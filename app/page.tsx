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
  Download, Flag, Zap, AlertCircle, CheckCircle2, Search, ArrowRight, User, CornerDownRight
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

interface VideoSlideProps {
  video: Wallpaper & { creator?: UserData };
  muted: boolean;
  setMuted: (val: boolean) => void;
  onShare: () => void;
  onComment: () => void;
}

export default function Feed() {
  const { user, userData } = useAuth();
  const [videos, setVideos] = useState<(Wallpaper & { creator?: UserData })[]>([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);

  // --- UI States ---
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [activeVid, setActiveVid] = useState<any>(null);

  // --- Search ---
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<{ users: UserData[], videos: Wallpaper[] }>({ users: [], videos: [] });
  const [isSearching, setIsSearching] = useState(false);

  // --- Comments ---
  const [comments, setComments] = useState<CommentData[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; username: string; path: string } | null>(null);

  const triggerToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
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
        setVideos(videoData.sort(() => Math.random() - 0.5));
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    fetchFeed();
  }, []);

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
    const uSnap = await getDocs(query(collection(db, "users"), where("username", "==", qStr.toLowerCase().trim())));
    const vSnap = await getDocs(query(collection(db, "wallpapers"), where("fileType", "==", "video"), orderBy("title"), startAt(qStr), endAt(qStr + "\uf8ff"), limit(12)));
    setSearchResults({ 
      users: uSnap.docs.map(d => ({ ...d.data(), uid: d.id } as UserData)), 
      videos: vSnap.docs.map(d => ({ ...d.data(), id: d.id } as Wallpaper)) 
    });
    setIsSearching(false);
  };

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
      text,
      userId: user.uid,
      username: userData?.username || "otaku",
      userPhoto: userData?.photoURL || "",
      createdAt: serverTimestamp(),
      parentId: replyTo?.id || null
    });
    setReplyTo(null);
    triggerToast("Synced comment! 🔥");
  };

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden">
      {toast && (
        <div className="fixed top-24 right-0 z-[600] px-6 py-4 rounded-l-2xl shadow-2xl flex items-center gap-3 border-l-4 bg-zinc-900 border-red-600 text-white animate-in slide-in-from-right duration-300">
          <AlertCircle className="w-5 h-5"/>
          <span className="font-bold text-xs uppercase tracking-widest">{toast.msg}</span>
        </div>
      )}

      <header className="absolute top-0 left-0 right-0 p-6 z-50 flex justify-between items-center pt-safe pointer-events-none">
        <h1 className="text-2xl font-black italic text-white text-shadow pointer-events-auto">
          <span className="text-red-600">OTAKU</span>WALL
        </h1>
        <button onClick={() => setShowSearch(true)} className="p-3 bg-black/20 backdrop-blur-xl border border-white/10 rounded-full text-white pointer-events-auto active:scale-90 transition"><Search/></button>
      </header>

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

      <div className={`fixed inset-0 z-[500] transition-transform duration-500 bg-black ${showSearch ? 'translate-x-0' : 'translate-x-full'}`}>
        <header className="p-6 pt-safe border-b border-white/5 flex items-center gap-4">
           <button onClick={() => setShowSearch(false)} className="p-2 bg-zinc-900 rounded-full"><X/></button>
           <div className="flex-1 relative">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none focus:border-red-600 transition-all" />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
           </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6 no-scrollbar pb-20">
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => executeSearch(s)} className="w-full flex items-center justify-between p-4 bg-zinc-900/50 rounded-2xl mb-2 border border-white/5 font-bold">@{s}<ArrowRight className="text-red-600"/></button>
            ))}
            <div className="grid grid-cols-2 gap-3 mt-4">
               {searchResults.videos.map(v => (
                 <Link key={v.id} href={`/watch/${v.id}`} className="aspect-[9/16] rounded-2xl bg-zinc-900 overflow-hidden relative border border-white/5"><video src={`${v.url}#t=0.1`} className="w-full h-full object-cover opacity-60" muted playsInline /><div className="absolute bottom-0 p-3"><p className="text-[10px] font-bold truncate">{v.title}</p></div></Link>
               ))}
            </div>
        </div>
      </div>

      {showComments && (
        <div className="fixed inset-0 z-[500]">
          <div className="drawer-mask" onClick={() => { setShowComments(false); setReplyTo(null); }} />
          <div className="drawer-content flex flex-col h-[75vh] animate-in slide-in-from-bottom duration-300">
            <header className="p-4 border-b border-white/5 flex justify-between items-center bg-zinc-900/50">
              <span className="text-xs font-black uppercase text-zinc-500">Discussion Hub</span>
              <button onClick={() => setShowComments(false)} className="p-2 bg-white/5 rounded-full"><X className="w-4 h-4"/></button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar pb-10">
              {comments.map((c) => (
                <CommentItem 
                   key={c.id} 
                   comment={c} 
                   vidId={activeVid.id} 
                   // 🟢 FIXED: Explicitly typed parameters to prevent Vercel error
                   onReply={(id: string, username: string) => setReplyTo({ id, username, path: `wallpapers/${activeVid.id}/comments/${id}/replies` })} 
                />
              ))}
            </div>

            <div className="p-4 bg-black border-t border-white/5 pb-safe">
              {replyTo && (
                <div className="flex items-center justify-between bg-zinc-900 px-4 py-2 rounded-t-xl text-[10px] font-bold">
                  <span>Replying to <span className="text-red-500">@{replyTo.username}</span></span>
                  <button onClick={() => setReplyTo(null)}><X className="w-3 h-3"/></button>
                </div>
              )}
              <div className="flex gap-2 items-center">
                <input type="text" value={commentInput} onChange={(e) => setCommentInput(e.target.value)} placeholder="Add a comment..." className="flex-1 bg-zinc-900 border-white/5 outline-none px-5 py-3 text-sm text-white rounded-full" />
                <button onClick={submitComment} className="bg-red-600 p-3 rounded-full"><Send className="w-4 h-4"/></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showShare && activeVid && (
        <div className="fixed inset-0 z-[500]">
           <div className="drawer-mask" onClick={() => setShowShare(false)} />
           <div className="drawer-content p-6 animate-in slide-in-from-bottom">
              <button onClick={() => setShowShare(false)} className="w-full py-4 mt-4 bg-zinc-900 rounded-2xl font-bold text-zinc-500">Cancel</button>
           </div>
        </div>
      )}

      <Navbar />
    </div>
  );
}

// --- Components ---

function CommentItem({ comment, vidId, onReply }: { comment: CommentData, vidId: string, onReply: (id: string, username: string) => void }) {
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
        <img src={comment.userPhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${comment.userId}`} className="w-9 h-9 rounded-full object-cover" alt="u" />
        <div className="flex-1">
          <p className="text-xs font-black text-zinc-400">@{comment.username}</p>
          <p className="text-sm text-white">{comment.text}</p>
          <div className="flex gap-4 mt-2">
             <button onClick={() => onReply(comment.id, comment.username)} className="text-[10px] font-black text-zinc-500 uppercase">Reply</button>
             <button onClick={() => setShowReplies(!showReplies)} className="text-[10px] font-black text-red-500 uppercase">
                {showReplies ? "Hide" : replies.length > 0 ? `View ${replies.length} replies` : "Replies"}
             </button>
          </div>
        </div>
      </div>
      {showReplies && <div className="ml-10 border-l border-zinc-900 pl-4 space-y-6 mt-2">
        {replies.map(r => <CommentItem key={r.id} comment={r} vidId={vidId} onReply={onReply} />)}
      </div>}
    </div>
  );
}

function VideoSlide({ video, muted, setMuted, onShare, onComment }: VideoSlideProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { e.isIntersecting ? videoRef.current?.play() : videoRef.current?.pause(); }, { threshold: 0.7 });
    if (videoRef.current) obs.observe(videoRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="feed-item">
      <video ref={videoRef} src={video.url} loop muted={muted} playsInline className="h-full w-full object-cover md:object-contain md:max-w-[480px]" />
      <div className="absolute right-4 bottom-32 flex flex-col gap-6 items-center z-40 pointer-events-auto">
        <div className="relative mb-2">
          <Link href={`/user/${video.userId}`}><img src={video.creator?.photoURL} className="w-12 h-12 rounded-full border-2 border-white object-cover" /></Link>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 rounded-full p-1 border-2 border-black"><Plus className="w-3 h-3 text-white" /></div>
        </div>
        <button className="flex flex-col items-center"><Heart className="w-8 h-8 text-white" /><span className="text-[10px] font-black">{video.likes?.length || 0}</span></button>
        <button onClick={onComment} className="flex flex-col items-center"><MessageCircle className="w-8 h-8 text-white" /></button>
        <button onClick={onShare} className="flex flex-col items-center"><Share2 className="w-8 h-8 text-white" /></button>
      </div>
      <div className="absolute bottom-0 left-0 w-full p-6 pb-28 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-30 pointer-events-none">
        <button onClick={(e) => { e.stopPropagation(); setMuted(!muted); }} className="pointer-events-auto mb-4 bg-black/40 p-3 rounded-full border border-white/10 backdrop-blur-md">{muted ? <VolumeX className="w-4 h-4"/> : <Volume2 className="w-4 h-4"/>}</button>
        <Link href={`/user/${video.userId}`} className="font-black text-lg text-white text-shadow block pointer-events-auto">@{video.creator?.username || video.username}</Link>
        <p className="text-sm text-zinc-100 text-shadow line-clamp-2 max-w-[80%]">{video.title}</p>
      </div>
    </section>
  );
}