// app/user/[uid]/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, onSnapshot, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { ArrowLeft, Share2, Grid, Heart, MessageSquare } from "lucide-react";
import { UserData, Wallpaper } from "@/types";

export default function ViewProfilePage() {
  const { uid } = useParams() as { uid: string };
  const { user } = useAuth();
  const router = useRouter();

  const [targetUser, setTargetUser] = useState<UserData | null>(null);
  const [uploads, setUploads] = useState<Wallpaper[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [stats, setStats] = useState({ followers: 0, following: 0, likes: 0 });

  useEffect(() => {
    if (user?.uid === uid) {
      router.push("/profile"); // Redirect to own profile if it's you
      return;
    }

    // Fetch Target User Data
    getDoc(doc(db, "users", uid)).then(snap => {
      if (snap.exists()) setTargetUser({ uid: snap.id, ...snap.data() } as UserData);
    });

    // Fetch Uploads
    const q = query(collection(db, "wallpapers"), where("userId", "==", uid));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Wallpaper));
      setUploads(items);
      const totalLikes = items.reduce((acc, curr) => acc + (curr.likes?.length || 0), 0);
      setStats(s => ({ ...s, likes: totalLikes }));
    });

    // Fetch Stats
    onSnapshot(collection(db, `users/${uid}/followers`), (snap) => setStats(s => ({ ...s, followers: snap.size })));
    onSnapshot(collection(db, `users/${uid}/following`), (snap) => setStats(s => ({ ...s, following: snap.size })));

    // Check if current user is following
    if (user) {
      getDoc(doc(db, `users/${uid}/followers/${user.uid}`)).then(doc => setIsFollowing(doc.exists()));
    }

    return () => unsub();
  },[uid, user, router]);

  const toggleFollow = async () => {
    if (!user) return router.push("/auth");
    const followerRef = doc(db, `users/${uid}/followers/${user.uid}`);
    const followingRef = doc(db, `users/${user.uid}/following/${uid}`);
    
    if (isFollowing) {
      await deleteDoc(followerRef);
      await deleteDoc(followingRef);
      setIsFollowing(false);
    } else {
      await setDoc(followerRef, { uid: user.uid, timestamp: serverTimestamp() });
      await setDoc(followingRef, { uid, timestamp: serverTimestamp() });
      setIsFollowing(true);
    }
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

  if (!targetUser) return <div className="h-screen bg-black" />;

  return (
    <main className="scroll-container no-scrollbar pb-32">
      <header className="fixed top-0 w-full h-[60px] bg-black/90 backdrop-blur-md border-b border-zinc-900 flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}><ArrowLeft className="w-6 h-6" /></button>
          <h1 className="text-lg font-black truncate">{targetUser.username}</h1>
        </div>
        <button><Share2 className="w-5 h-5 text-zinc-400" /></button>
      </header>

      <div className="pt-20 px-4 flex flex-col items-center">
        <img src={targetUser.photoURL} className="w-24 h-24 rounded-full object-cover border-2 border-zinc-800 bg-zinc-900" />
        <h1 className="text-xl font-black mt-3">@{targetUser.username}</h1>
        <p className="text-sm text-zinc-400 mt-1 max-w-xs text-center">{targetUser.bio || 'Anime Enthusiast'}</p>

        <div className="flex gap-8 my-6 w-full justify-center">
          <div className="flex flex-col items-center"><span className="font-bold text-lg">{stats.followers}</span><span className="text-xs text-zinc-500">Followers</span></div>
          <div className="flex flex-col items-center"><span className="font-bold text-lg">{stats.following}</span><span className="text-xs text-zinc-500">Following</span></div>
          <div className="flex flex-col items-center"><span className="font-bold text-lg">{stats.likes}</span><span className="text-xs text-zinc-500">Likes</span></div>
        </div>

        <div className="flex gap-2 w-full max-w-md mb-6">
          <button onClick={toggleFollow} className={`flex-1 py-3 rounded-xl font-bold text-sm transition ${isFollowing ? 'bg-zinc-800 text-white' : 'bg-red-600 text-white'}`}>
            {isFollowing ? 'Following' : 'Follow'}
          </button>
          <button onClick={startChat} className="flex-1 bg-zinc-800 text-white py-3 rounded-xl font-bold text-sm flex justify-center items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Chat
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-[2px]">
        {uploads.map(item => (
          <div key={item.id} onClick={() => router.push(`/watch/${item.id}`)} className="aspect-[3/4] bg-zinc-900 relative cursor-pointer">
            {item.fileType === 'video' ? (
              <video src={`${item.url}#t=0.1`} className="w-full h-full object-cover" muted playsInline />
            ) : (
              <img src={item.url} className="w-full h-full object-cover" />
            )}
          </div>
        ))}
      </div>
    </main>
  );
}