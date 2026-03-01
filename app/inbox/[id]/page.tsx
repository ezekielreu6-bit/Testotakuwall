"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { 
  collection, doc, onSnapshot, query, orderBy, 
  addDoc, updateDoc, serverTimestamp, getDoc, deleteDoc, arrayUnion, arrayRemove
} from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { 
  ArrowLeft, MoreVertical, Send, Smile, X, 
  Copy, Trash2, Flame, Play, Ghost, ChevronRight, BellOff,
  MapPin, Slash, ShieldAlert
} from "lucide-react";
import { Chat, Message, Wallpaper, UserData } from "@/types";
import Link from "next/link";
import VerifiedBadge from "@/components/VerifiedBadge";

// 🎨 CLEAN STICKER ASSETS (Fixed URLs)
const ANIME_STICKERS = [
  "https://media.giphy.com/media/13CoXDiaCcCoyk/giphy.gif",
  "https://media.giphy.com/media/vYyocN_99VlEk/giphy.gif",
  "https://media.giphy.com/media/3oz8xAFtqo0LnsYPkY/giphy.gif",
  "https://media.giphy.com/media/l0HlSno605w178BZS/giphy.gif",
  "https://media.giphy.com/media/OpfkuToK5gSHK/giphy.gif",
  "https://media.giphy.com/media/pMLAvZ8MDYc5bOYTpc/giphy.gif",
  "https://media.giphy.com/media/xdLH51eNWZAHrwy5mf/giphy.gif"
];

const EMOJIS = ["🔥","😂","❤️","✨","🙌","💀","👺","🍥","⚡","🎌","🎮","👑","🍜","🍙","🍡","💔","👀","👍","✅","📍"];

export default function ChatRoom() {
  const { id } = useParams() as { id: string };
  const { user, userData } = useAuth();
  const router = useRouter();
  
  const [chatData, setChatData] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<UserData[]>([]);
  const [input, setInput] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<'emoji' | 'sticker'>('emoji');
  const [showInfo, setShowInfo] = useState(false);
  const [contextMsg, setContextMsg] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const otherUid = chatData?.participants.find(p => p !== user?.uid);
  const isBlocked = (userData?.blockedUids || []).includes(otherUid || "");
  const isPinned = chatData?.pinnedBy?.includes(user?.uid || "");

  useEffect(() => {
    if (!id || !user) return;
    const unsubChat = onSnapshot(doc(db, "chats", id), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Chat;
        setChatData({ ...data, id: docSnap.id });
        const uPromises = data.participants.map(uid => getDoc(doc(db, "users", uid)));
        const uSnaps = await Promise.all(uPromises);
        setParticipants(uSnaps.map(s => ({ uid: s.id, ...s.data() } as UserData)));
      }
    });
    const q = query(collection(db, `chats/${id}/messages`), orderBy("timestamp", "asc"));
    const unsubMsgs = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Message[]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return () => { unsubChat(); unsubMsgs(); };
  }, [id, user]);

  const sendMsg = async (val: string, type: 'text' | 'sticker' = 'text') => {
    if (!val.trim() || !user || !chatData || isBlocked) return;
    if (type === 'text') setInput("");
    setIsPickerOpen(false);
    await addDoc(collection(db, `chats/${id}/messages`), {
      senderId: user.uid,
      timestamp: serverTimestamp(),
      type,
      ...(type === 'text' ? { text: val } : { mediaUrl: val })
    });
    await updateDoc(doc(db, "chats", id), {
      lastMsg: type === 'sticker' ? "Sent a sticker" : val,
      lastActivity: serverTimestamp(),
    });
  };

  if (!chatData || !user) return <div className="h-screen bg-black" />;

  return (
    <main className="flex flex-col h-screen bg-black text-white relative overflow-hidden">
      
      {/* 🟢 HEADER */}
      <header className="fixed top-0 left-0 right-0 z-[100] bg-black/95 backdrop-blur-xl border-b border-white/5 pt-safe px-4 h-[90px] flex items-center shadow-2xl">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0" onClick={() => setShowInfo(true)}>
            <button onClick={(e) => { e.stopPropagation(); router.back(); }} className="p-1 active:scale-90 transition">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="relative shrink-0">
                <img src={chatData.chatAvatar} className="w-11 h-11 rounded-2xl object-cover border border-white/10" alt="avatar" />
                {isPinned && <div className="absolute -top-1 -right-1 bg-red-600 p-1 rounded-full border-2 border-black shadow-lg"><MapPin className="w-2.5 h-2.5 text-white fill-white"/></div>}
            </div>
            <div className="min-w-0">
              <h3 className="text-[16px] font-black truncate leading-tight flex items-center gap-1">
                {chatData.chatName} {isBlocked && <Slash className="w-3 h-3 text-red-500" />}
              </h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isBlocked ? 'bg-zinc-600' : 'bg-green-500'}`} /> {isBlocked ? 'Blocked' : 'Active Sync'}
              </p>
            </div>
          </div>
          <button onClick={() => setShowInfo(true)} className="p-2.5 bg-white/5 rounded-full active:bg-white/10 transition shrink-0">
            <MoreVertical className="w-5 h-5 text-zinc-400"/>
          </button>
        </div>
      </header>

      {/* 🔵 MESSAGES AREA */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col no-scrollbar pt-[110px] pb-32">
        {messages.map((m, i) => {
          const isMe = m.senderId === user.uid;
          const isSameSender = i > 0 && messages[i - 1].senderId === m.senderId;
          
          return (
            <div key={m.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} ${isSameSender ? 'mt-2' : 'mt-7'}`}>
              <div 
                className="relative flex flex-col gap-1 max-w-[80%]"
                onContextMenu={(e) => { e.preventDefault(); setContextMsg(m); }}
                onDoubleClick={() => setContextMsg(m)}
              >
                {(m.type as string) === 'sticker' ? (
                  <img src={m.mediaUrl} className="w-36 h-36 object-contain drop-shadow-2xl animate-in zoom-in-75 duration-300" alt="sticker" />
                ) : (
                  <div className={`
                    px-4 py-2.5 rounded-[20px] text-[15px] font-medium leading-normal w-fit shadow-lg
                    break-words whitespace-pre-wrap transition-all
                    ${isMe 
                      ? 'bg-red-600 text-white ml-auto rounded-tr-none' 
                      : 'bg-zinc-800 text-zinc-100 mr-auto rounded-tl-none border border-white/5'
                    }
                  `}>
                    {m.text}
                    {m.text?.includes('/watch/') && <LinkPreview text={m.text} isMe={isMe} />}
                  </div>
                )}
                {m.reaction && (
                  <div className={`absolute -bottom-3 ${isMe ? 'right-1' : 'left-1'} bg-zinc-900 border border-white/10 rounded-full px-2 py-0.5 text-[11px] shadow-2xl z-10 flex items-center justify-center`}>
                    {m.reaction}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 🟡 INPUT BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur-2xl border-t border-white/5 p-4 pb-safe z-50">
        {isBlocked ? (
            <div className="py-2 flex flex-col items-center gap-1 opacity-50"><ShieldAlert className="w-4 h-4 text-red-500" /><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">You have blocked this sync</p></div>
        ) : (
            <div className="flex items-center gap-3 max-w-4xl mx-auto">
                <button onClick={() => setIsPickerOpen(!isPickerOpen)} className={`p-2 rounded-full transition ${isPickerOpen ? 'text-red-500 bg-red-500/10' : 'text-zinc-500 bg-white/5'}`}><Smile className="w-6 h-6" /></button>
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onFocus={() => setIsPickerOpen(false)} onKeyDown={(e) => e.key === 'Enter' && sendMsg(input)} placeholder="Aa" className="flex-1 bg-zinc-900 border border-white/5 rounded-full px-5 py-2.5 text-sm outline-none focus:border-red-600/50 transition-all text-white font-medium" />
                <button onClick={() => sendMsg(input)} disabled={!input.trim()} className="bg-red-600 p-2.5 rounded-full text-white active:scale-90 transition disabled:opacity-40"><Send className="w-5 h-5" /></button>
            </div>
        )}
        {isPickerOpen && !isBlocked && (
          <div className="mt-4 bg-zinc-900 rounded-[30px] border border-white/5 overflow-hidden animate-in slide-in-from-bottom-4">
            <div className="flex border-b border-white/5 bg-white/5">
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
                  {ANIME_STICKERS.map((s, i) => <img key={i} src={s} onClick={() => sendMsg(s, 'sticker')} className="w-full aspect-square object-contain cursor-pointer active:scale-95 transition" alt="s" />)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 🔴 DETAILS SUB-VIEW */}
      <div className={`sub-view fixed inset-0 bg-black z-[200] transition-transform duration-500 flex flex-col ${showInfo ? 'translate-x-0' : 'translate-x-full'}`}>
        <header className="p-6 border-b border-white/5 flex items-center gap-4 pt-safe bg-zinc-950">
          <button onClick={() => setShowInfo(false)} className="p-2 bg-zinc-900 rounded-full active:scale-90 transition"><ArrowLeft className="w-5 h-5"/></button>
          <h2 className="font-black italic text-lg text-white uppercase tracking-tight">Sync Info</h2>
        </header>
        <div className="flex-1 overflow-y-auto p-6 pb-10">
          <div className="flex flex-col items-center mb-10 text-center">
            <img src={chatData.chatAvatar} className="w-28 h-28 rounded-[35px] object-cover mb-4 border border-white/10 shadow-2xl" />
            <h2 className="text-2xl font-black italic">{chatData.chatName}</h2>
          </div>
          <div className="space-y-2">
             <ActionBtn icon={<MapPin className={`w-5 h-5 ${isPinned ? 'text-red-500 fill-red-500' : 'text-zinc-500'}`} />} label={isPinned ? "Unpin Chat" : "Pin to Top"} onClick={async () => {
               await updateDoc(doc(db, "chats", id), { pinnedBy: isPinned ? arrayRemove(user.uid) : arrayUnion(user.uid) });
             }} />
             {!chatData.isGroup && <ActionBtn icon={<Slash className={`w-5 h-5 ${isBlocked ? 'text-green-500' : 'text-red-500'}`} />} label={isBlocked ? "Unblock User" : "Block User"} onClick={async () => {
               await updateDoc(doc(db, "users", user.uid), { blockedUids: isBlocked ? arrayRemove(otherUid) : arrayUnion(otherUid) });
             }} />}
          </div>
          <div className="mt-10">
            <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-4 px-2">Synced Members</h4>
            <div className="space-y-3">
              {participants.map(p => (
                <div key={p.uid} className="flex items-center justify-between bg-zinc-900/50 p-4 rounded-3xl border border-white/5" onClick={() => router.push(`/user/${p.uid}`)}>
                   <div className="flex items-center gap-3"><img src={p.photoURL} className="w-10 h-10 rounded-2xl object-cover" alt="p" /><p className="text-sm font-bold">@{p.username}</p></div>
                   {p.isPremium && <VerifiedBadge className="w-3 h-3" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 🟠 CONTEXT MENU */}
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

// --- HELPERS ---
function ActionBtn({ icon, label, onClick }: any) {
  return (
    <button onClick={onClick} className="w-full p-4 bg-zinc-900/50 border border-white/5 rounded-3xl flex items-center justify-between active:scale-[0.98] transition">
       <div className="flex items-center gap-4 font-bold text-sm text-zinc-200">{icon} {label}</div>
       <ChevronRight className="w-4 h-4 text-zinc-700" />
    </button>
  );
}

function LinkPreview({ text, isMe }: { text: string, isMe: boolean }) {
  const [video, setVideo] = useState<Wallpaper | null>(null);
  const videoId = text.split('/watch/')[1]?.split(' ')[0];
  useEffect(() => {
    if (videoId) getDoc(doc(db, "wallpapers", videoId)).then(snap => snap.exists() && setVideo(snap.data() as Wallpaper));
  }, [videoId]);
  if (!video) return null;

  return (
    <Link href={`/watch/${videoId}`} className={`mt-3 block overflow-hidden rounded-2xl border ${isMe ? 'border-white/20' : 'border-white/10'} bg-black group w-44 aspect-[9/16] relative shadow-2xl`}>
      <video src={`${video.url}#t=0.1`} className="w-full h-full object-cover opacity-60" muted playsInline />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
          <Play className="w-4 h-4 fill-white text-white" />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black via-black/80 to-transparent">
        <p className="text-[11px] font-bold text-white truncate">{video.title}</p>
      </div>
    </Link>
  );
}