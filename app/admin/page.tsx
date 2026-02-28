// app/admin/page.tsx
"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { 
  collection, query, where, orderBy, onSnapshot, 
  deleteDoc, doc, updateDoc, setDoc, addDoc, serverTimestamp, getDocs, getCountFromServer, limit 
} from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { 
  ArrowLeft, Power, Video, Image as ImageIcon, Radio, 
  UploadCloud, BellRing, AlertTriangle, Trash2, ShieldBan 
} from "lucide-react";
import { Wallpaper, Report } from "@/types";

const ADMINS =['ezekielojochenemi1@gmail.com', 'donnafonna5@gmail.com', 'njokupeter738@gmail.com'];
type Tab = 'videos' | 'static' | 'live' | 'upload' | 'broadcast' | 'reports';

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>('videos');
  const [stats, setStats] = useState({ videos: 0, live: 0, static: 0, reports: 0 });
  const [items, setItems] = useState<Wallpaper[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const[bannedUsers, setBannedUsers] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ msg: string; err: boolean } | null>(null);

  // Upload Live Wall State
  const [liveTitle, setLiveTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const liveFileRef = useRef<HTMLInputElement>(null);

  // Broadcast State
  const[bcTitle, setBcTitle] = useState("");
  const [bcMsg, setBcMsg] = useState("");

  // 1. Security Check
  useEffect(() => {
    if (!authLoading) {
      if (!user || !user.email || !ADMINS.includes(user.email)) {
        router.push('/');
      }
    }
  }, [user, authLoading, router]);

  // 2. Fetch Stats Efficiently (Without downloading documents)
  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      try {
        const vidQ = query(collection(db, "wallpapers"), where("fileType", "==", "video"), where("isLive", "==", false));
        const liveQ = query(collection(db, "wallpapers"), where("isLive", "==", true));
        const imgQ = query(collection(db, "wallpapers"), where("fileType", "==", "image"));
        const repQ = collection(db, "reports");

        const[vidSnap, liveSnap, imgSnap, repSnap] = await Promise.all([
          getCountFromServer(vidQ), getCountFromServer(liveQ), 
          getCountFromServer(imgQ), getCountFromServer(repQ)
        ]);

        setStats({
          videos: vidSnap.data().count,
          live: liveSnap.data().count,
          static: imgSnap.data().count,
          reports: repSnap.data().count
        });
      } catch (e) { console.error("Stats error", e); }
    };

    fetchStats();
    const statInterval = setInterval(fetchStats, 30000); // Refresh stats every 30s
    return () => clearInterval(statInterval);
  }, [user]);

  // 3. Fetch Banned Users Map
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users"), where("banned", "==", true));
    const unsub = onSnapshot(q, (snap) => {
      const bans = new Set<string>();
      snap.forEach(d => bans.add(d.id));
      setBannedUsers(bans);
    });
    return () => unsub();
  }, [user]);

  // 4. Fetch Tab Content (Limited to 50 to prevent crash)
  useEffect(() => {
    if (!user) return;

    if (activeTab === 'reports') {
      const q = query(collection(db, "reports"), orderBy("timestamp", "desc"), limit(50));
      const unsub = onSnapshot(q, (snap) => setReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as Report))));
      return () => unsub();
    } 
    
    if (['videos', 'static', 'live'].includes(activeTab)) {
      let q = query(collection(db, "wallpapers"), orderBy("createdAt", "desc"), limit(50));
      if (activeTab === 'videos') q = query(q, where("fileType", "==", "video"), where("isLive", "==", false));
      if (activeTab === 'static') q = query(q, where("fileType", "==", "image"));
      if (activeTab === 'live') q = query(q, where("isLive", "==", true));

      const unsub = onSnapshot(q, (snap) => setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as Wallpaper))));
      return () => unsub();
    }
  }, [activeTab, user]);

  const showToast = (msg: string, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogout = () => { auth.signOut().then(() => router.push('/auth')); };

  // === Admin Actions ===
  const toggleBan = async (uid: string) => {
    const isBanned = bannedUsers.has(uid);
    if (!confirm(`${isBanned ? 'Unban' : 'Ban'} this user?`)) return;
    try {
      await updateDoc(doc(db, "users", uid), { banned: !isBanned });
      showToast(`User ${isBanned ? 'Unbanned' : 'Banned'}`, false);
    } catch (e) { showToast("Failed to update ban status", true); }
  };

  const deleteItem = async (col: string, id: string) => {
    if (!confirm("Permanently delete?")) return;
    try {
      await deleteDoc(doc(db, col, id));
      showToast("Deleted successfully");
    } catch (e) { showToast("Failed to delete", true); }
  };

  const handleLiveUpload = async () => {
    const file = liveFileRef.current?.files?.[0];
    if (!file || !liveTitle.trim()) return showToast("Missing fields", true);

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/video/upload`, {
        method: 'POST', body: formData
      });
      const data = await res.json();
      
      await addDoc(collection(db, "wallpapers"), {
        title: liveTitle, url: data.secure_url, fileType: 'video', isLive: true,
        userId: user!.uid, username: "ADMIN",
        createdAt: serverTimestamp(), likes:[], views: 0
      });
      
      showToast("Live Wallpaper Published!");
      setLiveTitle("");
      if (liveFileRef.current) liveFileRef.current.value = "";
    } catch (e) {
      showToast("Upload failed", true);
    } finally {
      setUploading(false);
    }
  };

  const handleBroadcast = async () => {
    if (!bcTitle.trim() || !bcMsg.trim()) return showToast("Fill all fields", true);
    try {
      await addDoc(collection(db, "platform_notifications"), {
        title: bcTitle, message: bcMsg, sender: "Admin", createdAt: serverTimestamp()
      });
      showToast("Broadcast Sent 📢");
      setBcTitle(""); setBcMsg("");
    } catch (e) { showToast("Broadcast failed", true); }
  };

  if (authLoading || !user || !ADMINS.includes(user.email || '')) return <div className="h-screen bg-black" />;

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-10">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl z-[1000] font-bold text-sm border-l-4 animate-in slide-in-from-bottom-5 ${toast.err ? 'bg-zinc-900 border-yellow-500 text-yellow-500' : 'bg-zinc-900 border-green-500 text-green-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="fixed top-0 w-full bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5 z-50">
        <div className="max-w-6xl mx-auto px-5 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/')} className="p-2 bg-white/5 rounded-xl text-zinc-400 hover:text-white transition"><ArrowLeft className="w-5 h-5" /></button>
            <h1 className="text-lg font-extrabold tracking-tight">ADMIN COMMAND</h1>
          </div>
          <button onClick={handleLogout} className="p-2 text-zinc-500 hover:text-red-500 transition"><Power className="w-5 h-5" /></button>
        </div>
      </header>

      <main className="scroll-container no-scrollbar pb-32">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard title="Total Feed" count={stats.videos} color="border-l-red-500" />
          <StatCard title="Live Walls" count={stats.live} color="border-l-purple-500 text-purple-400" />
          <StatCard title="Static Walls" count={stats.static} color="border-l-green-500 text-green-400" />
          <StatCard title="Reports" count={stats.reports} color="border-l-yellow-500 text-yellow-500" />
        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto gap-3 no-scrollbar mb-8 pb-2">
          <TabBtn active={activeTab === 'videos'} onClick={() => setActiveTab('videos')} icon={<Video className="w-4 h-4" />} label="Video Feed" />
          <TabBtn active={activeTab === 'static'} onClick={() => setActiveTab('static')} icon={<ImageIcon className="w-4 h-4" />} label="Static Walls" />
          <TabBtn active={activeTab === 'live'} onClick={() => setActiveTab('live')} icon={<Radio className="w-4 h-4" />} label="Live Walls" />
          <TabBtn active={activeTab === 'upload'} onClick={() => setActiveTab('upload')} icon={<UploadCloud className="w-4 h-4" />} label="Upload Live" />
          <TabBtn active={activeTab === 'broadcast'} onClick={() => setActiveTab('broadcast')} icon={<BellRing className="w-4 h-4" />} label="Broadcast" />
          <TabBtn active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={<AlertTriangle className="w-4 h-4" />} label="Reports" />
        </div>

        {/* Panel Content */}
        {['videos', 'static', 'live'].includes(activeTab) && (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(item => {
              const isBanned = bannedUsers.has(item.userId);
              return (
                <div key={item.id} className="bg-zinc-900/50 rounded-3xl border border-white/5 overflow-hidden">
                  {item.fileType === 'video' ? (
                    <video src={`${item.url}#t=1`} className="w-full h-44 object-cover" />
                  ) : (
                    <img src={item.url} className="w-full h-44 object-cover" />
                  )}
                  <div className="p-4">
                    <p className="text-xs font-bold truncate">{item.title}</p>
                    <p className="text-[10px] text-zinc-500 mb-4">@{item.username}</p>
                    <div className="flex gap-2">
                      <button onClick={() => deleteItem('wallpapers', item.id)} className="flex-1 py-2 bg-red-600/10 text-red-500 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1 hover:bg-red-600/20 transition"><Trash2 className="w-3 h-3"/> Delete</button>
                      {!item.isLive && (
                        <button onClick={() => toggleBan(item.userId)} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1 transition ${isBanned ? 'bg-green-600/20 text-green-500 hover:bg-green-600/30' : 'bg-orange-600/10 text-orange-500 hover:bg-orange-600/20'}`}>
                          <ShieldBan className="w-3 h-3"/> {isBanned ? 'Unban' : 'Ban'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="bg-zinc-900/50 rounded-3xl p-6 border border-purple-900/30 max-w-xl mx-auto">
            <h2 className="text-xl font-black mb-6 flex items-center gap-2"><Radio className="text-purple-500"/> Publish Live Wallpaper</h2>
            <div className="space-y-5">
              <input type="text" value={liveTitle} onChange={e => setLiveTitle(e.target.value)} className="w-full bg-black border border-white/5 p-4 rounded-2xl text-sm outline-none focus:border-purple-500 transition" placeholder="Wallpaper Title" />
              <label className="block w-full p-10 border-2 border-dashed border-zinc-800 rounded-3xl text-center cursor-pointer hover:border-purple-500 transition bg-black">
                <input type="file" ref={liveFileRef} className="hidden" accept="video/mp4" />
                <UploadCloud className="mx-auto mb-3 text-zinc-600 w-8 h-8" />
                <p className="text-xs text-zinc-500 font-bold uppercase">Select MP4 Video</p>
              </label>
              <button onClick={handleLiveUpload} disabled={uploading} className="w-full bg-purple-600 py-4 rounded-2xl font-black shadow-lg shadow-purple-900/20 active:scale-95 transition disabled:opacity-50">
                {uploading ? 'Uploading...' : 'Upload to Gallery'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'broadcast' && (
          <div className="bg-zinc-900/50 rounded-3xl p-6 border border-red-900/30 max-w-xl mx-auto">
            <h2 className="text-xl font-black mb-6 flex items-center gap-2"><BellRing className="text-red-500"/> Send Global Alert</h2>
            <div className="space-y-4">
              <input type="text" value={bcTitle} onChange={e => setBcTitle(e.target.value)} className="w-full bg-black border border-white/5 p-4 rounded-2xl text-sm outline-none focus:border-red-500 transition" placeholder="Title" />
              <textarea value={bcMsg} onChange={e => setBcMsg(e.target.value)} className="w-full bg-black border border-white/5 p-4 rounded-2xl text-sm h-32 outline-none focus:border-red-500 transition resize-none" placeholder="Message content..." />
              <button onClick={handleBroadcast} className="w-full bg-red-600 py-4 rounded-2xl font-black shadow-lg shadow-red-900/20 active:scale-95 transition">BROADCAST NOW</button>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="grid gap-4 md:grid-cols-2">
            {reports.map(r => (
              <div key={r.id} className="bg-zinc-900/50 rounded-3xl p-5 border border-red-600/20 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2"><AlertTriangle className="text-red-500 w-4 h-4"/><p className="text-sm font-bold">Reason: {r.reason}</p></div>
                  <p className="text-[10px] text-zinc-500 mb-4 break-all">Item ID: {r.contentId}</p>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => { deleteItem('wallpapers', r.contentId); deleteItem('reports', r.id); }} className="flex-1 bg-red-600 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-red-700 transition">Delete Item</button>
                  <button onClick={() => deleteItem('reports', r.id)} className="flex-1 bg-zinc-800 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-zinc-700 transition">Dismiss</button>
                </div>
              </div>
            ))}
            {reports.length === 0 && <div className="col-span-2 text-center py-20 text-zinc-600 font-bold text-xs uppercase">No Pending Reports</div>}
          </div>
        )}
      </main>
    </div>
  );
}

// Subcomponents for cleaner code
function StatCard({ title, count, color }: { title: string, count: number, color: string }) {
  return (
    <div className={`bg-zinc-900/80 rounded-3xl p-5 border-l-4 ${color} shadow-lg`}>
      <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">{title}</p>
      <p className="text-2xl font-black">{count.toLocaleString()}</p>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button 
      onClick={onClick} 
      className={`flex items-center gap-2 whitespace-nowrap px-5 py-3 rounded-2xl font-bold text-xs transition-all ${active ? 'bg-red-600 text-white shadow-lg shadow-red-600/20 transform -translate-y-1' : 'bg-zinc-900 text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
    >
      {icon} {label}
    </button>
  );
}