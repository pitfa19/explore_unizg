import NetworkGraph from "@/components/home/NetworkGraph";
import ChatSection from "@/components/home/ChatSection";
import ExploreSection from "@/components/home/ExploreSection";
import MotivationSection from "@/components/home/MotivationSection";
import EventsSlideshow from "@/components/home/EventsSlideshow";
import HeroSection from "@/components/home/HeroSection";
import BackgroundGradient from "@/components/ui/BackgroundGradient";

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
        
        <NetworkGraph />
        
        {/* Visual Separator */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent my-8 md:my-12" />
        
        <ChatSection />
        
        {/* Visual Separator */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent my-8 md:my-12" />
        
        <ExploreSection />
        
        {/* Visual Separator */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent my-8 md:my-12" />
        
        <MotivationSection />
        
        {/* Visual Separator */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent my-8 md:my-12" />
        
        <EventsSlideshow />
      </div>
    </div>
  );
}
