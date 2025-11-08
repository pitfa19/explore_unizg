"use client";

import { useState, useEffect, useRef, memo } from "react";
import { GraphCanvas } from "reagraph";
import CardSpotlight from "@/components/ui/CardSpotlight";
import { useToast } from "@/components/ui/Toast";
import { motion } from "motion/react";

const NetworkGraph = memo(function NetworkGraph() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedName, setSelectedName] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDark, setIsDark] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const sectionRef = useRef(null);
  const { showToast } = useToast();

  // Intersection Observer - render only when in viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          // Delay render slightly to not block initial render
          setTimeout(() => setShouldRender(true), 100);
        }
      },
      { rootMargin: "100px" } // Start loading 100px before viewport
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  // Fetch graph data from backend once the section should render
  useEffect(() => {
    if (!shouldRender) return;

    let cancelled = false;
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
        const url = `${baseUrl}/api/faculties/edges/`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) {
          throw new Error(`Request failed: ${res.status}`);
        }
        const data = await res.json();
        const faculties = Array.isArray(data?.faculties) ? data.faculties : [];

        // Map abbreviation -> cluster (can be null/undefined)
        const abbrToCluster = new Map();
        for (const f of faculties) {
          if (f?.abbreviation) {
            abbrToCluster.set(f.abbreviation, f?.cluster ?? null);
          }
        }

        // Build undirected edges, de-duplicated (keep smallest distance)
        const edgeMap = new Map();
        const degree = new Map();

        for (const f of faculties) {
          const a = f?.abbreviation;
          if (!a) continue;
          const knn = Array.isArray(f?.knn_edges) ? f.knn_edges : [];
          for (const e of knn) {
            const b = e?.neighbor_abbreviation;
            if (!b) continue;
            const [s, t] = a < b ? [a, b] : [b, a];
            const key = `${s}-${t}`;
            const dist = typeof e?.distance === "number" ? e.distance : Number.POSITIVE_INFINITY;
            const existing = edgeMap.get(key);
            if (!existing || existing.data.distance > dist) {
              edgeMap.set(key, { id: key, source: s, target: t, data: { distance: dist } });
            }
            degree.set(a, (degree.get(a) || 0) + 1);
            degree.set(b, (degree.get(b) || 0) + 1);
          }
        }

        const abbreviations = new Set(faculties.map((f) => f.abbreviation).filter(Boolean));
        for (const { source, target } of edgeMap.values()) {
          abbreviations.add(source);
          abbreviations.add(target);
        }

        // Cluster-based coloring
        const lightPalette = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#e879f9", "#22c55e", "#f97316", "#06b6d4"];
        const darkPalette  = ["#60a5fa", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#2dd4bf", "#f472b6", "#4ade80", "#fb923c", "#67e8f9"];
        const palette = isDark ? darkPalette : lightPalette;
        const colorForCluster = (clusterValue) => {
          if (clusterValue === null || clusterValue === undefined) return isDark ? "#60a5fa" : "#2563eb";
          const idx = Math.abs(Number(clusterValue)) % palette.length;
          return palette[idx];
        };
        const builtNodes = [...abbreviations].map((id) => {
          const clusterValue = abbrToCluster.get(id) ?? null;
          return {
            id,
            label: id,
            size: 16 + 2 * (degree.get(id) || 0),
            data: { cluster: clusterValue, type: "fakultet" },
            fill: colorForCluster(clusterValue),
          };
        });
        const builtEdges = [...edgeMap.values()];

        if (!cancelled) {
          setNodes(builtNodes);
          setEdges(builtEdges);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Greška pri učitavanju grafa");
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [shouldRender, isDark]);

  const handleNodeClick = async (node) => {
    setSelectedNode(node);
    setSelectedName(null);
    showToast(`Kliknuto: ${node.label}`, "info");

    try {
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
      const url = `${baseUrl}/api/faculties/name/?abbreviation=${encodeURIComponent(node.id)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const data = await res.json();
        if (data?.name) {
          setSelectedName(data.name);
        }
      }
    } catch (_e) {
      // Ignore error; keep abbreviation as label
    }
  };

  return (
    <section ref={sectionRef} className="w-full py-20 md:py-24 lg:py-32 px-4 sm:px-6 lg:px-8 relative">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
            Mrežni klasteri
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Povezivanje FER-a s studentskim udrugama i tvrtkama iz industrije; primjer
          </p>
        </div>
        <CardSpotlight className="rounded-2xl">
          <div className="w-full h-[600px] bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/20 dark:border-gray-700/30 relative overflow-hidden">
            {shouldRender ? (
              loading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-gray-400 dark:text-gray-600">Učitavanje grafa...</div>
                </div>
              ) : error ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-red-500 dark:text-red-400">{error}</div>
                </div>
              ) : nodes.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-gray-500 dark:text-gray-400">Nema podataka za prikaz</div>
                </div>
              ) : (
              <GraphCanvas
                nodes={nodes}
                edges={edges}
                layoutType="forceDirected2d"
                nodeLabelFontSize={14}
                nodeLabelFontWeight={600}
                edgeColor={isDark ? "#64748b" : "#94a3b8"}
                edgeWidth={2}
                minNodeViewThreshold={0}
                minEdgeViewThreshold={0}
                labelType="all"
                cursor="pointer"
                nodeLabelColor={isDark ? "#f1f5f9" : "#1f2937"}
                darkMode={isDark}
                onNodeClick={handleNodeClick}
                animations={
                  isInView
                    ? {
                        nodes: {
                          enter: {
                            type: "fade",
                            duration: 500,
                          },
                          update: {
                            type: "spring",
                            duration: 500,
                          },
                        },
                        edges: {
                          enter: {
                            type: "fade",
                            duration: 500,
                          },
                        },
                      }
                    : undefined
                }
              />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-gray-400 dark:text-gray-600">Učitavanje grafa...</div>
              </div>
            )}
            {selectedNode && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg p-4 border border-gray-200/50 dark:border-gray-700/50 z-10"
              >
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {selectedName || selectedNode.label}
                </p>
              </motion.div>
            )}
          </div>
        </CardSpotlight>
      </div>
    </section>
  );
});

export default NetworkGraph;

