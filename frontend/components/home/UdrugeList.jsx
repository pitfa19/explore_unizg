"use client";

import { udruge } from "@/data/udrugeData";
import CardSpotlight from "@/components/ui/CardSpotlight";

export default function UdrugeList() {
  return (
    <CardSpotlight className="rounded-2xl">
      <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/20 dark:border-gray-700/30 flex flex-col h-full hover:shadow-3xl transition-all duration-300 hover:border-green-300/50 dark:hover:border-green-500/30">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            Udruge
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Studentske udruge i organizacije u Zagrebu
          </p>
        </div>
        <div className="flex-1 overflow-y-auto max-h-[500px] p-4 space-y-3">
          {udruge.map((udruga) => (
            <div
              key={udruga.id}
              className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 dark:hover:from-green-900/20 dark:hover:to-emerald-900/20 transition-all cursor-pointer group hover:shadow-md hover:scale-[1.02]"
            >
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1 group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors">
                {udruga.name}
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {udruga.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </CardSpotlight>
  );
}

