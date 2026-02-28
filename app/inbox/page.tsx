"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { 
  collection, query, where, onSnapshot, orderBy, 
  doc, getDoc, getDocs, limit, setDoc, serverTimestamp 
} from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { Plus, Bell, Heart, UserPlus, ArrowLeft, X, Search, ChevronRight } from "lucide-react";
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
  const [hasOwnStory, setHasOwnStory] = useState(false); // New: Check if you have stories
  const [suggested, setSuggested] = useState<UserData[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [viewedAnnoIds, setViewedAnnoIds] = useState<string[]>([]);
  const [selectedAnno, setSelectedAnno] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // 1. Own Story Check (Last 24 Hours)
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    const qOwn = query(
      collection(db, "wallpapers"),
      where("userId", "==", user.uid),
      where("isStory", "==", true),
      where("createdAt", ">=", yesterday)
    );
    const unsubOwn = onSnapshot(qOwn, (snap) => {
      setHasOwnStory(!snap.empty);
    });

    // 2. Friends Stories Logic
    const qStories = query(
      collection(db, "wallpapers"),
      where("isStory", "==", true),
      where("createdAt", ">=", yesterday),
      orderBy("createdAt", "desc")
    );
    const unsubStories = onSnapshot(qStories, async (snap) => {
      const storyMap = new Map();
      for (const d of snap.docs) {
        const data = d.data() as Wallpaper;
        if (data.userId !== user.uid && !storyMap.has(data.userId)) {
          const uDoc = await getDoc(doc(db, "users", data.userId));
          if (uDoc.exists()) storyMap.set(data.userId, { user: uDoc.data() as UserData, story: data });
        }
      }
      setStories(Array.from(storyMap.values()));
    });

    // 3. Chat Listener
    const qChats = query(collection(db, "chats"), where("participants", "array-contains", user.uid));
    const unsubChats = onSnapshot(qChats, (snap) => {
      setChats(snap.docs.map(d => ({ ...d.data(), id: d.id } as Chat)));
      setLoading(false);
    });

    // 4. Discovery & Alerts
    getDocs(query(collection(db, "users"), limit(15))).then(snap => {
      setSuggested(snap.docs.map(d => ({ ...d.data(), uid: d.id } as UserData)).filter(u => u.uid !== user.uid));
    });
    const unsubAnno = onSnapshot(collection(db, "platform_notifications"), (snap) => {
      setAnnouncements(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    });

    return () => { unsubOwn(); unsubChats(); unsubStories(); unsubAnno(); };
  }, [user]);

  const handleOwnStoryClick = () => {
    if (hasOwnStory) {
      router.push(`/story/${user?.uid}`);
    } else {
      router.push('/upload');
    }
  };

  const handleAnnoClick = (anno: any) => {
    setSelectedAnno(anno);
    if (!viewedAnnoIds.includes(anno.id)) {
      const updated = [...viewedAnnoIds, anno.id];
      setViewedAnnoIds(updated);
      localStorage.setItem(`read_anno_${user?.uid}`, JSON.stringify(updated));
    }
  };

  if (!user) return null;

  return (
    <main className="scroll-container no-scrollbar pb-32 relative bg-black">
      <header className="px-6 py-6 flex justify-between items-center bg-black/90 backdrop-blur-xl border-b border-white/5 z-50 sticky top-0 pt-safe">
        <h1 className="text-2xl font-black italic tracking-tighter">Inbox</h1>
        <Search className="w-6 h-6 text-zinc-400" />
      </header>

      {/* 🟣 STORIES ROW */}
      <div className="flex gap-5 overflow-x-auto px-6 py-6 no-scrollbar bg-zinc-900/10 border-b border-white/5">
        
        {/* Current User Story ("You") */}
        <div className="flex flex-col items-center gap-2 shrink-0">
           <div className="relative cursor-pointer" onClick={handleOwnStoryClick}>
              {/* Ring: Red if has story, Grey if not */}
              <div className={`p-[2px] rounded-full transition-all duration-500 ${hasOwnStory ? 'bg-gradient-to-tr from-yellow-400 to-red-600' : 'bg-zinc-800'}`}>
                <div className="bg-black rounded-full p-0.5">
                  <img src={userData?.photoURL} className="w-16 h-16 rounded-full object-cover border border-black" alt="me" />
                </div>
              </div>
              
              {/* Plus Button: Always goes to upload */}
              <div 
                onClick={(e) => { e.stopPropagation(); router.push('/upload'); }} 
                className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-1.5 border-4 border-black active:scale-125 transition-transform shadow-lg"
              >
                <Plus className="w-3 h-3 text-white" strokeWidth={4} />
              </div>
           </div>
           <span className={`text-[10px] font-black uppercase tracking-widest ${hasOwnStory ? 'text-zinc-200' : 'text-zinc-600'}`}>You</span>
        </div>

        {/* Friends Stories */}
        {stories.map((s, i) => (
          <div key={i} className="flex flex-col items-center gap-2 shrink-0" onClick={() => router.push(`/story/${s.user.uid}`)}>
            <div className="p-[2px] rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-pink-600">
              <div className="bg-black rounded-full p-0.5">
                <img src={s.user.photoURL} className="w-16 h-16 rounded-full object-cover border border-black" alt="u" />
              </div>
            </div>
            <span className="text-[10px] font-black text-zinc-400 uppercase truncate w-16 text-center">{s.user.username}</span>
          </div>
        ))}
      </div>

      <div className="px-4 py-2">
        <HubRow icon={<Bell className="text-blue-400"/>} title="System Alerts" sub="Updates" badge={announcements.filter(a => !viewedAnnoIds.includes(a.id)).length} onClick={() => setActiveView('system')} />
        <HubRow icon={<Heart className="text-pink-500"/>} title="Activity" sub="Discovery" onClick={() => setActiveView('activity')} />
        <HubRow icon={<UserPlus className="text-green-500"/>} title="Followers" sub="Syncs" onClick={() => setActiveView('followers')} />
      </div>

      <div className="mt-4 px-2">
        <h3 className="px-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-2">Direct Sessions</h3>
        {chats.map((chat) => (
          <div key={chat.id} onClick={() => router.push(`/inbox/${chat.id}`)} className="flex items-center gap-4 px-4 py-4 active:bg-zinc-900 rounded-[28px] transition">
             <img src={chat.chatAvatar} className="w-14 h-14 rounded-[22px] object-cover bg-zinc-900 border border-white/5" alt="chat" />
             <div className="flex-1 min-w-0">
                <h4 className="font-bold text-[15px] truncate">{chat.chatName}</h4>
                <p className="text-xs text-zinc-500 truncate font-medium">{chat.lastMsg || 'Tap to sync'}</p>
             </div>
          </div>
        ))}
        {chats.length === 0 && !loading && (
          <div className="text-center py-10 opacity-20"><p className="text-xs font-black uppercase tracking-widest">No active chats</p></div>
        )}
      </div>

      {/* --- SUBVIEW PANELS --- */}
      <SubViewPanel title="Announcements" isOpen={activeView === 'system'} onClose={() => setActiveView('none')}>
        {announcements.map(a => (
          <div key={a.id} onClick={() => handleAnnoClick(a)} className="p-5 bg-zinc-900/50 rounded-3xl border border-white/5 mb-3 flex items-center justify-between active:scale-95 transition">
            <div className="min-w-0 flex-1">
               <h4 className={`font-black text-sm mb-1 ${viewedAnnoIds.includes(a.id) ? 'text-zinc-500' : 'text-white'}`}>{a.title}</h4>
               <p className="text-xs text-zinc-400 truncate">{a.message}</p>
            </div>
            <ChevronRight className="text-zinc-700 ml-4"/>
          </div>
        ))}
      </SubViewPanel>

      <SubViewPanel title="Discovery" isOpen={activeView === 'activity'} onClose={() => setActiveView('none')}>
         <div className="grid grid-cols-2 gap-3">
           {suggested.map((s) => (
             <div key={s.uid} className="bg-zinc-900 p-5 rounded-[35px] border border-white/5 flex flex-col items-center" onClick={() => router.push(`/user/${s.uid}`)}>
                <img src={s.photoURL} className="w-14 h-14 rounded-full mb-3 object-cover shadow-2xl border border-white/10" alt="p" />
                <span className="text-[11px] font-black truncate w-full text-center">@{s.username}</span>
                <button className="mt-4 bg-red-600 text-white text-[9px] font-black px-6 py-2.5 rounded-full uppercase shadow-lg shadow-red-900/20">Sync</button>
             </div>
           ))}
         </div>
      </SubViewPanel>

      {/* Announcement Popup Modal */}
      {selectedAnno && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md px-6">
          <div className="w-full max-w-sm bg-zinc-900 rounded-[40px] p-8 border border-white/10 animate-in zoom-in-95 shadow-2xl">
             <div className="w-12 h-12 bg-red-600/20 rounded-2xl flex items-center justify-center mb-6 text-red-500"><Bell className="w-6 h-6"/></div>
             <h2 className="text-xl font-black italic mb-2">{selectedAnno.title}</h2>
             <p className="text-sm text-zinc-300 leading-relaxed mb-8">{selectedAnno.message}</p>
             <button onClick={() => setSelectedAnno(null)} className="w-full py-4 bg-zinc-800 rounded-2xl font-black text-xs uppercase tracking-widest text-white shadow-lg">Dismiss</button>
          </div>
        </div>
      )}

      <Navbar />
    </main>
  );
}

function HubRow({ icon, title, sub, badge, onClick }: any) {
  return (
    <div onClick={(e) => { e.stopPropagation(); onClick(); }} className="flex items-center gap-4 p-4 hover:bg-zinc-900/50 rounded-[28px] transition cursor-pointer">
      <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center relative shrink-0">
        {icon}
        {badge > 0 && <div className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border-2 border-black animate-pulse">{badge}</div>}
      </div>
      <div className="flex-1"><h4 className="text-sm font-black text-white">{title}</h4><p className="text-[11px] font-bold text-zinc-500 uppercase tracking-tighter">{sub}</p></div>
    </div>
  );
}

function SubViewPanel({ title, isOpen, onClose, children }: any) {
  return (
    <div className={`fixed inset-0 bg-black z-[200] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <header className="p-6 border-b border-white/5 flex items-center gap-4 pt-safe bg-zinc-950 shadow-2xl">
        <button onClick={onClose} className="p-2 bg-zinc-900 rounded-full active:scale-90 transition"><ArrowLeft className="w-5 h-5"/></button>
        <h2 className="font-black italic text-lg text-white tracking-tighter uppercase">{title}</h2>
      </header>
      <div className="flex-1 overflow-y-auto p-6 no-scrollbar pb-32">{children}</div>
    </div>
  );
}