"use client";

import { useRef, useState, memo, useCallback } from "react";

const CardSpotlight = memo(function CardSpotlight({ children, className = "" }) {
  const divRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);
  const rafRef = useRef(null);

  const handleMouseMove = useCallback((e) => {
    if (!divRef.current || isFocused) return;

    // Use requestAnimationFrame for smoother performance
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      if (!divRef.current) return;
      const div = divRef.current;
      const rect = div.getBoundingClientRect();
      setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    });
  }, [isFocused]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setOpacity(1);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    setOpacity(0);
  }, []);

  const handleMouseEnter = useCallback(() => {
    setOpacity(1);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setOpacity(0);
  }, []);

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(59, 130, 246, 0.15), transparent 40%)`,
        }}
      />
      {children}
    </div>
  );
});

export default CardSpotlight;

