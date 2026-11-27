// Prikaz DAG-a preduvjeta u D3/SVG. Statičan raspored po stupcima (semestrima),
// s godišnjim pojasom na vrhu. Kolegiji bez preduvjeta mogu se povući u kasniji semestar.
(function () {
  const PMF = (window.PMF = window.PMF || {});
  const SVGNS = "http://www.w3.org/2000/svg";
  const XHTML = "http://www.w3.org/1999/xhtml";

  // Geometrija (SVG korisničke jedinice; cijeli se SVG skalira preko CSS-a).
  const CARD_W = 188;
  const COL_GAP = 92;
  const ROW_GAP = 30;
  const PAD_L = 28;
  const PAD_R = 28;
  const PAD_B = 22;
  const CARD_PAD_X = 12;
  const CARD_PAD_DRAG = 20;
  const CARD_PAD_Y = 8;
  const CARD_GAP = 3;
  const CARD_BORDER = 1;
  const MAX_TITLE_LINES = 2;
  const YEAR_TOP = 8;
  const YEAR_H = 18;
  const HEAD_TOP = YEAR_TOP + YEAR_H + 10; // = 36
  const HEAD_H = 24;
  const HEAD_GAP = 14;
  const NODES_TOP = HEAD_TOP + HEAD_H + HEAD_GAP; // = 74
  const PORT_GAP = 12;

  function svgEl(tag, attrs) {
    const e = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function htmlEl(tag, cls) {
    const e = document.createElementNS(XHTML, tag);
    if (cls) e.setAttribute("class", cls);
    return e;
  }
  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }
  const parityTag = (s) => (s % 2 === 1 ? "Z" : "Lj");
  const colXof = (s, first) => PAD_L + (s - (first || 1)) * (CARD_W + COL_GAP);

  function formatEcts(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    return String(Math.round(n * 10) / 10).replace(/\.0$/, "");
  }

  function slotText(slot) {
    const name = (slot.naziv && String(slot.naziv).trim()) || "Izborni kolegiji";
    const count = (slot.predmeti || []).length;
    let meta;
    if (slot.min_ects != null && slot.min_ects !== "" && Number.isFinite(Number(slot.min_ects))) {
      meta = `min ${formatEcts(slot.min_ects)} ECTS`;
    } else if (slot.opis) {
      meta = String(slot.opis);
    } else {
      meta = "izborna grupa";
    }
    if (count) meta += ` · ${count}`;
    return { name, meta };
  }

  // Širina naslova unutar kartice. Povlačive kartice imaju ručicu desno.
  function nameInnerWidth(draggable) {
    const padR = draggable ? CARD_PAD_DRAG : CARD_PAD_X;
    return Math.max(48, CARD_W - CARD_BORDER * 2 - CARD_PAD_X - padR - 2);
  }

  let nameProbe = null;
  let metaProbe = null;
  let linePx = 16.25;
  let metaPx = 12;

  function resetProbes() {
    if (nameProbe && nameProbe.parentNode) nameProbe.parentNode.remove();
    nameProbe = null;
    metaProbe = null;
  }

  function ensureProbes() {
    if (nameProbe) return;
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:absolute;left:-10000px;top:0;visibility:hidden;pointer-events:none;width:400px;";
    nameProbe = document.createElement("div");
    metaProbe = document.createElement("div");
    // Ista tipografija kao .node__name / .node__meta, bez line-clampa, da scrollHeight
    // kaže koliko redaka naslov stvarno zauzima.
    nameProbe.style.cssText = "display:block;box-sizing:border-box;width:400px;font-family:var(--sans);font-weight:600;font-size:0.8125rem;line-height:1.25;overflow-wrap:break-word;white-space:normal;";
    metaProbe.style.cssText = "display:block;box-sizing:border-box;width:400px;font-family:var(--mono);font-weight:400;font-size:0.625rem;line-height:1.2;white-space:nowrap;";
    host.append(nameProbe, metaProbe);
    document.body.appendChild(host);
    nameProbe.textContent = "Mg";
    linePx = nameProbe.getBoundingClientRect().height || linePx;
    metaProbe.textContent = "FER · 1. · 5 ECTS · Z";
    metaPx = metaProbe.getBoundingClientRect().height || metaPx;
  }

  function titleFits(text, width, weight) {
    nameProbe.style.width = width + "px";
    nameProbe.style.fontWeight = weight;
    nameProbe.textContent = text;
    return nameProbe.scrollHeight <= linePx * MAX_TITLE_LINES + 1;
  }

  // Naslov stane u najviše dva retka. Dulji se reže na granici riječi i dobije trotočku.
  function measureTitle(text, width, weight) {
    ensureProbes();
    const raw = String(text || "").replace(/\s+/g, " ").trim();
    if (!raw) return { text: "", lines: 1, truncated: false, nameHeight: linePx };
    if (titleFits(raw, width, weight)) {
      const lines = Math.max(1, Math.round(nameProbe.scrollHeight / linePx));
      return { text: raw, lines: Math.min(lines, MAX_TITLE_LINES), truncated: false, nameHeight: nameProbe.scrollHeight };
    }
    let lo = 1;
    let hi = raw.length;
    let best = 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const candidate = raw.slice(0, mid).trimEnd() + "…";
      if (titleFits(candidate, width, weight)) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    let cut = raw.slice(0, best).trimEnd();
    const space = cut.lastIndexOf(" ");
    if (space >= 8) {
      const wordy = cut.slice(0, space).trimEnd();
      if (wordy && titleFits(wordy + "…", width, weight)) cut = wordy;
    }
    const shown = cut + "…";
    titleFits(shown, width, weight);
    return { text: shown, lines: MAX_TITLE_LINES, truncated: true, nameHeight: nameProbe.scrollHeight };
  }

  function cardHeight(nameHeight) {
    const nameH = Math.min(nameHeight || linePx, linePx * MAX_TITLE_LINES + 1);
    return Math.ceil(CARD_PAD_Y * 2 + nameH + CARD_GAP + metaPx + CARD_BORDER * 2 + 2);
  }

  // Vodoravni kubični brid (isto što i d3.linkHorizontal): kontrolne točke na pola puta.
  function linkPath(x0, y0, x1, y1) {
    const mx = (x0 + x1) / 2;
    return `M${x0},${y0}C${mx},${y0},${mx},${y1},${x1},${y1}`;
  }

  // Suptilna tinta zaglavlja stupca ovisno o dubini semestra.
  function semTint(t) {
    const pale = [0xf2, 0xf2, 0xf2];
    const deep = [0xdc, 0xdc, 0xdc];
    const c = pale.map((v, i) => Math.round(v * (1 - t) + deep[i] * t));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  function renderEmpty(mount) {
    const box = document.createElement("div");
    box.className = "graph__note";
    box.textContent = "Nema kolegija za prikaz. Pretraži katalog i dodaj kolegij, ili učitaj obavezne kolegije studija.";
    mount.appendChild(box);
  }

  function renderError(mount, message) {
    const box = document.createElement("div");
    box.className = "callout callout--error";
    const h = document.createElement("h3");
    h.className = "callout__title";
    h.textContent = "Ne mogu izračunati raspored";
    const p = document.createElement("p");
    p.className = "callout__body";
    p.textContent = message || "Provjeri preduvjete i semestre kolegija.";
    box.append(h, p);
    mount.appendChild(box);
  }

  function layout(schedule, courses, slots, dragIds) {
    const keyOf = (k) => PMF.schedule.courseKey(k);
    const bySem = new Map();
    for (const k of courses) {
      const id = keyOf(k);
      const s = schedule.earliest.get(id);
      if (!bySem.has(s)) bySem.set(s, []);
      bySem.get(s).push(id);
    }
    const statusOf = new Map(courses.map((k) => [keyOf(k), k.status || ""]));
    const ectsOf = new Map(courses.map((k) => [keyOf(k), Number(k.ects) || 0]));

    const labelOf = new Map(courses.map((k) => [keyOf(k), PMF.schedule.displayName(k, courses) || k.naziv]));
    const pos = {};
    const slotPos = [];
    const first = schedule.firstSemester || 1;
    const total = schedule.totalSemesters;
    const bySlot = new Map();
    for (const slot of slots || []) {
      const sem = Number(slot.semestar);
      if (!Number.isFinite(sem) || sem < first || sem > total) continue;
      if (!bySlot.has(sem)) bySlot.set(sem, []);
      bySlot.get(sem).push(slot);
    }
    let bottom = NODES_TOP;
    for (let s = first; s <= total; s++) {
      const names = (bySem.get(s) || []).slice().sort((a, b) =>
        (labelOf.get(a) || a).localeCompare(labelOf.get(b) || b, "hr"));
      const here = bySlot.get(s) || [];
      const colX = colXof(s, first);
      let y = NODES_TOP;
      for (const n of names) {
        const drag = !!(dragIds && dragIds.has(n));
        const full = labelOf.get(n) || n;
        const measured = measureTitle(full, nameInnerWidth(drag), "600");
        const h = cardHeight(measured.nameHeight);
        pos[n] = {
          x: colX, y, h, cy: y + h / 2, sem: s,
          status: statusOf.get(n) || "", ects: ectsOf.get(n) || 0,
          title: measured.text, full, truncated: measured.truncated,
        };
        y += h + ROW_GAP;
      }
      for (const slot of here) {
        const text = slotText(slot);
        const measured = measureTitle(text.name, nameInnerWidth(false), "500");
        const h = cardHeight(measured.nameHeight);
        slotPos.push({
          slot, x: colX, y, h, cy: y + h / 2, sem: s,
          title: measured.text, full: text.name, meta: text.meta, truncated: measured.truncated,
        });
        y += h + ROW_GAP;
      }
      if (names.length || here.length) bottom = Math.max(bottom, y);
    }
    const count = Math.max(0, total - first + 1);
    const width = count ? PAD_L + count * (CARD_W + COL_GAP) - COL_GAP + PAD_R : 320;
    const height = bottom > NODES_TOP
      ? bottom - ROW_GAP + PAD_B
      : NODES_TOP + 28 + PAD_B;
    return { pos, width, height, total, first, slotPos };
  }

  function render(mount, schedule, courses, opts) {
    clear(mount);
    if (!schedule || !schedule.ok) return renderError(mount, schedule && schedule.error);
    if (!schedule.totalSemesters) return renderEmpty(mount);

    const onPin = opts && opts.onPin;
    const unrecorded = new Set((opts && opts.unrecorded || []).map(Number));
    const keyOf = (k) => PMF.schedule.courseKey(k);
    const noPrereq = new Set(courses.filter((k) => PMF.schedule.prereqNames(k).length === 0).map(keyOf));
    const dragIds = onPin ? noPrereq : new Set();
    const { pos, width, height, total, first, slotPos } = layout(schedule, courses, opts && opts.slots, dragIds);

    const svg = svgEl("svg", {
      class: "graph__svg",
      width: String(width),
      height: String(height),
      viewBox: `0 0 ${width} ${height}`,
      preserveAspectRatio: "xMidYMid meet",
      role: "img",
      "aria-label": "Graf preduvjeta kolegija po semestrima i godinama",
    });

    const defs = svgEl("defs");
    const marker = svgEl("marker", {
      id: "pmf-arrow", viewBox: "0 0 8 8", refX: "7.5", refY: "4",
      markerWidth: "8", markerHeight: "8", markerUnits: "userSpaceOnUse", orient: "auto",
    });
    marker.appendChild(svgEl("path", { d: "M0,0 L8,4 L0,8 Z", class: "graph__arrow" }));
    defs.appendChild(marker);
    svg.appendChild(defs);

    // ── godišnji pojas (grupira semestre u godine) ──
    const gYears = svgEl("g", { class: "graph__years" });
    const groups = [];
    for (let s = first; s <= total; s++) {
      const y = Math.ceil(s / 2);
      const last = groups[groups.length - 1];
      if (!last || last.year !== y) groups.push({ year: y, first: s, last: s });
      else last.last = s;
    }
    const ruleY = YEAR_TOP + YEAR_H;
    for (const g of groups) {
      const x0 = colXof(g.first, first);
      const x1 = colXof(g.last, first) + CARD_W;
      gYears.appendChild(svgEl("line", { x1: x0, y1: ruleY, x2: x1, y2: ruleY, class: "graph__year-rule" }));
      gYears.appendChild(svgEl("line", { x1: x0, y1: ruleY, x2: x0, y2: ruleY + 4, class: "graph__year-rule" }));
      gYears.appendChild(svgEl("line", { x1: x1, y1: ruleY, x2: x1, y2: ruleY + 4, class: "graph__year-rule" }));
      const label = svgEl("text", { x: (x0 + x1) / 2, y: YEAR_TOP + 6, "text-anchor": "middle", "dominant-baseline": "hanging", class: "graph__year-label" });
      label.textContent = `${g.year}. godina`;
      gYears.appendChild(label);
    }
    svg.appendChild(gYears);

    // ── zaglavlja stupaca (semestri) ──
    const gHeads = svgEl("g", { class: "graph__heads" });
    for (let s = first; s <= total; s++) {
      const colX = colXof(s, first);
      const t = total > 1 ? (s - 1) / (total - 1) : 0;
      gHeads.appendChild(svgEl("rect", { x: colX, y: HEAD_TOP, width: CARD_W, height: HEAD_H, rx: 3, fill: semTint(t) }));
      const cy = HEAD_TOP + HEAD_H / 2;
      const numT = svgEl("text", { x: colX + 10, y: cy, "dominant-baseline": "central", class: "graph__head-sem" });
      numT.textContent = s + ".";
      const parT = svgEl("text", { x: colX + CARD_W - 10, y: cy, "text-anchor": "end", "dominant-baseline": "central", class: "graph__head-par" });
      parT.textContent = parityTag(s);
      gHeads.append(numT, parT);
    }
    svg.appendChild(gHeads);

    const gTargets = svgEl("g", { class: "graph__targets" });
    const gEdges = svgEl("g", { class: "graph__edges" });
    const gNodes = svgEl("g", { class: "graph__nodes" });
    svg.append(gTargets, gEdges, gNodes);

    // ── port fan-out ──
    const outIdx = new Map();
    const inIdx = new Map();
    for (const e of schedule.edges) {
      if (!pos[e.source] || !pos[e.target]) continue;
      if (!outIdx.has(e.source)) outIdx.set(e.source, []);
      if (!inIdx.has(e.target)) inIdx.set(e.target, []);
      outIdx.get(e.source).push(e);
      inIdx.get(e.target).push(e);
    }
    outIdx.forEach((arr) => arr.sort((a, b) => pos[a.target].cy - pos[b.target].cy));
    inIdx.forEach((arr) => arr.sort((a, b) => pos[a.source].cy - pos[b.source].cy));

    const nodeEls = new Map();
    const slotEls = [];
    const edgeInfos = []; // { el, s, t }
    let pinned = null;
    const clampPort = (v, h) => {
      const maxPort = h / 2 - 8;
      return Math.max(-maxPort, Math.min(maxPort, v));
    };

    for (const e of schedule.edges) {
      const S = pos[e.source];
      const T = pos[e.target];
      if (!S || !T) continue;
      const outs = outIdx.get(e.source);
      const ins = inIdx.get(e.target);
      const sPort = clampPort((outs.indexOf(e) - (outs.length - 1) / 2) * PORT_GAP, S.h);
      const tPort = clampPort((ins.indexOf(e) - (ins.length - 1) / 2) * PORT_GAP, T.h);
      const d = linkPath(S.x + CARD_W, S.cy + sPort, T.x - 2.5, T.cy + tPort);
      const path = svgEl("path", { class: "edge", d, "marker-end": "url(#pmf-arrow)" });
      gEdges.appendChild(path);
      edgeInfos.push({ el: path, s: e.source, t: e.target });
    }

    // ── čvorovi (kartice) ──
    for (const k of courses) {
      const id = keyOf(k);
      const p = pos[id];
      if (!p) continue;
      const fo = svgEl("foreignObject", { x: String(p.x), y: String(p.y), width: String(CARD_W), height: String(p.h) });
      fo.style.overflow = "hidden";
      const draggable = dragIds.has(id);
      const card = htmlEl("div", "node" + (p.status === "izborni" ? " node--izborni" : "") + (draggable ? " node--draggable" : ""));
      card.setAttribute("data-naziv", id);
      const hint = "Povuci u kasniji semestar (ili natrag za automatski)";
      if (draggable && p.truncated) card.setAttribute("title", `${p.full} — ${hint}`);
      else if (draggable) card.setAttribute("title", hint);
      else if (p.truncated) card.setAttribute("title", p.full);
      const name = htmlEl("span", "node__name");
      name.textContent = p.title;
      const meta = htmlEl("span", "node__meta");
      const metaBits = [];
      if (k.fakultet) metaBits.push(k.fakultet);
      metaBits.push(`${p.sem}.`, `${p.ects} ECTS`, parityTag(p.sem));
      meta.textContent = metaBits.join(" · ");
      card.append(name, meta);
      card._course = k;
      fo.appendChild(card);
      gNodes.appendChild(fo);
      nodeEls.set(id, card);

      card.addEventListener("mouseenter", () => { if (!pinned) setHot(id, true); });
      card.addEventListener("mouseleave", () => { if (pinned !== id) setHot(id, false); });
      if (draggable) enableDrag(fo, card, k, p);
    }

    const occupied = new Set();
    for (const p of Object.values(pos)) occupied.add(p.sem);
    for (const sp of slotPos) {
      occupied.add(sp.sem);
      const fo = svgEl("foreignObject", { x: String(sp.x), y: String(sp.y), width: String(CARD_W), height: String(sp.h) });
      fo.style.overflow = "hidden";
      const card = htmlEl("div", "node node--slot");
      card.setAttribute("title", sp.truncated ? `${sp.full} — Popis kolegija u grupi` : "Popis kolegija u grupi");
      const name = htmlEl("span", "node__name");
      name.textContent = sp.title;
      const meta = htmlEl("span", "node__meta");
      meta.textContent = sp.meta;
      card.append(name, meta);
      card._slot = sp.slot;
      fo.appendChild(card);
      gNodes.appendChild(fo);
      slotEls.push(card);
    }
    for (let s = first; s <= total; s++) {
      if (occupied.has(s)) continue;
      const caption = svgEl("text", {
        x: colXof(s, first) + 10,
        y: NODES_TOP + 14,
        class: "graph__empty",
      });
      caption.textContent = unrecorded.has(s) ? "Nije evidentirano" : "Nema obaveznog kolegija";
      gNodes.appendChild(caption);
    }

    // Hover: istakni put (kolegij + svi njegovi preduvjeti i ovisnici), zatamni ostalo.
    function setHot(naziv, on) {
      if (!on) {
        svg.classList.remove("has-hover");
        for (const el of nodeEls.values()) el.classList.remove("node--hot", "node--adj", "node--dim");
        for (const el of slotEls) el.classList.remove("node--dim");
        for (const ei of edgeInfos) ei.el.classList.remove("edge--hot", "edge--dim");
        return;
      }
      // Ističemo samo preduvjete (uzvodni lanac), ne i kolegije koji ovise o ovome (nizvodno).
      // Bridovi su već razriješeni na id, pa lanac čitamo iz njih, a ne iz sirovih imena.
      const chain = new Set([naziv]);
      const pending = [naziv];
      while (pending.length) {
        const cur = pending.pop();
        for (const edge of schedule.edges) {
          if (edge.target === cur && !chain.has(edge.source)) {
            chain.add(edge.source);
            pending.push(edge.source);
          }
        }
      }
      svg.classList.add("has-hover");
      for (const [n, el] of nodeEls) {
        const inChain = chain.has(n);
        el.classList.toggle("node--dim", !inChain);
        el.classList.toggle("node--hot", n === naziv);
        el.classList.toggle("node--adj", inChain && n !== naziv);
      }
      for (const ei of edgeInfos) {
        // Cijeli lanac preduvjeta/ovisnika (i posredni) se ističe, ne samo izravni bridovi, // tako se vidi da su npr. Opća i Organska kemija (preko Biokemije) preduvjeti Mol. genetike.
        const inChain = chain.has(ei.s) && chain.has(ei.t);
        ei.el.classList.toggle("edge--hot", inChain);
        ei.el.classList.toggle("edge--dim", !inChain);
      }
      for (const el of slotEls) el.classList.add("node--dim");
    }

    // ── povlačenje (drag) kolegija bez preduvjeta u drugi semestar ──
    const svgScale = () => {
      const r = svg.getBoundingClientRect();
      return r.width ? width / r.width : 1;
    };
    // Samo semestri u sezoni kolegija: ljetni kolegij ne može u neparni semestar.
    function validColumns(base, course) {
      const wantOdd = course.semestar !== "ljetni";
      const cols = [];
      for (let s = base; s <= total; s++) {
        if ((s % 2 === 1) === wantOdd) cols.push({ sem: s, cx: colXof(s, first) + CARD_W / 2 });
      }
      return cols;
    }
    function nearestColumn(centerX, cols) {
      let best = cols[0];
      for (const c of cols) if (Math.abs(c.cx - centerX) < Math.abs(best.cx - centerX)) best = c;
      return best;
    }

    function enableDrag(fo, card, course, p) {
      // Bez preduvjeta: najraniji je prvi semestar sezone. Kolegij učitan iz
      // studija ne ide prije svog semestra u nastavnom programu.
      const seasonBase = course.semestar === "ljetni" ? 2 : 1;
      const plan = Number(course.planSem);
      const base = Number.isFinite(plan) && plan > seasonBase ? Math.floor(plan) : seasonBase;
      let dragging = false, startX = 0, startY = 0, cols = [];

      const showTargets = () => {
        clear(gTargets);
        const top = NODES_TOP - 8;
        const h = height - top - PAD_B + 8;
        for (const c of cols) {
          const r = svgEl("rect", { x: colXof(c.sem, first) - 8, y: top, width: CARD_W + 16, height: h, rx: 6, class: "target" });
          r.setAttribute("data-sem", String(c.sem));
          gTargets.appendChild(r);
        }
      };
      const markNearest = (centerX) => {
        const t = nearestColumn(centerX, cols);
        for (const r of gTargets.children) r.classList.toggle("target--on", Number(r.getAttribute("data-sem")) === t.sem);
      };

      card.addEventListener("pointerdown", (ev) => {
        if (ev.pointerType === "touch") return;
        if (ev.button != null && ev.button !== 0) return;
        ev.preventDefault();
        dragging = true;
        startX = ev.clientX;
        startY = ev.clientY;
        cols = validColumns(base, course);
        try { card.setPointerCapture(ev.pointerId); } catch (e) {}
        card.classList.add("node--dragging");
        svg.classList.add("is-dragging");
        gNodes.appendChild(fo); // podigni iznad ostalih
        showTargets();
        markNearest(p.x + CARD_W / 2);
      });
      card.addEventListener("pointermove", (ev) => {
        if (!dragging) return;
        const sc = svgScale();
        const nx = p.x + (ev.clientX - startX) * sc;
        const ny = p.y + (ev.clientY - startY) * sc;
        fo.setAttribute("x", String(nx));
        fo.setAttribute("y", String(ny));
        markNearest(nx + CARD_W / 2);
      });
      const end = (ev) => {
        if (!dragging) return;
        dragging = false;
        card.classList.remove("node--dragging");
        svg.classList.remove("is-dragging");
        clear(gTargets);
        const sc = svgScale();
        const nx = p.x + (ev.clientX - startX) * sc;
        const target = nearestColumn(nx + CARD_W / 2, cols);
        onPin(PMF.schedule.courseKey(course), target.sem <= base ? null : target.sem);
      };
      card.addEventListener("pointerup", end);
      card.addEventListener("pointercancel", end);
    }

    const view = document.createElement("div");
    view.className = "graph__viewport";
    svg.style.width = width + "px";
    svg.style.height = height + "px";
    view.appendChild(svg);
    const detail = document.createElement("div");
    detail.className = "graph__detail";
    detail.hidden = true;
    mount.append(view, detail);

    const state = { x: 12, y: 8, s: 1 };
    const apply = () => {
      svg.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.s})`;
    };
    const clamp = () => {
      const vw = view.clientWidth || 320;
      const vh = view.clientHeight || 280;
      const sw = width * state.s;
      const sh = height * state.s;
      state.x = Math.min(16, Math.max(Math.min(16, vw - sw - 16), state.x));
      state.y = Math.min(12, Math.max(Math.min(12, vh - sh - 12), state.y));
    };
    const fit = () => {
      const vw = view.clientWidth || 320;
      const readable = Math.min(1, (vw * 0.78) / CARD_W);
      const fitAll = Math.min(vw / width, (view.clientHeight || 320) / height, 1);
      const textAtFit = 13 * fitAll;
      state.s = textAtFit >= 12 ? fitAll : readable;
      state.x = 12;
      state.y = 8;
      clamp();
      apply();
    };

    const showSlot = (slot) => {
      pinned = null;
      setHot("", false);
      detail.hidden = false;
      detail.replaceChildren();
      const text = slotText(slot);
      const title = document.createElement("p");
      title.className = "graph__detail-name";
      title.textContent = text.name;
      const meta = document.createElement("p");
      meta.className = "graph__detail-meta";
      const bits = [text.meta, `${Number(slot.semestar)}. semestar`];
      if (slot.opis && !text.meta.includes(slot.opis)) bits.push(slot.opis);
      meta.textContent = bits.join(" · ");
      detail.append(title, meta);
      const reportSlot = () => {
        if (!PMF.feedback) return;
        detail.appendChild(PMF.feedback.link({
          section: "graph",
          course: { grupa: text.name, semestar: Number(slot.semestar) || null },
        }));
      };
      const options = slot.predmeti || [];
      if (!options.length) {
        const pre = document.createElement("p");
        pre.className = "graph__detail-pre";
        pre.textContent = "ISVU u ovoj grupi nije naveo kolegije.";
        detail.appendChild(pre);
        reportSlot();
        return;
      }
      const list = document.createElement("ul");
      list.className = "graph__detail-list";
      for (const item of options) {
        const li = document.createElement("li");
        const ects = formatEcts(item.ects);
        li.textContent = ects ? `${item.naziv} · ${ects} ECTS` : (item.naziv || item.sifra || "Kolegij");
        list.appendChild(li);
      }
      detail.appendChild(list);
      reportSlot();
    };

    const showDetail = (card) => {
      if (!card) return;
      if (card._slot) return showSlot(card._slot);
      const course = card._course;
      if (!course) return;
      const id = keyOf(course);
      pinned = id;
      setHot(id, true);
      detail.hidden = false;
      detail.replaceChildren();
      const title = document.createElement("p");
      title.className = "graph__detail-name";
      title.textContent = PMF.schedule.displayName(course, courses) || course.naziv || "Kolegij";
      const meta = document.createElement("p");
      meta.className = "graph__detail-meta";
      const bits = [];
      if (course.fakultet) bits.push(course.fakultet);
      if (course.sifra) bits.push(String(course.sifra));
      bits.push(course.status === "izborni" ? "izborni" : "obavezni");
      bits.push(`${course.ects} ECTS`);
      bits.push(`${course.godina}. godina`);
      bits.push(course.semestar === "ljetni" ? "ljetni" : "zimski");
      meta.textContent = bits.join(" · ");
      const pre = document.createElement("p");
      pre.className = "graph__detail-pre";
      const names = (course.izvor_preduvjeti || course.preduvjeti || []).map((item) =>
        typeof item === "string" ? item : item.kolegij
      ).filter(Boolean);
      pre.textContent = names.length
        ? `Preduvjeti: ${names.join(", ")}`
        : "ISVU za ovaj kolegij nije objavio preduvjete za upis.";
      detail.append(title, meta, pre);
      if (PMF.feedback) {
        detail.appendChild(PMF.feedback.link({
          section: "graph",
          course: {
            id: course.id || id,
            naziv: course.naziv || "",
            sifra: course.sifra || "",
            fakultet: course.fakultet || "",
          },
        }));
      }
    };

    let gesture = null;
    let suppressClick = false;
    view.addEventListener("pointerdown", (ev) => {
      if (ev.pointerType === "mouse" && ev.button !== 0) return;
      if (ev.pointerType === "mouse" && ev.target.closest && ev.target.closest(".node--draggable")) return;
      gesture = {
        id: ev.pointerId, x: ev.clientX, y: ev.clientY,
        ox: state.x, oy: state.y, moved: false, pan: false,
      };
    });
    view.addEventListener("pointermove", (ev) => {
      if (!gesture || ev.pointerId !== gesture.id) return;
      const dx = ev.clientX - gesture.x;
      const dy = ev.clientY - gesture.y;
      if (!gesture.moved && Math.hypot(dx, dy) < 8) return;
      gesture.moved = true;
      if (!gesture.pan) {
        if (ev.pointerType === "touch" && Math.abs(dy) > Math.abs(dx)) {
          gesture = null;
          return;
        }
        gesture.pan = true;
      }
      state.x = gesture.ox + dx;
      state.y = gesture.oy + dy;
      clamp();
      apply();
    });
    const cardAt = (x, y) => {
      const hit = document.elementFromPoint(x, y);
      const direct = hit && hit.closest && hit.closest(".node");
      if (direct && (direct._course || direct._slot)) return direct;
      let found = null;
      for (const card of view.querySelectorAll(".node")) {
        const r = card.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) found = card;
      }
      return found && (found._course || found._slot) ? found : null;
    };
    view.addEventListener("pointerup", (ev) => {
      if (!gesture || ev.pointerId !== gesture.id) return;
      const was = gesture;
      gesture = null;
      if (was.moved) {
        suppressClick = true;
        return;
      }
      const card = cardAt(ev.clientX, ev.clientY);
      if (card) showDetail(card);
    });
    view.addEventListener("click", (ev) => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      const card = cardAt(ev.clientX, ev.clientY);
      if (card) showDetail(card);
    });
    view.addEventListener("pointercancel", () => { gesture = null; });

    const pinchMeasure = (ev) => {
      const a = ev.touches[0];
      const b = ev.touches[1];
      const rect = view.getBoundingClientRect();
      return {
        dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1,
        mx: (a.clientX + b.clientX) / 2 - rect.left,
        my: (a.clientY + b.clientY) / 2 - rect.top,
      };
    };
    let pinch = null;
    view.addEventListener("touchstart", (ev) => {
      if (ev.touches.length < 2) return;
      ev.preventDefault();
      const now = pinchMeasure(ev);
      pinch = { dist: now.dist, s: state.s, x: state.x, y: state.y, mx: now.mx, my: now.my };
    }, { passive: false });
    view.addEventListener("touchmove", (ev) => {
      if (ev.touches.length === 2 && pinch) {
        ev.preventDefault();
        const now = pinchMeasure(ev);
        const next = Math.min(2.6, Math.max(0.4, pinch.s * (now.dist / pinch.dist)));
        const k = next / pinch.s;
        state.s = next;
        state.x = pinch.mx - (pinch.mx - pinch.x) * k;
        state.y = pinch.my - (pinch.my - pinch.y) * k;
        clamp();
        apply();
        return;
      }
      if (gesture && gesture.pan) ev.preventDefault();
    }, { passive: false });
    view.addEventListener("touchend", () => { pinch = null; });
    view.addEventListener("touchcancel", () => { pinch = null; });

    fit();
    if (document.fonts && document.fonts.status !== "loaded" && !(opts && opts._fontPass)) {
      document.fonts.ready.then(() => {
        resetProbes();
        if (mount.isConnected) render(mount, schedule, courses, Object.assign({}, opts, { _fontPass: true }));
      });
    }
  }

  PMF.graph = { render };
})();
