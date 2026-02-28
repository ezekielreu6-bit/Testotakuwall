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
  Copy, Trash2, Flame, Play, ExternalLink, Ghost, Image as ImageIcon
} from "lucide-react";
import { Chat, Message, Wallpaper, UserData } from "@/types";
import Link from "next/link";
import VerifiedBadge from "@/components/VerifiedBadge";

// 🎨 ASSETS
const ANIME_STICKERS = [
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpueXpueXpueXpueXpueXpueXpueXpueXpueXpueXpueXpueXpueSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/13CoXDiaCcCoyk/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpueXpueXpueXpueXpueXpueXpueXpueXpueXpueXpueXpueXpueSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/vYyocN_99VlEk/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpueXpueXpueXpueXpueXpueXpueXpueXpueXpueXpueXpueXpueSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/3oz8xAFtqo0LnsYPkY/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpueXpueXpueXpueXpueXpueXpueXpueXpueXpueXpueXpueXpueSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/l0HlSno605w178BZS/giphy.gif",
  "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExYnRybm4zZnJndXp4ZzJ4ZzJ4ZzJ4ZzJ4ZzJ4ZzJ4ZzJ4ZzJ4ZzJ4ZzJ4JmVwPXYxX3N0aWNrZXJzX3NlYXJjaCZjdD1z/vA986lR4122S4/giphy.gif",
  "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExYnRybm4zZnJndXp4ZzJ4ZzJ4ZzJ4ZzJ4ZzJ4ZzJ4ZzJ4ZzJ4ZzJ4ZzJ4JmVwPXYxX3N0aWNrZXJzX3NlYXJjaCZjdD1z/C86mI6Nn8i1lS/giphy.gif"
];

const EMOJIS = ["🔥","😂","❤️","✨","🙌","💀","👺","🍥","⚡","🎌","🎮","👑","🍜","🍙","🍡","💔","👀","👍","✅","❌","📍","🎁","🚀","🛸","💎","🧿","🧸","🎈","🎉","🌟","🎵","🎧","📸","💻","📱"];

export default function ChatRoom() {
  const { id } = useParams() as { id: string };
  const { user, userData } = useAuth();
  const router = useRouter();
  
  const [chatData, setChatData] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pickerMode, setPickerMode] = useState<'none' | 'emoji' | 'sticker'>('none');
  const [showInfo, setShowInfo] = useState(false);
  const [contextMsg, setContextMsg] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<any>(null);

  // 1. Listen to Chat & Messages
  useEffect(() => {
    if (!id || !user) return;
    const unsubChat = onSnapshot(doc(db, "chats", id), (docSnap) => {
      if (docSnap.exists()) setChatData({ ...docSnap.data(), id: docSnap.id } as Chat);
    });
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
    setPickerMode('none');

    const newUnread = { ...chatData.unread };
    chatData.participants.forEach(p => { if (p !== user.uid) newUnread[p] = (newUnread[p] || 0) + 1; });

    await addDoc(collection(db, `chats/${id}/messages`), {
      senderId: user.uid,
      timestamp: serverTimestamp(),
      type,
      ...(type === 'text' ? { text: val } : { mediaUrl: val })
    });

    await updateDoc(doc(db, "chats", id), {
      lastMsg: type === 'sticker' ? "Sent a sticker" : val,
      lastActivity: serverTimestamp(),
      unread: newUnread
    });
  };

  if (!chatData || !user) return <div className="h-screen bg-black" />;

  return (
    <main className="flex flex-col h-screen bg-black text-white relative overflow-hidden">
      
      {/* 🟢 RESPONSIVE HEADER: pt-safe ensures visibility on all phones */}
      <header className="fixed top-0 left-0 right-0 z-[100] bg-black/90 backdrop-blur-xl border-b border-white/5 pt-safe px-4 shadow-2xl">
        <div className="h-[70px] flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <button onClick={() => router.back()} className="p-2 -ml-2 active:scale-90 transition">
              <ArrowLeft className="w-6 h-6" />
            </button>
            
            <div className="flex items-center gap-3 cursor-pointer overflow-hidden" onClick={() => setShowInfo(true)}>
              <img 
                src={chatData.chatAvatar} 
                className="w-11 h-11 rounded-2xl object-cover border border-white/10 shrink-0" 
                alt="avatar"
              />
              <div className="flex flex-col min-w-0">
                <h3 className="text-[16px] font-black truncate text-white leading-tight">
                  {chatData.chatName}
                </h3>
                <div className="flex items-center gap-1.5">
                  {chatData.syncCount && chatData.syncCount >= 3 ? (
                    <span className="text-[10px] text-orange-400 font-black flex items-center gap-0.5 animate-pulse">
                      <Flame className="w-3 h-3 fill-orange-400" /> {chatData.syncCount} SYNC STREAK
                    </span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Active Sync</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <button onClick={() => setShowInfo(true)} className="text-zinc-500 p-2.5 bg-white/5 rounded-full shrink-0 active:bg-white/10 transition">
            <MoreVertical className="w-5 h-5"/>
          </button>
        </div>
      </header>

      {/* 🔵 MESSAGES: pt-[120px] makes space for the safe-area header */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 no-scrollbar pt-[125px] pb-32">
        {messages.map((m) => (
          <ChatMessage 
            key={m.id} 
            message={m} 
            currentUid={user.uid} 
            onLongPress={(msg: any) => {
                if (navigator.vibrate) navigator.vibrate(50);
                setContextMsg(msg);
            }} 
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 🟡 INPUT AREA */}
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-950/90 backdrop-blur-2xl border-t border-white/5 p-4 pb-safe z-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button 
                onClick={() => setPickerMode(pickerMode === 'emoji' ? 'none' : 'emoji')} 
                className={`p-2 transition ${pickerMode === 'emoji' ? 'text-red-500 scale-110' : 'text-zinc-500'}`}
            >
                <Smile className="w-6 h-6" />
            </button>
            <button 
                onClick={() => setPickerMode(pickerMode === 'sticker' ? 'none' : 'sticker')} 
                className={`p-2 transition ${pickerMode === 'sticker' ? 'text-red-500 scale-110' : 'text-zinc-500'}`}
            >
                <Ghost className="w-6 h-6" />
            </button>
          </div>
          
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setPickerMode('none')}
            onKeyDown={(e) => e.key === 'Enter' && sendMsg(input)}
            placeholder="Aa" 
            className="flex-1 bg-zinc-900 rounded-[20px] px-5 py-3 text-sm outline-none border border-white/5 text-white font-medium"
          />

          <button 
            onClick={() => sendMsg(input)}
            disabled={!input.trim()}
            className="bg-red-600 p-3 rounded-full text-white active:scale-90 transition disabled:opacity-50 shadow-lg shadow-red-900/20"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* EMOJI GRID */}
        {pickerMode === 'emoji' && (
          <div className="grid grid-cols-8 gap-2 p-4 bg-zinc-900/50 rounded-3xl mt-4 max-h-48 overflow-y-auto no-scrollbar animate-in slide-in-from-bottom-2">
            {EMOJIS.map(e => (
              <button key={e} onClick={() => setInput(input + e)} className="text-2xl p-2 active:scale-125 transition-transform">{e}</button>
            ))}
          </div>
        )}

        {/* STICKER GRID */}
        {pickerMode === 'sticker' && (
          <div className="grid grid-cols-4 gap-4 p-4 bg-zinc-900/50 rounded-3xl mt-4 max-h-56 overflow-y-auto no-scrollbar animate-in slide-in-from-bottom-2">
            {ANIME_STICKERS.map((s, i) => (
              <img 
                key={i} 
                src={s} 
                onClick={() => sendMsg(s, 'sticker')} 
                className="w-full aspect-square object-contain cursor-pointer active:scale-95 transition-transform hover:brightness-125" 
                alt="sticker"
              />
            ))}
          </div>
        )}
      </div>

      {/* Context Menu (Reactions) */}
      {contextMsg && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-md px-6" onClick={() => setContextMsg(null)}>
          <div className="w-full max-w-xs bg-zinc-900 rounded-[35px] overflow-hidden border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
             <div className="p-6 flex justify-around border-b border-white/5 bg-white/5">
                {["❤️", "🔥", "😂", "💀"].map(emoji => (
                  <button key={emoji} className="text-3xl active:scale-150 transition-transform" onClick={async () => {
                    await updateDoc(doc(db, `chats/${id}/messages`, contextMsg.id), { reaction: emoji });
                    setContextMsg(null);
                  }}>{emoji}</button>
                ))}
             </div>
             <button className="w-full p-5 text-left flex items-center gap-4 text-sm font-bold border-b border-white/5 active:bg-white/5 transition" onClick={() => { navigator.clipboard.writeText(contextMsg.text || ""); setContextMsg(null); }}>
                <Copy className="w-5 h-5 text-zinc-400"/> Copy Text
             </button>
             {contextMsg.senderId === user.uid && (
               <button className="w-full p-5 text-left flex items-center gap-4 text-sm font-bold text-red-500 active:bg-red-500/10 transition" onClick={() => { deleteDoc(doc(db, `chats/${id}/messages`, contextMsg.id)); setContextMsg(null); }}>
                  <Trash2 className="w-5 h-5"/> Delete Message
               </button>
             )}
          </div>
        </div>
      )}
    </main>
  );
}

// --- MESSAGE COMPONENT ---

function ChatMessage({ message, currentUid, onLongPress }: any) {
  const isMe = message.senderId === currentUid;
  const watchUrlRegex = /\/watch\/([a-zA-Z0-9_-]+)/;
  const match = message.text?.match(watchUrlRegex);
  const videoId = match ? match[1] : null;

  return (
    <div 
      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
      onContextMenu={(e) => { e.preventDefault(); onLongPress(message); }}
      onDoubleClick={() => onLongPress(message)}
    >
      <div className="relative flex flex-col gap-1 max-w-[85%] animate-in fade-in duration-300">
        
        {(message.type as string) === 'sticker' ? (
          <img src={message.mediaUrl} className="w-36 h-36 object-contain drop-shadow-2xl" alt="sticker" />
        ) : (
          <div className={`msg-bubble shadow-xl ${isMe ? 'bg-red-600 text-white rounded-br-none' : 'bg-zinc-800 text-zinc-100 rounded-bl-none border border-white/5'}`}>
            {message.text}
            {videoId && <VideoLinkPreview videoId={videoId} isMe={isMe} />}
          </div>
        )}
        
        {message.reaction && (
          <div className={`absolute -bottom-2 ${isMe ? 'right-0' : 'left-0'} bg-zinc-900 border border-white/10 rounded-full px-2 py-0.5 text-[11px] shadow-2xl flex items-center justify-center`}>
            {message.reaction}
          </div>
        )}
      </div>
    </div>
  );
}

// --- VIDEO PREVIEW ---

function VideoLinkPreview({ videoId, isMe }: { videoId: string, isMe: boolean }) {
  const [video, setVideo] = useState<Wallpaper | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDoc(doc(db, "wallpapers", videoId)).then(snap => {
      if (snap.exists()) setVideo({ ...snap.data(), id: snap.id } as Wallpaper);
      setLoading(false);
    });
  }, [videoId]);

  if (loading) return <div className="mt-3 w-full h-32 bg-black/20 rounded-xl animate-pulse" />;
  if (!video) return null;

  return (
    <Link href={`/watch/${videoId}`} className={`mt-3 block overflow-hidden rounded-2xl border ${isMe ? 'border-white/20' : 'border-white/10'} bg-black group`}>
      <div className="relative aspect-video flex items-center justify-center overflow-hidden">
        <video src={`${video.url}#t=0.1`} className="w-full h-full object-cover opacity-60 transition-transform group-hover:scale-110" muted playsInline />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
            <Play className="w-4 h-4 fill-white text-white ml-0.5" />
          </div>
        </div>
      </div>
      <div className="p-3 bg-zinc-900/90 backdrop-blur-sm">
        <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Linked Sync</p>
        <p className="text-xs font-bold text-white truncate">{video.title}</p>
      </div>
    </Link>
  );
}