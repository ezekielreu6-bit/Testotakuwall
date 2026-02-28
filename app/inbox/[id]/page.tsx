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
import { Chat, Message, Wallpaper } from "@/types";
import Link from "next/link";

// 🎨 PRESET ANIME STICKERS (GIFs)
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
    
    // Clear UI state
    if (type === 'text') setInput("");
    setPickerMode('none');

    const newUnread = { ...chatData.unread };
    chatData.participants.forEach(p => { if (p !== user.uid) newUnread[p] = (newUnread[p] || 0) + 1; });

    const payload = {
      senderId: user.uid,
      timestamp: serverTimestamp(),
      type,
      ...(type === 'text' ? { text: val } : { mediaUrl: val })
    };

    await addDoc(collection(db, `chats/${id}/messages`), payload);
    await updateDoc(doc(db, "chats", id), {
      lastMsg: type === 'sticker' ? "Sent a sticker" : val,
      lastActivity: serverTimestamp(),
      unread: newUnread
    });
  };

  if (!chatData || !user) return <div className="h-screen bg-black" />;

  return (
    <main className="flex flex-col h-screen bg-black text-white relative">
      
      {/* Header */}
      <header className="p-4 glass flex justify-between items-center z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}><ArrowLeft /></button>
          <img src={chatData.chatAvatar} className="w-10 h-10 rounded-2xl object-cover border border-white/10" />
          <div className="cursor-pointer" onClick={() => setShowInfo(true)}>
            <h3 className="text-sm font-black truncate max-w-[150px]">{chatData.chatName}</h3>
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">
              {chatData.syncCount && chatData.syncCount >= 3 ? `🔥 Streak ${chatData.syncCount}` : "Secure Sync"}
            </span>
          </div>
        </div>
        <button onClick={() => setShowInfo(true)} className="text-zinc-500 p-2"><MoreVertical className="w-5 h-5"/></button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 no-scrollbar">
        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} currentUid={user.uid} onLongPress={setContextMsg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Logic */}
      <div className="p-4 bg-zinc-950 border-t border-white/5 pb-safe z-50">
        <div className="flex items-center gap-3">
          {/* Toggle Buttons */}
          <div className="flex items-center gap-2">
            <button 
                onClick={() => setPickerMode(pickerMode === 'emoji' ? 'none' : 'emoji')} 
                className={`transition ${pickerMode === 'emoji' ? 'text-red-500' : 'text-zinc-500'}`}
            >
                <Smile className="w-6 h-6" />
            </button>
            <button 
                onClick={() => setPickerMode(pickerMode === 'sticker' ? 'none' : 'sticker')} 
                className={`transition ${pickerMode === 'sticker' ? 'text-red-500' : 'text-zinc-500'}`}
            >
                <Ghost className="w-6 h-6" />
            </button>
          </div>
          
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setPickerMode('none')}
            placeholder="Aa" 
            className="flex-1 bg-zinc-900 rounded-full px-5 py-3 text-sm outline-none border border-white/5 text-white"
          />

          <button 
            onClick={() => sendMsg(input)}
            className="bg-red-600 p-3 rounded-full text-white active:scale-90 transition disabled:opacity-50"
            disabled={!input.trim()}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* EMOJI GRID */}
        {pickerMode === 'emoji' && (
          <div className="grid grid-cols-8 gap-2 p-4 bg-zinc-900 rounded-3xl mt-4 max-h-48 overflow-y-auto no-scrollbar animate-in slide-in-from-bottom-2">
            {EMOJIS.map(e => (
              <button key={e} onClick={() => setInput(input + e)} className="text-2xl p-2 active:scale-125 transition-transform">{e}</button>
            ))}
          </div>
        )}

        {/* STICKER GRID */}
        {pickerMode === 'sticker' && (
          <div className="grid grid-cols-4 gap-4 p-4 bg-zinc-900 rounded-3xl mt-4 max-h-56 overflow-y-auto no-scrollbar animate-in slide-in-from-bottom-2">
            {ANIME_STICKERS.map((s, i) => (
              <img 
                key={i} 
                src={s} 
                onClick={() => sendMsg(s, 'sticker')} 
                className="w-full aspect-square object-contain cursor-pointer active:scale-95 transition-transform hover:opacity-80" 
                alt="sticker"
              />
            ))}
          </div>
        )}
      </div>

      {/* Context Menu (Reactions) */}
      {contextMsg && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md px-6" onClick={() => setContextMsg(null)}>
          <div className="w-full max-w-xs bg-zinc-900 rounded-[32px] overflow-hidden border border-white/10" onClick={e => e.stopPropagation()}>
             <div className="p-5 flex justify-around border-b border-white/5">
                {["❤️", "🔥", "😂", "💀"].map(emoji => (
                  <button key={emoji} className="text-3xl active:scale-150 transition" onClick={async () => {
                    await updateDoc(doc(db, `chats/${id}/messages`, contextMsg.id), { reaction: emoji });
                    setContextMsg(null);
                  }}>{emoji}</button>
                ))}
             </div>
             <button className="w-full p-5 text-left flex items-center gap-4 text-sm font-bold border-b border-white/5 active:bg-white/5" onClick={() => { navigator.clipboard.writeText(contextMsg.text || ""); setContextMsg(null); }}>
                <Copy className="w-5 h-5 text-zinc-400"/> Copy Text
             </button>
             {contextMsg.senderId === user.uid && (
               <button className="w-full p-5 text-left flex items-center gap-4 text-sm font-bold text-red-500 active:bg-red-500/10" onClick={() => { deleteDoc(doc(db, `chats/${id}/messages`, contextMsg.id)); setContextMsg(null); }}>
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

function ChatMessage({ message, currentUid, onLongPress }: { message: Message, currentUid: string, onLongPress: any }) {
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
      <div className="relative flex flex-col gap-1 max-w-[85%]">
        
        {message.type === 'sticker' ? (
          <img src={message.mediaUrl} className="w-32 h-32 object-contain animate-in zoom-in duration-200" />
        ) : (
          <div className={`msg-bubble shadow-xl ${isMe ? 'bg-red-600 text-white rounded-br-none' : 'bg-zinc-800 text-zinc-100 rounded-bl-none'}`}>
            {message.text}
            {videoId && <VideoLinkPreview videoId={videoId} isMe={isMe} />}
          </div>
        )}
        
        {message.reaction && (
          <div className={`absolute -bottom-2 ${isMe ? 'right-0' : 'left-0'} bg-zinc-900 border border-white/10 rounded-full px-2 py-0.5 text-[11px] shadow-2xl`}>
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
    <Link href={`/watch/${videoId}`} className={`mt-3 block overflow-hidden rounded-2xl border ${isMe ? 'border-white/20' : 'border-white/10'} bg-black shadow-lg`}>
      <div className="relative aspect-video flex items-center justify-center">
        <video src={`${video.url}#t=0.1`} className="w-full h-full object-cover opacity-60" muted playsInline />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
            <Play className="w-4 h-4 fill-white text-white ml-0.5" />
          </div>
        </div>
      </div>
      <div className="p-3 bg-zinc-900/80">
        <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Shared Sync</p>
        <p className="text-xs font-bold text-white truncate">{video.title}</p>
      </div>
    </Link>
  );
}