"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase"; // Use your new Supabase client
import { Skeleton } from "@/components/ui/Skeleton"; // Your new Skeleton
import VideoSlide from "@/components/feed/VideoSlide";
import ShareDrawer from "@/components/feed/ShareDrawer";
import CommentDrawer from "@/components/feed/CommentDrawer";
import Navbar from "@/components/Navbar";
import { Search } from "lucide-react";

export default function Feed() {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeVid, setActiveVid] = useState<any>(null);
  const [showShare, setShowShare] = useState(false);
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    // Fetch via SparkDB API or Supabase directly
    async function loadFeed() {
      const { data } = await supabase.from('wallpapers').select('*').eq('file_type', 'video');
      setVideos(data || []);
      setLoading(false);
    }
    loadFeed();
  }, []);

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden">
      <header className="absolute top-0 left-0 right-0 p-6 z-50 flex justify-between items-center pt-safe">
        <h1 className="text-2xl font-black italic text-white uppercase tracking-tighter">
          <span className="text-red-600">NEW</span>BRAND
        </h1>
        <button className="p-3 bg-black/20 backdrop-blur-xl border border-white/10 rounded-full text-white"><Search/></button>
      </header>

      <main className="h-full w-full snap-y snap-mandatory overflow-y-scroll no-scrollbar">
        {loading ? (
           <Skeleton className="h-screen w-full" />
        ) : (
          videos.map((vid) => (
            <VideoSlide 
              key={vid.id} 
              video={vid} 
              onShare={() => { setActiveVid(vid); setShowShare(true); }}
              onComment={() => { setActiveVid(vid); setShowComments(true); }}
            />
          ))
        )}
      </main>

      {/* Modular Drawers */}
      {showShare && <ShareDrawer video={activeVid} onClose={() => setShowShare(false)} />}
      {showComments && <CommentDrawer video={activeVid} onClose={() => setShowComments(false)} />}
      
      <Navbar />
    </div>
  );
}