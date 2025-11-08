"use client";

import { memo, useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import Link from "next/link";

const MotivationSection = memo(function MotivationSection() {
  const [isInView, setIsInView] = useState(false);
  const [stats, setStats] = useState([
    { value: "0", label: "Fakulteta" },
    { value: "0", label: "Udruga" },
    { value: "0", label: "Prijava" },
  ]);
  const sectionRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function loadInfo() {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
        const url = `${baseUrl}/api/info/`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) return;
        const data = await res.json();
        const faculties = Number(data?.faculties_count ?? 0);
        const orgs = Number(data?.organisations_count ?? 0);
        const students = Number(data?.students_count ?? 0);
        if (!cancelled) {
          setStats((prev) => [
            { ...prev[0], value: String(faculties) },
            { ...prev[1], value: String(orgs) },
            { ...prev[2], value: String(students) },
          ]);
        }
      } catch (_e) {
        // ignore and keep defaults
      }
    }
    loadInfo();
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        }
      },
      { rootMargin: "100px" }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      cancelled = true;
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, []);

  return (
    <section ref={sectionRef} className="w-full py-20 md:py-24 lg:py-32 px-4 sm:px-6 lg:px-8 relative bg-gradient-to-b from-transparent via-blue-50/30 dark:via-blue-900/10 to-transparent">
      <div className="max-w-7xl mx-auto">
        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative overflow-hidden rounded-3xl mt-12"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 opacity-90"></div>
          <div 
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }}
          ></div>
          
          <div className="relative z-10 px-8 py-16 md:py-20 text-center">
            <motion.h3
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5 }}
              className="text-3xl md:text-4xl font-bold text-white mb-4"
            >
              Tvoja prilika čeka
            </motion.h3>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-lg md:text-xl text-white/90 mb-10 max-w-3xl mx-auto"
            >
              Tisuće studenata su već pronašli svoj put. Pridruži im se i otvori vrata svojoj karijeri!
            </motion.p>

            {/* Stats inside colored container */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="grid grid-cols-3 gap-6 md:gap-8 max-w-3xl mx-auto mb-10"
            >
              {stats.map((stat, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                  className="text-center"
                >
                  <div className="text-3xl md:text-4xl font-bold text-white mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm md:text-base text-white/90 font-medium">
                    {stat.label}
                  </div>
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <Link
                href="#explore"
                className="px-8 py-4 bg-white text-blue-600 font-bold rounded-xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200"
              >
                Istraži sada
              </Link>
              <Link
                href="/about"
                className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white font-bold rounded-xl border-2 border-white/30 hover:bg-white/20 transition-all duration-200"
              >
                Saznaj više
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
});

export default MotivationSection;

