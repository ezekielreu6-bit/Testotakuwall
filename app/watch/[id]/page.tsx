// app/watch/[id]/page.tsx
"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { Wallpaper } from "@/types";

export default function WatchPage() {
  const { id } = useParams() as { id: string };
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Optional: If they came from a specific user profile, we filter videos by that uid
  const filterUid = searchParams.get('uid'); 
  
  const [videos, setVideos] = useState<Wallpaper[]>([]);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const fetchVideos = async () => {
      let fetchedVideos: Wallpaper[] =[];
      
      // 1. Fetch the target video first so it shows immediately
      const targetDoc = await getDoc(doc(db, "wallpapers", id));
      if (targetDoc.exists()) {
        fetchedVideos.push({ id: targetDoc.id, ...targetDoc.data() } as Wallpaper);
      }

      // 2. Fetch the rest of the feed
      let q;
      if (filterUid) {
        q = query(collection(db, "wallpapers"), where("userId", "==", filterUid), where("fileType", "==", "video"));
      } else {
        q = query(collection(db, "wallpapers"), where("fileType", "==", "video"));
      }

      const snap = await getDocs(q);
      const rest = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Wallpaper))
        .filter(v => v.id !== id); // Exclude the one we already fetched

      setVideos([...fetchedVideos, ...rest]);
    };

    fetchVideos();
  }, [id, filterUid]);

  if (videos.length === 0) return <div className="h-screen bg-black flex items-center justify-center animate-pulse text-red-500 font-bold">LOADING SYNC...</div>;

  return (
    <main className="h-screen w-full bg-black overflow-y-scroll snap-y snap-mandatory no-scrollbar relative">
      <button onClick={() => router.back()} className="fixed top-6 left-6 z-50 bg-black/50 p-3 rounded-full text-white backdrop-blur-md">
        <ArrowLeft className="w-5 h-5" />
      </button>

      <button onClick={() => setMuted(!muted)} className="fixed top-6 right-6 z-50 bg-black/50 p-3 rounded-full text-white backdrop-blur-md">
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
      if (entry.isIntersecting) videoRef.current?.play();
      else videoRef.current?.pause();
    }, { threshold: 0.6 });

    if (videoRef.current) observer.observe(videoRef.current);
    return () => observer.disconnect();
  },[]);

  return (
    <div className="w-full h-full snap-start snap-always relative flex justify-center items-center bg-black">
      <video ref={videoRef} src={video.url} loop muted={muted} playsInline className="w-full h-full object-cover md:object-contain md:max-w-[450px]" />
      <div className="absolute bottom-0 left-0 w-full p-6 pb-12 bg-gradient-to-t from-black via-black/50 to-transparent z-20 pointer-events-none">
        <h2 className="font-bold text-lg text-white">@{video.username}</h2>
        <p className="text-sm text-zinc-300">{video.title}</p>
      </div>
    </div>
  );
}