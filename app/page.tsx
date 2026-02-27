"use client";
import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, limit, orderBy } from "firebase/firestore";
import { Heart, MessageCircle, Share2, Volume2, VolumeX, Plus, X, Link as LinkIcon, WhatsApp } from "lucide-react";
import Navbar from "@/components/Navbar";
import VerifiedBadge from "@/components/VerifiedBadge";
import Link from "next/link";

export default function Feed() {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  
  // Drawer States
  const [showShare, setShowShare] = useState(false);
  const [activeVideo, setActiveVideo] = useState<any>(null);

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

  const openShare = (video: any) => {
    setActiveVideo(video);
    setShowShare(true);
  };

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden">
      {/* HEADER: Absolute, so it doesn't push video down */}
      <header className="absolute top-0 left-0 right-0 p-6 z-50 pointer-events-none">
        <h1 className="text-2xl font-black italic tracking-tighter text-white drop-shadow-lg pointer-events-auto">
          <span className="text-red-600">OTAKU</span>WALL
        </h1>
      </header>

      {/* MAIN FEED */}
      <main className="feed-container no-scrollbar">
        {loading ? (
          <div className="h-full w-full flex items-center justify-center">
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

              {/* ACTION BUTTONS (Right Side) */}
              <div className="absolute right-4 bottom-32 flex flex-col gap-6 items-center z-40">
                <div className="relative mb-2">
                  <Link href={`/user/${vid.userId}`}>
                    <img src={vid.creator?.photoURL} className="w-12 h-12 rounded-full border-2 border-white object-cover" />
                  </Link>
                  <button className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 rounded-full p-1 border-2 border-black">
                    <Plus className="w-3 h-3 text-white" />
                  </button>
                </div>
                
                <div className="flex flex-col items-center">
                  <Heart className="w-8 h-8 fill-white drop-shadow-md" />
                  <span className="text-[10px] font-black text-shadow">{vid.likes?.length || 0}</span>
                </div>

                <div className="flex flex-col items-center">
                  <MessageCircle className="w-8 h-8 fill-white drop-shadow-md" />
                  <span className="text-[10px] font-black text-shadow">Chat</span>
                </div>

                <button onClick={() => openShare(vid)} className="flex flex-col items-center">
                  <Share2 className="w-8 h-8 fill-white drop-shadow-md" />
                  <span className="text-[10px] font-black text-shadow">Share</span>
                </button>
              </div>

              {/* INFO BOX (Bottom Left) */}
              <div className="absolute bottom-0 left-0 w-full p-6 pb-28 bg-gradient-to-t from-black/80 to-transparent z-30 pointer-events-none">
                <div className="flex items-center gap-1 mb-2 pointer-events-auto">
                  <span className="font-black text-white text-lg text-shadow">@{vid.creator?.username || 'otaku'}</span>
                  {vid.creator?.isPremium && <VerifiedBadge className="w-4 h-4" />}
                </div>
                <p className="text-sm text-zinc-200 text-shadow font-medium line-clamp-2 max-w-[80%]">{vid.title}</p>
              </div>

              {/* MUTE TOGGLE (Bottom Left) */}
              <button onClick={() => setMuted(!muted)} className="absolute bottom-28 left-6 z-40 bg-black/40 p-3 rounded-full border border-white/10 backdrop-blur-md">
                {muted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
              </button>
            </div>
          ))
        )}
      </main>

      {/* SHARE DRAWER */}
      {showShare && (
        <>
          <div className="drawer-mask" onClick={() => setShowShare(false)} />
          <div className="drawer-content p-6 pb-12 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500">Share Sync</h3>
              <button onClick={() => setShowShare(false)} className="text-zinc-500"><X /></button>
            </div>
            
            <div className="flex gap-6 overflow-x-auto no-scrollbar pb-4">
              <div className="flex flex-col items-center gap-2 min-w-[70px]" onClick={() => { navigator.clipboard.writeText(window.location.href); alert("Copied!"); }}>
                <div className="w-14 h-14 bg-zinc-800 rounded-full flex items-center justify-center"><LinkIcon /></div>
                <span className="text-[10px] font-bold text-zinc-500">Link</span>
              </div>
              <div className="flex flex-col items-center gap-2 min-w-[70px]">
                <div className="w-14 h-14 bg-green-600 rounded-full flex items-center justify-center"><X className="w-6 h-6" /></div>
                <span className="text-[10px] font-bold text-zinc-500">WhatsApp</span>
              </div>
              <div className="flex flex-col items-center gap-2 min-w-[70px]">
                <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center"><Share2 /></div>
                <span className="text-[10px] font-bold text-zinc-500">More</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* NAVBAR */}
      <Navbar />
    </div>
  );
}