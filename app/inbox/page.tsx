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
  X, Search, Pin, Flame
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { Chat, UserData, Wallpaper } from "@/types";

type SubView = 'none' | 'system' | 'activity' | 'followers' | 'group';

export default function InboxPage() {
  const { user, userData } = useAuth();
  const router = useRouter();

  // Initialize strictly to 'none'
  const [activeView, setActiveView] = useState<SubView>('none');
  const [chats, setChats] = useState<Chat[]>([]);
  const [stories, setStories] = useState<{user: UserData, story: Wallpaper}[]>([]);
  const [suggested, setSuggested] = useState<UserData[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [systemBadge, setSystemBadge] = useState(0);
  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState("");

  // 1. Core Inbox Listener
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "chats"), where("participants", "array-contains", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as Chat));
      fetched.sort((a, b) => {
        const pinA = a.pinnedBy?.includes(user.uid) ? 1 : 0;
        const pinB = b.pinnedBy?.includes(user.uid) ? 1 : 0;
        if (pinA !== pinB) return pinB - pinA;
        return (b.lastActivity?.toMillis() || 0) - (a.lastActivity?.toMillis() || 0);
      });
      setChats(fetched);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  // 2. Stories Logic
  useEffect(() => {
    if (!user) return;
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    const q = query(collection(db, "wallpapers"), where("isStory", "==", true), where("createdAt", ">=", yesterday), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, async (snap) => {
      const storyMap = new Map();
      for (const d of snap.docs) {
        const data = d.data() as Wallpaper;
        if (!storyMap.has(data.userId)) {
          const uDoc = await getDoc(doc(db, "users", data.userId));
          if (uDoc.exists()) storyMap.set(data.userId, { user: uDoc.data(), story: data });
        }
      }
      setStories(Array.from(storyMap.values()));
    });
    return () => unsub();
  }, [user]);

  // 3. System Data
  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db, "users"), limit(10))).then(snap => {
      setSuggested(snap.docs.map(d => d.data() as UserData).filter(u => u.uid !== user.uid));
    });
    const unsub = onSnapshot(collection(db, "platform_notifications"), (snap) => {
      setAnnouncements(snap.docs.map(d => ({id: d.id, ...d.data()})));
      setSystemBadge(snap.size);
    });
    return () => unsub();
  }, [user]);

  const handleCreateGroup = async () => {
    if (!user || !groupName.trim()) return;
    const id = `group_${Date.now()}`;
    await setDoc(doc(db, "chats", id), {
      chatName: groupName,
      chatAvatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${groupName}`,
      participants: [user.uid],
      isGroup: true, ownerId: user.uid,
      lastActivity: serverTimestamp(),
      unread: { [user.uid]: 0 }
    });
    router.push(`/inbox/${id}`);
  };

  if (!user) return null;

  return (
    <main className="h-screen w-screen bg-black flex flex-col overflow-hidden relative">
      <header className="px-6 py-5 flex justify-between items-center bg-black/90 backdrop-blur-xl border-b border-white/5 z-50">
        <h1 className="text-2xl font-black italic tracking-tighter">Inbox</h1>
        <Search className="w-6 h-6 text-zinc-400" />
      </header>

      {/* Group FAB */}
      <button 
        onClick={() => setActiveView('group')}
        className="fixed bottom-24 right-6 w-16 h-16 bg-gradient-to-tr from-red-600 to-pink-600 rounded-3xl flex items-center justify-center shadow-2xl z-40 border border-white/10 active:scale-90 transition-transform"
      >
        <Plus className="w-8 h-8 text-white" />
      </button>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
        {/* Stories Row */}
        <div className="flex gap-5 overflow-x-auto px-6 py-6 no-scrollbar bg-zinc-900/10 border-b border-white/5">
          <div className="flex flex-col items-center gap-2 shrink-0" onClick={() => router.push(`/story/${user.uid}`)}>
            <div className="relative">
              <img src={userData?.photoURL} className="w-16 h-16 rounded-full object-cover border-2 border-zinc-800" alt="me" />
              <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-1 border-2 border-black"><Plus className="w-3 h-3 text-white" /></div>
            </div>
            <span className="text-[10px] font-black text-zinc-500 uppercase">You</span>
          </div>

          {stories.map((s, i) => (
            <div key={i} className="flex flex-col items-center gap-2 shrink-0" onClick={() => router.push(`/story/${s.user.uid}`)}>
              <div className="p-[2px] rounded-full bg-gradient-to-tr from-yellow-400 to-pink-600">
                <img src={s.user.photoURL} className="w-16 h-16 rounded-full object-cover border-2 border-black bg-black" alt="user" />
              </div>
              <span className="text-[10px] font-black text-zinc-400 uppercase truncate w-16 text-center">{s.user.username}</span>
            </div>
          ))}
        </div>

        {/* Hub Rows */}
        <div className="px-4 py-2">
          <HubRow icon={<Bell className="text-blue-400" />} title="System Alerts" sub="Platform updates" badge={systemBadge} onClick={() => setActiveView('system')} />
          <HubRow icon={<Heart className="text-pink-500" />} title="Activity" sub="Likes & Discovery" onClick={() => setActiveView('activity')} />
          <HubRow icon={<UserPlus className="text-green-500" />} title="Followers" sub="People following you" onClick={() => setActiveView('followers')} />
        </div>

        {/* Chat List */}
        <div className="mt-4 px-2">
          <h3 className="px-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-2">Direct Syncs</h3>
          {chats.map((chat) => {
            const unread = chat.unread?.[user.uid] || 0;
            const isPinned = chat.pinnedBy?.includes(user.uid);
            return (
              <div key={chat.id} onClick={() => router.push(`/inbox/${chat.id}`)} className="flex items-center gap-4 px-4 py-4 active:bg-zinc-900 rounded-[24px] transition-colors">
                <div className="relative">
                  <img src={chat.chatAvatar} className="w-14 h-14 rounded-[20px] bg-zinc-900 object-cover border border-white/5" alt="chat" />
                  {unread > 0 && <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full border-2 border-black flex items-center justify-center text-[9px] font-black">{unread}</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <h4 className="font-bold text-[15px] flex items-center gap-1.5 truncate">
                      {isPinned && <Pin className="w-3 h-3 text-red-500 fill-red-500" />}
                      {chat.chatName}
                    </h4>
                    {chat.syncCount && chat.syncCount >= 3 && <div className="flex items-center gap-0.5 text-orange-500"><Flame className="w-3 h-3 fill-orange-500" /><span className="text-[11px] font-black">{chat.syncCount}</span></div>}
                  </div>
                  <p className="text-xs text-zinc-500 truncate font-medium">{chat.lastMsg || 'Tap to sync content'}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- SUBVIEWS --- */}
      {/* Announcements */}
      <SubViewPanel title="Announcements" isOpen={activeView === 'system'} onClose={() => setActiveView('none')}>
        {announcements.map(a => (
          <div key={a.id} className="p-5 bg-zinc-900/50 rounded-3xl border border-white/5 mb-4">
            <h4 className="font-black text-red-500 mb-1 italic">{a.title}</h4>
            <p className="text-sm text-zinc-300 leading-relaxed">{a.message}</p>
          </div>
        ))}
      </SubViewPanel>

      {/* Activity */}
      <SubViewPanel title="Activity Feed" isOpen={activeView === 'activity'} onClose={() => setActiveView('none')}>
        <h4 className="text-[10px] font-black uppercase text-zinc-600 mb-4 px-2">People you might know</h4>
        <div className="flex gap-4 overflow-x-auto no-scrollbar">
          {suggested.map((s, i) => (
            <div key={i} className="flex flex-col items-center bg-zinc-900 p-4 rounded-3xl min-w-[110px] border border-white/5" onClick={() => router.push(`/user/${s.uid}`)}>
              <img src={s.photoURL} className="w-12 h-12 rounded-full mb-3 object-cover" alt="suggested" />
              <span className="text-[10px] font-black truncate w-full text-center">@{s.username}</span>
              <button className="mt-3 bg-red-600 text-white text-[9px] font-black px-4 py-1.5 rounded-full">SYNC</button>
            </div>
          ))}
        </div>
      </SubViewPanel>

      {/* Followers */}
      <SubViewPanel title="New Followers" isOpen={activeView === 'followers'} onClose={() => setActiveView('none')}>
        <div className="text-center py-20 text-zinc-600 font-bold text-xs uppercase tracking-widest">No new followers today</div>
      </SubViewPanel>

      {/* Group Modal */}
      {activeView === 'group' && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-sm px-0">
          <div className="absolute inset-0" onClick={() => setActiveView('none')} />
          <div className="w-full bg-[#111] rounded-t-[40px] p-8 pb-12 border-t border-white/10 relative z-10 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-black italic">Launch Group</h2>
              <button onClick={() => setActiveView('none')} className="bg-white/5 p-2 rounded-full"><X className="w-5 h-5"/></button>
            </div>
            <input 
              type="text" placeholder="Name your sync group..." value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full bg-black border border-white/10 p-5 rounded-3xl mb-8 outline-none focus:border-red-600 transition-all font-bold text-white"
            />
            <button onClick={handleCreateGroup} disabled={!groupName.trim()} className="w-full bg-red-600 py-5 rounded-3xl font-black uppercase tracking-widest active:scale-95 transition disabled:opacity-50">Start Group</button>
          </div>
        </div>
      )}

      <Navbar />
    </main>
  );
}

// Fixed Row Component
function HubRow({ icon, title, sub, badge, onClick }: any) {
  return (
    <div onClick={(e) => { e.stopPropagation(); onClick(); }} className="flex items-center gap-4 p-4 hover:bg-zinc-900/50 rounded-[28px] transition-colors cursor-pointer group">
      <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center relative shrink-0">
        {icon}
        {badge > 0 && <div className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border-2 border-black">{badge}</div>}
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-black text-white">{title}</h4>
        <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-tighter">{sub}</p>
      </div>
    </div>
  );
}

// Fixed Panel Component
function SubViewPanel({ title, isOpen, onClose, children }: any) {
  return (
    <div className={`fixed inset-0 bg-black z-[200] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <header className="p-6 border-b border-white/5 flex items-center gap-4 bg-black">
        <button onClick={onClose} className="p-2 bg-zinc-900 rounded-full"><ArrowLeft className="w-5 h-5"/></button>
        <h2 className="font-black italic text-lg">{title}</h2>
      </header>
      <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
        {children}
      </div>
    </div>
  );
}