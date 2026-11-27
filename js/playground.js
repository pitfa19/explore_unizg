// Instalacija MCP-a i graditelj odabira. Katalog dolazi s /api/catalog;
// stranica kolegija se traži tek kad se kolegij doda.
(function () {
  const PMF = (window.PMF = window.PMF || {});

  const $ = (id) => document.getElementById(id);
  let spine = null;
  let searchTimer = 0;
  let searchSeq = 0;

  function fold(value) {
    return PMF.schedule.fold(value);
  }

  async function copyText(text, button) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    const label = button.dataset.label || button.textContent;
    button.dataset.label = label;
    button.textContent = "✓";
    button.classList.add("is-done");
    button.setAttribute("aria-label", "Kopirano");
    clearTimeout(button._copyTimer);
    button._copyTimer = setTimeout(() => {
      button.textContent = label;
      button.classList.remove("is-done");
      button.removeAttribute("aria-label");
    }, 1600);
  }

  function wireCopy() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-copy-btn]");
      if (!button) return;
      const host = button.closest("[data-copy-host]");
      const node = host && host.querySelector("code, pre");
      const text = node ? node.innerText.trim() : "";
      if (text) copyText(text, button);
    });
  }

  function selectTab(tab) {
    const tabs = [...document.querySelectorAll("[role='tab']")];
    for (const item of tabs) {
      const on = item === tab;
      item.setAttribute("aria-selected", on ? "true" : "false");
      item.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(item.getAttribute("aria-controls"));
      if (panel) panel.hidden = !on;
    }
  }

  function wireHeroAgents() {
    document.querySelectorAll("[data-agent]").forEach((button) => {
      button.addEventListener("click", () => {
        const tab = document.getElementById(button.getAttribute("data-agent"));
        if (!tab) return;
        selectTab(tab);
        const install = document.getElementById("install");
        if (install) install.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function wireTabs() {
    const tabs = [...document.querySelectorAll("[role='tab']")];
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => selectTab(tab));
      tab.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
        tabs[next].focus();
        selectTab(tabs[next]);
      });
    });
  }

  function setStatus(text, busy) {
    const el = $("search-status");
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("is-busy", Boolean(busy));
  }

  function showSearchSkeleton(message) {
    const list = $("search-results");
    if (!list) return;
    if (!list.querySelector(".hit--skeleton")) {
      list.innerHTML = "";
      list.setAttribute("aria-busy", "true");
      const widths = ["skeleton--w1", "skeleton--w2", "skeleton--w3", "skeleton--w4"];
      for (let i = 0; i < 4; i++) {
        const item = document.createElement("li");
        item.className = "hit hit--skeleton";
        item.setAttribute("aria-hidden", "true");
        const text = document.createElement("div");
        const name = document.createElement("span");
        name.className = `skeleton ${widths[i]}`;
        const meta = document.createElement("span");
        meta.className = "skeleton skeleton--meta";
        text.append(name, meta);
        const button = document.createElement("span");
        button.className = "skeleton skeleton--btn";
        item.append(text, button);
        list.appendChild(item);
      }
    }
    setStatus(message, true);
  }

  function endSearchBusy() {
    const list = $("search-results");
    if (!list) return;
    list.removeAttribute("aria-busy");
    list.querySelectorAll(".hit--skeleton").forEach((item) => item.remove());
  }

  function setGraphBusy(on) {
    const graph = document.getElementById("graph");
    if (!graph) return;
    if (on) {
      graph.setAttribute("aria-busy", "true");
      if (!graph.querySelector(".graph-skeleton")) {
        const box = document.createElement("div");
        box.className = "graph-skeleton";
        box.setAttribute("aria-hidden", "true");
        for (let i = 0; i < 4; i++) box.appendChild(document.createElement("span"));
        graph.appendChild(box);
      }
      return;
    }
    graph.removeAttribute("aria-busy");
    const box = graph.querySelector(".graph-skeleton");
    if (box) box.remove();
  }

  function settleField(select) {
    if (!select) return;
    select.classList.remove("is-invalid", "is-shake");
  }

  function nudgeField(select, message) {
    setProgrammeStatus(message, "error");
    if (!select) return;
    select.classList.add("is-invalid");
    select.classList.remove("is-shake");
    void select.offsetWidth;
    select.classList.add("is-shake");
    select.addEventListener("animationend", () => select.classList.remove("is-shake"), { once: true });
    select.focus();
  }

  function facultySelect() {
    return $("faculty-filter");
  }

  function fillFaculties(institutions) {
    const select = facultySelect();
    if (!select || select.dataset.ready === "1") return;
    const current = select.value;
    select.innerHTML = "";
    const all = document.createElement("option");
    all.value = "";
    all.textContent = "Sve sastavnice";
    select.appendChild(all);
    for (const inst of institutions || []) {
      const option = document.createElement("option");
      option.value = String(inst.id);
      option.textContent = inst.grad && inst.grad !== "Zagreb" ? `${inst.naziv} (${inst.grad})` : inst.naziv;
      select.appendChild(option);
    }
    select.value = current;
    select.dataset.ready = "1";
  }

  function filterLocal(courses, query, facultyId) {
    const needle = fold(query);
    return courses.filter((course) => {
      if (facultyId && String(course.faculty_id) !== String(facultyId)) return false;
      if (!needle) return true;
      return fold(course.naziv).includes(needle) || fold(course.sifra).includes(needle);
    });
  }

  function facultyLabel(id) {
    const select = facultySelect();
    if (!select) return String(id);
    const option = [...select.options].find((item) => item.value === String(id));
    if (!option || !option.value) return String(id);
    const inst = (spine && spine.institutions || []).find((item) => String(item.id) === String(id));
    return (inst && inst.kratko) || option.textContent;
  }

  function renderHits(hits, total, query, facultyId) {
    const list = $("search-results");
    if (!list) return;
    const needle = fold(query);
    if (!spine && needle.length < 2) {
      showSearchSkeleton("Učitavam katalog. Možeš već tražiti: upiši barem dva slova.");
      return;
    }
    list.innerHTML = "";
    list.removeAttribute("aria-busy");
    if (spine && !needle && !facultyId) {
      const failed = (spine.coverage && spine.coverage.faculties_failed) || [];
      const gap = failed.length ? ` ${failed.length} sastavnica nije pročitana.` : "";
      setStatus(spine.count
        ? `Katalog ima ${spine.count} kolegija.${gap} Upiši naziv ili odaberi sastavnicu.`
        : "Katalog je prazan.");
      return;
    }
    if (!hits.length) {
      setStatus("Nema pogodaka. Pretraga je bez dijakritika.");
      return;
    }
    const shown = hits.slice(0, 40);
    setStatus(total > shown.length
      ? `Prikazano ${shown.length} od ${total} pogodaka. Suži upit ili odaberi sastavnicu.`
      : `${total} ${total === 1 ? "pogodak" : "pogodaka"}.`);
    for (const course of shown) {
      const item = document.createElement("li");
      item.className = "hit";
      const text = document.createElement("div");
      const name = document.createElement("div");
      name.className = "hit__name";
      name.textContent = course.naziv;
      const meta = document.createElement("div");
      meta.className = "hit__meta mono";
      meta.textContent = `${facultyLabel(course.faculty_id)} · ${course.sifra}`;
      text.append(name, meta);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn--ghost";
      button.textContent = "Dodaj";
      button.addEventListener("click", () => addHit(course, button));
      item.append(text, button);
      list.appendChild(item);
    }
  }

  async function addHit(course, button) {
    button.disabled = true;
    button.classList.add("is-loading");
    button.setAttribute("aria-busy", "true");
    button.setAttribute("aria-label", "Učitavam kolegij");
    try {
      const params = new URLSearchParams({
        op: "course",
        faculty_id: String(course.faculty_id),
        code: String(course.sifra),
      });
      const response = await fetch(`/api/catalog?${params}`);
      const detail = await response.json();
      if (!response.ok || detail.error) throw new Error(detail.error || "ISVU nije vratio kolegij.");
      const added = PMF.app.addCatalogCourse(detail);
      if (added && detail.napomena) PMF.ui.toast(detail.napomena, "info");
    } catch (err) {
      PMF.ui.toast(`Nisam dodao kolegij: ${err.message}`, "error");
    } finally {
      button.disabled = false;
      button.classList.remove("is-loading");
      button.removeAttribute("aria-busy");
      button.removeAttribute("aria-label");
    }
  }

  async function serverSearch(query, facultyId, seq) {
    const params = new URLSearchParams({ op: "search", q: query });
    if (facultyId) params.set("faculty_id", facultyId);
    showSearchSkeleton("Tražim u katalogu…");
    try {
      const response = await fetch(`/api/catalog?${params}`);
      const data = await response.json();
      if (seq !== searchSeq || spine) return;
      if (!response.ok || data.error) throw new Error(data.error || "Pretraga nije uspjela.");
      renderHits(data.courses || [], data.total_matches || 0, query, facultyId);
    } catch (err) {
      if (seq === searchSeq) {
        endSearchBusy();
        setStatus(err.message);
      }
    }
  }

  function runSearch() {
    const query = $("course-query").value.trim();
    const facultyId = facultySelect().value;
    if (spine) {
      const needle = fold(query);
      const hits = filterLocal(spine.courses, query, facultyId);
      hits.sort((a, b) => {
        const left = fold(a.naziv);
        const right = fold(b.naziv);
        const rank = (name) => (needle && name.startsWith(needle) ? 0 : 1);
        return rank(left) - rank(right) || left.localeCompare(right, "hr");
      });
      renderHits(hits, hits.length, query, facultyId);
      return;
    }
    if (fold(query).length < 2) {
      renderHits([], 0, query, facultyId);
      return;
    }
    const seq = ++searchSeq;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => serverSearch(query, facultyId, seq), 280);
  }

  function renderTray(courses) {
    const list = $("tray");
    const count = $("tray-count");
    if (count) count.textContent = courses.length ? `(${courses.length})` : "";
    if (!list) return;
    list.innerHTML = "";
    if (!courses.length) {
      const empty = document.createElement("li");
      empty.className = "tray__empty";
      empty.textContent = "Još nema kolegija. Dodaj iz pretrage ili učitaj studij.";
      list.appendChild(empty);
      return;
    }
    courses.forEach((course, index) => {
      const item = document.createElement("li");
      item.className = "chip";
      const label = document.createElement("span");
      label.textContent = PMF.schedule.displayName(course, courses) || course.naziv || "Bez naziva";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "chip__x";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Ukloni ${course.naziv || "kolegij"}`);
      remove.addEventListener("click", () => PMF.app.removeAt(index));
      item.append(label, remove);
      list.appendChild(item);
    });
  }

  function updateMobility(courses) {
    const hint = $("mobility-hint");
    if (!hint) return;
    const faculties = new Set(courses.map((course) => course.faculty_id).filter((id) => id != null && id !== ""));
    if (faculties.size < 2) {
      hint.hidden = true;
      hint.textContent = "";
      return;
    }
    hint.hidden = false;
    hint.textContent = "Odabir miješa sastavnice. To je horizontalna mobilnost: razina mora odgovarati i kolegij se ne smije već predavati na matičnom programu. Prosjek se ne traži, a pad ne ulazi u prosjek kod kuće. Obrazac, naknadu, rok i slobodna mjesta određuje fakultet.";
  }

  function setProgrammeStatus(text, kind) {
    const el = $("programme-status");
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("is-error", kind === "error");
    el.classList.toggle("is-busy", kind === "busy");
  }

  function selectedProgramme(select) {
    const option = select.options[select.selectedIndex];
    if (!option || option.value === "") return null;
    const razina = option.dataset.razina;
    const izvedba = option.dataset.izvedba;
    const smjer = option.dataset.smjer;
    if (razina == null || izvedba == null || smjer == null || razina === "" || smjer === "") return null;
    return { razina, izvedba, smjer, naziv: option.textContent };
  }

  async function loadProgrammes(facultyId) {
    const select = $("programme-select");
    const button = $("btn-load-programme");
    if (!select || !button) return;
    select.innerHTML = "";
    if (!facultyId) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Odaberi sastavnicu, pa studij";
      select.appendChild(option);
      select.disabled = true;
      setProgrammeStatus("");
      return;
    }
    select.disabled = false;
    select.setAttribute("aria-busy", "true");
    const waiting = document.createElement("option");
    waiting.value = "";
    waiting.textContent = "Učitavam studije…";
    select.appendChild(waiting);
    setProgrammeStatus("Dohvaćam popis studija…", "busy");
    try {
      const response = await fetch(`/api/catalog?op=programmes&faculty_id=${encodeURIComponent(facultyId)}`);
      let data = {};
      try { data = await response.json(); } catch (err) { data = {}; }
      if (!response.ok || data.error) throw new Error(data.error || "Popis studija nije stigao.");
      select.innerHTML = "";
      select.removeAttribute("aria-busy");
      const programmes = data.programmes || [];
      if (!programmes.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Nema objavljenog nastavnog programa";
        select.appendChild(option);
        select.disabled = false;
        setProgrammeStatus("ISVU za ovu sastavnicu nije vratio nastavni program.", "error");
        return;
      }
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Odaberi studij";
      select.appendChild(placeholder);
      for (const programme of programmes) {
        const option = document.createElement("option");
        option.value = `${programme.razina}|${programme.izvedba}|${programme.smjer}`;
        option.dataset.razina = String(programme.razina);
        option.dataset.izvedba = String(programme.izvedba);
        option.dataset.smjer = String(programme.smjer);
        const prefix = programme.kategorija ? `${programme.kategorija} — ` : "";
        option.textContent = prefix + (programme.naziv || "Studij");
        select.appendChild(option);
      }
      select.disabled = false;
      select.value = "";
      setProgrammeStatus(`${programmes.length} studija. Odaberi jedan i učitaj ga.`);
    } catch (err) {
      select.innerHTML = "";
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Studiji nisu učitani";
      select.appendChild(option);
      select.disabled = false;
      select.removeAttribute("aria-busy");
      setProgrammeStatus(err.message || "Popis studija nije stigao.", "error");
      PMF.ui.toast(err.message, "error");
    }
  }

  async function loadProgramme() {
    const faculty = facultySelect();
    const facultyId = faculty && faculty.value;
    const select = $("programme-select");
    const button = $("btn-load-programme");
    if (!button || !select) return;
    if (button.classList.contains("is-loading")) return;
    if (!facultyId) {
      nudgeField(faculty, "Prvo odaberi fakultet.");
      return;
    }
    settleField(faculty);
    const spec = selectedProgramme(select);
    if (!spec) {
      nudgeField(select, "Prvo odaberi studij.");
      return;
    }
    settleField(select);
    const current = PMF.app.getCourses();
    if (current.length && !window.confirm("Učitavanje studija zamjenjuje trenutni odabir.")) return;
    button.classList.add("is-loading");
    button.setAttribute("aria-busy", "true");
    setProgrammeStatus("Učitavam studij. Slažem graf čim stignu preduvjeti.", "busy");
    setGraphBusy(true);
    try {
      const params = new URLSearchParams({
        op: "dag",
        faculty_id: facultyId,
        razina: String(spec.razina),
        izvedba: String(spec.izvedba),
        smjer: String(spec.smjer),
      });
      const response = await fetch(`/api/catalog?${params}`);
      let data = {};
      try { data = await response.json(); } catch (err) { data = {}; }
      if (!response.ok || data.error) throw new Error(data.error || `Studij nije učitan (${response.status}).`);
      const list = data.kolegiji || [];
      if (!list.length) throw new Error("ISVU za ovaj studij nije vratio nijedan kolegij.");
      const notes = [`Učitano ${list.length} kolegija.`];
      if (data.merged_duplicates && data.merged_duplicates.length) {
        notes.push(`Spojeno dvostrukih naziva: ${data.merged_duplicates.length}.`);
      }
      if (data.dropped_prerequisites && data.dropped_prerequisites.length) {
        notes.push(`Preduvjeti izvan studija nisu nacrtani: ${data.dropped_prerequisites.length}.`);
      }
      setProgrammeStatus("Slažem graf…", "busy");
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      PMF.app.replaceCourses(list);
      setProgrammeStatus(notes.join(" "));
      setStatus("Studij je u odabiru. Graf računa preduvjete i ECTS, ne satnicu.");
      const graphHeading = document.getElementById("graph-heading");
      if (graphHeading) graphHeading.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      const message = err.message || "Studij nije učitan.";
      setProgrammeStatus(message, "error");
      setStatus("");
      PMF.ui.toast(message, "error");
    } finally {
      button.classList.remove("is-loading");
      button.removeAttribute("aria-busy");
      setGraphBusy(false);
    }
  }

  async function bootCatalog() {
    showSearchSkeleton("Učitavam katalog…");
    try {
      const response = await fetch("/api/catalog?op=institutions");
      const data = await response.json();
      if (response.ok) fillFaculties(data.institutions);
    } catch (err) {
      setStatus("Popis sastavnica nije stigao. Pretraga i dalje radi čim katalog stigne.");
    }
    try {
      const response = await fetch("/api/catalog?op=spine");
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || "Katalog nije stigao.");
      spine = data;
      fillFaculties(data.institutions);
      const failed = (data.coverage && data.coverage.faculties_failed) || [];
      if (failed.length) {
        setStatus(`Katalog: ${data.count} kolegija. ${failed.length} sastavnica nije pročitana, pa popis nije potpun.`);
      }
      runSearch();
    } catch (err) {
      setStatus(`${err.message} Možeš tražiti po nazivu i prije nego katalog stigne.`);
    }
  }

  function boot() {
    wireCopy();
    wireTabs();
    wireHeroAgents();
    const query = $("course-query");
    const faculty = facultySelect();
    if (query) query.addEventListener("input", runSearch);
    if (faculty) {
      faculty.addEventListener("change", () => {
        if (faculty.value) settleField(faculty);
        runSearch();
        loadProgrammes(faculty.value);
      });
    }
    const programmeSelect = $("programme-select");
    if (programmeSelect) {
      programmeSelect.addEventListener("change", () => {
        if (selectedProgramme(programmeSelect)) settleField(programmeSelect);
      });
    }
    const loadBtn = $("btn-load-programme");
    if (loadBtn) loadBtn.addEventListener("click", loadProgramme);
    if (PMF.app) {
      PMF.app.subscribe((courses) => {
        renderTray(courses);
        updateMobility(courses);
      });
    }
    bootCatalog();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
