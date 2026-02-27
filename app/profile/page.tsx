// app/profile/page.tsx
"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { Settings, Share2, Camera, Grid, Image as ImageIcon, Heart, X, LogOut, Info } from "lucide-react";
import { Wallpaper } from "@/types";

export default function ProfilePage() {
  const { user, userData } = useAuth();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<'videos' | 'images' | 'likes'>('videos');
  const [uploads, setUploads] = useState<Wallpaper[]>([]);
  const [stats, setStats] = useState({ followers: 0, following: 0, likes: 0 });
  
  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  
  // Edit Form
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
      router.push("/auth");
      return;
    }
    
    setEditName(userData?.username || "");
    setEditBio(userData?.bio || "");

    // Fetch User Uploads
    const q = query(collection(db, "wallpapers"), where("userId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Wallpaper));
      setUploads(items);
      
      // Calculate total likes from all uploads
      const totalLikes = items.reduce((acc, curr) => acc + (curr.likes?.length || 0), 0);
      setStats(s => ({ ...s, likes: totalLikes }));
    });

    // Fetch Followers & Following
    const unsubFollowers = onSnapshot(collection(db, `users/${user.uid}/followers`), (snap) => {
      setStats(s => ({ ...s, followers: snap.size }));
    });
    const unsubFollowing = onSnapshot(collection(db, `users/${user.uid}/following`), (snap) => {
      setStats(s => ({ ...s, following: snap.size }));
    });

    return () => { unsub(); unsubFollowers(); unsubFollowing(); };
  }, [user, userData, router]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      await updateDoc(doc(db, "users", user.uid), { photoURL: data.secure_url });
    } catch (err) {
      console.error("Upload failed", err);
    }
  };

  const saveProfile = async () => {
    if (!user || !editName.trim()) return;
    await updateDoc(doc(db, "users", user.uid), {
      username: editName.toLowerCase().replace(/\s+/g, ''),
      bio: editBio
    });
    setShowEdit(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/auth");
  };

  if (!user || !userData) return <div className="h-screen bg-black" />;

  const filteredUploads = uploads.filter(u => 
    activeTab === 'videos' ? u.fileType === 'video' : 
    activeTab === 'images' ? u.fileType === 'image' : true 
  ); // For likes tab, you'd fetch separately based on `likes` array containing user.uid

  return (
    <main className="min-h-screen bg-black text-white pb-24">
      <header className="fixed top-0 w-full h-[60px] bg-black/90 backdrop-blur-md border-b border-zinc-900 flex items-center px-4 z-40">
        <h1 className="text-xl font-black tracking-tighter"><span className="text-red-600">OTAKU</span>WALL</h1>
      </header>

      <div className="pt-20 px-4 flex flex-col items-center">
        {/* Profile Avatar */}
        <div className="relative">
          <img src={userData.photoURL} alt="Profile" className="w-24 h-24 rounded-full object-cover border-2 border-zinc-800 bg-zinc-900" />
          <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 bg-red-600 p-2 rounded-full border-4 border-black">
            <Camera className="w-4 h-4 text-white" />
          </button>
          <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileUpload} />
        </div>

        <h1 className="text-lg font-bold mt-3">@{userData.username}</h1>
        <p className="text-xs text-zinc-400 mt-1 max-w-xs text-center">{userData.bio || 'Anime Enthusiast'}</p>

        {/* Stats */}
        <div className="flex gap-8 my-6 w-full justify-center border-b border-zinc-900 pb-6">
          <div className="flex flex-col items-center"><span className="font-bold text-lg">{stats.followers}</span><span className="text-xs text-zinc-500">Followers</span></div>
          <div className="flex flex-col items-center"><span className="font-bold text-lg">{stats.following}</span><span className="text-xs text-zinc-500">Following</span></div>
          <div className="flex flex-col items-center"><span className="font-bold text-lg">{stats.likes}</span><span className="text-xs text-zinc-500">Likes</span></div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 w-full max-w-md">
          <button onClick={() => setShowEdit(true)} className="flex-1 bg-zinc-800 py-3 rounded-xl font-bold text-sm active:scale-95 transition">Edit Profile</button>
          <button className="bg-zinc-800 p-3 rounded-xl active:scale-95 transition"><Share2 className="w-5 h-5" /></button>
          <button onClick={() => setShowSettings(true)} className="bg-zinc-800 p-3 rounded-xl active:scale-95 transition"><Settings className="w-5 h-5" /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-[60px] bg-black z-30 flex border-b border-zinc-900 mt-6">
        <button onClick={() => setActiveTab('videos')} className={`flex-1 py-4 flex justify-center border-b-2 transition ${activeTab === 'videos' ? 'border-red-500 text-white' : 'border-transparent text-zinc-600'}`}><Grid className="w-5 h-5" /></button>
        <button onClick={() => setActiveTab('images')} className={`flex-1 py-4 flex justify-center border-b-2 transition ${activeTab === 'images' ? 'border-red-500 text-white' : 'border-transparent text-zinc-600'}`}><ImageIcon className="w-5 h-5" /></button>
        <button onClick={() => setActiveTab('likes')} className={`flex-1 py-4 flex justify-center border-b-2 transition ${activeTab === 'likes' ? 'border-red-500 text-white' : 'border-transparent text-zinc-600'}`}><Heart className="w-5 h-5" /></button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-[2px]">
        {filteredUploads.map(item => (
          <div key={item.id} onClick={() => router.push(`/watch/${item.id}`)} className="aspect-[3/4] bg-zinc-900 relative cursor-pointer">
            {item.fileType === 'video' ? (
              <video src={`${item.url}#t=0.1`} className="w-full h-full object-cover" muted playsInline />
            ) : (
              <img src={item.url} className="w-full h-full object-cover" />
            )}
          </div>
        ))}
      </div>

      {/* Settings Modal (Simplified for brevity) */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end">
          <div className="bg-zinc-950 w-full rounded-t-3xl p-6 pb-12 border-t border-zinc-800">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold">Settings</h2>
              <button onClick={() => setShowSettings(false)}><X /></button>
            </div>
            <button onClick={handleLogout} className="w-full py-4 mt-4 text-red-500 font-black text-sm bg-red-500/10 rounded-xl flex justify-center items-center gap-2">
              <LogOut className="w-4 h-4" /> Log Out
            </button>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 w-full max-w-sm rounded-3xl p-6 border border-zinc-800">
            <h2 className="text-lg font-bold mb-4">Edit Profile</h2>
            <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none mb-4 font-bold" />
            <textarea value={editBio} onChange={e => setEditBio(e.target.value)} className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-white outline-none mb-6 resize-none h-24" />
            <div className="flex gap-2">
              <button onClick={() => setShowEdit(false)} className="flex-1 bg-zinc-800 py-3 rounded-xl font-bold">Cancel</button>
              <button onClick={saveProfile} className="flex-1 bg-red-600 py-3 rounded-xl font-bold">Save</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}