"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { 
  collection, query, where, getDocs, orderBy, 
  doc, getDoc, addDoc, serverTimestamp 
} from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { X, Repeat2, Heart, Send } from "lucide-react";
import { Wallpaper, UserData } from "@/types";

export default function StoryViewer() {
  const { uid } = useParams() as { uid: string };
  const { user, userData } = useAuth();
  const router = useRouter();

  // State
  const [stories, setStories] = useState<Wallpaper[]>([]);
  const [targetUser, setTargetUser] = useState<UserData | null>(null);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [videoDuration, setVideoDuration] = useState(5000); // Default 5s for images
  const [reposting, setReposting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  // 1. Fetch User and Stories
  useEffect(() => {
    const fetchStories = async () => {
      // Get Target User Info
      const uDoc = await getDoc(doc(db, "users", uid));
      if (uDoc.exists()) setTargetUser(uDoc.data() as UserData);

      // Get Stories from the last 24 hours
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);

      const q = query(
        collection(db, "wallpapers"),
        where("userId", "==", uid),
        where("isStory", "==", true),
        where("createdAt", ">=", yesterday),
        orderBy("createdAt", "asc") // Oldest first, like IG
      );

      const snap = await getDocs(q);
      if (snap.empty) {
        router.back(); // No stories, go back
        return;
      }

      setStories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Wallpaper)));
    };

    if (uid) fetchStories();
  }, [uid, router]);

  // 2. Smart Progress Bar Logic
  useEffect(() => {
    if (stories.length === 0 || isPaused) return;

    const currentStory = stories[currentIndex];
    // If video, use videoDuration, else use 5000ms (5s)
    const duration = currentStory.fileType === 'video' ? videoDuration : 5000;
    const intervalTime = 50;
    const step = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev + step >= 100) {
          handleNext();
          return 0;
        }
        return prev + step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [currentIndex, isPaused, videoDuration, stories]);

  // Handle Video Metadata for accurate timing
  const handleVideoLoaded = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const duration = e.currentTarget.duration * 1000; // Convert to ms
    if (duration > 0) {
      setVideoDuration(duration);
    }
  };

  // 3. Navigation
  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
      setVideoDuration(5000); // Reset default for next slide
    } else {
      router.back(); // End of stories
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setProgress(0);
      setVideoDuration(5000);
    } else {
      setProgress(0); // Restart current if it's the first one
    }
  };

  const handleTouchStart = () => {
    setIsPaused(true);
    if (videoRef.current) videoRef.current.pause();
  };

  const handleTouchEnd = () => {
    setIsPaused(false);
    if (videoRef.current) videoRef.current.play();
  };

  // 4. Repost Functionality
  const handleRepost = async () => {
    if (!user || !userData || !targetUser) return;
    const currentStory = stories[currentIndex];
    
    // Prevent reposting your own story
    if (currentStory.userId === user.uid) {
      showToast("You can't repost your own story!");
      return;
    }

    setReposting(true);
    setIsPaused(true); // Pause while processing

    try {
      await addDoc(collection(db, "wallpapers"), {
        title: `Reposted from @${targetUser.username}`,
        url: currentStory.url,
        fileType: currentStory.fileType,
        category: 'story',
        isStory: true,
        userId: user.uid,
        username: userData.username,
        repostedFrom: targetUser.username, // Credit the original creator
        createdAt: serverTimestamp(),
        likes: [],
        views: 0
      });
      showToast("Reposted to your story! 🔄");
    } catch (e) {
      showToast("Failed to repost");
    } finally {
      setReposting(false);
      setIsPaused(false);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  if (stories.length === 0 || !targetUser) return <div className="h-screen bg-black" />;

  const currentStory = stories[currentIndex];

  return (
    <main className="h-screen w-full bg-black relative overflow-hidden select-none">
      
      {/* Toast Notification */}
      {toast && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-zinc-800 text-white px-6 py-2 rounded-full font-bold text-xs z-[100] shadow-2xl animate-in fade-in slide-in-from-top-5 border border-white/10">
          {toast}
        </div>
      )}

      {/* Progress Bars */}
      <div className="absolute top-4 left-0 right-0 flex gap-1 px-2 z-50">
        {stories.map((_, i) => (
          <div key={i} className="h-1 bg-white/30 flex-1 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white transition-all duration-75 ease-linear"
              style={{ 
                width: i === currentIndex ? `${progress}%` : i < currentIndex ? '100%' : '0%' 
              }} 
            />
          </div>
        ))}
      </div>

      {/* Header Info */}
      <div className="absolute top-8 left-4 flex items-center gap-3 z-50">
        <img src={targetUser.photoURL} className="w-10 h-10 rounded-full border border-white/20 object-cover" />
        <div>
          <p className="text-sm font-bold shadow-black drop-shadow-md text-white flex items-center gap-2">
            {targetUser.username}
            {currentStory.repostedFrom && (
              <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded-full flex items-center">
                <Repeat2 className="w-3 h-3 mr-1" />
                {currentStory.repostedFrom}
              </span>
            )}
          </p>
          <p className="text-[10px] text-zinc-300 shadow-black drop-shadow-md">
            {currentStory.createdAt ? new Date(currentStory.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
          </p>
        </div>
      </div>

      {/* Close Button */}
      <button 
        onClick={() => router.back()} 
        className="absolute top-8 right-4 z-50 p-2 bg-black/20 backdrop-blur-md rounded-full text-white"
      >
        <X className="w-5 h-5" />
      </button>

      {/* MEDIA DISPLAY */}
      <div className="absolute inset-0 z-0 flex items-center justify-center bg-zinc-900">
        {currentStory.fileType === 'video' ? (
          <video
            ref={videoRef}
            src={currentStory.url}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted={false} // Stories usually play with sound on mobile
            onLoadedMetadata={handleVideoLoaded}
            onEnded={handleNext} // Auto next when video ends
          />
        ) : (
          <img 
            src={currentStory.url} 
            className="w-full h-full object-cover animate-in fade-in duration-300" 
            alt="story"
          />
        )}
      </div>

      {/* TOUCH ZONES (Navigation & Pause) */}
      <div className="absolute inset-0 z-10 flex">
        {/* Previous Zone (Left 30%) */}
        <div 
          className="w-[30%] h-full" 
          onClick={handlePrev} 
          onTouchStart={handleTouchStart} 
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleTouchStart}
          onMouseUp={handleTouchEnd}
        />
        
        {/* Next Zone (Right 70%) */}
        <div 
          className="w-[70%] h-full" 
          onClick={handleNext} 
          onTouchStart={handleTouchStart} 
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleTouchStart}
          onMouseUp={handleTouchEnd}
        />
      </div>

      {/* FOOTER ACTIONS (Smart Repost & Reply) */}
      <div className="absolute bottom-0 left-0 right-0 p-4 pb-8 bg-gradient-to-t from-black/90 to-transparent z-50 flex items-center gap-3">
        
        {/* Reply Input (Visual only) */}
        <div className="flex-1 relative">
          <input 
            type="text" 
            placeholder={`Reply to ${targetUser.username}...`} 
            className="w-full bg-white/10 border border-white/20 rounded-full px-5 py-3 text-sm text-white placeholder:text-zinc-400 backdrop-blur-sm outline-none focus:bg-white/20 transition"
            onClick={(e) => {
              e.stopPropagation(); // Prevent nav click
              setIsPaused(true); // Pause while typing
            }}
            onBlur={() => setIsPaused(false)}
          />
        </div>

        {/* Repost Button */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            handleRepost();
          }}
          disabled={reposting || currentStory.userId === user?.uid}
          className={`p-3 rounded-full backdrop-blur-md border border-white/20 transition active:scale-90 ${
            currentStory.userId === user?.uid 
              ? 'bg-zinc-800/50 text-zinc-500 cursor-not-allowed' 
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          {reposting ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Repeat2 className="w-5 h-5" />
          )}
        </button>

        {/* Like Button */}
        <button 
          className="p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 transition active:scale-90"
          onClick={(e) => {
            e.stopPropagation();
            showToast("Liked ❤️");
          }}
        >
          <Heart className="w-5 h-5" />
        </button>

        {/* Share Button */}
        <button 
          className="p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 transition active:scale-90"
          onClick={(e) => {
            e.stopPropagation();
            if (navigator.share) {
              navigator.share({
                title: `Story by ${targetUser.username}`,
                url: window.location.href
              });
            } else {
              navigator.clipboard.writeText(window.location.href);
              showToast("Link Copied!");
            }
          }}
        >
          <Send className="w-5 h-5" />
        </button>
      </div>

    </main>
  );
}