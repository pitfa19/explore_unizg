// Logika rasporeda kolegija, čisti JS, radi u pregledniku (bez backenda).
// Port skripte kolegiji_dag/raspored.py (model "compress": lanac preduvjeta + sezona).
// Identitet čvora je id (faculty_id:šifra) kad postoji, inače naziv, da isti naziv
// na dvije sastavnice ne sruši graf. Stari JSON bez id-a i dalje radi po nazivu.
(function () {
  const PMF = (window.PMF = window.PMF || {});

  function fold(s) {
    return String(s || "")
      .replace(/đ/g, "dj")
      .replace(/Đ/g, "Dj")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase();
  }

  function courseKey(course) {
    if (!course) return "";
    if (course.id) return String(course.id);
    return String(course.naziv || "").trim();
  }

  function displayName(course, courses) {
    const name = String((course && course.naziv) || "").trim();
    if (!name) return "";
    const same = (courses || []).filter((c) => fold(c.naziv) === fold(name));
    if (same.length > 1 && course.fakultet) return `${name} (${course.fakultet})`;
    return name;
  }

  function prereqList(course) {
    return (course.preduvjeti || []).map((p) =>
      typeof p === "string" ? { kolegij: p, uvjet: "" } : { kolegij: p.kolegij, uvjet: p.uvjet || "" }
    );
  }

  function prereqNames(course) {
    return prereqList(course).map((p) => p.kolegij);
  }

  function sameFaculty(a, b) {
    if (!a || !b || a.faculty_id == null || b.faculty_id == null) return false;
    return String(a.faculty_id) === String(b.faculty_id);
  }

  function indexCourses(courses) {
    const byKey = new Map();
    const byFold = new Map();
    for (const course of courses) {
      const key = courseKey(course);
      if (!key) continue;
      if (!byKey.has(key)) byKey.set(key, course);
      const folded = fold(course.naziv);
      if (!byFold.has(folded)) byFold.set(folded, []);
      byFold.get(folded).push(course);
    }
    return { byKey, byFold };
  }

  // Referenca je ili id ili naziv. Više pogodaka istog naziva veže se samo unutar sastavnice.
  function matchPrereq(ref, owner, index) {
    if (!ref) return { error: "prazan" };
    if (index.byKey.has(ref)) return { key: ref };
    const hits = index.byFold.get(fold(ref)) || [];
    if (hits.length === 1) return { key: courseKey(hits[0]) };
    if (hits.length > 1) {
      const same = hits.filter((hit) => sameFaculty(hit, owner));
      if (same.length === 1) return { key: courseKey(same[0]) };
      return { error: "ambiguous" };
    }
    return { error: "missing" };
  }

  // Iz ISVU imena složi bridove prema onome što je u odabiru. Ručno dodani bridovi ostaju
  // ako i dalje pokazuju na kolegij u popisu. Vanjski preduvjeti se ne crtaju.
  function relink(courses) {
    const index = indexCourses(courses);
    let dropped = 0;
    const next = courses.map((course) => {
      if (!Array.isArray(course.izvor_preduvjeti)) return course;
      const auto = [];
      const autoKeys = new Set();
      for (const prereq of course.izvor_preduvjeti) {
        const ref = typeof prereq === "string" ? prereq : prereq.kolegij;
        const uvjet = typeof prereq === "string" ? "polozen" : prereq.uvjet === "odslusan" ? "odslusan" : "polozen";
        const match = matchPrereq(ref, course, index);
        if (match.key && match.key !== courseKey(course) && !autoKeys.has(match.key)) {
          autoKeys.add(match.key);
          auto.push({ kolegij: match.key, uvjet });
        } else if (!match.key) {
          dropped += 1;
        }
      }
      const kept = [];
      for (const prereq of prereqList(course)) {
        const match = matchPrereq(prereq.kolegij, course, index);
        if (!match.key || match.key === courseKey(course) || autoKeys.has(match.key)) continue;
        autoKeys.add(match.key);
        kept.push({ kolegij: match.key, uvjet: prereq.uvjet || "polozen" });
      }
      return { ...course, preduvjeti: [...auto, ...kept] };
    });
    return { courses: next, dropped };
  }

  function nominalSemester(course) {
    const g = Number(course.godina) || 1;
    return course.semestar === "zimski" ? 2 * g - 1 : 2 * g;
  }

  function semParity(sem) {
    return sem % 2 === 1 ? "zimski" : "ljetni";
  }

  function matchSeason(sem, course) {
    return semParity(sem) === (course.semestar === "zimski" ? "zimski" : "ljetni")
      ? sem
      : sem + 1;
  }

  function fail(error) {
    return { ok: false, error };
  }

  function emptyOk() {
    return {
      ok: true,
      earliest: new Map(),
      nodes: [],
      edges: [],
      perCourse: [],
      totalSemesters: 0,
      totalYears: 0,
      ectsPerSem: {},
      totalEcts: 0,
    };
  }

  function computeSchedule(courses) {
    if (!Array.isArray(courses) || courses.length === 0) return emptyOk();

    const byKey = new Map();
    for (const course of courses) {
      const naziv = (course.naziv || "").trim();
      const key = courseKey(course);
      if (!naziv || !key) return fail("Postoji kolegij bez naziva.");
      if (byKey.has(key)) return fail(`Dvostruki kolegij: "${displayName(course, courses) || naziv}".`);
      if (course.semestar !== "zimski" && course.semestar !== "ljetni")
        return fail(`"${naziv}": semestar mora biti "zimski" ili "ljetni".`);
      byKey.set(key, course);
    }
    const index = indexCourses(courses);

    const resolved = new Map();
    for (const course of courses) {
      const key = courseKey(course);
      const list = [];
      for (const prereq of prereqList(course)) {
        const match = matchPrereq(prereq.kolegij, course, index);
        if (match.error === "ambiguous") {
          return fail(`"${course.naziv}": preduvjet "${prereq.kolegij}" odgovara više kolegija. Odaberi točan u uređivaču.`);
        }
        if (!match.key) return fail(`"${course.naziv}": nepoznat preduvjet "${prereq.kolegij}".`);
        if (match.key === key) return fail(`"${course.naziv}": kolegij ne može biti sam sebi preduvjet.`);
        list.push({ kolegij: match.key, uvjet: prereq.uvjet });
      }
      resolved.set(key, list);
    }

    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map();
    courses.forEach((course) => color.set(courseKey(course), WHITE));
    const earliest = new Map();
    const stack = [];
    let cycleError = null;

    function dfs(key) {
      color.set(key, GRAY);
      stack.push(key);
      let m = 0;
      for (const prereq of resolved.get(key) || []) {
        const pn = prereq.kolegij;
        if (color.get(pn) === GRAY) {
          const idx = stack.indexOf(pn);
          cycleError = "Ciklus u preduvjetima: " + stack.slice(idx).concat(pn).join(" → ");
          throw new Error("cycle");
        }
        if (color.get(pn) === WHITE) dfs(pn);
        m = Math.max(m, earliest.get(pn));
      }
      const cur = byKey.get(key);
      let sem = matchSeason(m + 1, cur);
      const pin = Number(cur.pin);
      if (Number.isFinite(pin) && pin >= sem) sem = matchSeason(pin, cur);
      earliest.set(key, sem);
      stack.pop();
      color.set(key, BLACK);
    }

    try {
      for (const course of courses) {
        const key = courseKey(course);
        if (color.get(key) === WHITE) dfs(key);
      }
    } catch (e) {
      return fail(cycleError || String(e.message || e));
    }

    const edges = [];
    for (const course of courses) {
      const key = courseKey(course);
      for (const prereq of resolved.get(key) || []) {
        edges.push({
          id: `${prereq.kolegij}__${key}`,
          source: prereq.kolegij,
          target: key,
          uvjet: prereq.uvjet,
        });
      }
    }

    const perCourse = courses
      .map((course) => {
        const key = courseKey(course);
        const s = earliest.get(key);
        return {
          key,
          naziv: displayName(course, courses) || course.naziv,
          earliest: s,
          godina: Math.ceil(s / 2),
          parity: semParity(s),
          plan: nominalSemester(course),
          status: course.status || "",
          ects: Number(course.ects) || 0,
          preduvjeti: resolved.get(key) || [],
        };
      })
      .sort((a, b) => a.earliest - b.earliest || a.naziv.localeCompare(b.naziv, "hr"));

    const totalSemesters = Math.max(...earliest.values());
    const totalYears = Math.ceil(totalSemesters / 2);

    const ectsPerSem = {};
    for (const pc of perCourse) ectsPerSem[pc.earliest] = (ectsPerSem[pc.earliest] || 0) + pc.ects;

    const nodes = courses.map((course) => ({
      naziv: courseKey(course),
      semestar: earliest.get(courseKey(course)),
    }));
    const totalEcts = courses.reduce((sum, course) => sum + (Number(course.ects) || 0), 0);

    return { ok: true, earliest, nodes, edges, perCourse, totalSemesters, totalYears, ectsPerSem, totalEcts };
  }

  function ancestorsOf(key, courses) {
    const byKey = new Map(courses.map((course) => [courseKey(course), course]));
    const seen = new Set();
    const stack = [key];
    while (stack.length) {
      const cur = stack.pop();
      for (const pn of prereqNames(byKey.get(cur) || {})) {
        if (!seen.has(pn)) {
          seen.add(pn);
          stack.push(pn);
        }
      }
    }
    return seen;
  }

  function descendantsOf(key, courses) {
    const children = new Map();
    for (const course of courses) {
      for (const pn of prereqNames(course)) {
        if (!children.has(pn)) children.set(pn, []);
        children.get(pn).push(courseKey(course));
      }
    }
    const seen = new Set();
    const stack = [key];
    while (stack.length) {
      const cur = stack.pop();
      for (const child of children.get(cur) || []) {
        if (!seen.has(child)) {
          seen.add(child);
          stack.push(child);
        }
      }
    }
    return seen;
  }

  PMF.schedule = {
    fold,
    courseKey,
    displayName,
    relink,
    prereqList,
    prereqNames,
    nominalSemester,
    semParity,
    computeSchedule,
    ancestorsOf,
    descendantsOf,
  };
})();
