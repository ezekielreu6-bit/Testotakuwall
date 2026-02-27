// components/Navbar.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Grid, Plus, MessageSquare, User } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-lg border-t border-white/10 z-50 px-6 py-3 flex justify-between items-center pb-safe">
      <Link href="/" className={isActive("/") ? "text-white" : "text-zinc-500"}>
        <Home className="w-6 h-6" />
      </Link>
      
      <Link href="/category" className={isActive("/category") ? "text-red-500" : "text-zinc-500"}>
        <Grid className="w-6 h-6" />
      </Link>

      <Link href="/upload" className="bg-gradient-to-r from-red-600 to-pink-600 text-white p-3 rounded-xl -mt-10 shadow-lg shadow-red-600/40 active:scale-95 transition">
        <Plus className="w-7 h-7" />
      </Link>

      <Link href="/inbox" className={isActive("/inbox") ? "text-white" : "text-zinc-500"}>
        <MessageSquare className="w-6 h-6" />
      </Link>

      <Link href="/profile" className={isActive("/profile") ? "text-white" : "text-zinc-500"}>
        <User className="w-6 h-6" />
      </Link>
    </nav>
  );
}