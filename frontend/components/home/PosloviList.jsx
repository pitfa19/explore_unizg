"use client";

import { poslovi } from "@/data/posloviData";
import CardSpotlight from "@/components/ui/CardSpotlight";

export default function PosloviList() {
  return (
    <CardSpotlight className="rounded-2xl">
      <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/20 dark:border-gray-700/30 flex flex-col h-full hover:shadow-3xl transition-all duration-300 hover:border-amber-300/50 dark:hover:border-amber-500/30">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            Poslovi
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Poslovi za studente
          </p>
        </div>
        <div className="flex-1 overflow-y-auto max-h-[500px] p-4 space-y-3">
          {poslovi.map((posao) => (
            <div
              key={posao.id}
              className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 dark:hover:from-amber-900/20 dark:hover:to-orange-900/20 transition-all cursor-pointer group hover:shadow-md hover:scale-[1.02]"
            >
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                {posao.title}
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                {posao.company}
              </p>
              <span className="inline-block text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-lg shadow-sm">
                {posao.type}
              </span>
            </div>
          ))}
        </div>
      </div>
    </CardSpotlight>
  );
}

