"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { 
  collection, doc, onSnapshot, query, orderBy, 
  addDoc, updateDoc, serverTimestamp, getDoc, deleteDoc
} from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { 
  ArrowLeft, MoreVertical, Send, Smile, X, 
  Copy, Trash2, Flame, Play, ExternalLink, Ghost, ChevronRight, BellOff
} from "lucide-react";
import { Chat, Message, Wallpaper, UserData } from "@/types";
import Link from "next/link";
import VerifiedBadge from "@/components/VerifiedBadge";

// 🎨 ASSETS
const ANIME_STICKERS = [
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpueXpueXpueXpueXpueXpueXpueXpueXpueXpueXpueXpueSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/13CoXDiaCcCoyk/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpueXpueXpueXpueXpueXpueXpueXpueXpueXpueXpueXpueSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/vYyocN_99VlEk/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpueXpueXpueXpueXpueXpueXpueXpueXpueXpueXpueXpueSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/3oz8xAFtqo0LnsYPkY/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpueXpueXpueXpueXpueXpueXpueXpueXpueXpueXpueXpueSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/l0HlSno605w178BZS/giphy.gif",
  "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExYnRybm4zZnJndXp4ZzJ4ZzJ4ZzJ4ZzJ4ZzJ4ZzJ4ZzJ4ZzJ4ZzJ4ZzJ4ZzJ4JmVwPXYxX3N0aWNrZXJzX3NlYXJjaCZjdD1z/vA986lR4122S4/giphy.gif",
];

const EMOJIS = ["🔥","😂","❤️","✨","🙌","💀","👺","🍥","⚡","🎌","🎮","👑","🍜","🍙","🍡","💔","👀","👍","✅","📍"];

export default function ChatRoom() {
  const { id } = useParams() as { id: string };
  const { user, userData } = useAuth();
  const router = useRouter();
  
  // Data State
  const [chatData, setChatData] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<UserData[]>([]);
  
  // UI State
  const [input, setInput] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<'emoji' | 'sticker'>('emoji');
  const [showInfo, setShowInfo] = useState(false);
  const [contextMsg, setContextMsg] = useState<Message | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Chat Data & Real-time Messages
  useEffect(() => {
    if (!id || !user) return;
    
    // Listen for Chat metadata and Participants
    const unsubChat = onSnapshot(doc(db, "chats", id), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Chat;
        setChatData({ ...data, id: docSnap.id });

        // Pre-fetch participant profiles for immediate "Details" view
        const uPromises = data.participants.map(uid => getDoc(doc(db, "users", uid)));
        const uSnaps = await Promise.all(uPromises);
        setParticipants(uSnaps.map(s => ({ uid: s.id, ...s.data() } as UserData)));
      }
    });

    // Listen for Message Stream
    const q = query(collection(db, `chats/${id}/messages`), orderBy("timestamp", "asc"));
    const unsubMsgs = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Message[]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    return () => { unsubChat(); unsubMsgs(); };
  }, [id, user]);

  const sendMsg = async (val: string, type: 'text' | 'sticker' = 'text') => {
    if (!val.trim() || !user || !chatData) return;
    if (type === 'text') setInput("");
    setIsPickerOpen(false);

    const payload = {
      senderId: user.uid,
      timestamp: serverTimestamp(),
      type,
      ...(type === 'text' ? { text: val } : { mediaUrl: val })
    };

    await addDoc(collection(db, `chats/${id}/messages`), payload);
    
    // Update last message in Inbox
    await updateDoc(doc(db, "chats", id), {
      lastMsg: type === 'sticker' ? "Sent a sticker" : val,
      lastActivity: serverTimestamp(),
    });
  };

  if (!chatData || !user) return <div className="h-screen bg-black" />;

  return (
    <main className="flex flex-col h-screen bg-black text-white relative overflow-hidden">
      
      {/* 🟢 FIXED RESPONSIVE HEADER */}
      <header className="fixed top-0 left-0 right-0 z-[100] bg-black/90 backdrop-blur-xl border-b border-white/5 pt-safe px-4 h-[115px] flex items-end pb-4">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0" onClick={() => setShowInfo(true)}>
            <button onClick={(e) => { e.stopPropagation(); router.back(); }} className="p-1 active:scale-90 transition">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <img src={chatData.chatAvatar} className="w-11 h-11 rounded-2xl object-cover border border-white/10 shrink-0" alt="avatar" />
            <div className="min-w-0">
              <h3 className="text-[16px] font-black truncate leading-tight">{chatData.chatName}</h3>
              <div className="flex items-center gap-1.5">
                {chatData.syncCount && chatData.syncCount >= 3 ? (
                    <span className="text-[10px] text-orange-400 font-black flex items-center gap-0.5">
                      <Flame className="w-3 h-3 fill-orange-400" /> {chatData.syncCount} STREAK
                    </span>
                ) : (
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Secure Sync</span>
                    </div>
                )}
              </div>
            </div>
          </div>
          <button onClick={() => setShowInfo(true)} className="p-2.5 bg-white/5 rounded-full active:bg-white/10 transition shrink-0">
            <MoreVertical className="w-5 h-5 text-zinc-400"/>
          </button>
        </div>
      </header>

      {/* 🔵 MESSAGES LIST: Compact Sender Grouping */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col no-scrollbar pt-[130px] pb-32">
        {messages.map((m, i) => {
          const isMe = m.senderId === user.uid;
          const isSameSender = i > 0 && messages[i - 1].senderId === m.senderId;
          
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${isSameSender ? 'mt-1' : 'mt-5'}`}>
              <div 
                className="relative flex flex-col gap-1 max-w-[85%]"
                onContextMenu={(e) => { e.preventDefault(); setContextMsg(m); }}
              >
                {(m.type as string) === 'sticker' ? (
                  <img src={m.mediaUrl} className="w-36 h-36 object-contain drop-shadow-2xl" alt="sticker" />
                ) : (
                  <div className={`msg-bubble shadow-xl ${
                    isMe 
                      ? 'bg-red-600 text-white rounded-2xl rounded-tr-none' 
                      : 'bg-zinc-800 text-zinc-100 rounded-2xl rounded-tl-none border border-white/5'
                  }`}>
                    {m.text}
                    {/* Link Preview Detector */}
                    {m.text?.includes('/watch/') && <VideoPreview text={m.text} isMe={isMe} />}
                  </div>
                )}
                {m.reaction && <div className={`absolute -bottom-2 ${isMe ? 'right-0' : 'left-0'} bg-zinc-900 border border-white/10 rounded-full px-2 py-0.5 text-[10px] shadow-2xl`}>{m.reaction}</div>}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 🟡 COMPACT INPUT BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-950/90 backdrop-blur-2xl border-t border-white/5 p-4 pb-safe z-50">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          
          <button 
            onClick={() => setIsPickerOpen(!isPickerOpen)} 
            className={`p-2 rounded-full transition ${isPickerOpen ? 'text-red-500 bg-red-500/10' : 'text-zinc-500 bg-white/5'}`}
          >
            <Smile className="w-6 h-6" />
          </button>

          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setIsPickerOpen(false)}
            onKeyDown={(e) => e.key === 'Enter' && sendMsg(input)}
            placeholder="Aa" 
            className="flex-1 bg-zinc-900 border border-white/5 rounded-full px-5 py-2.5 text-sm outline-none focus:border-red-600/50 transition-all text-white"
          />

          <button 
            onClick={() => sendMsg(input)}
            disabled={!input.trim()}
            className="bg-red-600 p-3 rounded-full text-white active:scale-90 transition disabled:opacity-40 shadow-lg"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* TABBED PICKER PANEL */}
        {isPickerOpen && (
          <div className="mt-4 bg-zinc-900 rounded-[30px] border border-white/5 overflow-hidden animate-in slide-in-from-bottom-4">
            <div className="flex border-b border-white/5">
              <button onClick={() => setPickerTab('emoji')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition ${pickerTab === 'emoji' ? 'text-red-500 bg-white/5' : 'text-zinc-500'}`}>Emojis</button>
              <button onClick={() => setPickerTab('sticker')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition ${pickerTab === 'sticker' ? 'text-red-500 bg-white/5' : 'text-zinc-500'}`}>Stickers</button>
            </div>
            <div className="p-4 max-h-48 overflow-y-auto no-scrollbar">
              {pickerTab === 'emoji' ? (
                <div className="grid grid-cols-8 gap-2">
                  {EMOJIS.map(e => <button key={e} onClick={() => setInput(input + e)} className="text-2xl p-2 active:scale-125 transition">{e}</button>)}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {ANIME_STICKERS.map((s, i) => <img key={i} src={s} onClick={() => sendMsg(s, 'sticker')} className="w-full aspect-square object-contain cursor-pointer active:scale-95 transition" />)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 🔴 DETAILS SUB-VIEW */}
      <div className={`sub-view fixed inset-0 bg-black z-[200] transition-transform duration-500 flex flex-col ${showInfo ? 'translate-x-0' : 'translate-x-full'}`}>
        <header className="p-6 border-b border-white/5 flex items-center gap-4 pt-safe bg-zinc-950">
          <button onClick={() => setShowInfo(false)} className="p-2 bg-zinc-900 rounded-full"><ArrowLeft /></button>
          <h2 className="font-black italic text-lg text-white">Details</h2>
        </header>
        <div className="flex-1 overflow-y-auto p-6 no-scrollbar pb-10">
          <div className="flex flex-col items-center mb-10">
            <img src={chatData.chatAvatar} className="w-28 h-28 rounded-[35px] object-cover mb-4 border border-white/10 shadow-2xl" />
            <h2 className="text-2xl font-black">{chatData.chatName}</h2>
            <p className="text-xs text-zinc-500 font-bold uppercase mt-1 tracking-widest">{chatData.isGroup ? "Sync Group" : "Private Sync"}</p>
          </div>

          <div className="space-y-2">
             <div className="w-full p-4 bg-zinc-900/50 border border-white/5 rounded-3xl flex items-center justify-between"><div className="flex items-center gap-4 font-bold text-sm"><BellOff className="text-zinc-500"/> Mute Notifications</div><ChevronRight className="w-4 h-4 text-zinc-700" /></div>
             <div className="w-full p-4 bg-zinc-900/50 border border-white/5 rounded-3xl flex items-center justify-between text-red-500" onClick={() => setShowInfo(false)}><div className="flex items-center gap-4 font-bold text-sm"><Trash2/> {chatData.isGroup ? "Leave Group" : "Delete Chat"}</div><ChevronRight className="w-4 h-4 text-zinc-700" /></div>
          </div>

          <div className="mt-10">
            <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-4 px-2">Participants</h4>
            <div className="space-y-3">
              {participants.map(p => (
                <div key={p.uid} className="flex items-center justify-between bg-zinc-900/50 p-4 rounded-3xl border border-white/5">
                   <div className="flex items-center gap-3">
                      <img src={p.photoURL} className="w-10 h-10 rounded-2xl object-cover" />
                      <p className="text-sm font-bold">@{p.username}</p>
                   </div>
                   {p.isPremium && <VerifiedBadge className="w-3 h-3" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </main>
  );
}

// 🟢 LINK PREVIEW COMPONENT
function VideoPreview({ text, isMe }: { text: string, isMe: boolean }) {
  const [video, setVideo] = useState<Wallpaper | null>(null);
  const videoId = text.split('/watch/')[1]?.split(' ')[0];

  useEffect(() => {
    if (videoId) getDoc(doc(db, "wallpapers", videoId)).then(snap => snap.exists() && setVideo(snap.data() as Wallpaper));
  }, [videoId]);

  if (!video) return null;

  return (
    <Link href={`/watch/${videoId}`} className={`mt-3 block overflow-hidden rounded-2xl border ${isMe ? 'border-white/20' : 'border-white/5'} bg-black`}>
      <div className="relative aspect-video flex items-center justify-center">
        <video src={`${video.url}#t=0.1`} className="w-full h-full object-cover opacity-50" muted playsInline />
        <Play className="absolute w-8 h-8 fill-white text-white opacity-80" />
      </div>
      <div className="p-2.5 bg-zinc-900/90 text-[11px] font-bold truncate">{video.title}</div>
    </Link>
  );
}