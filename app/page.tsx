"use client";
import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, query, where, getDocs, doc, getDoc, 
  limit, orderBy, updateDoc, arrayUnion, arrayRemove, 
  setDoc, serverTimestamp, onSnapshot, addDoc 
} from "firebase/firestore";
import { 
  Heart, MessageCircle, Share2, Volume2, VolumeX, 
  Plus, X, Send 
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";
import VerifiedBadge from "@/components/VerifiedBadge";
import Link from "next/link";
import { Wallpaper, UserData } from "@/types";

export default function Feed() {
  const { user, userData } = useAuth();
  const [videos, setVideos] = useState<(Wallpaper & { creator?: UserData })[]>([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [followingList, setFollowingList] = useState<string[]>([]);
  
  // Comment Drawer States
  const [showComments, setShowComments] = useState(false);
  const [commentVid, setCommentVid] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentInput, setCommentInput] = useState("");

  // Helper: Shuffle Array
  const shuffle = (array: any[]) => {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
  };

  // 1. Fetch Feed & Shuffle
  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const q = query(
          collection(db, "wallpapers"), 
          where("fileType", "==", "video"), 
          limit(20) // Fetch a larger batch to shuffle
        );
        const snap = await getDocs(q);
        const videoData = await Promise.all(snap.docs.map(async (d) => {
          const item = d.data() as Wallpaper;
          const userSnap = await getDoc(doc(db, "users", item.userId));
          return { ...item, id: d.id, creator: userSnap.exists() ? userSnap.data() as UserData : undefined };
        }));

        setVideos(shuffle(videoData)); // SHUFFLE VIDEOS HERE
      } catch (e) { console.error(e); }
      setLoading(false);
    };

    if (user) {
      const unsub = onSnapshot(collection(db, `users/${user.uid}/following`), (snap) => {
        setFollowingList(snap.docs.map(d => d.id));
      });
      fetchFeed();
      return () => unsub();
    } else {
      fetchFeed();
    }
  }, [user]);

  // 2. Real-time Comment Listener for Drawer
  useEffect(() => {
    if (!commentVid) return;
    const q = query(collection(db, `wallpapers/${commentVid}/comments`), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [commentVid]);

  const postComment = async () => {
    if (!user || !commentInput.trim() || !commentVid) return;
    const text = commentInput;
    setCommentInput("");
    await addDoc(collection(db, `wallpapers/${commentVid}/comments`), {
      text,
      userId: user.uid,
      username: userData?.username || "otaku",
      userPhoto: userData?.photoURL || "",
      createdAt: serverTimestamp()
    });
  };

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden">
      <header className="absolute top-0 left-0 right-0 p-6 z-50 pointer-events-none pt-safe">
        <h1 className="text-2xl font-black italic tracking-tighter text-white text-shadow pointer-events-auto">
          <span className="text-red-600">OTAKU</span>WALL
        </h1>
      </header>

      <main className="feed-container no-scrollbar">
        {loading ? (
          <div className="h-full w-full flex items-center justify-center bg-black">
            <div className="otaku-spinner"></div>
          </div>
        ) : (
          videos.map((vid) => (
            <VideoSlide 
              key={vid.id} 
              video={vid} 
              muted={muted} 
              setMuted={setMuted} 
              isFollowing={followingList.includes(vid.userId)}
              onComment={() => { setCommentVid(vid.id); setShowComments(true); }}
            />
          ))
        )}
      </main>

      {/* COMMENTS DRAWER */}
      {showComments && (
        <div className="fixed inset-0 z-[200]">
          <div className="drawer-mask" onClick={() => setShowComments(false)} />
          <div className="drawer-content flex flex-col h-[75vh] animate-in slide-in-from-bottom duration-300">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-zinc-900/50">
              <span className="text-xs font-black uppercase tracking-widest text-zinc-500">{comments.length} Comments</span>
              <button onClick={() => setShowComments(false)} className="p-2 bg-white/5 rounded-full"><X className="w-4 h-4"/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <img src={c.userPhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${c.userId}`} className="w-9 h-9 rounded-full object-cover" alt="user" />
                  <div>
                    <p className="text-xs font-bold text-zinc-400">@{c.username}</p>
                    <p className="text-sm text-white mt-0.5">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-black border-t border-white/5 flex gap-2 items-center pb-safe">
              <input 
                type="text" 
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Add a comment..." 
                className="flex-1 bg-zinc-900 border-none outline-none rounded-full px-5 py-3 text-sm"
              />
              <button onClick={postComment} className="bg-red-600 p-3 rounded-full active:scale-90 transition"><Send className="w-4 h-4"/></button>
            </div>
          </div>
        </div>
      )}

      <Navbar />
    </div>
  );
}

function VideoSlide({ video, muted, setMuted, isFollowing, onComment }: any) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(video.likes?.includes(user?.uid));
  const [likesCount, setLikesCount] = useState(video.likes?.length || 0);
  const [liveCommentCount, setLiveCommentCount] = useState(0);

  // Real-time listener for this specific video's comment count
  useEffect(() => {
    const q = collection(db, `wallpapers/${video.id}/comments`);
    const unsub = onSnapshot(q, (snap) => {
      setLiveCommentCount(snap.size);
    });
    return () => unsub();
  }, [video.id]);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        videoRef.current?.play().catch(() => {});
      } else {
        videoRef.current?.pause();
        if (videoRef.current) videoRef.current.currentTime = 0;
      }
    }, { threshold: 0.7 });
    if (videoRef.current) observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, []);

  const toggleLike = async () => {
    if (!user) return;
    const ref = doc(db, "wallpapers", video.id);
    if (liked) {
      setLiked(false); setLikesCount(prev => prev - 1);
      await updateDoc(ref, { likes: arrayRemove(user.uid) });
    } else {
      setLiked(true); setLikesCount(prev => prev + 1);
      await updateDoc(ref, { likes: arrayUnion(user.uid) });
    }
  };

  const handleFollow = async () => {
    if (!user || isFollowing) return;
    await setDoc(doc(db, `users/${video.userId}/followers`, user.uid), { uid: user.uid });
    await setDoc(doc(db, `users/${user.uid}/following`, video.userId), { uid: video.userId });
  };

  return (
    <section className="feed-item">
      <video
        ref={videoRef}
        src={video.url}
        loop muted={muted} playsInline
        className="h-full w-full object-cover md:object-contain md:max-w-[480px]"
        onClick={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()}
      />

      <div className="absolute right-4 bottom-32 flex flex-col gap-6 items-center z-40">
        <div className="relative mb-2">
          <Link href={`/user/${video.userId}`}>
            <img 
              src={video.creator?.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${video.userId}`} 
              className="w-12 h-12 rounded-full border-2 border-white object-cover" 
            />
          </Link>
          {!isFollowing && user?.uid !== video.userId && (
            <button onClick={handleFollow} className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 rounded-full p-1 border-2 border-black active:scale-125 transition">
              <Plus className="w-3 h-3 text-white" />
            </button>
          )}
        </div>
        
        <button onClick={toggleLike} className="flex flex-col items-center gap-1">
          <Heart className={`w-8 h-8 ${liked ? 'fill-red-600 text-red-600 scale-110' : 'text-white'}`} />
          <span className="text-[10px] font-black text-white text-shadow">{likesCount}</span>
        </button>

        <button onClick={onComment} className="flex flex-col items-center gap-1">
          <MessageCircle className="w-8 h-8 text-white" />
          <span className="text-[10px] font-black text-white text-shadow">{liveCommentCount}</span>
        </button>

        <button className="flex flex-col items-center gap-1">
          <Share2 className="w-8 h-8 text-white" />
          <span className="text-[10px] font-black text-white text-shadow">Share</span>
        </button>
      </div>

      <div className="absolute bottom-0 left-0 w-full p-6 pb-28 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-30 pointer-events-none">
        <button 
          onClick={() => setMuted(!muted)} 
          className="pointer-events-auto mb-4 bg-black/40 p-3 rounded-full border border-white/10 backdrop-blur-md active:scale-90 transition"
        >
          {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
        </button>

        <div className="flex items-center gap-1 mb-1 pointer-events-auto">
          <Link href={`/user/${video.userId}`} className="font-black text-lg text-white text-shadow">
            @{video.creator?.username || video.username}
          </Link>
          {video.creator?.isPremium && <VerifiedBadge className="w-4 h-4" />}
        </div>
        <p className="text-sm text-zinc-100 text-shadow font-semibold line-clamp-2 max-w-[80%]">{video.title}</p>
      </div>
    </section>
  );
}