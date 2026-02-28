"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { 
  Lock, ArrowLeft, MoreVertical, Heart, Download, 
  Link as LinkIcon, Flag, X, BadgeCheck, Home, Grid as GridIcon, Plus, MessageSquare, User 
} from "lucide-react";
import { Wallpaper } from "@/types";

type Tab = 'static' | 'live';

export default function CategoryGallery() {
  const { user, userData } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>('static');
  const[wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & Interaction State
  const [selectedWallpaper, setSelectedWallpaper] = useState<Wallpaper | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const[showDrawer, setShowDrawer] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const[toast, setToast] = useState<{ msg: string; err: boolean } | null>(null);

  // Long press logic variables
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const[wasLongPressed, setWasLongPressed] = useState(false);

  useEffect(() => {
    // If user clicks "live" but isn't premium, don't fetch anything. Show gate.
    if (activeTab === 'live' && !userData?.isPremium) {
      setLoading(false);
      setWallpapers([]);
      return;
    }

    setLoading(true);
    let q = query(collection(db, "wallpapers"), orderBy("createdAt", "desc"));

    if (activeTab === 'static') {
      q = query(q, where("fileType", "==", "image"));
    } else {
      // STRICT FILTER: Only wallpapers explicitly uploaded by Admin with 'isLive' flag
      q = query(q, where("isLive", "==", true));
    }

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Wallpaper));
      setWallpapers(items);
      setLoading(false);
    });

    return () => unsub();
  }, [activeTab, userData?.isPremium]);

  const triggerToast = (msg: string, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3000);
  };

  // Touch Interactions
  const handleTouchStart = (w: Wallpaper) => {
    setWasLongPressed(false);
    pressTimer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50);
      setWasLongPressed(true);
      setSelectedWallpaper(w);
      setShowDrawer(true);
    }, 600);
  };

  const handleTouchEnd = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const handleClick = (w: Wallpaper) => {
    if (wasLongPressed) {
      setWasLongPressed(false);
      return;
    }
    setSelectedWallpaper(w);
    setShowPopup(true);
  };

  const handleDownload = async () => {
    if (!selectedWallpaper) return;
    triggerToast("Downloading 4K...");
    try {
      const res = await fetch(selectedWallpaper.url);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `OtakuWall_4K_${selectedWallpaper.id}.${selectedWallpaper.fileType === 'video' ? 'mp4' : 'jpg'}`;
      a.click();
      triggerToast("Saved to Device! 🔥");
    } catch (e) {
      triggerToast("Download failed", true);
    }
  };

  const submitReport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !selectedWallpaper) return triggerToast("Login to report", true);
    const formData = new FormData(e.currentTarget);
    const reason = formData.get("reason");

    try {
      await addDoc(collection(db, "reports"), {
        contentId: selectedWallpaper.id,
        reason,
        reporter: user.uid,
        timestamp: serverTimestamp(),
        status: 'pending'
      });
      triggerToast("Report Sent ✅");
      setShowReport(false);
      setShowDrawer(false);
    } catch (e) {
      triggerToast("Failed to report", true);
    }
  };

  return (
    <main className="scroll-container no-scrollbar pb-32">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 right-0 p-4 rounded-l-lg shadow-2xl z-[200] font-bold text-sm border-l-4 transition-transform ${toast.err ? 'bg-zinc-900 border-yellow-500 text-yellow-500' : 'bg-zinc-900 border-red-500 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="fixed top-0 w-full h-[60px] bg-black/95 backdrop-blur-md border-b border-zinc-900 flex items-center px-5 z-40">
        <h1 className="text-xl font-black tracking-tighter"><span className="text-red-600">OTAKU</span>WALL</h1>
      </header>

      <div className="pt-20 px-6 pb-4">
        <h2 className="text-3xl font-black italic">Gallery</h2>
        <div className="flex gap-2 mt-4 border-b border-white/5">
          <button 
            onClick={() => setActiveTab('static')} 
            className={`font-extrabold text-xs uppercase tracking-widest px-5 py-3 border-b-2 transition ${activeTab === 'static' ? 'border-red-500 text-white' : 'border-transparent text-zinc-600'}`}
          >
            Static
          </button>
          <button 
            onClick={() => setActiveTab('live')} 
            className={`font-extrabold text-xs uppercase tracking-widest px-5 py-3 border-b-2 transition ${activeTab === 'live' ? 'border-red-500 text-white' : 'border-transparent text-zinc-600'}`}
          >
            Live Walls
          </button>
        </div>
      </div>

      {/* Grid or Premium Gate */}
      {activeTab === 'live' && !userData?.isPremium ? (
        <div className="flex flex-col items-center justify-center py-20 px-10 text-center animate-in fade-in duration-500">
          <div className="w-16 h-16 bg-red-600/10 rounded-2xl flex items-center justify-center mb-6 border border-red-600/20 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
            <Lock className="text-red-500 w-8 h-8" />
          </div>
          <h3 className="text-xl font-black mb-2 text-white">Verified Exclusive</h3>
          <p className="text-zinc-500 text-sm mb-8">Live Wallpapers are isolated and only available to verified Otakus.</p>
          <button onClick={() => router.push('/premium')} className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition">
            Get Verified Badge
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 px-3 md:px-5">
          {loading ? (
            // Skeleton Loaders
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[9/16] bg-zinc-900 rounded-2xl animate-pulse" />
            ))
          ) : wallpapers.length === 0 ? (
            <div className="col-span-2 md:col-span-4 text-center py-20 text-zinc-600 font-bold text-xs uppercase tracking-widest">
              No Wallpapers Found
            </div>
          ) : (
            wallpapers.map((w) => (
              <div 
                key={w.id}
                onTouchStart={() => handleTouchStart(w)}
                onTouchEnd={handleTouchEnd}
                onMouseDown={() => handleTouchStart(w)}
                onMouseUp={handleTouchEnd}
                onClick={() => handleClick(w)}
                className="relative overflow-hidden rounded-2xl aspect-[9/16] bg-zinc-950 cursor-pointer group border border-white/5 hover:border-white/20 transition"
              >
                {w.fileType === 'video' ? (
                  <video src={`${w.url}#t=0.1`} className="w-full h-full object-cover pointer-events-none" muted playsInline autoPlay loop />
                ) : (
                  <img src={w.url} className="w-full h-full object-cover pointer-events-none" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent flex items-end p-3 opacity-90 group-hover:opacity-100 transition">
                  <p className="text-white font-bold text-[10px] truncate uppercase flex items-center gap-1 shadow-black drop-shadow-md">
                    @{w.username || 'admin'}
                    <BadgeCheck className="w-3 h-3 text-red-500" />
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Wallpaper Preview Popup */}
      {showPopup && selectedWallpaper && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col animate-in slide-in-from-bottom-4 duration-300">
          <header className="p-4 flex justify-between items-center border-b border-white/5">
            <button onClick={() => setShowPopup(false)}><ArrowLeft className="w-6 h-6" /></button>
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Preview</h3>
            <button onClick={() => { setShowPopup(false); setShowDrawer(true); }}><MoreVertical className="w-6 h-6" /></button>
          </header>
          
          <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
            {selectedWallpaper.fileType === 'video' ? (
              <video src={selectedWallpaper.url} loop muted playsInline autoPlay className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
            ) : (
              <img src={selectedWallpaper.url} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
            )}
          </div>

          <div className="p-8 bg-zinc-950 border-t border-white/5 rounded-t-[40px]">
            <div className="flex justify-between items-center mb-8">
              <div>
                <div className="flex items-center gap-1">
                  <p className="font-black text-xl text-white">@{selectedWallpaper.username}</p>
                  <BadgeCheck className="w-5 h-5 text-red-500" />
                </div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1">Admin Approved</p>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Heart className={`w-8 h-8 ${selectedWallpaper.likes?.includes(user?.uid || '') ? 'fill-red-500 text-red-500' : 'text-white'}`} />
                <span className="text-[10px] font-black text-zinc-500">{selectedWallpaper.likes?.length || 0}</span>
              </div>
            </div>
            
            <div className="flex flex-col gap-3">
              <button onClick={handleDownload} className="w-full bg-red-600 py-4 rounded-2xl font-black tracking-widest uppercase shadow-xl shadow-red-900/30 active:scale-95 transition-all text-white flex items-center justify-center gap-2">
                <Download className="w-5 h-5" /> Download 4K
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share / Options Drawer */}
      {showDrawer && selectedWallpaper && (
        <div className="fixed inset-0 bg-black/80 z-[150] flex flex-col justify-end animate-in fade-in duration-300">
          <div className="absolute inset-0" onClick={() => setShowDrawer(false)} />
          <div className="bg-zinc-900 w-full rounded-t-3xl relative z-10">
            <div className="p-6 border-b border-white/5 text-center">
              <h3 className="font-black text-zinc-400 text-xs uppercase">Options</h3>
            </div>
            <div className="p-8 grid grid-cols-3 gap-4 text-center">
              <button 
                onClick={() => { 
                  navigator.clipboard.writeText(`${window.location.origin}/watch/${selectedWallpaper.id}`); 
                  triggerToast("Link Copied!"); 
                  setShowDrawer(false); 
                }} 
                className="flex flex-col items-center gap-3"
              >
                <div className="w-16 h-16 bg-black border border-white/10 rounded-2xl flex items-center justify-center"><LinkIcon className="text-blue-400" /></div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Link</span>
              </button>
              
              <button onClick={() => { handleDownload(); setShowDrawer(false); }} className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-black border border-white/10 rounded-2xl flex items-center justify-center"><Download className="text-green-400" /></div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Save</span>
              </button>
              
              <button onClick={() => { setShowDrawer(false); setShowReport(true); }} className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-black border border-white/10 rounded-2xl flex items-center justify-center"><Flag className="text-red-400" /></div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Report</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Drawer */}
      {showReport && (
        <div className="fixed inset-0 bg-black/80 z-[150] flex flex-col justify-end animate-in fade-in duration-300">
          <div className="absolute inset-0" onClick={() => setShowReport(false)} />
          <div className="bg-zinc-900 w-full rounded-t-3xl relative z-10">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black rounded-t-3xl">
              <h3 className="font-bold text-red-500 text-sm uppercase">Report Problem</h3>
              <button onClick={() => setShowReport(false)}><X /></button>
            </div>
            <div className="p-6 pb-10">
              <p className="text-xs text-zinc-500 mb-5 text-center font-bold uppercase">Why are you reporting this sync?</p>
              <form onSubmit={submitReport} className="flex flex-col gap-3">
                {['Inappropriate Content', 'Spam or Misleading', 'Copyright Infringement', 'Other'].map(reason => (
                  <label key={reason} className="flex items-center gap-3 p-4 border border-zinc-800 rounded-xl bg-black cursor-pointer has-[:checked]:border-red-500 has-[:checked]:bg-zinc-950 transition">
                    <input type="radio" name="reason" value={reason} className="hidden" required />
                    <span className="w-4 h-4 rounded-full border-2 border-zinc-600 flex items-center justify-center shrink-0" />
                    <span className="text-sm font-semibold">{reason}</span>
                  </label>
                ))}
                <button type="submit" className="w-full bg-red-600 py-4 rounded-2xl font-black text-white mt-4 uppercase tracking-widest text-xs active:scale-95 transition">Submit Report</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-lg border-t border-white/10 z-30 px-6 py-3 flex justify-between items-center pb-safe">
        <button onClick={() => router.push('/')} className="text-zinc-500"><Home /></button>
        <button onClick={() => router.push('/category')} className="text-red-600"><GridIcon /></button>
        <button onClick={() => router.push('/upload')} className="bg-gradient-to-r from-red-500 to-pink-600 text-white p-3 rounded-xl -mt-10 shadow-lg shadow-red-500/50">
          <Plus />
        </button>
        <button onClick={() => router.push('/inbox')} className="text-zinc-500"><MessageSquare /></button>
        <button onClick={() => router.push('/profile')} className="text-zinc-500"><User /></button>
      </nav>

    </main>
  );
}