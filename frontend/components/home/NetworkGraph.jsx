"use client";

import { useState, useEffect } from "react";
import { GraphCanvas } from "reagraph";
import { graphNodes, graphEdges } from "@/data/graphData";
import CardSpotlight from "@/components/ui/CardSpotlight";
import Tooltip from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { motion } from "motion/react";

export default function NetworkGraph() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [isDark, setIsDark] = useState(false);
  const { showToast } = useToast();

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

  const handleNodeClick = (node) => {
    setSelectedNode(node);
    showToast(`Kliknuto: ${node.label}`, "info");
  };

  return (
    <section className="w-full py-16 px-4 sm:px-6 lg:px-8 relative">
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
            <GraphCanvas
              nodes={graphNodes}
              edges={graphEdges}
              layoutType="forceDirected2d"
              clusterAttribute="cluster"
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
              animations={{
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
              }}
            />
            {/* Legend */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute top-4 left-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg p-4 border border-gray-200/50 dark:border-gray-700/50 z-10"
            >
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Legenda</h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-blue-600 shadow-sm"></div>
                  <span className="text-gray-700 dark:text-gray-300">Fakultet</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-green-500 shadow-sm"></div>
                  <span className="text-gray-700 dark:text-gray-300">Udruga</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-amber-500 shadow-sm"></div>
                  <span className="text-gray-700 dark:text-gray-300">Tvrtka</span>
                </div>
              </div>
            </motion.div>
            {selectedNode && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg p-4 border border-gray-200/50 dark:border-gray-700/50 z-10"
              >
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {selectedNode.label}
                </p>
              </motion.div>
            )}
          </div>
        </CardSpotlight>
      </div>
    </section>
  );
}

