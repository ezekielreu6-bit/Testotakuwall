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
  Download, Flag, Zap, AlertCircle, CheckCircle2, Search, ArrowRight, Play, CornerDownRight
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";
import VerifiedBadge from "@/components/VerifiedBadge";
import Link from "next/link";
import { Wallpaper, UserData } from "@/types";

// --- Types ---
interface CommentData {
  id: string;
  text: string;
  userId: string;
  username: string;
  userPhoto?: string;
  createdAt: any;
  parentId?: string | null;
}

export default function Feed() {
  const { user, userData } = useAuth();
  const [videos, setVideos] = useState<(Wallpaper & { creator?: UserData })[]>([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);

  // --- UI MODAL STATES ---
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [activeVid, setActiveVid] = useState<any>(null);

  // --- SEARCH STATES ---
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<{ users: UserData[], videos: Wallpaper[] }>({ users: [], videos: [] });
  const [isSearching, setIsSearching] = useState(false);

  // --- COMMENT STATES ---
  const [comments, setComments] = useState<CommentData[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; username: string; path: string } | null>(null);

  const triggerToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 1. Fetch Feed & Shuffle
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
    fetchFeed();
  }, []);

  // 2. Search Engine Logic
  useEffect(() => {
    if (searchQuery.length < 2) { setSuggestions([]); return; }
    const delay = setTimeout(async () => {
      const userQ = query(collection(db, "users"), orderBy("username"), startAt(searchQuery.toLowerCase()), endAt(searchQuery.toLowerCase() + "\uf8ff"), limit(5));
      const userSnap = await getDocs(userQ);
      setSuggestions(userSnap.docs.map(d => d.data().username));
    }, 300);
    return () => clearTimeout(delay);
  }, [searchQuery]);

  const executeSearch = async (qStr: string) => {
    setIsSearching(true); setSearchQuery(qStr); setSuggestions([]);
    try {
      const uSnap = await getDocs(query(collection(db, "users"), where("username", "==", qStr.toLowerCase().trim())));
      const vSnap = await getDocs(query(collection(db, "wallpapers"), where("fileType", "==", "video"), orderBy("title"), startAt(qStr), endAt(qStr + "\uf8ff"), limit(12)));
      setSearchResults({ 
        users: uSnap.docs.map(d => ({ ...d.data(), uid: d.id } as UserData)), 
        videos: vSnap.docs.map(d => ({ ...d.data(), id: d.id } as Wallpaper)) 
      });
    } catch (e) { triggerToast("Search encountered an error", "error"); }
    setIsSearching(false);
  };

  // 3. Comments Logic
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
    const colPath = replyTo ? `${replyTo.path}` : `wallpapers/${activeVid.id}/comments`;
    await addDoc(collection(db, colPath), {
      text, userId: user.uid, username: userData?.username || "otaku", 
      userPhoto: userData?.photoURL || "", createdAt: serverTimestamp(), parentId: replyTo?.id || null
    });
    setReplyTo(null);
    triggerToast("Synced comment! 🔥");
  };

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden">
      
      {/* 🍞 TOAST */}
      {toast && (
        <div className={`fixed top-24 right-0 z-[600] px-6 py-4 rounded-l-2xl shadow-2xl flex items-center gap-3 border-l-4 transform transition-all animate-in slide-in-from-right duration-300 ${
          toast.type === 'error' ? 'bg-zinc-900 border-yellow-500 text-yellow-500' : 'bg-zinc-900 border-red-600 text-white'
        }`}>
          <AlertCircle className="w-5 h-5"/>
          <span className="font-bold text-xs uppercase tracking-widest">{toast.msg}</span>
        </div>
      )}

      {/* HEADER */}
      <header className="absolute top-0 left-0 right-0 p-6 z-50 flex justify-between items-center pt-safe pointer-events-none">
        <h1 className="text-2xl font-black italic text-white text-shadow pointer-events-auto">
          <span className="text-red-600">OTAKU</span>WALL
        </h1>
        <button onClick={() => setShowSearch(true)} className="p-3 bg-black/20 backdrop-blur-xl border border-white/10 rounded-full text-white pointer-events-auto active:scale-90 transition"><Search/></button>
      </header>

      {/* MAIN FEED */}
      <main className="feed-container no-scrollbar">
        {loading ? (
          <div className="h-full w-full flex items-center justify-center bg-black"><div className="otaku-spinner"></div></div>
        ) : (
          videos.map((vid) => (
            <VideoSlide 
              key={vid.id} video={vid} muted={muted} setMuted={setMuted} 
              onShare={() => { setActiveVid(vid); setShowShare(true); }} 
              onComment={() => { setActiveVid(vid); setShowComments(true); }}
            />
          ))
        )}
      </main>

      {/* 🔍 SEARCH MODAL */}
      <div className={`fixed inset-0 z-[500] transition-transform duration-500 bg-black ${showSearch ? 'translate-x-0' : 'translate-x-full'}`}>
        <header className="p-6 pt-safe border-b border-white/5 flex items-center gap-4 bg-zinc-950">
           <button onClick={() => {setShowSearch(false); setSearchResults({users:[], videos:[]});}} className="p-2 bg-zinc-900 rounded-full"><X/></button>
           <form onSubmit={(e) => { e.preventDefault(); executeSearch(searchQuery); }} className="flex-1 relative">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search otakus or syncs..." className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none focus:border-red-600 transition-all" />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
           </form>
        </header>
        <div className="flex-1 overflow-y-auto p-6 no-scrollbar pb-32">
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => executeSearch(s)} className="w-full flex items-center justify-between p-4 bg-zinc-900/50 rounded-2xl mb-2 border border-white/5 font-bold uppercase tracking-tighter">@{s}<ArrowRight className="text-red-600 w-4 h-4"/></button>
            ))}
            <div className="grid grid-cols-2 gap-3 mt-6">
               {searchResults.videos.map(v => (
                 <Link key={v.id} href={`/watch/${v.id}`} className="aspect-[9/16] rounded-2xl bg-zinc-900 overflow-hidden relative border border-white/5 shadow-2xl">
                    <video src={`${v.url}#t=0.1`} className="w-full h-full object-cover opacity-60" muted playsInline />
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black to-transparent">
                        <p className="text-[10px] font-black text-white uppercase truncate">{v.title}</p>
                    </div>
                 </Link>
               ))}
            </div>
            {searchResults.users.length > 0 && (
              <div className="mt-8">
                <p className="text-[10px] font-black uppercase text-zinc-600 mb-4 px-2 tracking-[2px]">Otaku Matches</p>
                {searchResults.users.map(u => (
                  <Link key={u.uid} href={`/user/${u.uid}`} className="flex items-center gap-4 p-4 bg-zinc-900/50 rounded-3xl border border-white/5 mb-3 active:scale-95 transition">
                    <img src={u.photoURL} className="w-12 h-12 rounded-full object-cover border border-white/10" alt="u" />
                    <span className="font-black text-sm uppercase italic">@{u.username}</span>
                    <ChevronRight className="ml-auto w-5 h-5 text-zinc-700" />
                  </Link>
                ))}
              </div>
            )}
        </div>
      </div>

      {/* 💬 COMMENTS DRAWER */}
      {showComments && (
        <div className="fixed inset-0 z-[500]">
          <div className="drawer-mask" onClick={() => { setShowComments(false); setReplyTo(null); }} />
          <div className="drawer-content flex flex-col h-[75vh] animate-in slide-in-from-bottom duration-300">
            <header className="p-4 border-b border-white/5 flex justify-between items-center bg-zinc-900/50">
              <span className="text-xs font-black uppercase text-zinc-500 tracking-widest">Discussion Hub</span>
              <button onClick={() => setShowComments(false)} className="p-2 bg-white/5 rounded-full"><X className="w-4 h-4"/></button>
            </header>
            <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar pb-10">
              {comments.map((c) => (
                <CommentItem key={c.id} comment={c} vidId={activeVid.id} onReply={(id: string, username: string) => setReplyTo({ id, username, path: `wallpapers/${activeVid.id}/comments/${id}/replies` })} />
              ))}
            </div>
            <div className="p-4 bg-black border-t border-white/5 pb-safe">
              {replyTo && (
                <div className="flex items-center justify-between bg-zinc-900 px-4 py-2 rounded-t-xl text-[10px] font-bold border-x border-t border-white/5">
                  <span>Replying to <span className="text-red-500">@{replyTo.username}</span></span>
                  <button onClick={() => setReplyTo(null)}><X className="w-3 h-3"/></button>
                </div>
              )}
              <div className="flex gap-2 items-center">
                <input type="text" value={commentInput} onChange={(e) => setCommentInput(e.target.value)} placeholder="Add a comment..." className={`flex-1 bg-zinc-900 border border-white/5 outline-none px-5 py-3 text-sm text-white ${replyTo ? 'rounded-b-2xl' : 'rounded-full'}`} />
                <button onClick={submitComment} className="bg-red-600 p-3 rounded-full shadow-lg active:scale-90 transition"><Send className="w-4 h-4"/></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 SHARE DRAWER */}
      {showShare && activeVid && (
        <div className="fixed inset-0 z-[500]">
           <div className="drawer-mask" onClick={() => setShowShare(false)} />
           <div className="drawer-content p-6 animate-in slide-in-from-bottom duration-300">
              <div className="p-4 border-b border-white/5 text-center relative mb-4">
                 <h3 className="font-bold text-xs uppercase tracking-widest text-zinc-500">Share Sync</h3>
              </div>
              <div className="flex gap-6 justify-center pb-8 border-b border-white/5">
                 <div onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/watch/${activeVid.id}`); triggerToast("Link Copied!"); setShowShare(false); }} className="flex flex-col items-center gap-2 cursor-pointer active:scale-90 transition">
                    <div className="w-14 h-14 bg-zinc-800 rounded-full flex items-center justify-center text-white shadow-xl"><LinkIcon/></div>
                    <span className="text-[10px] font-black uppercase text-zinc-500">Link</span>
                 </div>
                 <div onClick={() => window.open(`https://wa.me/?text=Check this! ${window.location.origin}/watch/${activeVid.id}`)} className="flex flex-col items-center gap-2 cursor-pointer active:scale-90 transition">
                    <div className="w-14 h-14 bg-green-600 rounded-full flex items-center justify-center text-white shadow-xl"><Send className="w-5 h-5 fill-white"/></div>
                    <span className="text-[10px] font-black uppercase text-zinc-500">WhatsApp</span>
                 </div>
                 <div onClick={() => triggerToast("Starting Download...", "info")} className="flex flex-col items-center gap-2 cursor-pointer active:scale-90 transition">
                    <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-xl"><Download/></div>
                    <span className="text-[10px] font-black uppercase text-zinc-500">Save</span>
                 </div>
              </div>
              <button onClick={() => { setShowShare(false); setShowReport(true); }} className="w-full py-5 flex items-center justify-center gap-3 text-red-500 font-black text-[10px] uppercase tracking-widest bg-white/5 rounded-2xl mt-6">
                <Flag className="w-4 h-4" /> Report content
              </button>
           </div>
        </div>
      )}

      {/* 🚩 REPORT DRAWER */}
      {showReport && (
        <div className="fixed inset-0 z-[700]">
           <div className="drawer-mask" onClick={() => setShowReport(false)} />
           <div className="drawer-content p-8 animate-in slide-in-from-bottom duration-300">
              <h3 className="text-red-500 font-black uppercase text-sm mb-6 tracking-widest italic">Reason for report</h3>
              <div className="space-y-3">
                 {["Inappropriate", "Copyright", "Spam", "Other"].map(r => (
                   <button key={r} onClick={() => { triggerToast("Reported for " + r); setShowReport(false); }} className="w-full p-5 bg-zinc-900 rounded-2xl text-left text-sm font-black italic border border-white/5 active:border-red-600 transition">{r}</button>
                 ))}
              </div>
           </div>
        </div>
      )}

      <Navbar />
    </div>
  );
}

// --- Video Slide Component ---

function VideoSlide({ video, muted, setMuted, onShare, onComment }: any) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [commentCount, setCommentCount] = useState(0);
  const [liked, setLiked] = useState(video.likes?.includes(user?.uid));
  const [likesCount, setLikesCount] = useState(video.likes?.length || 0);
  const [isPaused, setIsPaused] = useState(false);
  const lastClickTime = useRef(0);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, `wallpapers/${video.id}/comments`), (snap) => setCommentCount(snap.size));
    return () => unsub();
  }, [video.id]);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { 
        if (e.isIntersecting) { videoRef.current?.play(); setIsPaused(false); }
        else { videoRef.current?.pause(); }
    }, { threshold: 0.7 });
    if (videoRef.current) obs.observe(videoRef.current);
    return () => obs.disconnect();
  }, []);

  const handleInteraction = () => {
    const now = Date.now();
    if (now - lastClickTime.current < 300) {
      // Double tap -> Like logic
      if (!liked) {
          setLiked(true); setLikesCount(c => c + 1);
          updateDoc(doc(db, "wallpapers", video.id), { likes: arrayUnion(user?.uid) });
      }
    } else {
      // Single tap -> Play/Pause with visual indicator
      setTimeout(() => {
          if (Date.now() - lastClickTime.current >= 300) {
              if (videoRef.current?.paused) {
                  videoRef.current.play(); setIsPaused(false);
              } else {
                  videoRef.current?.pause(); setIsPaused(true);
              }
          }
      }, 300);
    }
    lastClickTime.current = now;
  };

  return (
    <section className="feed-item" onClick={handleInteraction}>
      <video ref={videoRef} src={video.url} loop muted={muted} playsInline className="h-full w-full object-cover md:object-contain md:max-w-[480px]" />
      
      {/* ⏸ PAUSE OVERLAY */}
      {isPaused && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none animate-in fade-in zoom-in duration-200">
           <div className="w-20 h-20 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
              <Play className="w-10 h-10 fill-white text-white ml-1" />
           </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="absolute right-4 bottom-32 flex flex-col gap-6 items-center z-40 pointer-events-auto" onClick={e => e.stopPropagation()}>
        <div className="relative mb-2">
          <Link href={`/user/${video.userId}`}><img src={video.creator?.photoURL} className="w-12 h-12 rounded-full border-2 border-white object-cover" /></Link>
          {!video.isLive && user?.uid !== video.userId && <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 rounded-full p-1 border-2 border-black"><Plus className="w-3 h-3 text-white" /></div>}
        </div>
        <button className="flex flex-col items-center"><Heart className={`w-8 h-8 ${liked ? 'fill-red-600 text-red-600 scale-125' : 'text-white'} transition-all`} /><span className="text-[10px] font-black text-shadow">{likesCount}</span></button>
        <button onClick={onComment} className="flex flex-col items-center"><MessageCircle className="w-8 h-8 text-white" /><span className="text-[10px] font-black text-shadow">{commentCount}</span></button>
        <button onClick={onShare} className="flex flex-col items-center"><Share2 className="w-8 h-8 text-white" /><span className="text-[10px] font-black text-shadow uppercase">Share</span></button>
      </div>

      {/* Bottom Info */}
      <div className="absolute bottom-0 left-0 w-full p-6 pb-28 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-30 pointer-events-none">
        <button onClick={(e) => { e.stopPropagation(); setMuted(!muted); }} className="pointer-events-auto mb-4 bg-black/40 p-3 rounded-full border border-white/10 backdrop-blur-md">{muted ? <VolumeX className="w-4 h-4"/> : <Volume2 className="w-4 h-4"/>}</button>
        <Link href={`/user/${video.userId}`} className="font-black text-lg text-white text-shadow block pointer-events-auto flex items-center gap-1">
          @{video.creator?.username || video.username}
          {video.creator?.isPremium && <VerifiedBadge className="w-4 h-4" />}
        </Link>
        <p className="text-sm text-zinc-100 text-shadow font-semibold line-clamp-2 max-w-[80%]">{video.title}</p>
      </div>
    </section>
  );
}

// --- Recursive Comment Item ---

function CommentItem({ comment, vidId, onReply }: any) {
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
      <div className="flex gap-3">
        <img src={comment.userPhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${comment.userId}`} className="w-9 h-9 rounded-full object-cover border border-white/5" alt="u" />
        <div className="flex-1">
          <p className="text-xs font-black text-zinc-400 mb-0.5">@{comment.username}</p>
          <p className="text-sm text-white leading-relaxed">{comment.text}</p>
          <div className="flex gap-4 mt-2">
             <button onClick={() => onReply(comment.id, comment.username)} className="text-[10px] font-black text-zinc-500 uppercase">Reply</button>
             <button onClick={() => setShowReplies(!showReplies)} className="text-[10px] font-black text-red-500 uppercase">
                {showReplies ? "Hide" : replies.length > 0 ? `View ${replies.length} replies` : "Replies"}
             </button>
          </div>
        </div>
      </div>
      {showReplies && <div className="ml-10 border-l border-zinc-900 pl-4 space-y-6 mt-2 animate-in slide-in-from-left-2 duration-300">
        {replies.map(r => <CommentItem key={r.id} comment={r} vidId={vidId} onReply={onReply} />)}
      </div>}
    </div>
  );
}