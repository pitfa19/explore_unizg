"use client";

import { memo } from "react";
import { motion } from "motion/react";
import ChatSection from "@/components/home/ChatSection";

const HeroSection = memo(function HeroSection() {
  

  return (
    <section className="relative w-full py-20 md:py-24 lg:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="max-w-7xl mx-auto text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-block mb-4"
        >
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-clip-text text-transparent animate-gradient bg-[length:200%_auto] pb-4 tracking-tight">
            Explore UNIZG
          </h1>
        </motion.div>
        
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-xl md:text-2xl text-gray-700 dark:text-gray-200 mb-3 max-w-3xl mx-auto font-semibold"
        >
          Za studente, od strane studenata
        </motion.p>
        
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg md:text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed"
        >
          Povezujemo studente s prilikama, udrugama i fakultetima Sveučilišta u Zagrebu
        </motion.p>
        
        {/* Chat placed beneath the intro copy */}
        <div className="max-w-4xl mx-auto my-8">
          <ChatSection />
        </div>
        
      </div>
    </section>
  );
});

export default HeroSection;

