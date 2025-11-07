import { memo } from "react";
import UdrugeList from "./UdrugeList";
import FakultetiList from "./FakultetiList";
import PosloviList from "./PosloviList";

const ExploreSection = memo(function ExploreSection() {
  return (
    <section id="explore" className="w-full py-20 md:py-24 lg:py-32 px-4 sm:px-6 lg:px-8 relative">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
            Istražite
          </h2>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Otkrijte prilike, fakultete i udruge koje vam odgovaraju
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          <UdrugeList />
          <FakultetiList />
          <PosloviList />
        </div>
      </div>
    </section>
  );
});

export default ExploreSection;

