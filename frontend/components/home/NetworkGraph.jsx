"use client";

import { GraphCanvas } from "reagraph";
import { graphNodes, graphEdges } from "@/data/graphData";
import CardSpotlight from "@/components/ui/CardSpotlight";

export default function NetworkGraph() {
  return (
    <section className="w-full py-16 px-4 sm:px-6 lg:px-8 relative">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Mrežni klasteri
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Povezivanje FER-a s studentskim udrugama i tvrtkama iz industrije; primjer
          </p>
        </div>
        <CardSpotlight className="rounded-2xl">
          <div className="w-full h-[600px] bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 relative overflow-hidden">
            <GraphCanvas
              nodes={graphNodes}
              edges={graphEdges}
              layoutType="forceDirected2d"
              clusterAttribute="cluster"
              nodeLabelFontSize={14}
              nodeLabelFontWeight={600}
              edgeColor="#94a3b8"
              edgeWidth={2}
              minNodeViewThreshold={0}
              minEdgeViewThreshold={0}
              labelType="all"
              cursor="pointer"
              nodeLabelColor="#1f2937"
              darkMode={false}
              onNodeClick={(node) => {
                console.log("Node clicked:", node);
              }}
            />
            {/* Legend */}
            <div className="absolute top-4 left-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg p-4 border border-gray-200/50 dark:border-gray-700/50 z-10">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Legenda</h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-blue-600"></div>
                  <span className="text-gray-700 dark:text-gray-300">Fakultet</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-green-500"></div>
                  <span className="text-gray-700 dark:text-gray-300">Udruga</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-amber-500"></div>
                  <span className="text-gray-700 dark:text-gray-300">Tvrtka</span>
                </div>
              </div>
            </div>
          </div>
        </CardSpotlight>
      </div>
    </section>
  );
}

