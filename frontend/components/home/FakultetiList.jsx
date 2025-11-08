"use client";

import { memo, useEffect, useState } from "react";
import CardSpotlight from "@/components/ui/CardSpotlight";

const FakultetiList = memo(function FakultetiList() {
  const [selectedName, setSelectedName] = useState(null);
  const [selectedAbbr, setSelectedAbbr] = useState("");
  const [selectedType, setSelectedType] = useState(null);
  const [faculties, setFaculties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    function onSelected(e) {
      const name = e?.detail?.name;
      if (!name) return;
      setSelectedType("faculty");
      setSelectedName(name);
      const controller = new AbortController();
      const fetchData = async () => {
        try {
          setLoading(true);
          setError(null);
          const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
          const url = `${baseUrl}/api/faculties/get/?name=${encodeURIComponent(name)}`;
          const res = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
          if (!res.ok) {
            throw new Error(`Greška ${res.status}`);
          }
          const data = await res.json();
          setSelectedAbbr((data?.abbreviation || "").trim());
          const list = Array.isArray(data?.faculties) ? data.faculties : [];
          // Dedupe and sort by cluster then label
          const unique = [];
          const seen = new Set();
          for (const f of list) {
            const key = (f?.label || "").trim();
            if (!key || seen.has(key)) continue;
            seen.add(key);
            unique.push({
              id: key,
              name: key,
              abbreviation: (f?.abbreviation || "").trim(),
              cluster: f?.cluster ?? null,
            });
          }
          unique.sort((a, b) => {
            const ca = a.cluster ?? 0;
            const cb = b.cluster ?? 0;
            if (ca !== cb) return ca - cb;
            return a.name.localeCompare(b.name, "hr");
          });
          setFaculties(unique);
        } catch (err) {
          if (err?.name !== "AbortError") {
            setError(err?.message || "Greška pri dohvaćanju podataka.");
          }
        } finally {
          setLoading(false);
        }
      };
      fetchData();
      return () => controller.abort();
    }
    function onStudentNeighbors(e) {
      const name = e?.detail?.name || "Student";
      const faculties = Array.isArray(e?.detail?.faculties) ? e.detail.faculties : [];
      setSelectedType("student");
      setSelectedName(name);
      try {
        const unique = [];
        const seen = new Set();
        for (const f of faculties) {
          const key = (f?.label || "").trim();
          if (!key || seen.has(key)) continue;
          seen.add(key);
          unique.push({
            id: key,
            name: key,
            abbreviation: (f?.abbreviation || "").trim(),
            cluster: f?.cluster ?? null,
            distance: typeof f?.distance === "number" ? f.distance : Number.POSITIVE_INFINITY,
          });
        }
        unique.sort((a, b) => {
          const da = a.distance ?? Number.POSITIVE_INFINITY;
          const db = b.distance ?? Number.POSITIVE_INFINITY;
          if (da !== db) return da - db;
          return a.name.localeCompare(b.name, "hr");
        });
        setFaculties(unique);
      } catch (_err) {
        // noop
      }
    }
    // Listen for selection broadcasted by the graph
    window.addEventListener("facultySelected", onSelected);
    // Also listen for organisation selection to avoid showing "Odabrano" here
    const onOrganisation = () => setSelectedType("organisation");
    window.addEventListener("organisationSelected", onOrganisation);
    // Listen for student embedding neighbors
    window.addEventListener("studentNeighbors", onStudentNeighbors);
    return () => {
      window.removeEventListener("facultySelected", onSelected);
      window.removeEventListener("organisationSelected", onOrganisation);
      window.removeEventListener("studentNeighbors", onStudentNeighbors);
    };
  }, []);

  return (
    <CardSpotlight className="rounded-2xl">
      <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/20 dark:border-gray-700/30 flex flex-col h-full hover:shadow-3xl transition-all duration-300 hover:border-blue-300/50 dark:hover:border-blue-500/30">
        <div className="p-6 md:p-8 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            Fakulteti
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {selectedName ? `Povezano s: ${selectedName}` : "Odaberite fakultet na mrežnom grafu"}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto max-h-[500px] p-4 space-y-3">
          {loading && (
            <div className="text-sm text-gray-500 dark:text-gray-400">Učitavanje...</div>
          )}
          {error && (
            <div className="text-sm text-red-500 dark:text-red-400">{error}</div>
          )}
          {!loading && faculties.length === 0 && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {selectedName ? "Nema povezanih fakulteta." : "Nema podataka. Kliknite na fakultet u grafu."}
            </div>
          )}
          {selectedType === "faculty" && selectedName && (
            <div
              key="selected-faculty"
              className="p-4 rounded-xl border border-blue-300/60 dark:border-blue-600/50 bg-blue-50/50 dark:bg-blue-900/10 transition-all group shadow-sm"
            >
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                  {selectedName}
                </h4>
                <div className="flex items-center gap-2">
                  {selectedAbbr ? (
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded-lg shadow-sm">
                      {selectedAbbr}
                    </span>
                  ) : null}
                  <span className="text-[10px] uppercase tracking-wide font-bold text-white bg-blue-600/90 dark:bg-blue-500/90 px-2 py-0.5 rounded">
                    Odabrano
                  </span>
                </div>
              </div>
            </div>
          )}
          {faculties.map((fakultet) => (
            <div
              key={fakultet.id}
              className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20 transition-all cursor-pointer group hover:shadow-md hover:scale-[1.02]"
            >
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                  {fakultet.name}
                </h4>
                {fakultet.abbreviation ? (
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg shadow-sm">
                    {fakultet.abbreviation}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </CardSpotlight>
  );
});

export default FakultetiList;
