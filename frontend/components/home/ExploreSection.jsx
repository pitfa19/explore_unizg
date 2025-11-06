import UdrugeList from "./UdrugeList";
import FakultetiList from "./FakultetiList";
import PosloviList from "./PosloviList";

export default function ExploreSection() {
  return (
    <section className="w-full py-16 px-4 sm:px-6 lg:px-8 relative">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Istražite
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Otkrijte prilike, fakultete i udruge
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <UdrugeList />
          <FakultetiList />
          <PosloviList />
        </div>
      </div>
    </section>
  );
}

