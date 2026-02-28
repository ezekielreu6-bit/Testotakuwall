"use client";
import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, query, where, getDocs, doc, getDoc, 
  limit, updateDoc, arrayUnion, arrayRemove, 
  setDoc, serverTimestamp, onSnapshot, addDoc, orderBy 
} from "firebase/firestore";
import { 
  Heart, MessageCircle, Share2, Volume2, VolumeX, 
  Plus, X, Send, Link as LinkIcon, MoreHorizontal 
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";
import VerifiedBadge from "@/components/VerifiedBadge";
import Link from "next/link";
import { Wallpaper, UserData } from "@/types";

interface VideoSlideProps {
  video: Wallpaper & { creator?: UserData };
  muted: boolean;
  setMuted: (val: boolean) => void;
  isFollowing: boolean;
  onComment: () => void;
  onShare: () => void; // Added for drawer
}

export default function Feed() {
  const { user, userData } = useAuth();
  const [videos, setVideos] = useState<(Wallpaper & { creator?: UserData })[]>([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [followingList, setFollowingList] = useState<string[]>([]);
  
  // Drawer States
  const [showComments, setShowComments] = useState(false);
  const [commentVid, setCommentVid] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentInput, setCommentInput] = useState("");

  // Share Drawer States
  const [showShare, setShowShare] = useState(false);
  const [activeShareVid, setActiveShareVid] = useState<string | null>(null);

  const shuffle = (array: any[]) => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  };

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const q = query(collection(db, "wallpapers"), where("fileType", "==", "video"), limit(25));
        const snap = await getDocs(q);
        const videoData = await Promise.all(snap.docs.map(async (d) => {
          const item = d.data() as Wallpaper;
          const userSnap = await getDoc(doc(db, "users", item.userId));
          return { ...item, id: d.id, creator: userSnap.exists() ? userSnap.data() as UserData : undefined };
        }));
        setVideos(shuffle(videoData));
      } catch (e) { console.error(e); }
      setLoading(false);
    };

    if (user) {
      const unsub = onSnapshot(collection(db, `users/${user.uid}/following`), (snap) => {
        setFollowingList(snap.docs.map(d => d.id));
      });
      fetchFeed();
      return () => unsub();
    } else { fetchFeed(); }
  }, [user]);

  // Comment logic
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
      text, userId: user.uid, username: userData?.username || "otaku", userPhoto: userData?.photoURL || "", createdAt: serverTimestamp()
    });
  };

  const copyShareLink = () => {
    if (!activeShareVid) return;
    navigator.clipboard.writeText(`${window.location.origin}/watch/${activeShareVid}`);
    alert("Link Copied!");
    setShowShare(false);
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
          <div className="h-full w-full flex items-center justify-center bg-black"><div className="otaku-spinner"></div></div>
        ) : (
          videos.map((vid) => (
            <VideoSlide 
              key={vid.id} 
              video={vid} 
              muted={muted} 
              setMuted={setMuted} 
              isFollowing={followingList.includes(vid.userId)}
              onComment={() => { setCommentVid(vid.id); setShowComments(true); }}
              onShare={() => { setActiveShareVid(vid.id); setShowShare(true); }}
            />
          ))
        )}
      </main>

      {/* SHARE DRAWER - Higher Z-Index */}
      {showShare && (
        <div className="fixed inset-0 z-[300]">
          <div className="drawer-mask" onClick={() => setShowShare(false)} />
          <div className="drawer-content p-6 flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6" />
            <h3 className="text-center text-xs font-black uppercase tracking-widest text-zinc-500 mb-8">Share Sync</h3>
            
            <div className="flex gap-6 overflow-x-auto no-scrollbar pb-8 border-b border-white/5 mb-6">
              <div className="flex flex-col items-center gap-2 min-w-[70px] cursor-pointer" onClick={copyShareLink}>
                <div className="w-14 h-14 bg-zinc-800 rounded-full flex items-center justify-center text-white"><LinkIcon /></div>
                <span className="text-[10px] font-black text-zinc-500 uppercase">Link</span>
              </div>
              <div className="flex flex-col items-center gap-2 min-w-[70px] cursor-pointer" onClick={() => window.open(`https://wa.me/?text=Check this out! ${window.location.origin}/watch/${activeShareVid}`)}>
                <div className="w-14 h-14 bg-green-600 rounded-full flex items-center justify-center text-white"><Send className="fill-white w-5 h-5" /></div>
                <span className="text-[10px] font-black text-zinc-500 uppercase">WhatsApp</span>
              </div>
              <div className="flex flex-col items-center gap-2 min-w-[70px] cursor-pointer">
                <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center text-white"><MoreHorizontal /></div>
                <span className="text-[10px] font-black text-zinc-500 uppercase">More</span>
              </div>
            </div>
            <button onClick={() => setShowShare(false)} className="w-full py-4 bg-zinc-900 rounded-2xl font-bold text-zinc-400">Cancel</button>
          </div>
        </div>
      )}

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
                  <img src={c.userPhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${c.userId}`} className="w-9 h-9 rounded-full object-cover" />
                  <div><p className="text-xs font-bold text-zinc-400">@{c.username}</p><p className="text-sm text-white mt-0.5">{c.text}</p></div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-black border-t border-white/5 flex gap-2 items-center pb-safe">
              <input type="text" value={commentInput} onChange={(e) => setCommentInput(e.target.value)} placeholder="Add a comment..." className="flex-1 bg-zinc-900 border-none outline-none rounded-full px-5 py-3 text-sm text-white" />
              <button onClick={postComment} className="bg-red-600 p-3 rounded-full active:scale-90 transition"><Send className="w-4 h-4"/></button>
            </div>
          </div>
        </div>
      )}

      <Navbar />
    </div>
  );
}

function VideoSlide({ video, muted, setMuted, isFollowing, onComment, onShare }: VideoSlideProps) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(video.likes?.includes(user?.uid || ""));
  const [likesCount, setLikesCount] = useState<number>(video.likes?.length || 0);
  const [liveCommentCount, setLiveCommentCount] = useState<number>(0);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, `wallpapers/${video.id}/comments`), (snap) => setLiveCommentCount(snap.size));
    return () => unsub();
  }, [video.id]);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) videoRef.current?.play().catch(() => {});
      else { videoRef.current?.pause(); if (videoRef.current) videoRef.current.currentTime = 0; }
    }, { threshold: 0.7 });
    if (videoRef.current) observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, []);

  const toggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Stop video pause
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

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Stop video pause
    if (!user || isFollowing) return;
    await setDoc(doc(db, `users/${video.userId}/followers`, user.uid), { uid: user.uid });
    await setDoc(doc(db, `users/${user.uid}/following`, video.userId), { uid: video.userId });
  };

  return (
    <section className="feed-item">
      <video ref={videoRef} src={video.url} loop muted={muted} playsInline className="h-full w-full object-cover md:object-contain md:max-w-[480px]" onClick={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()} />

      <div className="absolute right-4 bottom-32 flex flex-col gap-6 items-center z-40 pointer-events-auto">
        <div className="relative mb-2">
          <Link href={`/user/${video.userId}`} onClick={(e) => e.stopPropagation()}>
            <img src={video.creator?.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${video.userId}`} className="w-12 h-12 rounded-full border-2 border-white object-cover" alt="avatar" />
          </Link>
          {!isFollowing && user?.uid !== video.userId && (
            <button onClick={handleFollow} className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 rounded-full p-1 border-2 border-black active:scale-125 transition"><Plus className="w-3 h-3 text-white" /></button>
          )}
        </div>
        
        <button onClick={toggleLike} className="flex flex-col items-center gap-1">
          <Heart className={`w-8 h-8 drop-shadow-lg transition-all ${liked ? 'fill-red-600 text-red-600 scale-110' : 'text-white'}`} />
          <span className="text-[10px] font-black text-white text-shadow uppercase">{likesCount}</span>
        </button>

        <button onClick={(e) => { e.stopPropagation(); onComment(); }} className="flex flex-col items-center gap-1">
          <MessageCircle className="w-8 h-8 text-white drop-shadow-lg" />
          <span className="text-[10px] font-black text-white text-shadow uppercase">{liveCommentCount}</span>
        </button>

        <button onClick={(e) => { e.stopPropagation(); onShare(); }} className="flex flex-col items-center gap-1">
          <Share2 className="w-8 h-8 text-white drop-shadow-lg" />
          <span className="text-[10px] font-black text-white text-shadow uppercase">Share</span>
        </button>
      </div>

      <div className="absolute bottom-0 left-0 w-full p-6 pb-28 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-30 pointer-events-none">
        <button onClick={(e) => { e.stopPropagation(); setMuted(!muted); }} className="pointer-events-auto mb-4 bg-black/40 p-3 rounded-full border border-white/10 backdrop-blur-md active:scale-90 transition">
          {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
        </button>

        <div className="flex items-center gap-1 mb-1 pointer-events-auto">
          <Link href={`/user/${video.userId}`} onClick={(e) => e.stopPropagation()} className="font-black text-lg text-white text-shadow">@{video.creator?.username || video.username}</Link>
          {video.creator?.isPremium && <VerifiedBadge className="w-4 h-4" />}
        </div>
        <p className="text-sm text-zinc-100 text-shadow font-semibold line-clamp-2 max-w-[80%]">{video.title}</p>
      </div>
    </section>
  );
}