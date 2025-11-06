"use client";

export default function HeroSection() {
  return (
    <section className="relative w-full py-24 md:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="max-w-7xl mx-auto text-center relative z-10">
        <div className="inline-block mb-2">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-clip-text text-transparent animate-gradient bg-[length:200%_auto] pb-4">
            Explore Unizg
          </h1>
        </div>
        <p className="text-xl md:text-2xl text-gray-700 dark:text-gray-200 mb-4 max-w-3xl mx-auto font-medium">
          Za studente, od strane studenata
        </p>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Povezujemo studente s prilikama, udrugama i fakultetima Sveučilišta u Zagrebu
        </p>
      </div>
    </section>
  );
}

