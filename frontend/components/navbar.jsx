"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import ThemeToggle from "@/components/ui/ThemeToggle";

const Navbar = () => {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <nav className={`w-full fixed top-0 z-50 transition-all duration-300 ${
            scrolled 
                ? "bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl shadow-lg" 
                : "bg-transparent"
        }`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent hover:from-blue-700 hover:to-purple-700 transition-all">
                            Explore Unizg
                        </Link>
                    </div>
                    <div className="hidden md:flex items-center space-x-6">
                        <Link href="/about" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors duration-200 relative group">
                            O nama
                            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 transition-all group-hover:w-full"></span>
                        </Link>
                        <ThemeToggle />
                    </div>
                    <div className="flex md:hidden items-center space-x-2">
                        <ThemeToggle />
                        <button className="text-gray-700 dark:text-gray-300 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}

export default Navbar;