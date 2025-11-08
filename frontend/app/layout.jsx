import { Poppins } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import ThemeInitializer from "@/components/ui/ThemeInitializer";
import { ToastProvider } from "@/components/ui/Toast";

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-poppins",
});

export const metadata = {
  title: "Explore UNIZG",
  description: "Za studente, od strane studenata.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="hr" suppressHydrationWarning>
      <body
        className={`${poppins.variable} antialiased flex flex-col min-h-screen`}
      >
        <ThemeInitializer />
        <ThemeProvider>
          <ToastProvider>
          <Navbar/>
          <main className="flex-1">
            {children}
          </main>
          <Footer/>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
