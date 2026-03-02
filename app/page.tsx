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
  const [followingList, setFollowingList] = useState<string[]>([]);
  const [friends, setFriends] = useState<UserData[]>([]);

  // --- UI STATES ---
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [activeVid, setActiveVid] = useState<any>(null);

  // --- SEARCH ---
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ users: UserData[], videos: Wallpaper[] }>({ users: [], videos: [] });
  const [isSearching, setIsSearching] = useState(false);

  // --- COMMENTS ---
  const [comments, setComments] = useState<CommentData[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);

  const triggerToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 1. Real-time Following Listener (Fixes persistent + button)
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, `users/${user.uid}/following`), (snap) => {
      setFollowingList(snap.docs.map(d => d.id));
    });
    return () => unsub();
  }, [user]);

  // 2. Initial Feed Load
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

  // 3. Search Logic
  const executeSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const qText = searchQuery.toLowerCase().trim();
    try {
      const uSnap = await getDocs(query(collection(db, "users"), where("username", "==", qText)));
      const vSnap = await getDocs(query(collection(db, "wallpapers"), orderBy("title"), startAt(searchQuery), endAt(searchQuery + "\uf8ff"), limit(10)));
      setSearchResults({
        users: uSnap.docs.map(d => ({ ...d.data(), uid: d.id } as UserData)),
        videos: vSnap.docs.map(d => ({ ...d.data(), id: d.id } as Wallpaper))
      });
    } catch (e) { triggerToast("Search failed", "error"); }
    setIsSearching(false);
  };

  // 4. Comments Listener
  useEffect(() => {
    if (!activeVid || !showComments) return;
    const unsub = onSnapshot(query(collection(db, `wallpapers/${activeVid.id}/comments`), orderBy("createdAt", "asc")), (snap) => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as CommentData)));
    });
    return () => unsub();
  }, [activeVid, showComments]);

  const postComment = async () => {
    if (!user || !commentInput.trim() || !activeVid) return;
    const text = commentInput; setCommentInput("");
    const path = replyTo 
      ? `wallpapers/${activeVid.id}/comments/${replyTo.id}/replies`
      : `wallpapers/${activeVid.id}/comments`;
    
    await addDoc(collection(db, path), {
      text, userId: user.uid, username: userData?.username || "otaku",
      userPhoto: userData?.photoURL || "", createdAt: serverTimestamp()
    });
    setReplyTo(null);
  };

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden">
      
      {/* 🟢 HEADER */}
      <header className="absolute top-0 left-0 right-0 p-6 z-50 flex justify-between items-center pt-safe pointer-events-none">
        <h1 className="text-2xl font-black italic text-white text-shadow pointer-events-auto"><span className="text-red-600">OTAKU</span>WALL</h1>
        <button onClick={() => setShowSearch(true)} className="p-3 bg-black/20 backdrop-blur-xl border border-white/10 rounded-full text-white pointer-events-auto active:scale-90 transition"><Search/></button>
      </header>

      {/* 🟢 FEED */}
      <main className="feed-container no-scrollbar">
        {loading ? <div className="h-full w-full flex items-center justify-center"><div className="otaku-spinner"></div></div> :
          videos.map((vid) => (
            <VideoSlide 
              key={vid.id} video={vid} muted={muted} setMuted={setMuted} 
              isFollowing={followingList.includes(vid.userId)}
              onShare={() => { setActiveVid(vid); setShowShare(true); }} 
              onComment={() => { setActiveVid(vid); setShowComments(true); }}
            />
          ))
        }
      </main>

      {/* 🔍 SEARCH MODAL */}
      <div className={`fixed inset-0 z-[500] transition-transform duration-500 bg-black ${showSearch ? 'translate-x-0' : 'translate-x-full'}`}>
        <header className="p-6 pt-safe border-b border-white/5 flex items-center gap-4">
           <button onClick={() => setShowSearch(false)} className="p-2 bg-zinc-900 rounded-full"><X/></button>
           <form onSubmit={executeSearch} className="flex-1 relative">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none focus:border-red-600 transition-all" />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
           </form>
        </header>
        <div className="flex-1 overflow-y-auto p-6 pb-20">
           {isSearching ? <div className="otaku-spinner mx-auto mt-20"/> : (
             <div className="grid grid-cols-2 gap-3">
                {searchResults.users.map(u => (
                  <Link key={u.uid} href={`/user/${u.uid}`} className="col-span-2 flex items-center gap-4 bg-zinc-900/50 p-4 rounded-3xl border border-white/5">
                    <img src={u.photoURL} className="w-12 h-12 rounded-full object-cover"/>
                    <span className="font-black text-sm uppercase">@{u.username}</span>
                  </Link>
                ))}
                {searchResults.videos.map(v => (
                  <Link key={v.id} href={`/watch/${v.id}`} className="aspect-[9/16] rounded-2xl bg-zinc-900 overflow-hidden relative border border-white/5"><video src={`${v.url}#t=0.1`} className="w-full h-full object-cover opacity-60" muted playsInline /><div className="absolute bottom-0 p-3"><p className="text-[10px] font-bold truncate uppercase">{v.title}</p></div></Link>
                ))}
             </div>
           )}
        </div>
      </div>

      {/* 🚀 SHARE DRAWER (Original Row Layout) */}
      {showShare && activeVid && (
        <div className="fixed inset-0 z-[600]">
           <div className="drawer-mask" onClick={() => setShowShare(false)} />
           <div className="drawer-content p-6 animate-in slide-in-from-bottom duration-300">
              <div className="p-4 border-b border-white/5 text-center relative mb-4">
                 <h3 className="font-bold text-xs uppercase text-zinc-500 tracking-widest">Share Sync</h3>
                 <button onClick={() => setShowShare(false)} className="absolute right-0 top-3 text-zinc-600"><X className="w-5 h-5"/></button>
              </div>
              {/* Row 1: Friends (Simulated based on following) */}
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 border-b border-white/5 mb-6">
                 <div className="flex flex-col items-center gap-2 min-w-[70px]"><div className="w-14 h-14 bg-zinc-800 rounded-full flex items-center justify-center opacity-30"><Search className="w-5 h-5"/></div><span className="text-[9px] font-bold text-zinc-600">Find...</span></div>
              </div>
              {/* Row 2: Apps */}
              <div className="flex gap-6 justify-center pb-8 border-b border-white/5">
                 <ShareCircle icon={<LinkIcon/>} label="Link" color="bg-zinc-800" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/watch/${activeVid.id}`); triggerToast("Copied!"); setShowShare(false); }} />
                 <ShareCircle icon={<Send className="fill-white w-4 h-4"/>} label="WhatsApp" color="bg-green-600" onClick={() => window.open(`https://wa.me/?text=Check this! ${window.location.origin}/watch/${activeVid.id}`)} />
                 <ShareCircle icon={<MoreHorizontal/>} label="More" color="bg-blue-600" />
              </div>
              {/* Row 3: Action Grid */}
              <div className="p-4 grid grid-cols-3 gap-4">
                 <div className="flex flex-col items-center gap-2"><div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400"><Zap className="w-6 h-6"/></div><span className="text-[10px] font-black text-zinc-500">SPEED</span></div>
                 <div className="flex flex-col items-center gap-2" onClick={() => triggerToast("Starting Download")}><div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400"><Download className="w-6 h-6"/></div><span className="text-[10px] font-black text-zinc-500">SAVE</span></div>
                 <div className="flex flex-col items-center gap-2 text-red-500"><div className="w-14 h-14 bg-red-900/20 rounded-2xl flex items-center justify-center"><Flag className="w-6 h-6"/></div><span className="text-[10px] font-black uppercase">REPORT</span></div>
              </div>
           </div>
        </div>
      )}

      {/* 💬 COMMENTS DRAWER */}
      {showComments && (
        <div className="fixed inset-0 z-[500]">
          <div className="drawer-mask" onClick={() => { setShowComments(false); setReplyTo(null); }} />
          <div className="drawer-content flex flex-col h-[75vh] animate-in slide-in-from-bottom">
            <header className="p-4 border-b border-white/5 flex justify-between items-center bg-zinc-900/50">
              <span className="text-xs font-black uppercase text-zinc-500">Discussion Hub</span>
              <button onClick={() => setShowComments(false)} className="p-2 bg-white/5 rounded-full"><X className="w-4 h-4"/></button>
            </header>
            <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
              {comments.map((c) => (
                <CommentItem key={c.id} comment={c} vidId={activeVid.id} onReply={(id, username) => setReplyTo({id, username})} />
              ))}
            </div>
            <div className="p-4 bg-black border-t border-white/5 pb-safe">
              {replyTo && <div className="flex items-center justify-between bg-zinc-900 px-4 py-2 rounded-t-xl text-[10px] font-bold border-t border-white/5"><span>Replying to <span className="text-red-500">@{replyTo.username}</span></span><button onClick={() => setReplyTo(null)}><X className="w-3 h-3"/></button></div>}
              <div className="flex gap-2 items-center">
                <input type="text" value={commentInput} onChange={(e) => setCommentInput(e.target.value)} placeholder="Add a comment..." className={`flex-1 bg-zinc-900 border-white/5 outline-none px-5 py-3 text-sm text-white ${replyTo ? 'rounded-b-2xl' : 'rounded-full'}`} />
                <button onClick={postComment} className="bg-red-600 p-3 rounded-full"><Send className="w-4 h-4"/></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🍞 TOAST */}
      {toast && <div className="fixed top-24 right-0 z-[1000] px-6 py-4 rounded-l-2xl bg-zinc-900 border-l-4 border-red-600 text-white shadow-2xl animate-in slide-in-from-right duration-300 font-bold uppercase text-[11px] tracking-widest">{toast.msg}</div>}

      <Navbar />
    </div>
  );
}

// --- SUB-COMPONENTS ---

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
      <div className="flex gap-3">
        <img src={comment.userPhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${comment.userId}`} className="w-9 h-9 rounded-full object-cover border border-white/10" alt="u" />
        <div className="flex-1">
          <p className="text-xs font-black text-zinc-400 mb-0.5">@{comment.username}</p>
          <p className="text-sm text-white leading-relaxed">{comment.text}</p>
          <div className="flex gap-4 mt-2">
             <button onClick={() => onReply(comment.id, comment.username)} className="text-[10px] font-black text-zinc-500 uppercase">Reply</button>
             {(!showReplies || replies.length > 0) && (
                <button onClick={() => setShowReplies(!showReplies)} className="text-[10px] font-black text-red-500 uppercase">
                  {showReplies ? "Hide" : "Replies"}
                </button>
             )}
          </div>
        </div>
      </div>
      {showReplies && (
        <div className="ml-10 border-l-2 border-zinc-900 pl-4 space-y-6 mt-2 animate-in slide-in-from-left-2">
          {replies.map(r => <CommentItem key={r.id} comment={r} vidId={vidId} onReply={onReply} />)}
        </div>
      )}
    </div>
  );
}

function VideoSlide({ video, muted, setMuted, onShare, onComment }: any) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [commentCount, setCommentCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(video.likes?.length || 0);
  const [showHeartPop, setShowHeartPop] = useState(false);
  const lastClick = useRef(0);

  useEffect(() => {
    setLiked(video.likes?.includes(user?.uid));
    const unsub = onSnapshot(collection(db, `wallpapers/${video.id}/comments`), (snap) => setCommentCount(snap.size));
    return () => unsub();
  }, [video.id, user, video.likes]);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { e.isIntersecting ? videoRef.current?.play() : videoRef.current?.pause(); }, { threshold: 0.7 });
    if (videoRef.current) obs.observe(videoRef.current);
    return () => obs.disconnect();
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

  const handleFollow = async (e: any) => {
    e.stopPropagation(); if (!user) return;
    await setDoc(doc(db, `users/${user.uid}/following`, video.userId), { uid: video.userId });
    await setDoc(doc(db, `users/${video.userId}/followers`, user.uid), { uid: user.uid });
  };

  const handleInteraction = () => {
    const now = Date.now();
    if (now - lastClick.current < 300) {
      setShowHeartPop(true); setTimeout(() => setShowHeartPop(false), 800);
      if (!liked) handleLike();
    } else {
      setTimeout(() => { if (Date.now() - lastClick.current >= 300) { videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause(); } }, 300);
    }
    lastClick.current = now;
  };

  return (
    <section className="feed-item" onClick={handleInteraction}>
      <video ref={videoRef} src={video.url} loop muted={muted} playsInline className="h-full w-full object-cover md:object-contain md:max-w-[480px]" />
      
      {showHeartPop && <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"><Heart className="w-24 h-24 text-red-600 fill-red-600 animate-heart-pop" /></div>}

      <div className="absolute right-4 bottom-32 flex flex-col gap-6 items-center z-40 pointer-events-auto" onClick={e => e.stopPropagation()}>
        <div className="relative mb-2">
          <Link href={`/user/${video.userId}`}><img src={video.creator?.photoURL} className="w-12 h-12 rounded-full border-2 border-white object-cover" /></Link>
          {user?.uid !== video.userId && !video.isFollowing && (
             <button onClick={handleFollow} className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 rounded-full p-1 border-2 border-black"><Plus className="w-3 h-3 text-white" /></button>
          )}
        </div>
        <button onClick={handleLike} className="flex flex-col items-center gap-1"><Heart className={`w-8 h-8 ${liked ? 'fill-red-600 text-red-600 scale-125' : 'text-white'} transition-all`} /><span className="text-[10px] font-black text-shadow uppercase">{likesCount}</span></button>
        <button onClick={onComment} className="flex flex-col items-center gap-1"><MessageCircle className="w-8 h-8 text-white" /><span className="text-[10px] font-black text-shadow uppercase">{commentCount}</span></button>
        <button onClick={onShare} className="flex flex-col items-center gap-1"><Share2 className="w-8 h-8 text-white" /><span className="text-[10px] font-black text-shadow uppercase">Share</span></button>
      </div>

      <div className="absolute bottom-0 left-0 w-full p-6 pb-28 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-30 pointer-events-none">
        <button onClick={(e) => { e.stopPropagation(); setMuted(!muted); }} className="pointer-events-auto mb-4 bg-black/40 p-3 rounded-full border border-white/10 backdrop-blur-md">{muted ? <VolumeX className="w-4 h-4"/> : <Volume2 className="w-4 h-4"/>}</button>
        <div className="flex items-center gap-1 mb-1 pointer-events-auto">
          <Link href={`/user/${video.userId}`} className="font-black text-lg text-white text-shadow">@{video.creator?.username || video.username}</Link>
          {video.creator?.isPremium && <VerifiedBadge className="w-4 h-4" />}
        </div>
        <p className="text-sm text-zinc-200 text-shadow font-semibold line-clamp-2 max-w-[80%]">{video.title}</p>
      </div>
    </section>
  );
}

function ShareCircle({ icon, label, color, onClick }: any) {
  return (
    <div onClick={onClick} className="flex flex-col items-center gap-2 min-w-[70px] cursor-pointer active:scale-90 transition">
       <div className={`w-14 h-14 ${color} rounded-full flex items-center justify-center text-white shadow-xl`}>{icon}</div>
       <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{label}</span>
    </div>
  );
}