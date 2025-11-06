"use client";

import { useEffect } from "react";

export default function ThemeInitializer() {
  useEffect(() => {
    try {
      const theme = localStorage.getItem("theme") || "system";
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      
      if (theme === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        root.classList.add(systemTheme);
      } else {
        root.classList.add(theme);
      }
    } catch (e) {
      // Fallback to light if localStorage is not available
      document.documentElement.classList.add("light");
    }
  }, []);

  return null;
}

