"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes } from "@/components/ui/BackgroundBoxes";

const Footer = () => {
  const pathname = usePathname();

  const handleLinkClick = (e, href) => {
    if (pathname === href) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <footer className="w-full relative overflow-hidden bg-slate-900 border-t border-slate-700 mt-auto min-h-[300px]">
      <Boxes />
      <div className="absolute inset-0 w-full h-full bg-slate-900 z-20 [mask-image:radial-gradient(transparent,white)] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-30">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Explore Unizg</h3>
            <p className="text-gray-300 text-sm">
              Za studente, od strane studenata. Povezivanje studenata s prilikama.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Brzi linkovi</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link 
                  href="/" 
                  onClick={(e) => handleLinkClick(e, "/")}
                  className="text-gray-300 hover:text-blue-400 transition-colors"
                >
                  Početna
                </Link>
              </li>
              <li>
                <Link 
                  href="/about" 
                  onClick={(e) => handleLinkClick(e, "/about")}
                  className="text-gray-300 hover:text-blue-400 transition-colors"
                >
                  O nama
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-700 pt-6 text-center">
          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} Explore Unizg. Sva prava pridržana.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;