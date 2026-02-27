// components/Navbar.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Grid, Plus, MessageSquare, User } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const isActive = (p: string) => pathname === p;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-xl border-t border-white/5 z-[100] px-6 py-3 flex justify-between items-center pb-safe">
      <Link href="/" className={isActive("/") ? "text-white" : "text-zinc-500"}>
        <Home className="w-6 h-6" />
      </Link>
      
      <Link href="/category" className={isActive("/category") ? "text-red-500" : "text-zinc-500"}>
        <Grid className="w-6 h-6" />
      </Link>

      <Link href="/upload" className="bg-gradient-to-r from-red-600 to-pink-600 text-white p-3 rounded-2xl -mt-10 shadow-xl shadow-red-600/40 active:scale-95 transition-all">
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