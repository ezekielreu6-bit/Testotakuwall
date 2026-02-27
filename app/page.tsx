// app/page.tsx
"use client";
import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, orderBy, limit } from "firebase/firestore";
import { Heart, MessageCircle, Share2, Volume2, VolumeX, Plus } from "lucide-react";
import { Wallpaper, UserData } from "@/types";
import Navbar from "@/components/Navbar";
import VerifiedBadge from "@/components/VerifiedBadge";
import Link from "next/link";

export default function Feed() {
  const [videos, setVideos] = useState<(Wallpaper & { creator?: UserData })[]>([]);
  const [muted, setMuted] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeed = async () => {
      const q = query(
        collection(db, "wallpapers"), 
        where("fileType", "==", "video"), 
        orderBy("createdAt", "desc"),
        limit(15)
      );
      
      const snap = await getDocs(q);
      const videoData = await Promise.all(snap.docs.map(async (d) => {
        const data = d.data() as Wallpaper;
        const userSnap = await getDoc(doc(db, "users", data.userId));
        return { ...data, id: d.id, creator: userSnap.exists() ? userSnap.data() as UserData : undefined };
      }));

      setVideos(videoData);
      setLoading(false);
    };
    fetchFeed();
  }, []);

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative">
      {/* 1. Header Area */}
      <header className="fixed top-0 left-0 right-0 p-5 z-50 flex items-center pointer-events-none">
        <h1 className="text-2xl font-black tracking-tighter text-white italic drop-shadow-lg pointer-events-auto">
          <span className="text-red-600">OTAKU</span>WALL
        </h1>
      </header>

      {/* 2. Main Scrollable Area */}
      <main className="feed-container no-scrollbar">
        {loading ? (
          <div className="h-full w-full flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          videos.map((vid) => (
            <VideoSlide key={vid.id} video={vid} muted={muted} setMuted={setMuted} />
          ))
        )}
      </main>

      {/* 3. FIXED BOTTOM NAVIGATION */}
      <Navbar />
    </div>
  );
}

function VideoSlide({ video, muted, setMuted }: { video: any, muted: boolean, setMuted: any }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) videoRef.current?.play();
      else videoRef.current?.pause();
    }, { threshold: 0.7 });
    if (videoRef.current) observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="feed-item">
      {/* THE VIDEO (Centered automatically by .feed-item) */}
      <video
        ref={videoRef}
        src={video.url}
        loop
        muted={muted}
        playsInline
        className="h-full w-full object-cover md:object-contain md:max-w-[450px]"
        onClick={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()}
      />

      {/* Side Actions (Right aligned) */}
      <div className="absolute right-4 bottom-32 flex flex-col gap-6 items-center z-30">
        <div className="relative">
          <Link href={`/user/${video.userId}`}>
            <img src={video.creator?.photoURL} className="w-12 h-12 rounded-full border-2 border-white object-cover shadow-xl" />
          </Link>
          <button className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 rounded-full p-1 border-2 border-black">
            <Plus className="w-3 h-3 text-white" />
          </button>
        </div>
        <ActionBtn icon={<Heart className="w-8 h-8 fill-white" />} count={video.likes?.length || 0} />
        <ActionBtn icon={<MessageCircle className="w-8 h-8 fill-white" />} count="Chat" />
        <ActionBtn icon={<Share2 className="w-8 h-8 fill-white" />} count="Share" />
      </div>

      {/* Info Overlay (Bottom Left) */}
      <div className="absolute bottom-0 left-0 w-full p-6 pb-28 bg-gradient-to-t from-black/80 to-transparent z-20 pointer-events-none">
        <div className="flex items-center gap-1 mb-2 pointer-events-auto">
          <Link href={`/user/${video.userId}`} className="font-black text-lg text-white text-shadow">
            @{video.creator?.username || 'otaku'}
          </Link>
          {video.creator?.isPremium && <VerifiedBadge className="w-4 h-4" />}
        </div>
        <p className="text-sm text-zinc-200 text-shadow line-clamp-2 max-w-[80%]">{video.title}</p>
      </div>

      {/* Mute Toggle */}
      <button onClick={() => setMuted(!muted)} className="absolute bottom-28 left-6 z-40 bg-black/40 p-3 rounded-full border border-white/10 backdrop-blur-md">
        {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>
    </section>
  );
}

function ActionBtn({ icon, count }: { icon: any, count: any }) {
  return (
    <button className="flex flex-col items-center gap-1">
      <div className="drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]">{icon}</div>
      <span className="text-[10px] font-black text-white text-shadow uppercase">{count}</span>
    </button>
  );
}