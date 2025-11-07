import { Suspense, lazy } from "react";
import ChatSection from "@/components/home/ChatSection";
import ExploreSection from "@/components/home/ExploreSection";
import HeroSection from "@/components/home/HeroSection";
import BackgroundGradient from "@/components/ui/BackgroundGradient";
import { SkeletonCard } from "@/components/ui/Skeleton";

// Lazy load teške komponente
const NetworkGraph = lazy(() => import("@/components/home/NetworkGraph"));
const MotivationSection = lazy(() => import("@/components/home/MotivationSection"));
const EventsSlideshow = lazy(() => import("@/components/home/EventsSlideshow"));

// Loading component za NetworkGraph
const NetworkGraphSkeleton = () => (
  <section className="w-full py-20 md:py-24 lg:py-32 px-4 sm:px-6 lg:px-8 relative">
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-12">
        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg w-64 mx-auto mb-4 animate-pulse" />
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-lg w-96 mx-auto animate-pulse" />
      </div>
      <div className="w-full h-[600px] bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
    </div>
  </section>
);

// Loading component za sekcije
const SectionSkeleton = () => (
  <section className="w-full py-20 md:py-24 lg:py-32 px-4 sm:px-6 lg:px-8 relative">
    <div className="max-w-7xl mx-auto">
      <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg w-64 mx-auto mb-12 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  </section>
);

export default function Home() {
  return (
    <div className="min-h-screen relative">
      {/* Skip to content link for accessibility */}
      <a
        href="#explore"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:shadow-lg"
      >
        Preskoči na glavni sadržaj
      </a>
      <BackgroundGradient />
      <div className="flex flex-col relative z-10">
        <div className="pt-16">
          <HeroSection />
        </div>
        {/* Visual Separator */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent my-8 md:my-12" />
        
        {/* Lazy loaded NetworkGraph */}
        <Suspense fallback={<NetworkGraphSkeleton />}>
          <NetworkGraph />
        </Suspense>
        
        {/* Visual Separator */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent my-8 md:my-12" />
        
        <ChatSection />
        
        {/* Visual Separator */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent my-8 md:my-12" />
        
        <ExploreSection />
        
        {/* Visual Separator */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent my-8 md:my-12" />
        
        {/* Lazy loaded MotivationSection */}
        <Suspense fallback={<SectionSkeleton />}>
          <MotivationSection />
        </Suspense>
        
        {/* Visual Separator */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent my-8 md:my-12" />
        
        {/* Lazy loaded EventsSlideshow */}
        <Suspense fallback={<SectionSkeleton />}>
          <EventsSlideshow />
        </Suspense>
      </div>
    </div>
  );
}
