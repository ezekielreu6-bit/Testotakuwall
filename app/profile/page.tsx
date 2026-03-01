"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { signOut, sendPasswordResetEmail } from "firebase/auth";
import { 
  collection, query, where, doc, 
  updateDoc, onSnapshot, orderBy, getDoc 
} from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { 
  Settings, Share2, Camera, Grid, Image as ImageIcon, 
  Heart, X, LogOut, ChevronRight, User, TrendingUp, 
  Lock, FileText, Trash2, ShieldCheck, Play, ArrowLeft,
  Mail, ShieldAlert, CheckCircle2, AlertCircle, Info
} from "lucide-react";
import { Wallpaper, UserData } from "@/types";
import Navbar from "@/components/Navbar";
import VerifiedBadge, { rosettePath } from "@/components/VerifiedBadge";

type Tab = 'videos' | 'images' | 'likes';
type SettingsView = 'main' | 'account' | 'privacy' | 'terms';

export default function ProfilePage() {
  const { user, userData, loading: authLoading } = useAuth();
  const router = useRouter();

  // --- UI State ---
  const [activeTab, setActiveTab] = useState<Tab>('videos');
  const [uploads, setUploads] = useState<Wallpaper[]>([]);
  const [stats, setStats] = useState({ followers: 0, following: 0, likes: 0 });
  const [dataLoading, setDataLoading] = useState(true);
  
  // --- Modals & Sub-view State ---
  const [showSettings, setShowSettings] = useState(false);
  const [settingsView, setSettingsView] = useState<SettingsView>('main');
  const [showEdit, setShowEdit] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  
  // --- Form & Toast State ---
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [randomSeeds, setRandomSeeds] = useState<string[]>([]);
  const [cacheSize, setCacheSize] = useState("0.4 MB");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Protection & Data Fetching
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/auth");
      return;
    }

    setEditName(userData?.username || "");
    setEditBio(userData?.bio || "");

    // Real-time followers/following
    const unsubFollowers = onSnapshot(collection(db, `users/${user.uid}/followers`), (s) => setStats(prev => ({...prev, followers: s.size})));
    const unsubFollowing = onSnapshot(collection(db, `users/${user.uid}/following`), (s) => setStats(prev => ({...prev, following: s.size})));

    // User content query (Requires index)
    const q = query(collection(db, "wallpapers"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsubWalls = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Wallpaper));
      setUploads(items);
      const totalLikes = items.reduce((acc, curr) => acc + (curr.likes?.length || 0), 0);
      setStats(prev => ({...prev, likes: totalLikes}));
      setDataLoading(false);
    });

    return () => { unsubFollowers(); unsubFollowing(); unsubWalls(); };
  }, [user, userData, authLoading, router]);

  // 2. Notification System
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 3. Avatar & Photo Handlers
  const openAvatarPicker = () => {
    const seeds = Array.from({ length: 12 }, () => Math.random().toString(36).substring(7));
    setRandomSeeds(seeds);
    setShowAvatarPicker(true);
  };

  const selectAvatar = async (seed: string) => {
    if (!user) return;
    const url = `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}`;
    try {
      await updateDoc(doc(db, "users", user.uid), { photoURL: url });
      setShowAvatarPicker(false);
      showToast("Avatar Synced!");
    } catch (e) { showToast("Failed to sync", "error"); }
  };

  const handleCustomUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    showToast("Processing Image...");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: "POST", body: formData
      });
      const data = await res.json();
      await updateDoc(doc(db, "users", user.uid), { photoURL: data.secure_url });
      showToast("Photo Updated!");
    } catch (err) { showToast("Upload failed", "error"); }
  };

  // 4. Form Actions
  const saveProfile = async () => {
    if (!user || !editName.trim()) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        username: editName.toLowerCase().replace(/\s+/g, ''),
        bio: editBio
      });
      setShowEdit(false);
      showToast("Changes Saved!");
    } catch (e) { showToast("Name taken", "error"); }
  };

  if (authLoading || (user && !userData)) {
    return <div className="h-screen w-screen bg-black flex items-center justify-center"><div className="otaku-spinner" /></div>;
  }

  if (!user || !userData) return null;

  return (
    <main className="scroll-container no-scrollbar pb-40 relative bg-black">
      
      {/* 🍞 TOAST */}
      {toast && (
        <div className={`fixed top-20 right-0 z-[500] px-6 py-4 rounded-l-2xl shadow-2xl flex items-center gap-3 border-l-4 transform transition-all animate-in slide-in-from-right duration-300 ${
          toast.type === 'error' ? 'bg-zinc-900 border-yellow-500 text-yellow-500' : 'bg-zinc-900 border-red-600 text-white'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-5 h-5"/> : <CheckCircle2 className="w-5 h-5"/>}
          <span className="font-bold text-xs uppercase tracking-widest">{toast.msg}</span>
        </div>
      )}

      {/* 🟢 HEADER */}
      <header className="fixed top-0 left-0 right-0 h-[65px] bg-black/80 backdrop-blur-xl border-b border-white/5 z-50 px-6 flex items-center justify-between pt-safe">
        <h1 className="text-xl font-black italic tracking-tighter"><span className="text-red-600">OTAKU</span>WALL</h1>
        <button 
          onClick={() => { setSettingsView('main'); setShowSettings(true); }} 
          className="p-2 bg-white/5 rounded-full text-zinc-400 active:scale-90 transition pointer-events-auto"
        >
          <Settings className="w-5 h-5"/>
        </button>
      </header>

      {/* ⚪️ PROFILE HERO */}
      <div className="pt-24 px-6 flex flex-col items-center">
        <div className="relative group">
          <div className="w-28 h-28 rounded-[40px] overflow-hidden border-2 border-zinc-800 bg-zinc-900 shadow-2xl">
            <img src={userData.photoURL} className="w-full h-full object-cover" alt="avatar" />
          </div>
          <button 
            onClick={() => setShowEdit(true)}
            className="absolute -bottom-2 -right-2 bg-red-600 p-2.5 rounded-2xl border-4 border-black shadow-xl active:scale-90 transition"
          >
            <Camera className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="mt-5 text-center">
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            <h1 className="text-2xl font-black tracking-tight italic">@{userData.username}</h1>
            {userData.isPremium ? <VerifiedBadge className="w-5 h-5" /> : (
              <button onClick={() => router.push('/premium')} className="flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-1 rounded-full active:scale-95 transition">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-red-600/40"><path d={rosettePath}/></svg>
                <span className="text-[9px] font-black uppercase text-red-500 tracking-tighter">Get Verified</span>
              </button>
            )}
          </div>
          <p className="text-sm text-zinc-500 font-medium mt-1.5 max-w-[280px] leading-relaxed">{userData.bio || 'Anime Enthusiast'}</p>
        </div>

        {/* Stats */}
        <div className="w-full max-w-sm mt-8 p-6 bg-zinc-900/30 border border-white/5 rounded-[32px] flex justify-between items-center backdrop-blur-sm shadow-xl">
           <StatItem label="Followers" value={stats.followers} />
           <div className="w-px h-8 bg-white/10" />
           <StatItem label="Following" value={stats.following} />
           <div className="w-px h-8 bg-white/10" />
           <StatItem label="Likes" value={stats.likes} />
        </div>

        <div className="flex gap-2 w-full max-w-md mt-8 px-2">
           <button onClick={() => setShowEdit(true)} className="flex-1 py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition shadow-lg">Edit Profile</button>
           <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/user/${user.uid}`); showToast("Link Copied!"); }} className="px-5 bg-zinc-900 border border-white/10 rounded-2xl text-white active:scale-90 transition"><Share2 className="w-5 h-5"/></button>
        </div>
      </div>

      {/* 🔵 CONTENT TABS */}
      <div className="sticky top-[65px] bg-black z-30 flex border-b border-zinc-900 mt-8">
        <TabBtn active={activeTab === 'videos'} onClick={() => setActiveTab('videos')} icon={<Grid className="w-5 h-5" />} />
        <TabBtn active={activeTab === 'images'} onClick={() => setActiveTab('images')} icon={<ImageIcon className="w-5 h-5" />} />
        <TabBtn active={activeTab === 'likes'} onClick={() => setActiveTab('likes')} icon={<Heart className="w-5 h-5" />} />
      </div>

      {/* 🎥 MEDIA GRID */}
      <div className="grid grid-cols-3 gap-[2px]">
        {uploads.filter(u => activeTab === 'videos' ? u.fileType === 'video' : u.fileType === 'image').map(item => (
          <div key={item.id} onClick={() => router.push(`/watch/${item.id}?uid=${user.uid}`)} className="aspect-[3/4] bg-zinc-900 relative group overflow-hidden cursor-pointer">
            {item.fileType === 'video' ? (
              <video src={`${item.url}#t=0.1`} className="w-full h-full object-cover" muted playsInline />
            ) : (
              <img src={item.url} className="w-full h-full object-cover" alt="post" />
            )}
            <div className="absolute bottom-2 left-2 flex items-center gap-1 opacity-100">
                 <Play className="w-3 h-3 fill-white" />
                 <span className="text-[10px] font-bold">{item.views || 0}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 🟡 EDIT MODAL (DiceBear Integration) */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/90 z-[110] flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in duration-300">
           <div className="w-full max-w-sm bg-zinc-900 rounded-[40px] p-8 border border-white/10 animate-in zoom-in-95 shadow-2xl relative">
              <button onClick={() => setShowEdit(false)} className="absolute top-6 right-6 p-2 bg-white/5 rounded-full"><X className="w-4 h-4"/></button>
              <h2 className="text-xl font-black italic mb-8">Edit Profile</h2>

              <div className="flex flex-col items-center mb-8">
                 <div className="w-20 h-20 rounded-[25px] overflow-hidden border-2 border-white/10 mb-3 bg-black">
                    <img src={userData.photoURL} className="w-full h-full object-cover opacity-50" />
                 </div>
                 <button onClick={openAvatarPicker} className="text-red-500 text-[10px] font-black uppercase tracking-widest active:scale-95">Change Photo</button>
              </div>
              
              <div className="space-y-5">
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Username" className="w-full bg-black border border-white/5 p-4 rounded-2xl text-sm font-bold focus:border-red-600 outline-none transition" />
                <textarea value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="Bio" className="w-full bg-black border border-white/5 p-4 rounded-2xl text-sm font-medium focus:border-red-600 outline-none transition h-24 resize-none" />
              </div>

              <button onClick={saveProfile} className="w-full bg-red-600 py-4 rounded-2xl font-black text-sm mt-8 shadow-xl active:scale-95 transition uppercase tracking-widest">Save Changes</button>
           </div>
        </div>
      )}

      {/* 🎭 DICEBEAR AVATAR PICKER DRAWER */}
      {showAvatarPicker && (
        <div className="fixed inset-0 z-[200]">
           <div className="drawer-mask" onClick={() => setShowAvatarPicker(false)} />
           <div className="drawer-content p-8 animate-in slide-in-from-bottom duration-500">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black italic">Choose Avatar</h2>
                <button onClick={() => setShowAvatarPicker(false)} className="bg-white/5 p-2 rounded-full"><X className="w-5 h-5"/></button>
              </div>
              
              <div className="grid grid-cols-4 gap-4 mb-8">
                {randomSeeds.map(seed => (
                  <div key={seed} onClick={() => selectAvatar(seed)} className="aspect-square rounded-2xl bg-zinc-900 border border-white/5 p-1 active:scale-90 transition cursor-pointer overflow-hidden">
                    <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}`} className="w-full h-full object-cover" alt="avatar" />
                  </div>
                ))}
              </div>

              <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 bg-zinc-800 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                <ImageIcon className="w-4 h-4" /> Upload Custom Photo
              </button>
              <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleCustomUpload} />
           </div>
        </div>
      )}

      {/* 🔴 SETTINGS SUB-VIEW ENGINE */}
      <div className={`sub-view ${showSettings ? 'open' : ''}`}>
        <header className="p-6 border-b border-white/5 flex items-center gap-4 pt-safe bg-zinc-950 shadow-xl">
          <button 
            onClick={() => settingsView === 'main' ? setShowSettings(false) : setSettingsView('main')} 
            className="p-2 bg-zinc-900 rounded-full active:scale-90 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="font-black italic text-lg text-white uppercase tracking-tight">{settingsView}</h2>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar pb-32">
          {settingsView === 'main' && (
            <div className="space-y-8">
               <SettingsGroup label="Personal">
                  <SettingsItem icon={<User/>} label="Account Info" onClick={() => setSettingsView('account')} />
                  <SettingsItem icon={<TrendingUp className="text-red-500"/>} label="Promote Content" onClick={() => router.push('/ads')} />
               </SettingsGroup>
               <SettingsGroup label="Privacy & Legal">
                  <SettingsItem icon={<Lock/>} label="Privacy Policy" onClick={() => setSettingsView('privacy')} />
                  <SettingsItem icon={<FileText/>} label="Terms of Use" onClick={() => setSettingsView('terms')} />
               </SettingsGroup>
               <SettingsGroup label="System">
                  <SettingsItem icon={<Trash2/>} label="Clear Cache" sub={cacheSize} onClick={() => { localStorage.clear(); setCacheSize("0 KB"); showToast("Cache Purged!"); }} />
                  <button onClick={() => signOut(auth).then(() => router.push('/auth'))} className="w-full p-5 mt-6 bg-red-600/10 text-red-500 rounded-3xl font-black text-xs uppercase flex items-center justify-center gap-2 border border-red-600/20 active:scale-95 transition">
                    <LogOut className="w-4 h-4"/> Log Out
                  </button>
               </SettingsGroup>
            </div>
          )}

          {settingsView === 'account' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
               <div className="p-6 bg-zinc-900/50 rounded-[32px] border border-white/5">
                  <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1 ml-1">Registered Email</p>
                  <p className="font-bold text-white mb-6 flex items-center gap-2 truncate ml-1"><Mail className="w-4 h-4 text-zinc-500"/> {userData.email}</p>
                  <button onClick={() => { sendPasswordResetEmail(auth, userData.email || ""); showToast("Link sent to email!"); }} className="w-full p-4 bg-black border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest active:bg-zinc-800 transition">Send Reset Link</button>
               </div>
               <div className="p-4 bg-red-900/10 border border-red-900/20 rounded-2xl flex items-start gap-3">
                  <ShieldAlert className="text-red-500 w-5 h-5 shrink-0" />
                  <p className="text-[11px] text-zinc-400 font-medium leading-relaxed">Deleting your account is permanent and cannot be undone. You will lose all your syncs and status badge.</p>
               </div>
            </div>
          )}
          
          {settingsView === 'privacy' && <div className="p-6 bg-zinc-900 rounded-[32px] text-sm text-zinc-400 leading-relaxed">OtakuWall uses end-to-end encryption for private sync sessions. Your data is your property.</div>}
          {settingsView === 'terms' && <div className="p-6 bg-zinc-900 rounded-[32px] text-sm text-zinc-400 leading-relaxed">Community Guidelines: NSFW content is strictly prohibited. Violations lead to permanent account suspension.</div>}
        </div>
      </div>

      <Navbar />
    </main>
  );
}

// --- REUSABLE COMPONENTS ---
function StatItem({ label, value }: { label: string, value: number }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xl font-black tracking-tight">{value.toLocaleString()}</span>
      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">{label}</span>
    </div>
  );
}

function TabBtn({ active, onClick, icon }: any) {
  return (
    <button onClick={onClick} className={`flex-1 py-4 flex justify-center transition-all ${active ? 'text-red-500 border-b-2 border-red-500' : 'text-zinc-600 border-b-2 border-transparent'}`}>
      {icon}
    </button>
  );
}

function SettingsGroup({ label, children }: any) {
  return (
    <div>
      <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[2px] mb-4 px-2">{label}</h3>
      <div className="bg-zinc-900/50 rounded-[32px] border border-white/5 overflow-hidden">{children}</div>
    </div>
  );
}

function SettingsItem({ icon, label, sub, onClick }: any) {
  return (
    <div onClick={onClick} className="flex items-center justify-between p-5 border-b border-white/5 last:border-0 active:bg-white/5 transition cursor-pointer group">
      <div className="flex items-center gap-4">
        <div className="text-zinc-500 group-active:text-white transition-colors">{icon}</div>
        <div>
          <p className="text-sm font-bold text-white">{label}</p>
          {sub && <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">{sub}</p>}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-zinc-700" />
    </div>
  );
}