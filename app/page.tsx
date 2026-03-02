"use client";
import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, query, where, getDocs, doc, getDoc, 
  limit, updateDoc, arrayUnion, arrayRemove, 
  setDoc, serverTimestamp, onSnapshot, addDoc, orderBy, startAt, endAt
} from "firebase/firestore";
import { 
  Heart, MessageCircle, Share2, Volume2, VolumeX, 
  Plus, X, Send, Link as LinkIcon, MoreHorizontal,
  Download, Flag, Zap, AlertCircle, CheckCircle2, Search, ArrowRight, Play, ChevronRight
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";
import VerifiedBadge from "@/components/VerifiedBadge";
import Link from "next/link";
import { Wallpaper, UserData } from "@/types";

// --- Strict Types ---
interface CommentData {
  id: string;
  text: string;
  userId: string;
  username: string;
  userPhoto?: string;
  createdAt: any;
}

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

  // --- UI STATES ---
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [activeVid, setActiveVid] = useState<any>(null);

  // --- SEARCH ---
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ users: UserData[], videos: Wallpaper[] }>({ users: [], videos: [] });
  const [isSearching, setIsSearching] = useState(false);

  // --- COMMENTS ---
  const [comments, setComments] = useState<CommentData[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const [showSpeed, setShowSpeed] = useState(false);

  const triggerToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 1. Core Data Fetching
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
        setVideos(videoData.sort(() => Math.random() - 0.5));
      } catch (e) { console.error(e); }
      setLoading(false);
    };

    if (user) {
      onSnapshot(collection(db, `users/${user.uid}/following`), (snap) => setFollowingList(snap.docs.map(d => d.id)));
      getDocs(query(collection(db, "users"), limit(8))).then(async (snap) => {
         const fData = await Promise.all(snap.docs.map(f => getDoc(doc(db, "users", f.id))));
         setFriends(fData.map(d => d.data() as UserData));
      });
    }
    fetchFeed();
  }, [user]);

  // 2. Advanced Search (Prefix Matching)
  useEffect(() => {
    if (searchQuery.length < 1) { setSearchResults({ users: [], videos: [] }); return; }
    const delay = setTimeout(async () => {
      setIsSearching(true);
      const qText = searchQuery.toLowerCase().trim();
      const uQ = query(collection(db, "users"), orderBy("username"), startAt(qText), endAt(qText + "\uf8ff"), limit(5));
      const vQ = query(collection(db, "wallpapers"), orderBy("title"), startAt(searchQuery), endAt(searchQuery + "\uf8ff"), limit(10));
      const [uSnap, vSnap] = await Promise.all([getDocs(uQ), getDocs(vQ)]);
      setSearchResults({
        users: uSnap.docs.map(d => ({ ...d.data(), uid: d.id } as UserData)),
        videos: vSnap.docs.map(d => ({ ...d.data(), id: d.id } as Wallpaper))
      });
      setIsSearching(false);
    }, 250);
    return () => clearTimeout(delay);
  }, [searchQuery]);

  // 3. Comments Handler
  useEffect(() => {
    if (!activeVid || !showComments) return;
    const unsub = onSnapshot(query(collection(db, `wallpapers/${activeVid.id}/comments`), orderBy("createdAt", "asc")), (snap) => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as CommentData)));
    });
    return () => unsub();
  }, [activeVid, showComments]);

  const submitComment = async () => {
    if (!user || !commentInput.trim() || !activeVid) return;
    const text = commentInput; setCommentInput("");
    const path = replyTo ? `wallpapers/${activeVid.id}/comments/${replyTo.id}/replies` : `wallpapers/${activeVid.id}/comments`;
    await addDoc(collection(db, path), {
      text, userId: user.uid, username: userData?.username || "otaku",
      userPhoto: userData?.photoURL || "", createdAt: serverTimestamp()
    });
    setReplyTo(null);
  };

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden">
      
      {/* 🍞 TOAST */}
      {toast && (
        <div className={`fixed top-24 right-0 z-[1000] px-6 py-4 rounded-l-2xl shadow-2xl flex items-center gap-3 border-l-4 bg-zinc-900 animate-in slide-in-from-right duration-300 ${
          toast.type === 'error' ? 'border-yellow-500 text-yellow-500' : toast.type === 'info' ? 'border-blue-500 text-blue-500' : 'border-red-600 text-white'
        }`}>
          <AlertCircle className="w-5 h-5"/>
          <span className="font-bold text-[11px] uppercase tracking-widest">{toast.msg}</span>
        </div>
      )}

      {/* HEADER */}
      <header className="absolute top-0 left-0 right-0 p-6 z-50 flex justify-between items-center pt-safe pointer-events-none">
        <h1 className="text-2xl font-black italic text-white text-shadow pointer-events-auto uppercase tracking-tighter italic">
          <span className="text-red-600">OTAKU</span>WALL
        </h1>
        <button onClick={() => setShowSearch(true)} className="p-3 bg-black/20 backdrop-blur-xl border border-white/10 rounded-full text-white pointer-events-auto active:scale-90 transition shadow-lg"><Search/></button>
      </header>

      {/* FEED */}
      <main className="feed-container no-scrollbar">
        {loading ? <div className="h-full w-full flex items-center justify-center bg-black"><div className="otaku-spinner"></div></div> :
          videos.map((vid) => (
            <VideoSlide 
              key={vid.id} video={vid} muted={muted} setMuted={setMuted} 
              isFollowing={followingList.includes(vid.userId)}
              playbackRate={playbackRate}
              onShare={() => { setActiveVid(vid); setShowShare(true); }} 
              onComment={() => { setActiveVid(vid); setShowComments(true); }}
            />
          ))
        }
      </main>

      {/* 🔍 SEARCH MODAL */}
      <div className={`fixed inset-0 z-[500] transition-transform duration-500 bg-black ${showSearch ? 'translate-x-0' : 'translate-x-full'}`}>
        <header className="p-6 pt-safe border-b border-white/5 flex items-center gap-4 bg-zinc-950">
           <button onClick={() => {setShowSearch(false); setSearchQuery("");}} className="p-2 bg-zinc-900 rounded-full active:scale-90 transition"><X/></button>
           <form onSubmit={(e) => e.preventDefault()} className="flex-1 relative">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search otakus or syncs..." className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none focus:border-red-600 transition-all text-white" />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
           </form>
        </header>
        <div className="flex-1 overflow-y-auto p-6 no-scrollbar pb-32">
             <div className="space-y-4">
                {searchResults.users.map(u => (
                  <Link key={u.uid} href={`/user/${u.uid}`} onClick={() => setShowSearch(false)} className="flex items-center justify-between p-4 bg-zinc-900 rounded-[24px] border border-white/5 active:scale-95 transition">
                    <div className="flex items-center gap-3">
                        <img src={u.photoURL} className="w-12 h-12 rounded-full object-cover border border-white/10" alt="u"/>
                        <span className="font-black text-sm uppercase italic">@{u.username}</span>
                    </div>
                    <ArrowRight className="text-red-600 w-4 h-4"/>
                  </Link>
                ))}
                <div className="grid grid-cols-2 gap-3 mt-4">
                   {searchResults.videos.map(v => (
                     <Link key={v.id} href={`/watch/${v.id}`} onClick={() => setShowSearch(false)} className="aspect-[9/16] rounded-2xl bg-zinc-900 overflow-hidden relative border border-white/5 shadow-2xl">
                        <video src={`${v.url}#t=0.1`} className="w-full h-full object-cover opacity-60" muted playsInline />
                        <div className="absolute bottom-0 p-3"><p className="text-[10px] font-black uppercase truncate">{v.title}</p></div>
                     </Link>
                   ))}
                </div>
             </div>
        </div>
      </div>

      {/* 🚀 SHARE DRAWER */}
      {showShare && activeVid && (
        <div className="fixed inset-0 z-[600]">
           <div className="drawer-mask" onClick={() => { setShowShare(false); setShowSpeed(false); }} />
           <div className="drawer-content p-6 animate-in slide-in-from-bottom duration-300">
              <div className="p-4 border-b border-white/5 text-center relative mb-4">
                 <h3 className="font-bold text-xs uppercase tracking-widest text-zinc-500 italic">Share Sync</h3>
                 <button onClick={() => setShowShare(false)} className="absolute right-0 top-3 text-zinc-600"><X className="w-5 h-5"/></button>
              </div>
              <div className="flex gap-4 overflow-x-auto p-4 border-b border-white/5 no-scrollbar mb-4">
                {friends.map((f, i) => (
                    <div key={i} className="flex flex-col items-center min-w-[65px] gap-1 cursor-pointer active:scale-90 transition" onClick={() => triggerToast(`Shared with @${f.username}`)}>
                      <img src={f.photoURL} className="w-12 h-12 rounded-full object-cover border border-white/10" alt="f"/>
                      <span className="text-[9px] font-bold text-zinc-500 truncate w-14 text-center">@{f.username}</span>
                    </div>
                ))}
              </div>
              <div className="flex gap-6 justify-center pb-8 border-b border-white/5">
                 <div onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/watch/${activeVid.id}`); triggerToast("Link Copied!"); setShowShare(false); }} className="flex flex-col items-center gap-2 cursor-pointer active:scale-90 transition">
                    <div className="w-14 h-14 bg-zinc-800 rounded-full flex items-center justify-center text-white shadow-xl border border-white/5"><LinkIcon/></div>
                    <span className="text-[10px] font-black uppercase text-zinc-500">Link</span>
                 </div>
                 <div onClick={() => window.open(`https://wa.me/?text=Check this sync! ${window.location.origin}/watch/${activeVid.id}`)} className="flex flex-col items-center gap-2 cursor-pointer active:scale-90 transition">
                    <div className="w-14 h-14 bg-green-600 rounded-full flex items-center justify-center text-white shadow-xl"><Send className="w-5 h-5 fill-white"/></div>
                    <span className="text-[10px] font-black uppercase text-zinc-500">WhatsApp</span>
                 </div>
              </div>
              <div className="p-4 grid grid-cols-3 gap-4">
                 <div onClick={() => setShowSpeed(!showSpeed)} className="flex flex-col items-center gap-2 cursor-pointer transition">
                    <div className={`w-14 h-14 ${showSpeed ? 'bg-red-600' : 'bg-zinc-800'} rounded-2xl flex items-center justify-center text-zinc-400 shadow-lg`}><Zap className="w-6 h-6"/></div>
                    <span className="text-[10px] font-black text-zinc-500 uppercase">Speed</span>
                 </div>
                 <div onClick={() => triggerToast("Download Initiated", "info")} className="flex flex-col items-center gap-2 cursor-pointer">
                    <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400 shadow-lg"><Download className="w-6 h-6 text-green-500"/></div>
                    <span className="text-[10px] font-black text-zinc-500 uppercase">Save</span>
                 </div>
                 <div onClick={() => { setShowShare(false); setShowReport(true); }} className="flex flex-col items-center gap-2 cursor-pointer">
                    <div className="w-14 h-14 bg-red-900/20 rounded-2xl flex items-center justify-center text-red-500 shadow-lg"><Flag className="w-6 h-6 text-red-500"/></div>
                    <span className="text-[10px] font-black text-zinc-500 uppercase">Report</span>
                 </div>
              </div>
              {showSpeed && (
                <div className="p-4 flex gap-3 justify-center animate-in fade-in duration-300 bg-black rounded-3xl mt-2 border border-white/5">
                  {[0.5, 1.0, 1.5, 2.0].map(s => (
                    <button key={s} onClick={() => { setPlaybackRate(s); triggerToast(`Playback: ${s}x`, "info"); setShowSpeed(false); }} className={`px-5 py-2 rounded-full text-xs font-black transition ${playbackRate === s ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-500'}`}>{s}x</button>
                  ))}
                </div>
              )}
           </div>
        </div>
      )}

      {/* 🚩 REPORT DRAWER */}
      {showReport && (
        <div className="fixed inset-0 z-[700]">
           <div className="drawer-mask" onClick={() => setShowReport(false)} />
           <div className="drawer-content p-8 animate-in slide-in-from-bottom duration-300">
              <h3 className="text-red-500 font-black uppercase text-sm mb-6 tracking-widest italic">Report Sync</h3>
              <div className="space-y-3">
                 {["Inappropriate", "Copyright", "Spam", "Other"].map(r => (
                   <button key={r} onClick={() => { triggerToast("Report received. We will review.", "success"); setShowReport(false); }} className="w-full p-5 bg-zinc-900 rounded-2xl text-left text-sm font-black italic border border-white/5 active:border-red-600 transition text-white">{r}</button>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* 💬 COMMENTS DRAWER */}
      {showComments && (
        <div className="fixed inset-0 z-[500]">
          <div className="drawer-mask" onClick={() => { setShowComments(false); setReplyTo(null); }} />
          <div className="drawer-content flex flex-col h-[75vh] animate-in slide-in-from-bottom duration-300">
            <header className="p-4 border-b border-white/5 flex justify-between items-center bg-zinc-900/50">
              <span className="text-xs font-black uppercase text-zinc-500 px-2 tracking-widest">Discussion Hub</span>
              <button onClick={() => setShowComments(false)} className="p-2 bg-white/5 rounded-full active:scale-90 transition"><X className="w-4 h-4"/></button>
            </header>
            <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar pb-10">
              {comments.map((c) => (
                <CommentItem key={c.id} comment={c} vidId={activeVid.id} onReply={(id: string, username: string) => setReplyTo({id, username})} />
              ))}
            </div>
            <div className="p-4 bg-black border-t border-white/5 pb-safe">
              {replyTo && <div className="flex items-center justify-between bg-zinc-900 px-4 py-2 rounded-t-xl text-[10px] font-bold border-t border-white/5"><span>Replying to <span className="text-red-500">@{replyTo.username}</span></span><button onClick={() => setReplyTo(null)}><X className="w-3 h-3"/></button></div>}
              <div className="flex gap-2 items-center">
                <input type="text" value={commentInput} onChange={(e) => setCommentInput(e.target.value)} placeholder="Add a comment..." className={`flex-1 bg-zinc-900 border border-white/5 outline-none px-5 py-3 text-sm text-white ${replyTo ? 'rounded-b-2xl' : 'rounded-full'}`} />
                <button onClick={submitComment} className="bg-red-600 p-3 rounded-full shadow-lg active:scale-90 transition"><Send className="w-4 h-4"/></button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Navbar />
    </div>
  );
}

// --- VIDEO PLAYER COMPONENT ---
function VideoSlide({ video, muted, setMuted, onShare, onComment, isFollowing, playbackRate }: any) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [commentCount, setCommentCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState<number>(video.likes?.length || 0);
  const [isPaused, setIsPaused] = useState(false);
  const lastClickTime = useRef(0);

  useEffect(() => {
    setLiked(video.likes?.includes(user?.uid || ""));
    const unsub = onSnapshot(collection(db, `wallpapers/${video.id}/comments`), (snap) => setCommentCount(snap.size));
    return () => unsub();
  }, [video.id, user, video.likes]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { 
        if (entry.isIntersecting) { videoRef.current?.play().catch(() => {}); setIsPaused(false); }
        else { videoRef.current?.pause(); }
    }, { threshold: 0.7 });
    if (videoRef.current) observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, []);

  const handleLike = async () => {
    if (!user) return;
    const ref = doc(db, "wallpapers", video.id);
    if (!liked) {
      setLiked(true); setLikesCount((p: number) => p + 1);
      await updateDoc(ref, { likes: arrayUnion(user.uid) });
    } else {
      setLiked(false); setLikesCount((p: number) => p - 1);
      await updateDoc(ref, { likes: arrayRemove(user.uid) });
    }
  };

  const handleInteraction = () => {
    const now = Date.now();
    if (now - lastClickTime.current < 300) {
      if (!liked) handleLike();
    } else {
      setTimeout(() => { if (Date.now() - lastClickTime.current >= 300) {
          if (videoRef.current?.paused) { videoRef.current.play(); setIsPaused(false); }
          else { videoRef.current?.pause(); setIsPaused(true); }
      }}, 300);
    }
    lastClickTime.current = now;
  };

  const followUser = async (e: any) => {
    e.stopPropagation(); if (!user) return;
    await setDoc(doc(db, `users/${user.uid}/following`, video.userId), { uid: video.userId });
    await setDoc(doc(db, `users/${video.userId}/followers`, user.uid), { uid: user.uid });
  };

  return (
    <section className="feed-item" onClick={handleInteraction}>
      <video ref={videoRef} src={video.url} loop muted={muted} playsInline className="h-full w-full object-cover md:object-contain md:max-w-[480px]" />
      
      {isPaused && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none animate-in fade-in zoom-in duration-200">
           <div className="w-20 h-20 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
              <Play className="w-10 h-10 fill-white text-white ml-1" />
           </div>
        </div>
      )}

      <div className="absolute right-4 bottom-32 flex flex-col gap-6 items-center z-40 pointer-events-auto" onClick={e => e.stopPropagation()}>
        <div className="relative mb-2">
          <Link href={`/user/${video.userId}`}><img src={video.creator?.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${video.userId}`} className="w-12 h-12 rounded-full border-2 border-white object-cover" alt="a"/></Link>
          {!isFollowing && user?.uid !== video.userId && (
             <button onClick={followUser} className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 rounded-full p-1 border-2 border-black active:scale-125 transition shadow-lg"><Plus className="w-3 h-3 text-white" /></button>
          )}
        </div>
        <button onClick={handleLike} className="flex flex-col items-center gap-1"><Heart className={`w-8 h-8 ${liked ? 'fill-red-600 text-red-600 scale-125' : 'text-white'} transition-all`} /><span className="text-[10px] font-black text-white text-shadow uppercase">{likesCount}</span></button>
        <button onClick={onComment} className="flex flex-col items-center gap-1"><MessageCircle className="w-8 h-8 text-white" /><span className="text-[10px] font-black text-white text-shadow uppercase">{commentCount}</span></button>
        <button onClick={onShare} className="flex flex-col items-center gap-1"><Share2 className="w-8 h-8 text-white" /><span className="text-[10px] font-black text-white text-shadow uppercase">Share</span></button>
      </div>

      <div className="absolute bottom-0 left-0 w-full p-6 pb-28 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-30 pointer-events-none">
        <button onClick={(e) => { e.stopPropagation(); setMuted(!muted); }} className="pointer-events-auto mb-4 bg-black/40 p-3 rounded-full border border-white/10 backdrop-blur-md active:scale-90 transition shadow-lg">
          {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
        </button>
        <div className="flex items-center gap-1 mb-1 pointer-events-auto">
          <Link href={`/user/${video.userId}`} className="font-black text-lg text-white text-shadow block tracking-tight">@{video.creator?.username || video.username}</Link>
          {video.creator?.isPremium && <VerifiedBadge className="w-4 h-4" />}
        </div>
        <p className="text-sm text-zinc-100 text-shadow font-semibold line-clamp-2 max-w-[80%]">{video.title}</p>
      </div>
    </section>
  );
}

// --- RECURSIVE COMMENTS ---
function CommentItem({ comment, vidId, onReply }: { comment: CommentData, vidId: string, onReply: (id: string, user: string) => void }) {
  const [replies, setReplies] = useState<CommentData[]>([]);
  const [showReplies, setShowReplies] = useState(false);
  useEffect(() => {
    if (!showReplies) return;
    const unsub = onSnapshot(query(collection(db, `wallpapers/${vidId}/comments/${comment.id}/replies`), orderBy("createdAt", "asc")), (snap) => {
      setReplies(snap.docs.map(d => ({ id: d.id, ...d.data() } as CommentData)));
    });
    return () => unsub();
  }, [showReplies, vidId, comment.id]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3 px-2 animate-in fade-in duration-300">
        <img src={comment.userPhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${comment.userId}`} className="w-9 h-9 rounded-full object-cover border border-white/10 shadow-lg" alt="u" />
        <div className="flex-1">
          <p className="text-[11px] font-black text-zinc-400 mb-0.5 uppercase tracking-tighter">@{comment.username}</p>
          <p className="text-sm text-white leading-relaxed">{comment.text}</p>
          <div className="flex gap-4 mt-2">
             <button onClick={() => onReply(comment.id, comment.username)} className="text-[10px] font-black text-zinc-500 uppercase tracking-tighter active:text-red-500 transition">Reply</button>
             {(replies.length > 0) && (
                <button onClick={() => setShowReplies(!showReplies)} className="text-[10px] font-black text-red-500 uppercase tracking-tighter flex items-center gap-1 active:scale-95 transition">
                  {showReplies ? "Hide" : `View ${replies.length} replies`}
                </button>
             )}
          </div>
        </div>
      </div>
      {showReplies && <div className="ml-10 border-l border-white/5 pl-4 space-y-6 mt-2 animate-in slide-in-from-left-2 duration-300">
        {replies.map(r => <CommentItem key={r.id} comment={r} vidId={vidId} onReply={onReply} />)}
      </div>}
    </div>
  );
}