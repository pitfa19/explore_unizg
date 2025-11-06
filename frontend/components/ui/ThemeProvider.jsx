"use client";

import { createContext, useContext, useEffect, useState, useRef } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("system");
  const [mounted, setMounted] = useState(false);
  const themeRef = useRef("system");

  useEffect(() => {
    // Get theme from localStorage or default to system
    const savedTheme = localStorage.getItem("theme") || "system";
    themeRef.current = savedTheme;
    setTheme(savedTheme);
    
    // Apply theme immediately
    const root = document.documentElement;
    if (savedTheme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.remove("light", "dark");
      root.classList.add(systemTheme);
    } else {
      root.classList.remove("light", "dark");
      root.classList.add(savedTheme);
    }
    
    setMounted(true);
    
    // Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      if (themeRef.current === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        const root = document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(systemTheme);
      }
    };
    
    mediaQuery.addEventListener("change", handleSystemThemeChange);
    
    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  const applyTheme = (newTheme) => {
    if (typeof window === "undefined") return;
    
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    
    if (newTheme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(newTheme);
    }
    
    // Force a repaint to ensure classes are applied
    void root.offsetHeight;
  };

  const setThemeValue = (newTheme) => {
    themeRef.current = newTheme;
    setTheme(newTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", newTheme);
    }
    applyTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeValue }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

