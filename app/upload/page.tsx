"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { 
  collection, query, where, orderBy, onSnapshot, 
  deleteDoc, doc, updateDoc, addDoc, serverTimestamp, getDocs, limit 
} from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { 
  ArrowLeft, Power, Video, Image as ImageIcon, Radio, 
  UploadCloud, BellRing, AlertTriangle, Trash2, ShieldBan,
  Users, Activity, CheckCircle2, Search, MoreHorizontal
} from "lucide-react";
import { Wallpaper, Report, UserData } from "@/types";

// 🔐 List of Authorized Admins
const ADMINS = ['ezekielojochenemi1@gmail.com', 'donnafonna5@gmail.com', 'njokupeter738@gmail.com'];

type AdminTab = 'videos' | 'static' | 'live' | 'users' | 'upload' | 'broadcast' | 'reports';

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // --- UI State ---
  const [activeTab, setActiveTab] = useState<AdminTab>('videos');
  const [stats, setStats] = useState({ videos: 0, live: 0, static: 0, reports: 0, users: 0 });
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [toast, setToast] = useState<{ msg: string; err: boolean } | null>(null);

  // --- Action States ---
  const [uploading, setUploading] = useState(false);
  const [liveTitle, setLiveTitle] = useState("");
  const [bcTitle, setBcTitle] = useState("");
  const [bcMsg, setBcMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Security Check
  useEffect(() => {
    if (!authLoading) {
      if (!user || !user.email || !ADMINS.includes(user.email)) {
        router.push('/');
      }
    }
  }, [user, authLoading, router]);

  // 2. Data Listeners
  useEffect(() => {
    if (!user || !ADMINS.includes(user.email || "")) return;

    // Fetch Stats
    const unsubStats = onSnapshot(collection(db, "wallpapers"), (snap) => {
      const docs = snap.docs.map(d => d.data());
      setStats({
        videos: docs.filter((d: any) => d.fileType === 'video' && !d.isLive).length,
        live: docs.filter((d: any) => d.isLive).length,
        static: docs.filter((d: any) => d.fileType === 'image').length,
        reports: reports.length,
        users: allUsers.length
      });
    });

    // Fetch All Users
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      setAllUsers(snap.docs.map(d => ({ ...d.data(), uid: d.id } as UserData)));
    });

    // Fetch Content based on Tab
    let wallQ = query(collection(db, "wallpapers"), orderBy("createdAt", "desc"));
    if (activeTab === 'videos') wallQ = query(wallQ, where("fileType", "==", "video"), where("isLive", "==", false));
    if (activeTab === 'static') wallQ = query(wallQ, where("fileType", "==", "image"));
    if (activeTab === 'live') wallQ = query(wallQ, where("isLive", "==", true));

    const unsubWalls = onSnapshot(wallQ, (snap) => {
      setWallpapers(snap.docs.map(d => ({ ...d.data(), id: d.id } as Wallpaper)));
    });

    // Fetch Reports
    const unsubRep = onSnapshot(query(collection(db, "reports"), orderBy("timestamp", "desc")), (snap) => {
      setReports(snap.docs.map(d => ({ ...d.data(), id: d.id } as Report)));
    });

    return () => { unsubStats(); unsubUsers(); unsubWalls(); unsubRep(); };
  }, [user, activeTab, reports.length, allUsers.length]);

  const showToast = (msg: string, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3000);
  };

  // --- ADMIN ACTIONS ---

  const handleDelete = async (col: string, id: string) => {
    if (!confirm("This action is permanent. Delete?")) return;
    try {
      await deleteDoc(doc(db, col, id));
      showToast("Data Purged Successfully");
    } catch (e) { showToast("Purge Failed", true); }
  };

  const toggleBan = async (targetUser: UserData) => {
    const action = targetUser.banned ? "Unban" : "Ban";
    if (!confirm(`${action} @${targetUser.username}?`)) return;
    try {
      await updateDoc(doc(db, "users", targetUser.uid), { banned: !targetUser.banned });
      showToast(`User ${action}ned`);
    } catch (e) { showToast("Access Denied", true); }
  };

  const handleLiveUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !liveTitle) return showToast("Title & Video Required", true);

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/video/upload`, {
        method: "POST", body: formData
      });
      const data = await res.json();

      await addDoc(collection(db, "wallpapers"), {
        title: liveTitle,
        url: data.secure_url,
        fileType: 'video',
        isLive: true,
        userId: user!.uid,
        username: "ADMIN",
        createdAt: serverTimestamp(),
        likes: [],
        views: 0
      });

      showToast("Live Wallpaper Verified & Published!");
      setLiveTitle("");
    } catch (e) { showToast("Upload Logic Error", true); }
    finally { setUploading(false); }
  };

  const sendBroadcast = async () => {
    if (!bcTitle || !bcMsg) return showToast("Broadcast is empty", true);
    try {
      await addDoc(collection(db, "platform_notifications"), {
        title: bcTitle,
        message: bcMsg,
        createdAt: serverTimestamp(),
        type: 'alert'
      });
      showToast("Global Alert Sent! 📢");
      setBcTitle(""); setBcMsg("");
    } catch (e) { showToast("Broadcast Failed", true); }
  };

  if (authLoading || !user) return <div className="h-screen bg-black" />;

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-20">
      
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 px-6 py-4 rounded-2xl z-[1000] shadow-2xl flex items-center gap-3 border-l-4 animate-in slide-in-from-bottom-4 ${toast.err ? 'bg-zinc-900 border-yellow-500 text-yellow-500' : 'bg-zinc-900 border-red-600 text-white'}`}>
          <Activity className="w-5 h-5"/>
          <span className="font-black text-xs uppercase tracking-widest">{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/')} className="p-2 bg-white/5 rounded-xl text-zinc-400 hover:text-white transition"><ArrowLeft/></button>
          <h1 className="font-black italic text-lg tracking-tighter">ADMIN COMMAND</h1>
        </div>
        <button onClick={() => auth.signOut()} className="p-2.5 bg-red-600/10 text-red-500 rounded-xl active:scale-90 transition"><Power className="w-5 h-5"/></button>
      </header>

      <main className="pt-24 px-6 max-w-7xl mx-auto">
        
        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
          <StatCard label="Videos" value={stats.videos} icon={<Video className="text-red-500"/>} />
          <StatCard label="Live Walls" value={stats.live} icon={<Radio className="text-purple-500"/>} />
          <StatCard label="Static" value={stats.static} icon={<ImageIcon className="text-green-500"/>} />
          <StatCard label="Users" value={stats.users} icon={<Users className="text-blue-500"/>} />
          <StatCard label="Reports" value={stats.reports} icon={<AlertTriangle className="text-yellow-500"/>} />
        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto gap-3 no-scrollbar mb-8 pb-2">
          <AdminTabBtn active={activeTab === 'videos'} label="Shorts Feed" onClick={() => setActiveTab('videos')} />
          <AdminTabBtn active={activeTab === 'static'} label="Static Walls" onClick={() => setActiveTab('static')} />
          <AdminTabBtn active={activeTab === 'live'} label="Live Walls" onClick={() => setActiveTab('live')} />
          <AdminTabBtn active={activeTab === 'users'} label="User Bans" onClick={() => setActiveTab('users')} />
          <AdminTabBtn active={activeTab === 'upload'} label="Upload Pro" onClick={() => setActiveTab('upload')} />
          <AdminTabBtn active={activeTab === 'broadcast'} label="Broadcast" onClick={() => setActiveTab('broadcast')} />
          <AdminTabBtn active={activeTab === 'reports'} label={`Reports (${reports.length})`} onClick={() => setActiveTab('reports')} />
        </div>

        {/* 🎥 CONTENT PANELS (Videos/Static/Live) */}
        {['videos', 'static', 'live'].includes(activeTab) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-500">
            {wallpapers.map(wall => (
              <div key={wall.id} className="bg-zinc-900/50 rounded-[32px] border border-white/5 overflow-hidden group">
                <div className="aspect-[9/16] relative bg-black">
                  {wall.fileType === 'video' ? (
                    <video src={`${wall.url}#t=0.5`} className="w-full h-full object-cover opacity-60" muted />
                  ) : (
                    <img src={wall.url} className="w-full h-full object-cover opacity-60" alt="wall" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleDelete('wallpapers', wall.id)} className="p-4 bg-red-600 rounded-full shadow-2xl active:scale-90 transition"><Trash2 className="w-6 h-6"/></button>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-xs font-black truncate mb-1 uppercase tracking-widest">{wall.title}</p>
                  <p className="text-[10px] text-zinc-500 font-bold">BY @{wall.username}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 👥 USER MANAGEMENT PANEL */}
        {activeTab === 'users' && (
          <div className="bg-zinc-900/30 rounded-[35px] border border-white/5 overflow-hidden">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
              <h3 className="font-black text-sm uppercase tracking-widest">Active Database Users</h3>
              <Search className="w-5 h-5 text-zinc-600" />
            </div>
            <div className="divide-y divide-white/5">
              {allUsers.map(u => (
                <div key={u.uid} className="p-5 flex items-center justify-between hover:bg-white/5 transition">
                  <div className="flex items-center gap-4">
                    <img src={u.photoURL} className="w-12 h-12 rounded-2xl object-cover border border-white/10" alt="u"/>
                    <div>
                      <p className="font-black text-sm">@{u.username}</p>
                      <p className="text-[10px] text-zinc-500 font-medium">{u.email}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => toggleBan(u)}
                    className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-tighter transition ${u.banned ? 'bg-green-600/10 text-green-500' : 'bg-red-600/10 text-red-500'}`}
                  >
                    {u.banned ? 'Unban User' : 'Ban User'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 🚀 ADMIN UPLOAD PANEL */}
        {activeTab === 'upload' && (
          <div className="max-w-xl mx-auto bg-zinc-900/50 p-10 rounded-[40px] border border-purple-900/20 shadow-2xl">
            <h2 className="text-2xl font-black italic mb-8 flex items-center gap-3"><Radio className="text-purple-500"/> Publish Live Sync</h2>
            <div className="space-y-6">
              <input value={liveTitle} onChange={e => setLiveTitle(e.target.value)} placeholder="Wallpaper Title" className="w-full bg-black border border-white/5 p-5 rounded-3xl outline-none focus:border-purple-500 transition" />
              <label className="block w-full p-16 border-2 border-dashed border-zinc-800 rounded-[40px] text-center cursor-pointer hover:border-purple-500 transition bg-black group">
                <input type="file" ref={fileInputRef} hidden accept="video/mp4" />
                <UploadCloud className="mx-auto mb-4 text-zinc-600 w-10 h-10 group-hover:text-purple-500 transition" />
                <p className="text-xs text-zinc-500 font-black uppercase tracking-widest">Target MP4 File</p>
              </label>
              <button 
                onClick={handleLiveUpload} 
                disabled={uploading}
                className="w-full bg-purple-600 py-5 rounded-3xl font-black shadow-xl active:scale-95 transition disabled:opacity-50"
              >
                {uploading ? 'Transcoding...' : 'Verify & Launch'}
              </button>
            </div>
          </div>
        )}

        {/* 📢 BROADCAST PANEL */}
        {activeTab === 'broadcast' && (
          <div className="max-w-xl mx-auto bg-zinc-900/50 p-10 rounded-[40px] border border-red-900/20 shadow-2xl">
            <h2 className="text-2xl font-black italic mb-8 flex items-center gap-3"><BellRing className="text-red-600"/> Platform Update</h2>
            <div className="space-y-4">
              <input value={bcTitle} onChange={e => setBcTitle(e.target.value)} placeholder="Subject line" className="w-full bg-black border border-white/5 p-5 rounded-3xl outline-none focus:border-red-600 transition" />
              <textarea value={bcMsg} onChange={e => setBcMsg(e.target.value)} placeholder="Message content..." className="w-full bg-black border border-white/5 p-5 rounded-3xl h-40 outline-none focus:border-red-600 transition resize-none" />
              <button onClick={sendBroadcast} className="w-full bg-red-600 py-5 rounded-3xl font-black shadow-xl active:scale-95 transition">SEND TO ALL INBOXES</button>
            </div>
          </div>
        )}

        {/* 🚩 REPORTS PANEL */}
        {activeTab === 'reports' && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 animate-in slide-in-from-bottom-5">
            {reports.map(r => (
              <div key={r.id} className="bg-zinc-900/80 rounded-[35px] p-6 border border-yellow-600/20 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-yellow-600/10 rounded-xl text-yellow-500"><AlertTriangle className="w-5 h-5"/></div>
                    <p className="text-sm font-black italic uppercase tracking-tighter">{r.reason}</p>
                  </div>
                  <p className="text-[10px] text-zinc-500 font-medium break-all mb-6 px-1">CONTENT_ID: {r.contentId}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { handleDelete('wallpapers', r.contentId); handleDelete('reports', r.id); }} className="flex-1 bg-red-600 py-4 rounded-2xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition">Purge Content</button>
                  <button onClick={() => handleDelete('reports', r.id)} className="flex-1 bg-zinc-800 py-4 rounded-2xl text-[10px] font-black uppercase active:scale-95 transition">Dismiss</button>
                </div>
              </div>
            ))}
            {reports.length === 0 && <div className="col-span-full text-center py-40 opacity-20"><Activity className="mx-auto w-16 h-16 mb-4"/><p className="font-black text-xs uppercase tracking-widest">Database is clean</p></div>}
          </div>
        )}

      </main>
    </div>
  );
}

// --- DASHBOARD SUB-COMPONENTS ---

function StatCard({ label, value, icon }: any) {
  return (
    <div className="bg-zinc-900/50 rounded-[30px] p-6 border border-white/5 shadow-xl">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2.5 bg-black/40 rounded-2xl border border-white/5">{icon}</div>
        <CheckCircle2 className="w-4 h-4 text-zinc-800" />
      </div>
      <p className="text-2xl font-black italic mb-0.5">{value.toLocaleString()}</p>
      <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">{label}</p>
    </div>
  );
}

function AdminTabBtn({ active, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${active ? 'bg-red-600 text-white shadow-xl shadow-red-900/30 -translate-y-1' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300 border border-white/5'}`}
    >
      {label}
    </button>
  );
}