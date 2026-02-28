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
  Plus, X, Send, Link as LinkIcon, MoreHorizontal,
  Download, Flag, Zap, Check, AlertTriangle
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
  onShare: () => void;
  onReport: () => void;
}

export default function Feed() {
  const { user, userData } = useAuth();
  const [videos, setVideos] = useState<(Wallpaper & { creator?: UserData })[]>([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [followingList, setFollowingList] = useState<string[]>([]);
  const [friends, setFriends] = useState<UserData[]>([]);
  
  // Drawer States
  const [showComments, setShowComments] = useState(false);
  const [commentVid, setCommentVid] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentInput, setCommentInput] = useState("");

  const [showShare, setShowShare] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [activeVid, setActiveVid] = useState<any>(null);
  const [showSpeed, setShowSpeed] = useState(false);
  const [reportReason, setReportReason] = useState("");

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
        const q = query(collection(db, "wallpapers"), where("fileType", "==", "video"), limit(20));
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
      onSnapshot(collection(db, `users/${user.uid}/following`), (snap) => {
        setFollowingList(snap.docs.map(d => d.id));
      });
      const fetchFriends = async () => {
        const q = query(collection(db, `users/${user.uid}/following`), limit(8));
        const snap = await getDocs(q);
        const fData = await Promise.all(snap.docs.map(async (f) => {
          const d = await getDoc(doc(db, "users", f.id));
          return d.exists() ? d.data() as UserData : null;
        }));
        setFriends(fData.filter(f => f !== null) as UserData[]);
      };
      fetchFriends();
    }
    fetchFeed();
  }, [user]);

  // Comments Listener
  useEffect(() => {
    if (!commentVid) return;
    const q = query(collection(db, `wallpapers/${commentVid}/comments`), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [commentVid]);

  const copyLink = () => {
    if (typeof window !== "undefined" && activeVid) {
      navigator.clipboard.writeText(`${window.location.origin}/watch/${activeVid.id}`);
      alert("Link Copied!");
      setShowShare(false);
    }
  };

  const submitReport = async () => {
    if (!user || !activeVid || !reportReason) return;
    await addDoc(collection(db, "reports"), {
      contentId: activeVid.id,
      reason: reportReason,
      reporter: user.uid,
      timestamp: serverTimestamp(),
      status: 'pending'
    });
    alert("Report Sent Successfully");
    setShowReport(false);
    setReportReason("");
  };

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden">
      <header className="absolute top-0 left-0 right-0 p-6 z-50 pointer-events-none pt-safe">
        <h1 className="text-2xl font-black italic text-white text-shadow pointer-events-auto">
          <span className="text-red-600">OTAKU</span>WALL
        </h1>
      </header>

      <main className="feed-container no-scrollbar">
        {loading ? (
          <div className="h-full w-full flex items-center justify-center"><div className="otaku-spinner"></div></div>
        ) : (
          videos.map((vid) => (
            <VideoSlide 
              key={vid.id} video={vid} muted={muted} setMuted={setMuted} 
              isFollowing={followingList.includes(vid.userId)}
              onComment={() => { setCommentVid(vid.id); setShowComments(true); }}
              onShare={() => { setActiveVid(vid); setShowShare(true); }}
              onReport={() => { setActiveVid(vid); setShowReport(true); }}
            />
          ))
        )}
      </main>

      {/* SHARE DRAWER */}
      {showShare && (
        <div className="fixed inset-0 z-[300]">
          <div className="drawer-mask" onClick={() => setShowShare(false)} />
          <div className="drawer-content animate-in slide-in-from-bottom duration-300">
            <div className="p-4 border-b border-white/5 text-center relative bg-zinc-900">
              <h3 className="font-bold text-gray-200 text-sm uppercase">Share Sync</h3>
              <button onClick={() => setShowShare(false)} className="absolute right-4 top-4"><X className="w-5 h-5"/></button>
            </div>
            <div className="flex gap-4 overflow-x-auto p-4 border-b border-white/5 no-scrollbar">
              {friends.map((f, i) => (
                <div key={i} className="flex flex-col items-center min-w-[65px] gap-1">
                  <img src={f.photoURL} className="w-12 h-12 rounded-full object-cover border border-white/10" />
                  <span className="text-[9px] font-bold text-zinc-500 truncate w-14 text-center">@{f.username}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-6 overflow-x-auto p-6 border-b border-white/5 no-scrollbar">
              <button onClick={copyLink} className="flex flex-col items-center gap-2 min-w-[65px]">
                <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center"><LinkIcon className="w-5 h-5"/></div>
                <span className="text-[10px] font-bold uppercase text-zinc-500">Link</span>
              </button>
              <button className="flex flex-col items-center gap-2 min-w-[65px]">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center"><Send className="w-5 h-5 fill-white"/></div>
                <span className="text-[10px] font-bold uppercase text-zinc-500">WA</span>
              </button>
              <button className="flex flex-col items-center gap-2 min-w-[65px]">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center"><MoreHorizontal className="w-5 h-5"/></div>
                <span className="text-[10px] font-bold uppercase text-zinc-500">More</span>
              </button>
            </div>
            <div className="p-6 grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center gap-2" onClick={() => setShowSpeed(!showSpeed)}>
                <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center"><Zap className="text-yellow-500"/></div>
                <span className="text-[10px] font-bold text-zinc-400">Speed</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center"><Download className="text-green-500"/></div>
                <span className="text-[10px] font-bold text-zinc-400">Save</span>
              </div>
              <div className="flex flex-col items-center gap-2" onClick={() => { setShowShare(false); setShowReport(true); }}>
                <div className="w-14 h-14 bg-red-900/20 rounded-2xl flex items-center justify-center"><Flag className="text-red-500"/></div>
                <span className="text-[10px] font-bold text-zinc-400">Report</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REPORT DRAWER */}
      {showReport && (
        <div className="fixed inset-0 z-[300]">
          <div className="drawer-mask" onClick={() => setShowReport(false)} />
          <div className="drawer-content p-6 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-red-500 uppercase tracking-widest">Report Content</h3>
              <button onClick={() => setShowReport(false)}><X /></button>
            </div>
            <div className="space-y-3 mb-8">
              {['Inappropriate Content', 'Copyright Violation', 'Spam', 'Other'].map(r => (
                <button 
                  key={r} 
                  onClick={() => setReportReason(r)}
                  className={`w-full p-4 rounded-xl text-left text-sm font-bold transition ${reportReason === r ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-400'}`}
                >
                  {r}
                </button>
              ))}
            </div>
            <button onClick={submitReport} className="w-full py-4 bg-red-600 rounded-2xl font-black active:scale-95 transition">Submit Report</button>
          </div>
        </div>
      )}

      {/* COMMENTS DRAWER */}
      {showComments && (
        <div className="fixed inset-0 z-[200]">
          <div className="drawer-mask" onClick={() => setShowComments(false)} />
          <div className="drawer-content flex flex-col h-[75vh]">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-zinc-900/50">
              <span className="text-xs font-black uppercase text-zinc-500">{comments.length} Comments</span>
              <button onClick={() => setShowComments(false)}><X className="w-4 h-4"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <img src={c.userPhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${c.userId}`} className="w-9 h-9 rounded-full object-cover" />
                  <div><p className="text-xs font-bold text-zinc-400">@{c.username}</p><p className="text-sm text-white mt-0.5">{c.text}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <Navbar />
    </div>
  );
}

function VideoSlide({ video, muted, setMuted, isFollowing, onComment, onShare, onReport }: any) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(video.likes?.includes(user?.uid || ""));
  const [likesCount, setLikesCount] = useState<number>(video.likes?.length || 0);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) videoRef.current?.play().catch(() => {});
      else { videoRef.current?.pause(); if (videoRef.current) videoRef.current.currentTime = 0; }
    }, { threshold: 0.7 });
    if (videoRef.current) observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, []);

  const toggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  return (
    <section className="feed-item">
      <video ref={videoRef} src={video.url} loop muted={muted} playsInline className="h-full w-full object-cover md:object-contain md:max-w-[480px]" onClick={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()} />

      <div className="absolute right-4 bottom-32 flex flex-col gap-6 items-center z-40 pointer-events-auto">
        <div className="relative mb-2">
          <Link href={`/user/${video.userId}`} onClick={(e) => e.stopPropagation()}>
            <img src={video.creator?.photoURL} className="w-12 h-12 rounded-full border-2 border-white object-cover" />
          </Link>
          {!isFollowing && user?.uid !== video.userId && (
            <button onClick={(e) => { e.stopPropagation(); /* follow logic */ }} className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 rounded-full p-1 border-2 border-black"><Plus className="w-3 h-3 text-white" /></button>
          )}
        </div>
        <button onClick={toggleLike} className="flex flex-col items-center gap-1"><Heart className={`w-8 h-8 ${liked ? 'fill-red-600 text-red-600 scale-110' : 'text-white'}`} /><span className="text-[10px] font-black">{likesCount}</span></button>
        <button onClick={(e) => { e.stopPropagation(); onComment(); }} className="flex flex-col items-center gap-1"><MessageCircle className="w-8 h-8 text-white" /><span className="text-[10px] font-black">Chat</span></button>
        <button onClick={(e) => { e.stopPropagation(); onShare(); }} className="flex flex-col items-center gap-1"><Share2 className="w-8 h-8 text-white" /><span className="text-[10px] font-black">Share</span></button>
      </div>

      <div className="absolute bottom-0 left-0 w-full p-6 pb-28 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-30 pointer-events-none">
        <button onClick={(e) => { e.stopPropagation(); setMuted(!muted); }} className="pointer-events-auto mb-4 bg-black/40 p-3 rounded-full border border-white/10 backdrop-blur-md">
          {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
        </button>
        <div className="flex items-center gap-1 mb-1 pointer-events-auto">
          <Link href={`/user/${video.userId}`} className="font-black text-lg text-white text-shadow">@{video.creator?.username || video.username}</Link>
          {video.creator?.isPremium && <VerifiedBadge className="w-4 h-4" />}
        </div>
        <p className="text-sm text-zinc-100 text-shadow font-semibold line-clamp-2 max-w-[80%]">{video.title}</p>
      </div>
    </section>
  );
}