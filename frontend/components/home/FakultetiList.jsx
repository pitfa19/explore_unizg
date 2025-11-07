"use client";

import { fakulteti } from "@/data/fakultetiData";
import CardSpotlight from "@/components/ui/CardSpotlight";

export default function FakultetiList() {
  return (
    <CardSpotlight className="rounded-2xl">
      <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/20 dark:border-gray-700/30 flex flex-col h-full hover:shadow-3xl transition-all duration-300 hover:border-blue-300/50 dark:hover:border-blue-500/30">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            Fakulteti
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Fakulteti Sveučilišta u Zagrebu
          </p>
        </div>
        <div className="flex-1 overflow-y-auto max-h-[500px] p-4 space-y-3">
          {fakulteti.map((fakultet) => (
            <div
              key={fakultet.id}
              className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20 transition-all cursor-pointer group hover:shadow-md hover:scale-[1.02]"
            >
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                  {fakultet.name}
                </h4>
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg shadow-sm">
                  {fakultet.abbreviation}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CardSpotlight>
  );
}

