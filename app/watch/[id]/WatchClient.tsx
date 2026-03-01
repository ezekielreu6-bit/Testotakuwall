// app/watch/[id]/WatchClient.tsx
"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { Wallpaper } from "@/types";

export default function WatchClient({ id, filterUid }: { id: string, filterUid?: string }) {
  const router = useRouter();
  const [videos, setVideos] = useState<Wallpaper[]>([]);
  const [muted, setMuted] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        let fetchedVideos: Wallpaper[] = [];

        // 1. Fetch the target video
        const targetDoc = await getDoc(doc(db, "wallpapers", id));
        if (!targetDoc.exists()) {
          setLoading(false);
          return;
        }
        
        const targetData = { id: targetDoc.id, ...targetDoc.data() } as Wallpaper;
        fetchedVideos.push(targetData);

        // 2. Logic: If UID exists, fetch the user's feed. If not, STOP (Shared link mode)
        if (filterUid) {
          const q = query(
            collection(db, "wallpapers"), 
            where("userId", "==", filterUid), 
            where("fileType", "==", "video"),
            orderBy("createdAt", "desc")
          );
          
          const snap = await getDocs(q);
          const otherVideos = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Wallpaper))
            .filter(v => v.id !== id);

          setVideos([...fetchedVideos, ...otherVideos]);
        } else {
          // No UID in URL? -> User only sees the shared video.
          setVideos(fetchedVideos);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [id, filterUid]);

  if (loading) return (
    <div className="h-screen bg-black flex items-center justify-center">
      <div className="otaku-spinner"></div>
    </div>
  );

  return (
    <main className="h-screen w-full bg-black feed-container no-scrollbar relative">
      <button onClick={() => router.back()} className="fixed top-6 left-6 z-50 bg-black/50 p-3 rounded-full text-white backdrop-blur-md border border-white/10 active:scale-90 transition">
        <ArrowLeft className="w-5 h-5" />
      </button>

      <button onClick={() => setMuted(!muted)} className="fixed top-6 right-6 z-50 bg-black/50 p-3 rounded-full text-white backdrop-blur-md border border-white/10 active:scale-90 transition">
        {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>

      {videos.map((vid) => (
        <VideoPlayer key={vid.id} video={vid} muted={muted} />
      ))}
    </main>
  );
}

function VideoPlayer({ video, muted }: { video: Wallpaper, muted: boolean }) {
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
    <div className="feed-item">
      <video ref={videoRef} src={video.url} loop muted={muted} playsInline className="h-full w-full object-cover md:object-contain md:max-w-[450px]" />
      <div className="absolute bottom-0 left-0 w-full p-8 pb-16 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-20 pointer-events-none">
        <h2 className="font-black text-xl text-white text-shadow mb-1">@{video.username}</h2>
        <p className="text-sm text-zinc-300 text-shadow line-clamp-2 max-w-[80%]">{video.title}</p>
      </div>
    </div>
  );
}