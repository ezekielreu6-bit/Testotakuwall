"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { 
  collection, doc, onSnapshot, query, orderBy, 
  addDoc, updateDoc, serverTimestamp 
} from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { ArrowLeft, MoreVertical, Send, Smile } from "lucide-react";
import { Chat, Message } from "@/types";

export default function ChatRoom() {
  const { id } = useParams() as { id: string };
  const { user } = useAuth();
  const router = useRouter();
  
  const [chatData, setChatData] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Listen to Chat Metadata
  useEffect(() => {
    if (!id || !user) return;
    const unsubChat = onSnapshot(doc(db, "chats", id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // FIX: Spread the data first, then assign the ID to avoid double-key error
        setChatData({ ...data, id: docSnap.id } as Chat);

        // Reset unread count for current user
        if (data.unread?.[user.uid] && data.unread[user.uid] > 0) {
          updateDoc(docSnap.ref, {
            [`unread.${user.uid}`]: 0
          });
        }
      }
    });
    return () => unsubChat();
  }, [id, user]);

  // 2. Listen to Messages
  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, `chats/${id}/messages`), orderBy("timestamp", "asc"));
    const unsubMsgs = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Message[];
      setMessages(msgs);
      // Scroll to bottom on new message
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return () => unsubMsgs();
  }, [id]);

  // 3. Send Message Function
  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = input.trim();
    if (!text || !user || !chatData) return;

    setInput(""); // Optimistic clear

    // Calculate new unread counts for other participants
    const newUnread = { ...chatData.unread };
    chatData.participants.forEach(p => {
      if (p !== user.uid) newUnread[p] = (newUnread[p] || 0) + 1;
    });

    try {
      // Add Message
      await addDoc(collection(db, `chats/${id}/messages`), {
        text,
        senderId: user.uid,
        timestamp: serverTimestamp(),
        type: 'text'
      });

      // Update Chat Metadata
      await updateDoc(doc(db, "chats", id), {
        lastMsg: text,
        lastActivity: serverTimestamp(),
        unread: newUnread
      });
    } catch (err) {
      console.error("Message send error:", err);
    }
  };

  if (!chatData || !user) return <div className="h-screen bg-black" />;

  return (
    <main className="flex flex-col h-screen bg-black">
      {/* Header */}
      <header className="p-4 border-b border-white/5 flex justify-between items-center bg-black/90 backdrop-blur-md z-40">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-white"><ArrowLeft /></button>
          <img src={chatData.chatAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${chatData.chatName}`} className="w-10 h-10 rounded-full border border-white/5 object-cover" alt="avatar" />
          <div>
            <h3 className="text-sm font-bold truncate max-w-[150px] text-white">{chatData.chatName}</h3>
            <div className="text-[10px] text-orange-400 font-black uppercase tracking-tighter">
              {chatData.syncCount && chatData.syncCount >= 3 ? `🔥 ${chatData.syncCount}` : "🔒 SECURE SYNC"}
            </div>
          </div>
        </div>
        <button className="text-zinc-500"><MoreVertical /></button>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 no-scrollbar">
        {messages.map((m) => {
          const isMe = m.senderId === user.uid;
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`relative px-4 py-3 rounded-2xl max-w-[80%] text-sm font-medium break-words ${
                isMe ? 'bg-red-600 text-white rounded-br-sm' : 'bg-zinc-800 text-zinc-200 rounded-bl-sm'
              }`}>
                {m.text}
                {m.reaction && (
                  <div className="absolute -bottom-2 -right-2 bg-zinc-900 border border-zinc-700 rounded-full px-1.5 py-0.5 text-[10px]">
                    {m.reaction}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-zinc-900/50 border-t border-white/5 pb-safe">
        <form onSubmit={sendMessage} className="flex items-center gap-3">
          <button type="button" className="text-zinc-500"><Smile className="w-6 h-6" /></button>
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Aa" 
            className="flex-1 bg-zinc-800 rounded-full px-5 py-3 text-sm outline-none border border-white/5 text-white font-bold"
          />
          <button 
            type="submit" 
            disabled={!input.trim()}
            className="bg-red-600 p-3 rounded-full text-white active:scale-90 transition disabled:opacity-50 disabled:active:scale-100"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </main>
  );
}