// app/page.tsx
"use client";
import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, limit, getDocs, orderBy } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { Heart, MessageCircle, Share2, Volume2, VolumeX, Plus } from "lucide-react";
import { Wallpaper } from "@/types";

export default function Feed() {
  const { user, userData } = useAuth();
  const [videos, setVideos] = useState<Wallpaper[]>([]);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const fetchVideos = async () => {
      const q = query(collection(db, "wallpapers"), where("fileType", "==", "video"), limit(10));
      const snap = await getDocs(q);
      setVideos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Wallpaper)));
    };
    fetchVideos();
  },[]);

  return (
    <main className="h-screen w-full bg-black overflow-y-scroll snap-y snap-mandatory no-scrollbar relative">
      <header className="fixed top-0 left-0 right-0 p-4 z-50 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <h1 className="text-2xl font-black tracking-tighter text-white drop-shadow-lg pointer-events-auto">
          <span className="text-red-600">OTAKU</span>WALL
        </h1>
      </header>

      {videos.map((vid) => (
        <VideoPlayer key={vid.id} video={vid} muted={muted} setMuted={setMuted} />
      ))}
    </main>
  );
}

// Separate component for IntersectionObserver Logic
function VideoPlayer({ video, muted, setMuted }: { video: Wallpaper, muted: boolean, setMuted: any }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const[isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          videoRef.current?.play();
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
  },[]);

  const togglePlay = () => {
    if (isPlaying) videoRef.current?.pause();
    else videoRef.current?.play();
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="w-full h-full snap-start snap-always relative flex justify-center items-center bg-zinc-900">
      <video
        ref={videoRef}
        src={video.url}
        loop
        muted={muted}
        playsInline
        onClick={togglePlay}
        className="w-full h-full object-cover md:object-contain md:max-w-[500px]"
      />

      <button 
        onClick={() => setMuted(!muted)} 
        className="absolute bottom-32 left-4 bg-black/50 p-3 rounded-full backdrop-blur-md z-40"
      >
        {muted ? <VolumeX className="text-white w-5 h-5" /> : <Volume2 className="text-white w-5 h-5" />}
      </button>

      {/* Video Info Overlay */}
      <div className="absolute bottom-0 left-0 w-full p-4 pb-20 bg-gradient-to-t from-black/80 to-transparent z-20 pointer-events-none">
        <h2 className="font-bold text-lg text-white">@{video.username}</h2>
        <p className="text-sm text-zinc-300">{video.title}</p>
      </div>

      {/* Sidebar Buttons */}
      <div className="absolute right-4 bottom-24 flex flex-col gap-6 items-center z-30">
        <div className="relative">
          <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${video.userId}`} className="w-12 h-12 rounded-full border-2 border-white bg-zinc-800" />
          <button className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 rounded-full p-1 border-2 border-black">
            <Plus className="w-3 h-3 text-white" />
          </button>
        </div>
        <button className="flex flex-col items-center gap-1">
          <Heart className="w-8 h-8 text-white" />
          <span className="text-[10px] font-bold text-white">{video.likes?.length || 0}</span>
        </button>
        <button className="flex flex-col items-center gap-1">
          <MessageCircle className="w-8 h-8 text-white" />
          <span className="text-[10px] font-bold text-white">Chat</span>
        </button>
        <button className="flex flex-col items-center gap-1">
          <Share2 className="w-8 h-8 text-white" />
          <span className="text-[10px] font-bold text-white">Share</span>
        </button>
      </div>
    </div>
  );
}