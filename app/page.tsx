"use client";
import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, limit, orderBy } from "firebase/firestore";
import { 
  Heart, MessageCircle, Share2, Volume2, VolumeX, 
  Plus, X, Link as LinkIcon, Send, MoreHorizontal 
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";
import VerifiedBadge from "@/components/VerifiedBadge";
import Link from "next/link";

export default function Feed() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  
  // Drawer States
  const [showShare, setShowShare] = useState(false);
  const [activeVideo, setActiveVideo] = useState<any>(null);

  useEffect(() => {
    const fetchFeed = async () => {
      const q = query(
        collection(db, "wallpapers"), 
        where("fileType", "==", "video"), 
        orderBy("createdAt", "desc"),
        limit(10)
      );
      const snap = await getDocs(q);
      const data = await Promise.all(snap.docs.map(async (d) => {
        const item = d.data();
        const userSnap = await getDoc(doc(db, "users", item.userId));
        return { ...item, id: d.id, creator: userSnap.exists() ? userSnap.data() : null };
      }));
      setVideos(data);
      setLoading(false);
    };
    fetchFeed();
  }, []);

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden">
      
      {/* 1. HEADER: Absolute Floating */}
      <header className="absolute top-0 left-0 right-0 p-6 z-50 pointer-events-none pt-safe">
        <h1 className="text-2xl font-black italic tracking-tighter text-white drop-shadow-lg pointer-events-auto">
          <span className="text-red-600">OTAKU</span>WALL
        </h1>
      </header>

      {/* 2. VIDEO FEED */}
      <main className="feed-container no-scrollbar">
        {loading ? (
          <div className="h-full w-full flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          videos.map((vid) => (
            <VideoSlide key={vid.id} video={vid} muted={muted} setMuted={setMuted} onShare={() => { setActiveVideo(vid); setShowShare(true); }} />
          ))
        )}
      </main>

      {/* 3. SHARE DRAWER */}
      {showShare && (
        <div className="fixed inset-0 z-[200]">
          <div className="drawer-mask" onClick={() => setShowShare(false)} />
          <div className="otaku-drawer p-6 animate-in slide-in-from-bottom duration-300">
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500">Share Sync</h3>
              <button onClick={() => setShowShare(false)} className="bg-white/5 p-2 rounded-full"><X className="w-4 h-4" /></button>
            </div>
            
            <div className="flex gap-6 overflow-x-auto no-scrollbar pb-6 border-b border-white/5 mb-6">
              <ShareAction icon={<LinkIcon />} label="Link" color="bg-zinc-800" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/watch/${activeVideo?.id}`); setShowShare(false); }} />
              <ShareAction icon={<Send className="fill-white w-5 h-5" />} label="WhatsApp" color="bg-green-600" onClick={() => window.open(`https://wa.me/?text=Check this out on OtakuWall! ${window.location.origin}/watch/${activeVideo?.id}`)} />
              <ShareAction icon={<MoreHorizontal />} label="More" color="bg-blue-600" />
            </div>

            <button onClick={() => setShowShare(false)} className="w-full py-4 bg-zinc-900 rounded-2xl font-bold text-sm text-zinc-400">Cancel</button>
          </div>
        </div>
      )}

      {/* 4. NAVBAR: Stuck at bottom */}
      <Navbar />
    </div>
  );
}

function VideoSlide({ video, muted, setMuted, onShare }: { video: any, muted: boolean, setMuted: any, onShare: any }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) videoRef.current?.play().catch(() => {});
      else { videoRef.current?.pause(); if(videoRef.current) videoRef.current.currentTime = 0; }
    }, { threshold: 0.6 });
    if (videoRef.current) observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="feed-item">
      {/* Video centered and covering background */}
      <video
        ref={videoRef}
        src={video.url}
        loop muted={muted} playsInline
        className="h-full w-full object-cover md:object-contain md:max-w-[480px]"
        onClick={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()}
      />

      {/* Side Actions */}
      <div className="absolute right-4 bottom-32 flex flex-col gap-6 items-center z-40">
        <div className="relative mb-2">
          <Link href={`/user/${video.userId}`}>
            <img src={video.creator?.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${video.userId}`} className="w-12 h-12 rounded-full border-2 border-white object-cover" />
          </Link>
          <button className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 rounded-full p-1 border-2 border-black">
            <Plus className="w-3 h-3 text-white" />
          </button>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Heart className="w-8 h-8 fill-white drop-shadow-lg active:scale-125 transition-transform" />
          <span className="text-[10px] font-black text-shadow uppercase">{video.likes?.length || 0}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <MessageCircle className="w-8 h-8 fill-white drop-shadow-lg" />
          <span className="text-[10px] font-black text-shadow uppercase">Chat</span>
        </div>
        <button onClick={onShare} className="flex flex-col items-center gap-1">
          <Share2 className="w-8 h-8 fill-white drop-shadow-lg" />
          <span className="text-[10px] font-black text-shadow uppercase">Share</span>
        </button>
      </div>

      {/* Info Overlay */}
      <div className="absolute bottom-0 left-0 w-full p-6 pb-28 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-30 pointer-events-none">
        <Link href={`/user/${video.userId}`} className="pointer-events-auto flex items-center gap-1 mb-2">
          <span className="font-black text-lg text-white text-shadow tracking-tight">@{video.creator?.username || 'otaku'}</span>
          {video.creator?.isPremium && <VerifiedBadge className="w-4 h-4" />}
        </Link>
        <p className="text-sm text-zinc-100 text-shadow font-semibold line-clamp-2 max-w-[80%]">{video.title}</p>
      </div>

      {/* Mute Button */}
      <button onClick={() => setMuted(!muted)} className="absolute bottom-28 left-6 z-40 bg-black/40 p-3 rounded-full border border-white/10 backdrop-blur-md">
        {muted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
      </button>
    </section>
  );
}

function ShareAction({ icon, label, color, onClick }: { icon: any, label: string, color: string, onClick?: any }) {
  return (
    <div className="flex flex-col items-center gap-2 min-w-[70px] cursor-pointer" onClick={onClick}>
      <div className={`w-14 h-14 ${color} rounded-full flex items-center justify-center text-white shadow-lg`}>
        {icon}
      </div>
      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{label}</span>
    </div>
  );
}