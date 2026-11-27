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

console.log("schedule identity ok");
