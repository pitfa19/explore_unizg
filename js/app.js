// Bootstrap: jedinstveno stanje, orkestracija prikaza, alatna traka. Učitava se zadnji.
(function () {
  const PMF = (window.PMF = window.PMF || {});

  const state = { courses: [], droppedPrereqs: 0, frame: null };
  const listeners = [];

  const $ = (id) => document.getElementById(id);
  let editorEl, graphEl, resultsEl, countEl;

  const emptyCourse = () => ({
    naziv: "",
    semestar: "zimski",
    godina: 1,
    status: "obavezni",
    ects: 0,
    preduvjeti: [],
  });

  function save() {
    PMF.store.save(state.courses);
  }

  function notify() {
    for (const fn of listeners) {
      try { fn(state.courses, state.droppedPrereqs); } catch (err) { /* slušatelj ne smije srušiti graf */ }
    }
  }

  function relinkSelection() {
    const linked = PMF.schedule.relink(state.courses);
    state.courses = linked.courses;
    state.droppedPrereqs = linked.dropped;
  }

  function renderDerived() {
    const span = state.frame ? { from: state.frame.from, to: state.frame.to } : null;
    const schedule = PMF.schedule.computeSchedule(state.courses, { span });
    PMF.graph.render(graphEl, schedule, state.courses, {
      onPin,
      slots: state.frame ? state.frame.slots : [],
      unrecorded: state.frame ? state.frame.unrecorded : [],
    });
    PMF.results.render(resultsEl, schedule);
    if (countEl) countEl.textContent = String(state.courses.length);
    const droppedEl = document.getElementById("dropped-prereqs");
    if (droppedEl) {
      droppedEl.hidden = !state.droppedPrereqs;
      droppedEl.textContent = state.droppedPrereqs
        ? `${state.droppedPrereqs} preduvjeta iz ISVU-a nije u odabiru, pa nisu nacrtani.`
        : "";
    }
    notify();
  }

  // Fiksiraj kolegij (bez preduvjeta) u zadani semestar; sem == null => automatski (najraniji).
  function onPin(naziv, sem) {
    const i = state.courses.findIndex((c) => PMF.schedule.courseKey(c) === naziv);
    if (i < 0) return;
    if (sem == null) {
      const next = { ...state.courses[i] };
      delete next.pin;
      state.courses[i] = next;
    } else {
      state.courses[i] = { ...state.courses[i], pin: sem };
    }
    save();
    renderDerived();
  }

  // Sažmi više izmjena vrijednosti unutar jednog frame-a (npr. tipkanje naziva).
  let rafPending = false;
  function scheduleDerived() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      renderDerived();
    });
  }

  function rebuildEditor(opts) {
    PMF.editor.render(editorEl, state.courses, handlers, opts);
  }

  const handlers = {
    // izmjena vrijednosti polja, ne rušimo uređivač (fokus ostaje)
    onValueEdit(i, patch) {
      const next = { ...state.courses[i], ...patch };
      if (state.courses[i].planSem && (patch.godina != null || patch.semestar)) {
        next.planSem = PMF.schedule.nominalSemester(next);
      }
      state.courses[i] = next;
      save();
      scheduleDerived();
    },
    onPrereqValueEdit(i, pi, patch) {
      const c = state.courses[i];
      const list = (c.preduvjeti || []).map((pr, idx) => {
        const base = typeof pr === "string" ? { kolegij: pr, uvjet: "" } : pr;
        return idx === pi ? { ...base, ...patch } : base;
      });
      state.courses[i] = { ...c, preduvjeti: list };
      save();
      scheduleDerived();
    },

    // strukturne promjene, grade uređivač nanovo
    addCourse() {
      state.courses = [...state.courses, emptyCourse()];
      save();
      rebuildEditor({ openIndex: state.courses.length - 1 });
      renderDerived();
    },
    removeCourse(i) {
      state.courses = state.courses.filter((_, idx) => idx !== i);
      relinkSelection();
      save();
      rebuildEditor();
      renderDerived();
    },
    addPrereq(i) {
      const c = state.courses[i];
      const options = state.courses.filter((_, idx) => idx !== i).map((x) => PMF.schedule.courseKey(x)).filter(Boolean);
      const already = new Set((c.preduvjeti || []).map((p) => (typeof p === "string" ? p : p.kolegij)));
      const first = options.find((o) => !already.has(o)) || "";
      state.courses[i] = { ...c, preduvjeti: [...(c.preduvjeti || []), { kolegij: first, uvjet: "polozen" }] };
      save();
      rebuildEditor();
      renderDerived();
    },
    removePrereq(i, pi) {
      const c = state.courses[i];
      state.courses[i] = { ...c, preduvjeti: (c.preduvjeti || []).filter((_, idx) => idx !== pi) };
      save();
      rebuildEditor();
      renderDerived();
    },
  };

  // ── alatna traka ──
  function doExport() {
    const blob = new Blob([JSON.stringify({ kolegiji: state.courses }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kolegiji.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Zajednički put za uvoz iz datoteke i iz zalijepljenog teksta.
  function loadFromText(text) {
    state.courses = PMF.store.normalizeImported(JSON.parse(text));
    state.frame = null;
    PMF.store.saveFrame(null);
    relinkSelection();
    save();
    rebuildEditor({ resetOpen: true });
    renderDerived();
    PMF.ui.toast(`Uvezeno ${state.courses.length} kolegija.`, "success");
  }

  async function doImport(file, inputEl) {
    try {
      loadFromText(await file.text());
    } catch (err) {
      PMF.ui.toast(`Greška pri uvozu: ${err.message}`, "error");
    } finally {
      if (inputEl) inputEl.value = "";
    }
  }

  function togglePaste(show) {
    const box = $("paste-box");
    box.hidden = !show;
    if (show) $("paste-json").focus();
    else $("paste-json").value = "";
  }

  function doPaste() {
    const raw = $("paste-json").value.trim();
    if (!raw) return PMF.ui.toast("Prazno polje: zalijepi JSON.", "error");
    try {
      loadFromText(raw);
      togglePaste(false);
    } catch (err) {
      PMF.ui.toast(`Greška pri uvozu: ${err.message}`, "error");
    }
  }

  function doReset() {
    state.courses = PMF.store.reset();
    state.frame = null;
    rebuildEditor({ resetOpen: true });
    renderDerived();
    PMF.ui.toast("Vraćeno na zadani popis.", "info");
  }

  function wireToolbar() {
    $("btn-export").addEventListener("click", doExport);
    const fileInput = $("file-import");
    $("btn-import").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) doImport(file, fileInput);
    });
    $("btn-paste").addEventListener("click", () => togglePaste($("paste-box").hidden));
    $("btn-paste-load").addEventListener("click", doPaste);
    $("btn-paste-cancel").addEventListener("click", () => togglePaste(false));
    $("paste-json").addEventListener("keydown", (e) => {
      if (e.key === "Escape") togglePaste(false);
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) doPaste();
    });
    $("btn-reset").addEventListener("click", doReset);
  }

  function replaceCourses(list, message, frame) {
    state.courses = list;
    state.frame = frame || null;
    PMF.store.saveFrame(state.frame);
    relinkSelection();
    save();
    rebuildEditor({ resetOpen: true });
    renderDerived();
    if (message) PMF.ui.toast(message, "success");
  }

  function addCatalogCourse(course) {
    const key = course.id || PMF.schedule.courseKey(course);
    if (state.courses.some((c) => PMF.schedule.courseKey(c) === key)) {
      PMF.ui.toast("Kolegij je već u odabiru.", "info");
      return false;
    }
    state.courses = [...state.courses, course];
    relinkSelection();
    save();
    rebuildEditor();
    renderDerived();
    PMF.ui.toast(`Dodano: ${course.naziv}`, "success");
    return true;
  }

  function boot() {
    editorEl = $("editor");
    graphEl = $("graph");
    resultsEl = $("results");
    countEl = $("course-count");

    state.courses = PMF.store.load();
    state.frame = PMF.store.loadFrame();
    relinkSelection();
    rebuildEditor();
    renderDerived();
    wireToolbar();
  }

  PMF.app = {
    getCourses() { return state.courses; },
    getDropped() { return state.droppedPrereqs; },
    subscribe(fn) { listeners.push(fn); fn(state.courses, state.droppedPrereqs); },
    replaceCourses,
    addCatalogCourse,
    removeAt(index) { handlers.removeCourse(index); },
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
