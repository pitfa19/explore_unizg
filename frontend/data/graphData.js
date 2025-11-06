// Graph data representing FER cluster with connections
export const graphNodes = [
  // FER - Main node (center)
  {
    id: "fer",
    label: "FER",
    size: 40,
    data: { cluster: "fakultet", type: "fakultet", color: "#2563eb" },
    fill: "#2563eb",
  },
  // Udruge connected to FER
  {
    id: "szfer",
    label: "Studentski zbor FER",
    size: 25,
    data: { cluster: "udruga", type: "udruga", color: "#10b981" },
    fill: "#10b981",
  },
  {
    id: "aiesec",
    label: "AIESEC Zagreb",
    size: 25,
    data: { cluster: "udruga", type: "udruga", color: "#10b981" },
    fill: "#10b981",
  },
  {
    id: "eestec",
    label: "EESTEC Zagreb",
    size: 25,
    data: { cluster: "udruga", type: "udruga", color: "#10b981" },
    fill: "#10b981",
  },
  {
    id: "ieee",
    label: "IEEE Student Branch",
    size: 25,
    data: { cluster: "udruga", type: "udruga", color: "#10b981" },
    fill: "#10b981",
  },
  // Companies connected to FER
  {
    id: "infobip",
    label: "Infobip",
    size: 30,
    data: { cluster: "tvrka", type: "tvrka", color: "#f59e0b" },
    fill: "#f59e0b",
  },
  {
    id: "rimac",
    label: "Rimac Automobili",
    size: 30,
    data: { cluster: "tvrka", type: "tvrka", color: "#f59e0b" },
    fill: "#f59e0b",
  },
  {
    id: "ericsson",
    label: "Ericsson Nikola Tesla",
    size: 30,
    data: { cluster: "tvrka", type: "tvrka", color: "#f59e0b" },
    fill: "#f59e0b",
  },
  {
    id: "microblink",
    label: "Microblink",
    size: 30,
    data: { cluster: "tvrka", type: "tvrka", color: "#f59e0b" },
    fill: "#f59e0b",
  },
  {
    id: "five",
    label: "Five",
    size: 30,
    data: { cluster: "tvrka", type: "tvrka", color: "#f59e0b" },
    fill: "#f59e0b",
  },
  {
    id: "croteam",
    label: "Croteam",
    size: 30,
    data: { cluster: "tvrka", type: "tvrka", color: "#f59e0b" },
    fill: "#f59e0b",
  },
];

export const graphEdges = [
  // FER to Udruge connections
  { id: "e1", source: "fer", target: "szfer" },
  { id: "e2", source: "fer", target: "aiesec" },
  { id: "e3", source: "fer", target: "eestec" },
  { id: "e4", source: "fer", target: "ieee" },
  // FER to Companies connections
  { id: "e5", source: "fer", target: "infobip" },
  { id: "e6", source: "fer", target: "rimac" },
  { id: "e7", source: "fer", target: "ericsson" },
  { id: "e8", source: "fer", target: "microblink" },
  { id: "e9", source: "fer", target: "five" },
  { id: "e10", source: "fer", target: "croteam" },
];

