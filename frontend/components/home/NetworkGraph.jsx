"use client";

import { useState, useEffect, useRef, memo } from "react";
import { GraphCanvas } from "reagraph";
import CardSpotlight from "@/components/ui/CardSpotlight";
import { useToast } from "@/components/ui/Toast";
import { motion } from "motion/react";

const NetworkGraph = memo(function NetworkGraph() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedName, setSelectedName] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [neighborIds, setNeighborIds] = useState(new Set());
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDark, setIsDark] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const sectionRef = useRef(null);
  const { showToast } = useToast();
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);

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
        const nodesFromApi = Array.isArray(data?.nodes) ? data.nodes : [];
        const edgesFromApi = Array.isArray(data?.edges) ? data.edges : [];

        // Cluster-based coloring
        const lightPalette = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#e879f9", "#22c55e", "#f97316", "#06b6d4"];
        const darkPalette  = ["#60a5fa", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#2dd4bf", "#f472b6", "#4ade80", "#fb923c", "#67e8f9"];
        const palette = isDark ? darkPalette : lightPalette;
        const colorForCluster = (clusterValue) => {
          if (clusterValue === null || clusterValue === undefined) return isDark ? "#60a5fa" : "#2563eb";
          const idx = Math.abs(Number(clusterValue)) % palette.length;
          return palette[idx];
        };
        // Compute degree from edges for sizing
        const degree = new Map();
        for (const e of edgesFromApi) {
          const s = e?.from;
          const t = e?.to;
          if (!s || !t) continue;
          degree.set(s, (degree.get(s) || 0) + 1);
          degree.set(t, (degree.get(t) || 0) + 1);
        }
        const builtNodes = nodesFromApi.map((n) => {
          const id = n?.id;
          const label = n?.label || id || "";
          const type = n?.type || "node";
          const clusterValue = n?.cluster ?? null;
          // Base size by type; faculties larger than organisations
          const base = type === "faculty" ? 18 : 12;
          const size = base + 2 * (degree.get(id) || 0);
          const originalData = n?.data || {};
          return {
            id,
            label,
            size,
            data: { ...originalData, cluster: clusterValue, type },
            fill: colorForCluster(clusterValue),
          };
        });
        // De-duplicate edges (undirected) and adapt shape for reagraph
        const edgeMap = new Map();
        for (const e of edgesFromApi) {
          const a = e?.from;
          const b = e?.to;
          if (!a || !b) continue;
          const [s, t] = a < b ? [a, b] : [b, a];
          const key = `${s}-${t}`;
          const dist = typeof e?.distance === "number" ? e.distance : Number.POSITIVE_INFINITY;
          const existing = edgeMap.get(key);
          if (!existing || existing.data.distance > dist) {
            edgeMap.set(key, { id: key, source: s, target: t, data: { distance: dist } });
          }
        }
        const builtEdges = [...edgeMap.values()];

        if (!cancelled) {
          setNodes(builtNodes);
          setEdges(builtEdges);
          nodesRef.current = builtNodes;
          edgesRef.current = builtEdges;
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

  // Keep refs in sync
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // Listen for event to add a special "student" node and connect to KNNs
  useEffect(() => {
    const handler = (e) => {
      try {
        const detail = e?.detail || {};
        const studentId = detail.studentId ?? null;
        const name = (detail.name || "").trim() || "Student";
        const neighbors = Array.isArray(detail.neighbors) ? detail.neighbors : [];
        const studentNodeId = studentId != null ? `_student_${studentId}` : `_student_${name.replace(/\s+/g, "_")}`;

        const existingNodes = nodesRef.current || [];
        const existingEdges = edgesRef.current || [];

        // Build special styled node
        const specialFill = isDark ? "#f472b6" : "#ec4899"; // pink
        const specialStroke = isDark ? "#111827" : "#ffffff";
        const newStudentNode = {
          id: studentNodeId,
          label: name,
          size: 28,
          data: { type: "student" },
          fill: specialFill,
          stroke: specialStroke,
          strokeWidth: 2.5,
        };

        // Filter out any prior student node with same id and its edges
        const filteredNodes = existingNodes.filter((n) => n.id !== studentNodeId);
        const filteredEdges = existingEdges.filter((e) => e.source !== studentNodeId && e.target !== studentNodeId);

        // Create edges to neighbors by matching neighbor.label to existing node ids
        const idSet = new Set(filteredNodes.map((n) => n.id));
        const addedEdges = [];
        for (const n of neighbors) {
          const targetId = (n?.label || n?.name || "").trim();
          if (!targetId || !idSet.has(targetId)) continue;
          const source = studentNodeId;
          const target = targetId;
          const key = source < target ? `${source}-${target}` : `${target}-${source}`;
          // Avoid duplicates if somehow present
          if (filteredEdges.some((e) => (e.id === key) || (e.source === source && e.target === target) || (e.source === target && e.target === source))) {
            continue;
          }
          addedEdges.push({
            id: key,
            source,
            target,
            data: { distance: typeof n?.distance === "number" ? n.distance : 0.0, isStudentEdge: true },
          });
        }

        const nextNodes = [...filteredNodes, newStudentNode];
        const nextEdges = [...filteredEdges, ...addedEdges];

        nodesRef.current = nextNodes;
        edgesRef.current = nextEdges;
        setNodes(nextNodes);
        setEdges(nextEdges);
        setSelectedNode(newStudentNode);
        setSelectedId(studentNodeId);
        setSelectedType("student");
        const neighIds = new Set([studentNodeId, ...addedEdges.map((e) => e.target)]);
        setNeighborIds(neighIds);
      } catch (_err) {
        // no-op
      }
    };
    window.addEventListener("addStudentNode", handler);
    return () => window.removeEventListener("addStudentNode", handler);
  }, [isDark]);

  const handleNodeClick = async (node) => {
    // Toggle selection when clicking the same node
    if (selectedId && node?.id === selectedId) {
      setSelectedNode(null);
      setSelectedName(null);
      setSelectedId(null);
      setSelectedType(null);
      setNeighborIds(new Set());
      return;
    }

    setSelectedNode(node);
    setSelectedId(node?.id || null);
    const type = node?.data?.type || "node";
    setSelectedType(type);
    setSelectedName(node?.label || null);
    showToast(`Kliknuto: ${node.label}`, "info");

    // Determine neighbors: for faculty fetch from backend, for others derive locally
    try {
      if (type === "faculty") {
        const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
        // Send full name (label/id) to backend
        const nameParam = node?.label || node?.id;
        const url = `${baseUrl}/api/faculties/get/?name=${encodeURIComponent(nameParam)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const data = await res.json();
          const edges = Array.isArray(data?.edges) ? data.edges : [];
          const neigh = new Set(edges.map((e) => e?.to).filter(Boolean));
          neigh.add(node.id);
          setNeighborIds(neigh);
        if (data?.name) {
          setSelectedName(data.name);
        }
        // Broadcast selection so side lists can update independently
        if (typeof window !== "undefined") {
          try {
            window.dispatchEvent(new CustomEvent("facultySelected", { detail: { name: data?.name || nameParam } }));
          } catch (_err) {
            // no-op
          }
        }
        } else {
          // fallback local
          const neigh = new Set();
          for (const e of edges) {
            if (e.source === node.id) neigh.add(e.target);
            else if (e.target === node.id) neigh.add(e.source);
          }
          neigh.add(node.id);
          setNeighborIds(neigh);
        }
      } else {
        // organisation or other: derive locally
        const neigh = new Set();
        for (const e of edges) {
          if (e.source === node.id) neigh.add(e.target);
          else if (e.target === node.id) neigh.add(e.source);
        }
        neigh.add(node.id);
        setNeighborIds(neigh);
        // Broadcast organisation selection for side lists
        if (type === "organisation" && typeof window !== "undefined") {
          try {
            // Build neighbour organisations list (exclude self)
            const neighborOrgs = [];
            for (const nid of neigh) {
              if (nid === node.id) continue;
              const nobj = nodes.find((n) => n.id === nid);
              if (nobj?.data?.type === "organisation") {
                neighborOrgs.push({
                  id: nobj.id,
                  name: nobj.label,
                  abbreviation: nobj?.data?.abbreviation || "",
                });
              }
            }
            neighborOrgs.sort((a, b) => a.name.localeCompare(b.name, "hr"));
            window.dispatchEvent(
              new CustomEvent("organisationSelected", {
                detail: {
                  name: node?.label || node?.id,
                  abbreviation: node?.data?.abbreviation || "",
                  neighbors: neighborOrgs,
                },
              })
            );
          } catch (_err) {
            // no-op
          }
        }
      }
    } catch (_e) {
      // Fallback to local neighbor derivation
      const neigh = new Set();
      for (const e of edges) {
        if (e.source === node.id) neigh.add(e.target);
        else if (e.target === node.id) neigh.add(e.source);
      }
      neigh.add(node.id);
      setNeighborIds(neigh);
    }
  };

  // Build highlighted render nodes/edges based on selection
  const renderNodes = nodes.map((n) => {
    if (!selectedId) return n;
    const isSelected = n.id === selectedId;
    const isNeighbor = neighborIds.has(n.id);
    const sizeBoost = isSelected ? 8 : isNeighbor ? 4 : -4;
    const newSize = Math.max(6, (n.size || 12) + sizeBoost);
    return { ...n, size: newSize };
  });
  const renderEdges = edges.map((e) => {
    if (!selectedId) return e;
    const isOut = e.source === selectedId;
    const isIn = e.target === selectedId;
    const isConnected = isOut || isIn;
    const size = isConnected ? 3 : 1;
    // Distinct colors for outgoing vs incoming; dim others
    const outgoingColor = isDark ? "#22c55e" : "#16a34a"; // green
    const incomingColor = isDark ? "#f59e0b" : "#d97706"; // amber
    const dimColor = isDark ? "#374151" : "#cbd5e1";
    const color = isOut ? outgoingColor : isIn ? incomingColor : dimColor;
    return { ...e, size, color };
  });

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
                nodes={renderNodes}
                edges={renderEdges}
                layoutType="forceDirected2d"
                layoutProps={{
                  // Pull nodes further apart: larger link distance and stronger repulsion
                  linkDistance: 140,
                  nodeStrength: -500,
                  collideRadius: 18,
                }}
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

