"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import Tooltip from "@/components/ui/Tooltip";

const Navbar = () => {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        if (mobileMenuOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [mobileMenuOpen]);

    return (
        <nav className={`w-full fixed top-0 z-50 transition-all duration-300 ${
            scrolled 
                ? "bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl shadow-lg" 
                : "bg-transparent"
        }`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <Link 
                            href="/" 
                            className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent hover:from-blue-700 hover:to-purple-700 transition-all"
                            aria-label="Explore Unizg - Početna"
                        >
                            Explore Unizg
                        </Link>
                    </div>
                    <div className="hidden md:flex items-center space-x-6">
                        <Link 
                            href="/about" 
                            className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors duration-200 relative group"
                            aria-label="O nama"
                        >
                            O nama
                            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 transition-all group-hover:w-full"></span>
                        </Link>
                        <Tooltip text="Promijeni temu">
                        <ThemeToggle />
                        </Tooltip>
                    </div>
                    <div className="flex md:hidden items-center space-x-2">
                        <Tooltip text="Promijeni temu">
                        <ThemeToggle />
                        </Tooltip>
                        <button 
                            className="text-gray-700 dark:text-gray-300 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            aria-label="Toggle menu"
                            aria-expanded={mobileMenuOpen}
                        >
                            <motion.svg 
                                className="w-6 h-6" 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                                animate={{ rotate: mobileMenuOpen ? 90 : 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                {mobileMenuOpen ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                )}
                            </motion.svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm md:hidden z-40"
                            onClick={() => setMobileMenuOpen(false)}
                        />
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed top-16 right-0 bottom-0 w-64 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl shadow-2xl md:hidden z-50 overflow-y-auto"
                        >
                            <div className="p-6 space-y-4">
                                <Link
                                    href="/"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="block text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors py-2"
                                >
                                    Početna
                                </Link>
                                <Link
                                    href="/about"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="block text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors py-2"
                                >
                                    O nama
                                </Link>
                                <a
                                    href="#explore"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="block text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors py-2"
                                >
                                    Istraži
                                </a>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </nav>
    );
}

export default Navbar;