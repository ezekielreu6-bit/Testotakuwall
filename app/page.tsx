// app/page.tsx
"use client";
import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, orderBy, limit } from "firebase/firestore";
import { Heart, MessageCircle, Share2, Volume2, VolumeX, Plus } from "lucide-react";
import Navbar from "@/components/Navbar";
import VerifiedBadge from "@/components/VerifiedBadge";
import Link from "next/link";

export default function Feed() {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const fetchFeed = async () => {
      const q = query(collection(db, "wallpapers"), where("fileType", "==", "video"), limit(10));
      const snap = await getDocs(q);
      const data = await Promise.all(snap.docs.map(async (d) => {
        const item = d.data();
        const u = await getDoc(doc(db, "users", item.userId));
        return { ...item, id: d.id, creator: u.exists() ? u.data() : null };
      }));
      setVideos(data);
      setLoading(false);
    };
    fetchFeed();
  }, []);

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden">
      {/* HEADER: Floating over everything */}
      <header className="absolute top-0 left-0 right-0 p-6 z-50 pointer-events-none">
        <h1 className="text-2xl font-black italic tracking-tighter text-white drop-shadow-lg pointer-events-auto">
          <span className="text-red-600">OTAKU</span>WALL
        </h1>
      </header>

      {/* FEED: The scrolling part */}
      <main className="feed-container">
        {loading ? (
          <div className="h-full w-full flex items-center justify-center bg-black">
            <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          videos.map((vid) => (
            <div key={vid.id} className="feed-item">
              <video
                src={vid.url}
                className="h-full w-full object-cover md:object-contain md:max-w-[450px]"
                loop
                muted={muted}
                autoPlay
                playsInline
                onClick={(e) => (e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause())}
              />

              {/* SIDE BUTTONS */}
              <div className="absolute right-4 bottom-32 flex flex-col gap-6 items-center z-40">
                <div className="relative">
                  <img src={vid.creator?.photoURL} className="w-12 h-12 rounded-full border-2 border-white object-cover" />
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 rounded-full p-1 border-2 border-black">
                    <Plus className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div className="flex flex-col items-center"><Heart className="w-8 h-8 fill-white" /><span className="text-[10px] font-black">{vid.likes?.length || 0}</span></div>
                <div className="flex flex-col items-center"><MessageCircle className="w-8 h-8 fill-white" /><span className="text-[10px] font-black">Chat</span></div>
                <div className="flex flex-col items-center"><Share2 className="w-8 h-8 fill-white" /><span className="text-[10px] font-black">Share</span></div>
              </div>

              {/* BOTTOM OVERLAY */}
              <div className="absolute bottom-0 left-0 w-full p-6 pb-28 bg-gradient-to-t from-black/80 to-transparent z-30">
                <div className="flex items-center gap-1 mb-2">
                  <span className="font-black text-white text-lg text-shadow">@{vid.creator?.username || 'otaku'}</span>
                  {vid.creator?.isPremium && <VerifiedBadge className="w-4 h-4" />}
                </div>
                <p className="text-sm text-zinc-200 text-shadow font-medium line-clamp-2">{vid.title}</p>
              </div>

              {/* MUTE TOGGLE */}
              <button onClick={() => setMuted(!muted)} className="absolute bottom-28 left-6 z-40 bg-black/40 p-3 rounded-full border border-white/10 backdrop-blur-md">
                {muted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
              </button>
            </div>
          ))
        )}
      </main>

      {/* NAVBAR: Stuck at the bottom edge */}
      <Navbar />
    </div>
  );
}