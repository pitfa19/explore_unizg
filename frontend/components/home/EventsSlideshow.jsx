"use client";

import { useState, useEffect } from "react";
import { events } from "@/data/eventsData";
import { motion, AnimatePresence } from "motion/react";

export default function EventsSlideshow() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  // Auto-play slideshow with progress indicator
  useEffect(() => {
    if (!isAutoPlaying) {
      setProgress(0);
      return;
    }
    
    setProgress(0);
    const duration = 8000; // 8 seconds
    const interval = 100; // Update every 100ms for smooth progress
    const steps = duration / interval;
    let step = 0;
    
    const progressInterval = setInterval(() => {
      step++;
      setProgress((step / steps) * 100);
    }, interval);
    
    const slideInterval = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % events.length);
    }, duration);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(slideInterval);
    };
  }, [isAutoPlaying, currentIndex, events.length]);

  const goToSlide = (index) => {
    setCurrentIndex(index);
    setIsAutoPlaying(false);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + events.length) % events.length);
    setIsAutoPlaying(false);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % events.length);
    setIsAutoPlaying(false);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("hr-HR", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  };

  return (
    <section className="w-full py-12 px-4 sm:px-6 lg:px-8 relative">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Predstojeći događaji
          </h2>
          <p className="text-base text-gray-600 dark:text-gray-400">
            Otkrijte nadolazeće događaje vezane uz udruge i fakultete
          </p>
        </div>

        <div className="relative">
          {/* Main Slideshow Container */}
          <div className="relative h-[350px] md:h-[400px] rounded-xl overflow-hidden shadow-xl">
            {/* Progress Bar */}
            {isAutoPlaying && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200/30 dark:bg-gray-700/30 z-20 overflow-hidden">
                <motion.div
                  className="h-full bg-blue-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.1, ease: "linear" }}
                  style={{ willChange: "width" }}
                />
              </div>
            )}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="absolute inset-0"
              >
                <motion.div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${events[currentIndex].image}?w=800&h=600&fit=crop&q=80)`,
                    willChange: "transform",
                  }}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
                </motion.div>
                
                <motion.div 
                  className="absolute bottom-0 left-0 right-0 p-6 md:p-8 text-white"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <div className="max-w-2xl">
                    <motion.div 
                      className="inline-block mb-2"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.3 }}
                    >
                      <span className="px-3 py-1 bg-blue-600/80 backdrop-blur-sm rounded-full text-xs font-semibold">
                        {events[currentIndex].category}
                      </span>
                    </motion.div>
                    <motion.h3 
                      className="text-2xl md:text-3xl font-bold mb-2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.4 }}
                    >
                      {events[currentIndex].title}
                    </motion.h3>
                    <motion.p 
                      className="text-sm md:text-base mb-3 text-gray-200 max-h-[3rem] overflow-hidden text-ellipsis"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.4, delay: 0.5 }}
                    >
                      {events[currentIndex].description}
                    </motion.p>
                    <motion.div 
                      className="flex flex-wrap gap-3 text-xs md:text-sm"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.6 }}
                    >
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="truncate">{formatDate(events[currentIndex].date)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="truncate">{events[currentIndex].location}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="truncate">{events[currentIndex].organizer}</span>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation Arrows */}
            <motion.button
              onClick={goToPrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full"
              aria-label="Previous event"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </motion.button>
            <motion.button
              onClick={goToNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full"
              aria-label="Next event"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </motion.button>
          </div>

          {/* Preview Thumbnails */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {events.map((event, index) => (
              <motion.button
                key={event.id}
                onClick={() => goToSlide(index)}
                className={`flex-shrink-0 relative rounded-lg overflow-hidden ${
                  index === currentIndex
                    ? "ring-2 ring-blue-500"
                    : "opacity-60"
                }`}
                aria-label={`Go to event ${event.title}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ 
                  opacity: index === currentIndex ? 1 : 0.6,
                  y: 0,
                  scale: index === currentIndex ? 1.05 : 1
                }}
                transition={{ 
                  duration: 0.3,
                  delay: index * 0.05,
                  type: "spring",
                  stiffness: 300
                }}
                whileHover={{ scale: 1.05, opacity: 1 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="w-24 h-16 md:w-32 md:h-20">
                  <img
                    src={event.image}
                    alt={event.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-1 left-1 right-1">
                    <p className="text-[10px] md:text-xs text-white font-semibold truncate">
                      {event.title}
                    </p>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>

          {/* Dots Indicator */}
          <div className="flex justify-center gap-2 mt-3">
            {events.map((_, index) => (
              <motion.button
                key={index}
                onClick={() => goToSlide(index)}
                className={`h-2 rounded-full ${
                  index === currentIndex
                    ? "bg-blue-600"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
                aria-label={`Go to slide ${index + 1}`}
                animate={{
                  width: index === currentIndex ? 32 : 8,
                }}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 300, 
                  damping: 20,
                  duration: 0.3
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

