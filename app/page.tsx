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
  Download, Flag, Zap, AlertCircle, CheckCircle2
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
  playbackRate: number;
}

export default function Feed() {
  const { user, userData } = useAuth();
  const [videos, setVideos] = useState<(Wallpaper & { creator?: UserData })[]>([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [followingList, setFollowingList] = useState<string[]>([]);
  const [friends, setFriends] = useState<UserData[]>([]);
  
  // Toast State
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

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

  const triggerToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

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
      onSnapshot(collection(db, `users/${user.uid}/following`), (snap) => setFollowingList(snap.docs.map(d => d.id)));
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

  // Share Actions
  const copyLink = () => {
    if (typeof window !== "undefined" && activeVid) {
      navigator.clipboard.writeText(`${window.location.origin}/watch/${activeVid.id}`);
      triggerToast("Link Copied to Clipboard!");
      setShowShare(false);
    }
  };

  const shareWhatsApp = () => {
    const url = `${window.location.origin}/watch/${activeVid?.id}`;
    window.open(`https://wa.me/?text=Check out this sync on OtakuWall! 🔥 ${url}`);
    setShowShare(false);
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'OtakuWall Sync',
          text: 'Check out this awesome anime clip!',
          url: `${window.location.origin}/watch/${activeVid?.id}`,
        });
      } catch (err) { console.log(err); }
    } else {
      copyLink();
    }
  };

  const handleDownload = async () => {
    if (!activeVid) return;
    triggerToast("Starting Download...", "info");
    try {
      const res = await fetch(activeVid.url);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `OtakuWall_${activeVid.id}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      triggerToast("Saved to Gallery! ✅");
    } catch (e) {
      triggerToast("Download failed. Try again.", "error");
    }
    setShowShare(false);
  };

  const submitReport = async () => {
    if (!user || !activeVid || !reportReason) return;
    try {
      await addDoc(collection(db, "reports"), {
        contentId: activeVid.id,
        reason: reportReason,
        reporter: user.uid,
        timestamp: serverTimestamp(),
        status: 'pending'
      });
      triggerToast("Report sent to Admins. ✅");
      setShowReport(false);
      setReportReason("");
    } catch (e) { triggerToast("Report failed.", "error"); }
  };

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden">
      
      {/* CUSTOM TOAST SYSTEM */}
      {toast && (
        <div className={`fixed top-24 right-0 z-[500] px-6 py-4 rounded-l-2xl shadow-2xl flex items-center gap-3 border-l-4 transform transition-all animate-in slide-in-from-right duration-300 ${
          toast.type === 'error' ? 'bg-zinc-900 border-yellow-500 text-yellow-500' : 
          toast.type === 'info' ? 'bg-zinc-900 border-blue-500 text-blue-500' :
          'bg-zinc-900 border-red-600 text-white'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-5 h-5"/> : <CheckCircle2 className="w-5 h-5"/>}
          <span className="font-bold text-sm uppercase tracking-wide">{toast.msg}</span>
        </div>
      )}

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
              playbackRate={playbackRate}
              isFollowing={followingList.includes(vid.userId)}
              onComment={() => { setCommentVid(vid.id); setShowComments(true); }}
              onShare={() => { setActiveVid(vid); setShowShare(true); }}
            />
          ))
        )}
      </main>

      {/* SHARE DRAWER */}
      {showShare && (
        <div className="fixed inset-0 z-[300]">
          <div className="drawer-mask" onClick={() => { setShowShare(false); setShowSpeed(false); }} />
          <div className="drawer-content animate-in slide-in-from-bottom duration-300">
            <div className="p-4 border-b border-white/5 text-center relative bg-zinc-900">
              <h3 className="font-bold text-gray-200 text-xs uppercase tracking-widest">Share Sync</h3>
              <button onClick={() => setShowShare(false)} className="absolute right-4 top-4 text-zinc-500"><X className="w-5 h-5"/></button>
            </div>

            <div className="flex gap-4 overflow-x-auto p-4 border-b border-white/5 no-scrollbar">
              {friends.map((f, i) => (
                <div key={i} className="flex flex-col items-center min-w-[65px] gap-1 cursor-pointer" onClick={() => triggerToast(`Sent to @${f.username}`)}>
                  <img src={f.photoURL} className="w-12 h-12 rounded-full object-cover border border-white/10" />
                  <span className="text-[9px] font-bold text-zinc-500 truncate w-14 text-center">@{f.username}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-6 overflow-x-auto p-6 border-b border-white/5 no-scrollbar">
              <div className="flex flex-col items-center gap-2 min-w-[65px] cursor-pointer" onClick={copyLink}>
                <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-white"><LinkIcon className="w-5 h-5"/></div>
                <span className="text-[10px] font-black uppercase text-zinc-500">Link</span>
              </div>
              <div className="flex flex-col items-center gap-2 min-w-[65px] cursor-pointer" onClick={shareWhatsApp}>
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white"><Send className="w-5 h-5 fill-white"/></div>
                <span className="text-[10px] font-black uppercase text-zinc-500">WA</span>
              </div>
              <div className="flex flex-col items-center gap-2 min-w-[65px] cursor-pointer" onClick={shareNative}>
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white"><MoreHorizontal className="w-5 h-5"/></div>
                <span className="text-[10px] font-black uppercase text-zinc-500">More</span>
              </div>
            </div>

            <div className="p-6 grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => setShowSpeed(!showSpeed)}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${showSpeed ? 'bg-red-600' : 'bg-zinc-800'}`}><Zap className={`w-6 h-6 ${showSpeed ? 'text-white' : 'text-yellow-500'}`}/></div>
                <span className="text-[11px] font-bold text-zinc-400">Speed</span>
              </div>
              <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={handleDownload}>
                <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center"><Download className="w-6 h-6 text-green-500"/></div>
                <span className="text-[11px] font-bold text-zinc-400">Save</span>
              </div>
              <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => { setShowShare(false); setShowReport(true); }}>
                <div className="w-14 h-14 bg-red-900/20 rounded-2xl flex items-center justify-center"><Flag className="w-6 h-6 text-red-500"/></div>
                <span className="text-[11px] font-bold text-zinc-400">Report</span>
              </div>
            </div>

            {showSpeed && (
              <div className="p-4 bg-black border-t border-white/5 flex gap-3 justify-center animate-in fade-in duration-300">
                {[0.5, 1.0, 1.5, 2.0].map(s => (
                  <button key={s} onClick={() => { setPlaybackRate(s); triggerToast(`Speed set to ${s}x`, 'info'); }} className={`px-5 py-2 rounded-full text-xs font-black transition ${playbackRate === s ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>{s}x</button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* REPORT DRAWER */}
      {showReport && (
        <div className="fixed inset-0 z-[300]">
          <div className="drawer-mask" onClick={() => setShowReport(false)} />
          <div className="drawer-content p-6 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-red-500 uppercase text-sm tracking-widest">Report sync</h3>
              <button onClick={() => setShowReport(false)}><X /></button>
            </div>
            <div className="space-y-3 mb-8">
              {['Inappropriate Content', 'Copyright Violation', 'Spam', 'Other'].map(r => (
                <button 
                  key={r} onClick={() => setReportReason(r)}
                  className={`w-full p-4 rounded-xl text-left text-sm font-bold border transition ${reportReason === r ? 'bg-red-600 border-red-600 text-white' : 'bg-zinc-900 border-white/5 text-zinc-400'}`}
                >
                  {r}
                </button>
              ))}
            </div>
            <button onClick={submitReport} disabled={!reportReason} className="w-full py-4 bg-red-600 rounded-2xl font-black active:scale-95 transition disabled:opacity-50">SUBMIT REPORT</button>
          </div>
        </div>
      )}

      <Navbar />
    </div>
  );
}

function VideoSlide({ video, muted, setMuted, isFollowing, onComment, onShare, playbackRate }: VideoSlideProps) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(video.likes?.includes(user?.uid || ""));
  const [likesCount, setLikesCount] = useState<number>(video.likes?.length || 0);

  // Sync playback speed
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

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
            <img src={video.creator?.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${video.userId}`} className="w-12 h-12 rounded-full border-2 border-white object-cover" />
          </Link>
          {!isFollowing && user?.uid !== video.userId && (
            <button className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 rounded-full p-1 border-2 border-black"><Plus className="w-3 h-3 text-white" /></button>
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