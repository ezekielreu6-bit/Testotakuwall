"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { signOut, sendPasswordResetEmail } from "firebase/auth";
import { 
  collection, query, where, doc, 
  updateDoc, onSnapshot, orderBy 
} from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { 
  Settings, Share2, Camera, Grid, Image as ImageIcon, 
  Heart, X, LogOut, ChevronRight, User, TrendingUp, 
  Lock, FileText, Trash2, ShieldCheck, Play, ArrowLeft,
  Mail, ShieldAlert, Info
} from "lucide-react";
import { Wallpaper } from "@/types";
import Navbar from "@/components/Navbar";
import VerifiedBadge from "@/components/VerifiedBadge";

type Tab = 'videos' | 'images' | 'likes';
type SettingsView = 'main' | 'account' | 'privacy' | 'terms';

export default function ProfilePage() {
  const { user, userData } = useAuth();
  const router = useRouter();

  // State
  const [activeTab, setActiveTab] = useState<Tab>('videos');
  const [uploads, setUploads] = useState<Wallpaper[]>([]);
  const [stats, setStats] = useState({ followers: 0, following: 0, likes: 0 });
  const [loading, setLoading] = useState(true);
  const [cacheSize, setCacheSize] = useState("0.4 MB");

  // Modals & Sub-views
  const [showSettings, setShowSettings] = useState(false);
  const [settingsView, setSettingsView] = useState<SettingsView>('main');
  const [showEdit, setShowEdit] = useState(false);
  
  // Form State
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;

    setEditName(userData?.username || "");
    setEditBio(userData?.bio || "");

    const unsubFollowers = onSnapshot(collection(db, `users/${user.uid}/followers`), (s) => setStats(prev => ({...prev, followers: s.size})));
    const unsubFollowing = onSnapshot(collection(db, `users/${user.uid}/following`), (s) => setStats(prev => ({...prev, following: s.size})));

    const q = query(collection(db, "wallpapers"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsubWalls = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Wallpaper));
      setUploads(items);
      const totalLikes = items.reduce((acc, curr) => acc + (curr.likes?.length || 0), 0);
      setStats(prev => ({...prev, likes: totalLikes}));
      setLoading(false);
    });

    return () => { unsubFollowers(); unsubFollowing(); unsubWalls(); };
  }, [user, userData]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    showToast("Updating avatar...");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: "POST", body: formData
      });
      const data = await res.json();
      await updateDoc(doc(db, "users", user.uid), { photoURL: data.secure_url });
      showToast("Avatar updated! 🔥");
    } catch (err) { showToast("Upload failed"); }
  };

  const saveProfile = async () => {
    if (!user || !editName.trim()) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        username: editName.toLowerCase().replace(/\s+/g, ''),
        bio: editBio
      });
      setShowEdit(false);
      showToast("Profile saved!");
    } catch (e) { showToast("Error saving profile"); }
  };

  const resetPassword = async () => {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      showToast("Reset link sent to email!");
    } catch (e) { showToast("Failed to send link"); }
  };

  const clearCache = () => {
    localStorage.clear();
    setCacheSize("0 KB");
    showToast("Cache cleared! 🧹");
  };

  if (!user || !userData) return <div className="h-screen bg-black" />;

  return (
    <main className="scroll-container no-scrollbar pb-32 relative bg-black">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-zinc-900 border border-white/10 px-6 py-3 rounded-full z-[200] shadow-2xl animate-in fade-in slide-in-from-top-5">
          <p className="text-xs font-black uppercase tracking-widest text-red-500">{toast}</p>
        </div>
      )}

      {/* 🟢 HEADER */}
      <header className="fixed top-0 left-0 right-0 h-[65px] bg-black/80 backdrop-blur-xl border-b border-white/5 z-50 px-6 flex items-center justify-between pt-safe">
        <h1 className="text-xl font-black italic tracking-tighter"><span className="text-red-600">OTAKU</span>WALL</h1>
        <button onClick={() => { setSettingsView('main'); setShowSettings(true); }} className="p-2 bg-white/5 rounded-full text-zinc-400 active:scale-90 transition"><Settings className="w-5 h-5"/></button>
      </header>

      {/* ⚪️ PROFILE HERO */}
      <div className="pt-24 px-6 flex flex-col items-center">
        <div className="relative">
          <div className="w-28 h-28 rounded-[40px] overflow-hidden border-2 border-zinc-800 bg-zinc-900 shadow-2xl">
            <img src={userData.photoURL} className="w-full h-full object-cover" alt="avatar" />
          </div>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-2 -right-2 bg-red-600 p-2.5 rounded-2xl border-4 border-black shadow-xl active:scale-90 transition"
          >
            <Camera className="w-4 h-4 text-white" />
          </button>
          <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleAvatarUpload} />
        </div>

        <div className="mt-5 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <h1 className="text-2xl font-black tracking-tight italic">@{userData.username}</h1>
            {userData.isPremium && <VerifiedBadge className="w-5 h-5" />}
          </div>
          <p className="text-sm text-zinc-500 font-medium mt-1.5 max-w-[280px] leading-relaxed">
            {userData.bio || 'Anime Enthusiast • Collector'}
          </p>
        </div>

        {/* Stats */}
        <div className="w-full max-w-sm mt-8 p-6 bg-zinc-900/30 border border-white/5 rounded-[32px] flex justify-between items-center backdrop-blur-sm shadow-xl">
           <StatItem label="Followers" value={stats.followers} />
           <div className="w-px h-8 bg-white/10" />
           <StatItem label="Following" value={stats.following} />
           <div className="w-px h-8 bg-white/10" />
           <StatItem label="Likes" value={stats.likes} />
        </div>

        <div className="flex gap-2 w-full max-w-md mt-8">
           <button onClick={() => setShowEdit(true)} className="flex-1 py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition shadow-lg">Edit Profile</button>
           <button 
            onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/user/${user.uid}`);
                showToast("Profile link copied!");
            }}
            className="px-5 bg-zinc-900 border border-white/10 rounded-2xl active:scale-95 transition"
           >
            <Share2 className="w-5 h-5"/>
           </button>
        </div>
      </div>

      {/* 🔵 TABS */}
      <div className="sticky top-[65px] bg-black z-30 flex border-b border-zinc-900 mt-8">
        <TabBtn active={activeTab === 'videos'} onClick={() => setActiveTab('videos')} icon={<Grid className="w-5 h-5" />} />
        <TabBtn active={activeTab === 'images'} onClick={() => setActiveTab('images')} icon={<ImageIcon className="w-5 h-5" />} />
        <TabBtn active={activeTab === 'likes'} onClick={() => setActiveTab('likes')} icon={<Heart className="w-5 h-5" />} />
      </div>

      {/* 🎥 MEDIA GRID */}
      <div className="grid grid-cols-3 gap-[2px]">
        {uploads.filter(u => activeTab === 'videos' ? u.fileType === 'video' : u.fileType === 'image').map(item => (
          <div key={item.id} onClick={() => router.push(`/watch/${item.id}`)} className="aspect-[3/4] bg-zinc-900 relative group overflow-hidden cursor-pointer">
            {item.fileType === 'video' ? (
              <video src={`${item.url}#t=0.1`} className="w-full h-full object-cover" muted playsInline />
            ) : (
              <img src={item.url} className="w-full h-full object-cover" alt="post" />
            )}
            <div className="absolute bottom-2 left-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition duration-300">
                 <Play className="w-3 h-3 fill-white" />
                 <span className="text-[10px] font-bold">{item.views || 0}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 🟡 EDIT PROFILE MODAL (HTML Style) */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/90 z-[110] flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in duration-300">
           <div className="w-full max-w-sm bg-zinc-900 rounded-[40px] p-8 border border-white/10 animate-in zoom-in-95 shadow-2xl">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black italic">Edit Profile</h2>
                <button onClick={() => setShowEdit(false)} className="p-2 bg-white/5 rounded-full"><X className="w-5 h-5"/></button>
              </div>

              <div className="flex flex-col items-center mb-8">
                 <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/10 mb-3 bg-black">
                    <img src={userData.photoURL} className="w-full h-full object-cover opacity-50" />
                 </div>
                 <button onClick={() => { setShowEdit(false); fileInputRef.current?.click(); }} className="text-red-500 text-[10px] font-black uppercase tracking-widest">Change Photo</button>
              </div>
              
              <div className="space-y-5">
                <div>
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-2 block ml-1">Username</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-black border border-white/5 p-4 rounded-2xl text-sm font-bold focus:border-red-600 outline-none transition" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-2 block ml-1">Bio</label>
                  <textarea value={editBio} onChange={e => setEditBio(e.target.value)} className="w-full bg-black border border-white/5 p-4 rounded-2xl text-sm font-medium focus:border-red-600 outline-none transition h-28 resize-none" />
                </div>
              </div>

              <button onClick={saveProfile} className="w-full bg-red-600 py-4 rounded-2xl font-black text-sm mt-8 shadow-xl active:scale-95 transition uppercase tracking-widest">Save Changes</button>
           </div>
        </div>
      )}

      {/* 🔴 SETTINGS SUB-VIEW ENGINE */}
      <div className={`sub-view fixed inset-0 bg-black z-[100] transition-transform duration-500 flex flex-col ${showSettings ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Settings Header */}
        <header className="p-6 border-b border-white/5 flex items-center gap-4 pt-safe bg-zinc-950 shadow-xl">
          <button 
            onClick={() => settingsView === 'main' ? setShowSettings(false) : setSettingsView('main')} 
            className="p-2 bg-zinc-900 rounded-full active:scale-90 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="font-black italic text-lg text-white">
            {settingsView === 'main' ? 'Settings' : settingsView === 'account' ? 'Account' : settingsView === 'privacy' ? 'Privacy' : 'Terms'}
          </h2>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar pb-32">
          
          {settingsView === 'main' && (
            <div className="space-y-8 animate-in slide-in-from-left-4 duration-300">
               <SettingsGroup label="Personal">
                  <SettingsItem icon={<User/>} label="Account Info" sub="Email, Password, ID" onClick={() => setSettingsView('account')} />
                  <SettingsItem icon={<TrendingUp className="text-red-500"/>} label="Promote Content" onClick={() => router.push('/ads')} />
               </SettingsGroup>

               <SettingsGroup label="Privacy & Legal">
                  <SettingsItem icon={<Lock/>} label="Privacy Policy" onClick={() => setSettingsView('privacy')} />
                  <SettingsItem icon={<FileText/>} label="Terms of Use" onClick={() => setSettingsView('terms')} />
               </SettingsGroup>

               <SettingsGroup label="System">
                  <SettingsItem icon={<Trash2/>} label="Clear Cache" sub={cacheSize} onClick={clearCache} />
                  <button onClick={() => signOut(auth)} className="w-full p-5 mt-6 bg-red-600/10 text-red-500 rounded-3xl font-black text-sm uppercase flex items-center justify-center gap-2 border border-red-600/20 active:scale-95 transition">
                    <LogOut className="w-4 h-4"/> Log Out
                  </button>
               </SettingsGroup>
            </div>
          )}

          {settingsView === 'account' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
               <div className="p-6 bg-zinc-900/50 rounded-[32px] border border-white/5">
                  <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Registered Email</p>
                  <p className="font-bold text-white mb-6 flex items-center gap-2"><Mail className="w-4 h-4 text-zinc-500"/> {userData.email}</p>
                  
                  <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Security</p>
                  <button onClick={resetPassword} className="w-full p-4 bg-black border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest active:bg-zinc-800 transition">Send Password Reset Link</button>
               </div>
               <div className="p-4 bg-red-900/10 border border-red-900/20 rounded-2xl flex items-start gap-3">
                  <ShieldAlert className="text-red-500 w-5 h-5 shrink-0" />
                  <p className="text-[11px] text-zinc-400 font-medium leading-relaxed">Deleting your account is permanent. All your syncs, likes, and followers will be removed from the OtakuWall database.</p>
               </div>
            </div>
          )}

          {settingsView === 'privacy' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 text-zinc-400 text-sm leading-relaxed">
               <div className="p-6 bg-zinc-900/50 rounded-[32px] border border-white/5">
                  <h3 className="text-white font-black italic mb-2">1. Data Encryption</h3>
                  <p>OtakuWall uses end-to-end encryption for your private direct syncs. Your uploaded wallpapers are hosted on secure distributed servers.</p>
                  <h3 className="text-white font-black italic mt-6 mb-2">2. Information Usage</h3>
                  <p>We collect minimal data: Email and Username. This is purely for identifying you in the community. We never sell your personal data to third parties.</p>
               </div>
            </div>
          )}

          {settingsView === 'terms' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 text-zinc-400 text-sm leading-relaxed">
               <div className="p-6 bg-zinc-900/50 rounded-[32px] border border-white/5">
                  <h3 className="text-white font-black italic mb-2">1. Content Ownership</h3>
                  <p>By uploading content, you guarantee you have the rights to share it. NSFW or harmful content will lead to immediate OtakuID ban.</p>
                  <h3 className="text-white font-black italic mt-6 mb-2">2. Premium Subscription</h3>
                  <p>The Red Tick is a status badge. It can be revoked if community guidelines are repeatedly violated without a refund.</p>
               </div>
            </div>
          )}

        </div>
      </div>

      <Navbar />
    </main>
  );
}

// --- SUB-COMPONENTS ---

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
      <div className="bg-zinc-900/50 rounded-[32px] border border-white/5 overflow-hidden shadow-2xl">{children}</div>
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