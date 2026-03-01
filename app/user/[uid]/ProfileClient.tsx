// app/user/[uid]/ProfileClient.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, onSnapshot, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { ArrowLeft, Share2, MessageSquare, Play, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { UserData, Wallpaper } from "@/types";
import Navbar from "@/components/Navbar";
import VerifiedBadge from "@/components/VerifiedBadge";

export default function ProfileClient({ uid }: { uid: string }) {
  const { user } = useAuth();
  const router = useRouter();

  // Logic State
  const [targetUser, setTargetUser] = useState<UserData | null>(null);
  const [uploads, setUploads] = useState<Wallpaper[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [stats, setStats] = useState({ followers: 0, following: 0, likes: 0 });
  const [loading, setLoading] = useState(true);

  // Toast State
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (user?.uid === uid) {
      router.replace("/profile");
      return;
    }

    const fetchUser = async () => {
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) setTargetUser({ uid: snap.id, ...snap.data() } as UserData);
      setLoading(false);
    };
    fetchUser();

    const q = query(collection(db, "wallpapers"), where("userId", "==", uid));
    const unsubWalls = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Wallpaper));
      setUploads(items);
      const totalLikes = items.reduce((acc, curr) => acc + (curr.likes?.length || 0), 0);
      setStats(s => ({ ...s, likes: totalLikes }));
    });

    onSnapshot(collection(db, `users/${uid}/followers`), (snap) => setStats(s => ({ ...s, followers: snap.size })));
    onSnapshot(collection(db, `users/${uid}/following`), (snap) => setStats(s => ({ ...s, following: snap.size })));

    if (user) {
      const checkFollow = onSnapshot(doc(db, `users/${uid}/followers`, user.uid), (doc) => setIsFollowing(doc.exists()));
      return () => { unsubWalls(); checkFollow(); };
    }

    return () => unsubWalls();
  }, [uid, user, router]);

  const toggleFollow = async () => {
    if (!user) return router.push("/auth");
    const followerRef = doc(db, `users/${uid}/followers`, user.uid);
    const followingRef = doc(db, `users/${user.uid}/following`, uid);

    try {
      if (isFollowing) {
        await deleteDoc(followerRef);
        await deleteDoc(followingRef);
        showToast("Unfollowed @"+targetUser?.username, "info");
      } else {
        await setDoc(followerRef, { uid: user.uid, timestamp: serverTimestamp() });
        await setDoc(followingRef, { uid, timestamp: serverTimestamp() });
        showToast("Following @"+targetUser?.username);
      }
    } catch (e) { showToast("Action failed", "error"); }
  };

  const startChat = async () => {
    if (!user || !targetUser) return router.push("/auth");
    const combinedId = user.uid < uid ? user.uid + uid : uid + user.uid;
    await setDoc(doc(db, "chats", combinedId), {
      chatName: targetUser.username,
      chatAvatar: targetUser.photoURL,
      participants: [user.uid, uid],
      lastActivity: serverTimestamp(),
      isGroup: false,
    }, { merge: true });
    router.push(`/inbox/${combinedId}`);
  };

  const copyProfileLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      showToast("Profile link copied!");
    }
  };

  if (loading) return <div className="h-screen bg-black flex items-center justify-center"><div className="otaku-spinner" /></div>;
  if (!targetUser) return <div className="h-screen bg-black flex items-center justify-center font-bold">USER NOT FOUND</div>;

  return (
    <main className="scroll-container no-scrollbar pb-32 bg-black relative">
      
      {/* 🍞 OTAKU TOAST */}
      {toast && (
        <div className={`fixed top-24 right-0 z-[500] px-6 py-4 rounded-l-2xl shadow-2xl flex items-center gap-3 border-l-4 transform transition-all animate-in slide-in-from-right duration-300 ${
          toast.type === 'error' ? 'bg-zinc-900 border-yellow-500 text-yellow-500' : 
          toast.type === 'info' ? 'bg-zinc-900 border-blue-500 text-blue-500' :
          'bg-zinc-900 border-red-600 text-white'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-5 h-5"/> : <CheckCircle2 className="w-5 h-5"/>}
          <span className="font-bold text-xs uppercase tracking-widest">{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-[65px] bg-black/90 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-5 z-50 pt-safe">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-1 active:scale-90 transition"><ArrowLeft /></button>
          <h1 className="text-lg font-black italic tracking-tighter truncate max-w-[180px] uppercase">{targetUser.username}</h1>
        </div>
        <button onClick={copyProfileLink} className="p-2 text-zinc-400 active:text-white"><Share2 className="w-5 h-5" /></button>
      </header>

      {/* Profile Details */}
      <div className="pt-24 px-6 flex flex-col items-center">
        <img 
          src={targetUser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${uid}`} 
          className="w-28 h-28 rounded-[40px] object-cover border-2 border-zinc-800 bg-zinc-900 shadow-2xl" 
          alt="avatar"
        />
        
        <div className="mt-5 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <h1 className="text-2xl font-black tracking-tight italic">@{targetUser.username}</h1>
            {targetUser.isPremium && <VerifiedBadge className="w-5 h-5 shadow-lg" />}
          </div>
          <p className="text-sm text-zinc-500 font-medium max-w-xs">{targetUser.bio || 'Anime Enthusiast'}</p>
        </div>

        {/* Stats Row */}
        <div className="flex gap-10 my-8 w-full justify-center">
          <div className="flex flex-col items-center"><span className="font-black text-xl">{stats.followers}</span><span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Followers</span></div>
          <div className="flex flex-col items-center"><span className="font-black text-xl">{stats.following}</span><span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Following</span></div>
          <div className="flex flex-col items-center"><span className="font-black text-xl">{stats.likes}</span><span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Likes</span></div>
        </div>

        <div className="flex gap-2 w-full max-w-md mb-8 px-2">
          <button 
            onClick={toggleFollow} 
            className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition active:scale-95 shadow-lg ${isFollowing ? 'bg-zinc-900 text-zinc-400 border border-white/5' : 'bg-red-600 text-white shadow-red-900/20'}`}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>
          <button onClick={startChat} className="flex-1 bg-white text-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 flex justify-center items-center gap-2 shadow-lg">
            <MessageSquare className="w-4 h-4" /> Chat
          </button>
        </div>
      </div>

      {/* Grid Content */}
      <div className="px-6 py-4 border-t border-zinc-900 flex items-center gap-2">
         <div className="w-1 h-4 bg-red-600 rounded-full" />
         <span className="text-[10px] font-black uppercase tracking-[2px] text-zinc-500">Sync Grid</span>
      </div>

      <div className="grid grid-cols-3 gap-[2px]">
        {uploads.map(item => (
          <div 
            key={item.id} 
            onClick={() => router.push(`/watch/${item.id}?uid=${uid}`)} 
            className="aspect-[3/4] bg-zinc-900 relative cursor-pointer group overflow-hidden"
          >
            {item.fileType === 'video' ? (
              <>
                <video src={`${item.url}#t=0.1`} className="w-full h-full object-cover opacity-80" muted playsInline />
                <div className="absolute bottom-2 left-2 flex items-center gap-1">
                   <Play className="w-3 h-3 fill-white text-white" />
                   <span className="text-[9px] font-black">{item.views || 0}</span>
                </div>
              </>
            ) : (
              <img src={item.url} className="w-full h-full object-cover opacity-80" alt="post" />
            )}
          </div>
        ))}
      </div>

      <Navbar />
    </main>
  );
}