import NetworkGraph from "@/components/home/NetworkGraph";
import ChatSection from "@/components/home/ChatSection";
import ExploreSection from "@/components/home/ExploreSection";
import HeroSection from "@/components/home/HeroSection";
import BackgroundGradient from "@/components/ui/BackgroundGradient";

export default function Home() {
  return (
    <div className="min-h-screen relative">
      <BackgroundGradient />
      <div className="flex flex-col relative z-10">
        <div className="pt-16">
          <HeroSection />
        </div>
        <NetworkGraph />
        <ChatSection />
        <ExploreSection />
      </div>
    </div>
  );
}
