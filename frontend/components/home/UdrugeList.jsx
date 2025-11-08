"use client";

import { memo, useEffect, useState } from "react";
import CardSpotlight from "@/components/ui/CardSpotlight";

const UdrugeList = memo(function UdrugeList() {
  const [selectedName, setSelectedName] = useState(null);
  const [selectedAbbr, setSelectedAbbr] = useState("");
  const [selectedType, setSelectedType] = useState(null);
  const [organisations, setOrganisations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load all organisations by default and preselect EESTEC
  useEffect(() => {
    let cancelled = false;
    const loadAllOrganisations = async () => {
      try {
        setLoading(true);
        setError(null);
        const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
        const url = `${baseUrl}/api/faculties/edges/`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) {
          throw new Error(`Greška ${res.status}`);
        }
        const data = await res.json();
        const nodes = Array.isArray(data?.nodes) ? data.nodes : [];
        const unique = [];
        const seen = new Set();
        for (const n of nodes) {
          if ((n?.type || "").trim() !== "organisation") continue;
          const key = (n?.label || n?.id || "").trim();
          if (!key || seen.has(key)) continue;
          seen.add(key);
          unique.push({
            id: key,
            name: key,
            abbreviation: (n?.data?.abbreviation || "").trim(),
            cluster: n?.cluster ?? null,
          });
        }
        unique.sort((a, b) => a.name.localeCompare(b.name, "hr"));
        if (!cancelled) {
          setOrganisations(unique);
          // Preselect EESTEC if present; fallback to a node containing 'EESTEC'
          const preferredName = "EESTEC studentska udruga";
          let selected = unique.find((o) => o.name.trim().toLowerCase() === preferredName.toLowerCase());
          if (!selected) {
            selected = unique.find((o) => /eestec/i.test(o.name));
          }
          if (selected) {
            setSelectedType("organisation");
            setSelectedName(selected.name);
            setSelectedAbbr(selected.abbreviation || "");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Greška pri dohvaćanju podataka.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    loadAllOrganisations();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onFacultySelected(e) {
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
          const list = Array.isArray(data?.organisations) ? data.organisations : [];
          // Dedupe by name and sort by distance then name
          const map = new Map();
          for (const o of list) {
            const key = (o?.name || "").trim();
            if (!key) continue;
            const existing = map.get(key);
            const dist = typeof o?.distance === "number" ? o.distance : Number.POSITIVE_INFINITY;
            if (!existing || (dist < existing.distance)) {
              map.set(key, {
                id: key,
                name: key,
                abbreviation: (o?.abbreviation || "").trim(),
                cluster: o?.cluster ?? null,
                distance: dist,
              });
            }
          }
          const unique = [...map.values()];
          unique.sort((a, b) => {
            const da = a.distance ?? Number.POSITIVE_INFINITY;
            const db = b.distance ?? Number.POSITIVE_INFINITY;
            if (da !== db) return da - db;
            return a.name.localeCompare(b.name, "hr");
          });
          setOrganisations(unique);
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
    function onOrganisationSelected(e) {
      const name = e?.detail?.name || "";
      const abbr = (e?.detail?.abbreviation || "").trim();
      const neighbors = Array.isArray(e?.detail?.neighbors) ? e.detail.neighbors : [];
      if (!name) return;
      setSelectedType("organisation");
      setSelectedName(name);
      setSelectedAbbr(abbr);
      // Replace list with neighbor organisations of the selected organisation
      try {
        const unique = [];
        const seen = new Set();
        for (const o of neighbors) {
          const key = (o?.name || "").trim();
          if (!key || seen.has(key)) continue;
          seen.add(key);
          unique.push({
            id: key,
            name: key,
            abbreviation: (o?.abbreviation || "").trim(),
          });
        }
        unique.sort((a, b) => a.name.localeCompare(b.name, "hr"));
        setOrganisations(unique);
      } catch (_err) {
        // noop
      }
    }
    function onStudentNeighbors(e) {
      const name = e?.detail?.name || "Student";
      const orgs = Array.isArray(e?.detail?.organisations) ? e.detail.organisations : [];
      setSelectedType("student");
      setSelectedName(name);
      setSelectedAbbr("");
      try {
        const unique = [];
        const seen = new Set();
        for (const o of orgs) {
          const key = (o?.name || "").trim();
          if (!key || seen.has(key)) continue;
          seen.add(key);
          unique.push({
            id: key,
            name: key,
            abbreviation: (o?.abbreviation || "").trim(),
            distance: typeof o?.distance === "number" ? o.distance : Number.POSITIVE_INFINITY,
          });
        }
        unique.sort((a, b) => {
          const da = a.distance ?? Number.POSITIVE_INFINITY;
          const db = b.distance ?? Number.POSITIVE_INFINITY;
          if (da !== db) return da - db;
          return a.name.localeCompare(b.name, "hr");
        });
        setOrganisations(unique);
      } catch (_err) {
        // noop
      }
    }
    window.addEventListener("facultySelected", onFacultySelected);
    window.addEventListener("organisationSelected", onOrganisationSelected);
    window.addEventListener("studentNeighbors", onStudentNeighbors);
    return () => {
      window.removeEventListener("facultySelected", onFacultySelected);
      window.removeEventListener("organisationSelected", onOrganisationSelected);
      window.removeEventListener("studentNeighbors", onStudentNeighbors);
    };
  }, []);

  return (
    <CardSpotlight className="rounded-2xl">
      <div id="udruge" className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/20 dark:border-gray-700/30 flex flex-col h-full hover:shadow-3xl transition-all duration-300 hover:border-green-300/50 dark:hover:border-green-500/30">
        <div className="p-6 md:p-8 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            Udruge
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
          {!loading && organisations.length === 0 && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {selectedName ? "Nema povezanih udruga/organizacija." : "Nema podataka. Kliknite na fakultet u grafu."}
            </div>
          )}
          {selectedType === "organisation" && selectedName && (
            <div
              key="selected-faculty"
              className="p-4 rounded-xl border border-green-300/60 dark:border-green-600/50 bg-green-50/50 dark:bg-green-900/10 transition-all group shadow-sm"
            >
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors">
                  {selectedName}
                </h4>
                <div className="flex items-center gap-2">
                  {selectedAbbr ? (
                    <span className="text-xs font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40 px-2 py-1 rounded-lg shadow-sm">
                      {selectedAbbr}
                    </span>
                  ) : null}
                  <span className="text-[10px] uppercase tracking-wide font-bold text-white bg-green-600/90 dark:bg-green-500/90 px-2 py-0.5 rounded">
                    Odabrana organizacija
                  </span>
                </div>
              </div>
            </div>
          )}
          {organisations.map((udruga) => (
            <div
              key={udruga.id}
              className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 dark:hover:from-green-900/20 dark:hover:to-emerald-900/20 transition-all cursor-pointer group hover:shadow-md hover:scale-[1.02]"
            >
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors">
                  {udruga.name}
                </h4>
                {udruga.abbreviation ? (
                  <span className="text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-lg shadow-sm">
                    {udruga.abbreviation}
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

export default UdrugeList;

