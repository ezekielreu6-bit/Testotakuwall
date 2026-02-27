// app/page.tsx
"use client";
import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, limit, orderBy } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
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
        limit(10)
      );
      
      const snap = await getDocs(q);
      const videoData = await Promise.all(snap.docs.map(async (d) => {
        const data = d.data() as Wallpaper;
        // REAL-TIME USER FETCHING:
        const userRef = doc(db, "users", data.userId);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() as UserData : undefined;
        
        return { ...data, id: d.id, creator: userData };
      }));

      setVideos(videoData);
      setLoading(false);
    };

    fetchFeed();
  }, []);

  return (
    <main className="h-screen w-full bg-black overflow-y-scroll snap-y snap-mandatory no-scrollbar relative scroll-smooth">
      <header className="fixed top-0 left-0 right-0 p-5 z-50 flex justify-between items-center pointer-events-none">
        <h1 className="text-2xl font-black tracking-tighter text-white drop-shadow-2xl pointer-events-auto italic">
          <span className="text-red-600">OTAKU</span>WALL
        </h1>
      </header>

      {loading ? (
        <div className="h-full w-full flex flex-col items-center justify-center bg-black">
          <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Syncing Feed...</p>
        </div>
      ) : (
        videos.map((vid) => (
          <VideoPlayer key={vid.id} video={vid} muted={muted} setMuted={setMuted} />
        ))
      )}

      <Navbar />
    </main>
  );
}

function VideoPlayer({ video, muted, setMuted }: { video: Wallpaper & { creator?: UserData }, muted: boolean, setMuted: any }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          videoRef.current?.play().catch(() => {});
          setIsPlaying(true);
        } else {
          videoRef.current?.pause();
          setIsPlaying(false);
        }
      },
      { threshold: 0.6 }
    );
    if (videoRef.current) observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="w-full h-full snap-start snap-always relative flex justify-center items-center bg-zinc-950">
      <video
        ref={videoRef}
        src={video.url}
        loop
        muted={muted}
        playsInline
        className="w-full h-full object-cover md:object-contain md:max-w-[480px] bg-black"
        onClick={() => {
          if (isPlaying) videoRef.current?.pause();
          else videoRef.current?.play();
          setIsPlaying(!isPlaying);
        }}
      />

      {/* Side Actions */}
      <div className="absolute right-3 bottom-28 flex flex-col gap-6 items-center z-30">
        <div className="relative mb-2">
          <Link href={`/user/${video.userId}`}>
            <img 
              src={video.creator?.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${video.userId}`} 
              className="w-12 h-12 rounded-full border-2 border-white object-cover"
              alt="avatar"
            />
          </Link>
          <button className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 rounded-full p-1 border-2 border-black">
            <Plus className="w-3 h-3 text-white" />
          </button>
        </div>
        
        <button className="flex flex-col items-center gap-1 group">
          <Heart className="w-8 h-8 text-white drop-shadow-lg group-active:scale-125 transition-transform" />
          <span className="text-[10px] font-black text-white drop-shadow-md">{video.likes?.length || 0}</span>
        </button>

        <button className="flex flex-col items-center gap-1">
          <MessageCircle className="w-8 h-8 text-white drop-shadow-lg" />
          <span className="text-[10px] font-black text-white drop-shadow-md">Chat</span>
        </button>

        <button className="flex flex-col items-center gap-1">
          <Share2 className="w-8 h-8 text-white drop-shadow-lg" />
          <span className="text-[10px] font-black text-white drop-shadow-md">Share</span>
        </button>
      </div>

      {/* User Info Overlay */}
      <div className="absolute bottom-0 left-0 w-full p-5 pb-24 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none">
        <Link href={`/user/${video.userId}`} className="pointer-events-auto flex items-center gap-1 mb-2">
          <span className="font-black text-white text-lg drop-shadow-md">
            @{video.creator?.username || video.username}
          </span>
          {video.creator?.isPremium && <VerifiedBadge className="w-4 h-4" />}
        </Link>
        <p className="text-sm text-zinc-200 line-clamp-2 max-w-[80%] font-medium drop-shadow-md">
          {video.title}
        </p>
      </div>

      {/* Mute Button */}
      <button 
        onClick={() => setMuted(!muted)} 
        className="absolute bottom-24 left-5 bg-black/40 backdrop-blur-md p-3 rounded-full z-30 pointer-events-auto border border-white/10"
      >
        {muted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
      </button>
    </div>
  );
}