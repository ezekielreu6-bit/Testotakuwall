"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { 
  collection, query, where, onSnapshot, orderBy, 
  doc, getDoc, getDocs, limit, setDoc, serverTimestamp 
} from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { 
  Plus, Bell, Heart, UserPlus, ArrowLeft, 
  X, Search, Pin, Flame, ChevronRight
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { Chat, UserData, Wallpaper } from "@/types";

type SubView = 'none' | 'system' | 'activity' | 'followers' | 'group';

export default function InboxPage() {
  const { user, userData } = useAuth();
  const router = useRouter();

  // State
  const [activeView, setActiveView] = useState<SubView>('none');
  const [chats, setChats] = useState<Chat[]>([]);
  const [stories, setStories] = useState<{user: UserData, story: Wallpaper}[]>([]);
  const [suggested, setSuggested] = useState<UserData[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [viewedAnnoIds, setViewedAnnoIds] = useState<string[]>([]);
  const [selectedAnno, setSelectedAnno] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState("");

  // 1. Core Listeners
  useEffect(() => {
    if (!user) return;

    // Load read announcements from local storage
    const saved = localStorage.getItem(`read_anno_${user.uid}`);
    if (saved) setViewedAnnoIds(JSON.parse(saved));

    // Chats Listener
    const q = query(collection(db, "chats"), where("participants", "array-contains", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map(d => ({ ...d.data(), id: d.id } as Chat));
      setChats(fetched.sort((a, b) => (b.lastActivity?.toMillis() || 0) - (a.lastActivity?.toMillis() || 0)));
      setLoading(false);
    });

    // Discovery: People you might know (FIXED ID MAPPING)
    getDocs(query(collection(db, "users"), limit(15))).then(snap => {
      setSuggested(snap.docs.map(d => ({ ...d.data(), uid: d.id } as UserData)).filter(u => u.uid !== user.uid));
    });

    // System Announcements
    const unsubAnno = onSnapshot(collection(db, "platform_notifications"), (snap) => {
      setAnnouncements(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    });

    return () => { unsub(); unsubAnno(); };
  }, [user]);

  // 2. Read State Logic
  const handleAnnoClick = (anno: any) => {
    setSelectedAnno(anno);
    if (!viewedAnnoIds.includes(anno.id)) {
      const updated = [...viewedAnnoIds, anno.id];
      setViewedAnnoIds(updated);
      localStorage.setItem(`read_anno_${user?.uid}`, JSON.stringify(updated));
    }
  };

  const unreadAnnoCount = announcements.filter(a => !viewedAnnoIds.includes(a.id)).length;

  if (!user) return null;

  return (
    <main className="h-screen w-screen bg-black flex flex-col overflow-hidden relative">
      <header className="px-6 py-5 flex justify-between items-center bg-black/90 backdrop-blur-xl border-b border-white/5 z-50">
        <h1 className="text-2xl font-black italic tracking-tighter">Inbox</h1>
        <Search className="w-6 h-6 text-zinc-400" />
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
        {/* Stories Row */}
        <div className="flex gap-5 overflow-x-auto px-6 py-6 no-scrollbar bg-zinc-900/10 border-b border-white/5">
          <div className="flex flex-col items-center gap-2 shrink-0" onClick={() => router.push(`/profile`)}>
             <div className="relative">
                <img src={userData?.photoURL} className="w-16 h-16 rounded-full object-cover border-2 border-zinc-800" />
                <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-1 border-2 border-black"><Plus className="w-3 h-3 text-white" /></div>
             </div>
             <span className="text-[10px] font-black text-zinc-500 uppercase">You</span>
          </div>
          {/* Map friends stories here... */}
        </div>

        {/* Hub Rows */}
        <div className="px-4 py-2">
          <HubRow 
            icon={<Bell className="text-blue-400" />} 
            title="System Alerts" 
            sub="Platform updates" 
            badge={unreadAnnoCount} 
            onClick={() => setActiveView('system')} 
          />
          <HubRow icon={<Heart className="text-pink-500" />} title="Activity" sub="Discovery" onClick={() => setActiveView('activity')} />
          <HubRow icon={<UserPlus className="text-green-500" />} title="Followers" sub="People following you" onClick={() => setActiveView('followers')} />
        </div>

        {/* Chat List */}
        <div className="mt-4 px-2">
          <h3 className="px-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-2">Direct Syncs</h3>
          {chats.map((chat) => (
            <div key={chat.id} onClick={() => router.push(`/inbox/${chat.id}`)} className="flex items-center gap-4 px-4 py-4 active:bg-zinc-900 rounded-[24px]">
               <img src={chat.chatAvatar} className="w-14 h-14 rounded-[20px] object-cover bg-zinc-900" />
               <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-[15px] truncate">{chat.chatName}</h4>
                  <p className="text-xs text-zinc-500 truncate">{chat.lastMsg || 'New session started'}</p>
               </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- SUBVIEWS --- */}

      {/* Announcements Panel */}
      <SubViewPanel title="System Alerts" isOpen={activeView === 'system'} onClose={() => setActiveView('none')}>
        {announcements.map(a => {
          const isRead = viewedAnnoIds.includes(a.id);
          return (
            <div 
              key={a.id} 
              onClick={() => handleAnnoClick(a)}
              className="p-5 bg-zinc-900/50 rounded-3xl border border-white/5 mb-3 flex items-center justify-between active:scale-[0.98] transition relative overflow-hidden"
            >
              {!isRead && <div className="absolute top-0 left-0 w-1 h-full bg-red-600" />}
              <div className="min-w-0 flex-1">
                <h4 className={`font-black text-sm mb-1 ${isRead ? 'text-zinc-500' : 'text-white'}`}>{a.title}</h4>
                <p className="text-xs text-zinc-400 truncate">{a.message}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-700 ml-4 shrink-0" />
            </div>
          );
        })}
      </SubViewPanel>

      {/* Announcement Context Modal */}
      {selectedAnno && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md px-6">
          <div className="w-full max-w-sm bg-zinc-900 rounded-[40px] p-8 border border-white/10 animate-in zoom-in-95 duration-200">
             <div className="w-12 h-12 bg-red-600/20 rounded-2xl flex items-center justify-center mb-6 text-red-500">
                <Bell className="w-6 h-6" />
             </div>
             <h2 className="text-xl font-black italic mb-2">{selectedAnno.title}</h2>
             <p className="text-sm text-zinc-300 leading-relaxed mb-8">{selectedAnno.message}</p>
             <button onClick={() => setSelectedAnno(null)} className="w-full py-4 bg-zinc-800 rounded-2xl font-black text-xs uppercase tracking-widest text-white">Close Alert</button>
          </div>
        </div>
      )}

      {/* Activity / Discovery Panel (FIXED UID) */}
      <SubViewPanel title="Activity Feed" isOpen={activeView === 'activity'} onClose={() => setActiveView('none')}>
        <h4 className="text-[10px] font-black uppercase text-zinc-600 mb-6 px-2">People you might know</h4>
        <div className="grid grid-cols-2 gap-3">
          {suggested.map((s) => (
            <div key={s.uid} className="flex flex-col items-center bg-zinc-900 p-5 rounded-[32px] border border-white/5 shadow-xl" onClick={() => router.push(`/user/${s.uid}`)}>
              <img src={s.photoURL} className="w-14 h-14 rounded-full mb-4 object-cover border-2 border-zinc-800 shadow-md" />
              <span className="text-[11px] font-black truncate w-full text-center mb-4">@{s.username}</span>
              <button className="w-full bg-red-600 text-white text-[9px] font-black py-2.5 rounded-2xl uppercase tracking-tighter">View Syncs</button>
            </div>
          ))}
        </div>
      </SubViewPanel>

      {/* Subviews Logic Components */}
      {/* ... (Keep Group and Followers panels from previous version) ... */}

      <Navbar />
    </main>
  );
}

function HubRow({ icon, title, sub, badge, onClick }: any) {
  return (
    <div onClick={onClick} className="flex items-center gap-4 p-4 hover:bg-zinc-900/50 rounded-[28px] transition-colors cursor-pointer group">
      <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center relative shrink-0">
        {icon}
        {badge > 0 && <div className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border-2 border-black animate-pulse">{badge}</div>}
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-black text-white">{title}</h4>
        <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-tighter">{sub}</p>
      </div>
    </div>
  );
}

function SubViewPanel({ title, isOpen, onClose, children }: any) {
  return (
    <div className={`fixed inset-0 bg-black z-[200] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <header className="p-6 border-b border-white/5 flex items-center gap-4 pt-safe bg-zinc-950">
        <button onClick={onClose} className="p-2 bg-zinc-900 rounded-full active:scale-90 transition"><ArrowLeft className="w-5 h-5"/></button>
        <h2 className="font-black italic text-lg text-white">{title}</h2>
      </header>
      <div className="flex-1 overflow-y-auto p-6 no-scrollbar pb-10">
        {children}
      </div>
    </div>
  );
}