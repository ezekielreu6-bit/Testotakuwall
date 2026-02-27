// app/inbox/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { Bell, Heart, UserPlus, Plus, MessageSquare } from "lucide-react";
import { Chat } from "@/types";

export default function InboxPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);
  const[loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedChats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Chat[];

      // Sort: Pinned first, then by lastActivity
      fetchedChats.sort((a, b) => {
        const pinA = a.pinnedBy?.includes(user.uid) ? 1 : 0;
        const pinB = b.pinnedBy?.includes(user.uid) ? 1 : 0;
        if (pinA !== pinB) return pinB - pinA;
        
        const timeA = a.lastActivity?.toMillis() || 0;
        const timeB = b.lastActivity?.toMillis() || 0;
        return timeB - timeA;
      });

      setChats(fetchedChats);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (!user) return null; // Or a loading spinner

  return (
    <main className="h-screen bg-black text-white flex flex-col">
      <header className="px-5 py-4 border-b border-white/5 bg-black/90 backdrop-blur-xl z-50 flex justify-between items-center">
        <h1 className="text-xl font-black italic">Inbox</h1>
        <button className="text-red-500 bg-red-500/10 p-2 rounded-full">
          <Plus className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto pb-24 no-scrollbar">
        {/* Hub Rows (Static Alerts/Activity) */}
        <div className="divide-y divide-white/5 border-b border-white/5 mb-2">
          <HubRow icon={<Bell className="w-5 h-5" />} color="blue" title="System Alerts" subtitle="Platform updates" />
          <HubRow icon={<Heart className="w-5 h-5" />} color="pink" title="Activity" subtitle="Likes & Discovery" />
          <HubRow icon={<UserPlus className="w-5 h-5" />} color="green" title="Followers" subtitle="People following you" />
        </div>

        {/* Dynamic Chats List */}
        {loading ? (
          <div className="text-center py-10 text-zinc-600 text-xs font-bold uppercase tracking-widest animate-pulse">
            Syncing Chats...
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {chats.map(chat => {
              const unreadCount = chat.unread?.[user.uid] || 0;
              const isPinned = chat.pinnedBy?.includes(user.uid);

              return (
                <div 
                  key={chat.id} 
                  onClick={() => router.push(`/inbox/${chat.id}`)}
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-zinc-900/50 transition active:bg-zinc-900"
                >
                  <img src={chat.chatAvatar} className="w-14 h-14 rounded-2xl bg-zinc-900 object-cover border border-white/5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-bold text-sm text-white truncate flex items-center gap-2">
                        {isPinned && <span className="w-2 h-2 rounded-full bg-red-500"></span>}
                        {chat.chatName}
                      </h4>
                      {unreadCount > 0 && (
                        <div className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full border border-black">
                          {unreadCount}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 truncate">{chat.lastMsg || 'Tap to sync'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Basic Bottom Nav Placeholder */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-lg border-t border-white/5 px-6 py-4 flex justify-between items-center pb-safe z-50">
        <MessageSquare className="text-white w-6 h-6" />
        <span className="text-xs font-bold text-zinc-500">Other tabs here</span>
      </nav>
    </main>
  );
}

// Reusable Hub Row Component
function HubRow({ icon, color, title, subtitle }: { icon: any, color: string, title: string, subtitle: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-600/20 text-blue-500",
    pink: "bg-pink-600/20 text-pink-500",
    green: "bg-green-600/20 text-green-500"
  };

  return (
    <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-zinc-900/50 transition">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${colorMap[color]}`}>
        {icon}
      </div>
      <div>
        <h4 className="font-bold text-sm text-white">{title}</h4>
        <p className="text-xs text-zinc-500">{subtitle}</p>
      </div>
    </div>
  );
}