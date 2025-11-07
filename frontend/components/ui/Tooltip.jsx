"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

export default function Tooltip({ children, text, position = "top" }) {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowClasses = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-gray-900 dark:border-t-gray-100",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-gray-900 dark:border-b-gray-100",
    left: "left-full top-1/2 -translate-y-1/2 border-l-gray-900 dark:border-l-gray-100",
    right: "right-full top-1/2 -translate-y-1/2 border-r-gray-900 dark:border-r-gray-100",
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className={`absolute z-50 ${positionClasses[position]} pointer-events-none`}
          >
            <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-medium px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
              {text}
              <div
                className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}



