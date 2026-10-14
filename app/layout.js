import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "Trading Tools",
  description: "Journal & Crypto Screener",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className="bg-slate-950 text-slate-100">
        {/* Navbar */}
        <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-6">
            <Link href="/" className="font-bold text-cyan-400 hover:text-cyan-300">
              Journal
            </Link>
            <Link href="/screener" className="font-bold text-slate-300 hover:text-white">
              Crypto Screener
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}