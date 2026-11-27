// Identitet kolegija: stari popis po nazivu i dva ista naziva s različitih sastavnica.
const fs = require("fs");
const vm = require("vm");
const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("js/schedule.js", "utf8"), sandbox);
const S = sandbox.PMF.schedule;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const classic = S.computeSchedule([
  { naziv: "Biologija stanice", semestar: "zimski", godina: 1, status: "obavezni", ects: 8, preduvjeti: [] },
  {
    naziv: "Genetika", semestar: "ljetni", godina: 2, status: "obavezni", ects: 9,
    preduvjeti: [{ kolegij: "Biologija stanice", uvjet: "polozen" }],
  },
]);
assert(classic.ok, classic.error || "classic schedule failed");
assert(classic.earliest.get("Biologija stanice") === 1, "Biologija is semester 1");
assert(classic.earliest.get("Genetika") === 2, "Genetika is the next ljetni semester after its prereq");
assert(classic.edges[0].source === "Biologija stanice" && classic.edges[0].target === "Genetika", "edge keys stay names");

const mixed = [
  {
    id: "36:1", faculty_id: 36, sifra: "1", fakultet: "FER", naziv: "Matematika",
    semestar: "zimski", godina: 1, status: "obavezni", ects: 7,
    izvor_preduvjeti: [], preduvjeti: [],
  },
  {
    id: "119:2", faculty_id: 119, sifra: "2", fakultet: "PMF", naziv: "Matematika",
    semestar: "zimski", godina: 1, status: "obavezni", ects: 8,
    izvor_preduvjeti: [], preduvjeti: [],
  },
  {
    id: "36:3", faculty_id: 36, sifra: "3", fakultet: "FER", naziv: "Fizika",
    semestar: "ljetni", godina: 1, status: "obavezni", ects: 6,
    izvor_preduvjeti: [{ kolegij: "Matematika", uvjet: "polozen" }, { kolegij: "Kemija", uvjet: "polozen" }],
    preduvjeti: [],
  },
];
const linked = S.relink(mixed);
assert(linked.dropped === 1, "Kemija is outside the selection");
const fizika = linked.courses.find((c) => c.id === "36:3");
assert(fizika.preduvjeti.length === 1 && fizika.preduvjeti[0].kolegij === "36:1", "FER Fizika links to FER Matematika");
const scheduled = S.computeSchedule(linked.courses);
assert(scheduled.ok, scheduled.error || "mixed schedule failed");
assert(scheduled.earliest.get("36:3") === 2, "Fizika waits for Matematika and stays in ljetni");
assert(S.displayName(mixed[0], mixed).includes("FER"), "duplicate names show the faculty");
assert(S.fold("Računarstvo") === "racunarstvo", "fold drops diacritics");

// A two-year programme whose second year is a thesis must keep that semester.
// Without planSem the compress model pulls every ljetni course into semester 2.
const dataScience = [
  { naziv: "Uvod u znanost o podacima", semestar: "zimski", godina: 1, status: "obavezni", ects: 5, planSem: 1, preduvjeti: [] },
  { naziv: "Prezentacijski seminar", semestar: "ljetni", godina: 1, status: "obavezni", ects: 3, planSem: 2, preduvjeti: [] },
  { naziv: "Mentorski seminar", semestar: "zimski", godina: 2, status: "obavezni", ects: 3, planSem: 3, preduvjeti: [] },
  { naziv: "Diplomski rad", semestar: "ljetni", godina: 2, status: "obavezni", ects: 30, planSem: 4, preduvjeti: [] },
];
const placed = S.computeSchedule(dataScience, { span: { from: 1, to: 4 } });
assert(placed.ok, placed.error || "data science schedule failed");
assert(placed.earliest.get("Mentorski seminar") === 3, "mentorski seminar stays in semester 3");
assert(placed.earliest.get("Diplomski rad") === 4, "thesis stays in semester 4");
assert(placed.firstSemester === 1 && placed.totalSemesters === 4, "columns cover semesters 1-4");
const collapsed = S.computeSchedule(dataScience.map(({ planSem, ...course }) => course));
assert(collapsed.earliest.get("Diplomski rad") === 2, "without the floor the thesis collapses into semester 2");
assert(collapsed.totalSemesters === 2, "without a span the graph stops at the collapsed semester");

// A later slice (FER Računarstvo is semesters 3-6) does not invent year 1,
// and a trailing elective-only semester still gets a column.
const slice = S.computeSchedule([
  { naziv: "Završni rad", semestar: "ljetni", godina: 3, status: "obavezni", ects: 10, planSem: 6, preduvjeti: [] },
], { span: { from: 3, to: 6 } });
assert(slice.firstSemester === 3 && slice.totalSemesters === 6, "slice columns are 3-6");
assert(slice.earliest.get("Završni rad") === 6, "završni rad stays in semester 6");

console.log("schedule identity ok");
