export default function About() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            O Explore Unizg
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Za studente, od strane studenata.
          </p>
        </div>

        {/* Mission Section */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold text-gray-900 dark:text-white mb-6">
            Naša misija
          </h2>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border-l-4 border-blue-600">
            <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
              <strong>Misija je ubrzati i poboljšati točnost povezivanja studenta i poslodavca.</strong>
            </p>
            <p className="text-gray-600 dark:text-gray-400 mt-4">
              Naš cilj je ubrzati i poboljšati točnost povezivanja studenata s poslodavcima, 
              čineći lakšim za studente da pronađu prilike, a za poslodavce da pronađu pravi talent.
            </p>
          </div>
        </section>

        {/* What We Do Section */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold text-gray-900 dark:text-white mb-6">
            Što radimo
          </h2>
          <div className="space-y-6">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Povezivanje studenata s prilikama
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Pomažemo studentima da otkriju radne prilike, prakse i djelomične pozicije 
                koje su savršene za njihov raspored i karijerne ciljeve.
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Istraživanje studentskih udruga
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Otkrijte i povežite se sa studentskim udrugama i organizacijama na Sveučilištu u Zagrebu, 
                pomažući vam da pronađete zajednice koje odgovaraju vašim interesima.
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Navigacija fakultetima
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Pregledajte različite fakultete i pronađite informacije o programima, prilikama 
                i resursima dostupnim na svakom fakultetu.
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Vizualizacija mreže
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Koristite naše interaktivne mrežne grafove za vizualizaciju veza između studenata, 
                udruga, fakulteta i radnih prilika.
              </p>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold text-gray-900 dark:text-white mb-6">
            Ključne značajke
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Pametno pretraživanje
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Pronađite točno ono što tražite uz našu inteligentnu sučelje za pretraživanje.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Mrežne veze
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Vizualizirajte i shvatite veze kroz interaktivne mrežne grafove.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Provjerene prilike
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Svi oglasi za posao i prilike su provjereni za autentičnost.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Uvijek ažurirano
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Naša platforma se kontinuirano ažurira s najnovijim prilikama i informacijama.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

