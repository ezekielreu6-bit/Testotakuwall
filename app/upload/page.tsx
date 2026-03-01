"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { 
  X, RefreshCw, Zap, Smile, ImageIcon, ChevronLeft, 
  ArrowLeft, Type, Volume2, VolumeX, Trash2, Check
} from "lucide-react";

type UploadMode = 'story' | 'wallpaper' | 'shorts';
type ViewState = 'camera' | 'studio' | 'post';

export default function UploadStudio() {
  const { user, userData } = useAuth();
  const router = useRouter();

  // Navigation & Mode
  const [view, setView] = useState<ViewState>('camera');
  const [mode, setMode] = useState<UploadMode>('shorts');
  
  // Hardware
  const [isRecording, setIsRecording] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [recTime, setRecTime] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Media
  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // 🎨 CUSTOM STUDIO TOOLS STATE
  const [activeFilter, setActiveFilter] = useState("none");
  const [isMuted, setIsMuted] = useState(false);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  // 📝 TEXT OVERLAY ENGINE
  const [isEditingText, setIsEditingText] = useState(false);
  const [tempText, setTempText] = useState("");
  const [overlayText, setOverlayText] = useState("");
  const [textPos, setTextPos] = useState({ x: 50, y: 50 }); // Percentage based
  const isDragging = useRef(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const studioPreviewRef = useRef<HTMLDivElement>(null);

  // 1. Camera Logic
  useEffect(() => {
    if (!user) return;
    const startStream = async () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      try {
        const s = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode, width: { ideal: 1080 }, height: { ideal: 1920 } }, 
          audio: true 
        });
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch (err) { console.error("Camera Error"); }
    };
    if (view === 'camera') startStream();
    return () => stream?.getTracks().forEach(t => t.stop());
  }, [view, facingMode, user]);

  useEffect(() => {
    let int: any;
    if (isRecording) int = setInterval(() => setRecTime(p => p + 1), 1000);
    return () => clearInterval(int);
  }, [isRecording]);

  // 2. Drag & Drop Logic
  const handleDrag = (e: React.PointerEvent) => {
    if (!isDragging.current || !studioPreviewRef.current) return;
    const rect = studioPreviewRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setTextPos({ x: Math.max(10, Math.min(90, x)), y: Math.max(10, Math.min(90, y)) });
  };

  // 3. Capturing Logic
  const handleShutter = () => {
    if (mode === 'wallpaper') {
      if (!videoRef.current) return;
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      if (facingMode === "user") { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob((b) => {
        if (b) { setMediaBlob(b); setPreviewUrl(URL.createObjectURL(b)); setView('studio'); }
      }, "image/jpeg", 0.9);
    } else {
      if (isRecording) {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
      } else {
        if (!stream) return;
        chunksRef.current = [];
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
        recorder.onstop = () => {
          const b = new Blob(chunksRef.current, { type: 'video/mp4' });
          setMediaBlob(b); setPreviewUrl(URL.createObjectURL(b)); setView('studio');
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
      }
    }
  };

  // 4. SMART REDIRECT PUBLISH
  const handleFinalPublish = async () => {
    if (!mediaBlob || !user || !userData) return;
    setUploading(true);
    const isVideo = mediaBlob.type.startsWith('video');
    const formData = new FormData();
    formData.append("file", mediaBlob);
    formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/${isVideo ? 'video' : 'image'}/upload`, {
        method: "POST", body: formData
      });
      const data = await res.json();

      await addDoc(collection(db, "wallpapers"), {
        title: caption || "New Sync",
        url: data.secure_url,
        fileType: isVideo ? 'video' : 'image',
        category: mode,
        isStory: mode === 'story',
        userId: user.uid,
        username: userData.username,
        createdAt: serverTimestamp(),
        likes: [],
        views: 0,
        filter: activeFilter,
        overlayText,
        textX: textPos.x,
        textY: textPos.y
      });

      // 🔀 SMART REDIRECTS
      if (mode === 'story') router.push('/inbox');
      else if (mode === 'wallpaper') router.push('/category');
      else router.push('/'); // Shorts go to main feed

    } catch (e) {
      alert("Upload Error");
      setUploading(false);
    }
  };

  return (
    <main className="h-screen w-screen bg-black text-white overflow-hidden relative">
      
      {/* 🟢 VIEW 1: CAMERA */}
      {view === 'camera' && (
        <div className="h-full w-full relative animate-in fade-in">
          <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${facingMode === 'user' ? 'transform -scale-x-100' : ''}`} />
          
          <div className="absolute top-0 w-full p-6 flex justify-between items-center z-50 pt-safe">
            <button onClick={() => router.back()} className="p-2 bg-black/20 backdrop-blur-md rounded-full active:scale-90 transition"><X/></button>
            {isRecording && <div className="bg-red-600 px-4 py-1.5 rounded-full font-black text-[10px] animate-pulse uppercase tracking-widest">Recording</div>}
            <button onClick={() => setFacingMode(f => f === "user" ? "environment" : "user")} className="p-2 bg-black/20 backdrop-blur-md rounded-full active:rotate-180 transition-all duration-500"><RefreshCw/></button>
          </div>

          <div className="absolute bottom-0 w-full h-80 bg-gradient-to-t from-black/95 via-black/40 to-transparent flex flex-col items-center justify-end pb-16 px-6">
            <div className="flex items-center justify-between w-full mb-12">
                <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-1.5 active:scale-90 transition">
                    <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center border border-white/10 shadow-lg"><ImageIcon className="w-6 h-6"/></div>
                    <span className="text-[10px] font-black uppercase tracking-tighter text-zinc-400">Gallery</span>
                </button>
                <input type="file" ref={fileInputRef} hidden onChange={(e) => {
                   const f = e.target.files?.[0];
                   if(f) { setMediaBlob(f); setPreviewUrl(URL.createObjectURL(f)); setView('studio'); }
                }} />
                <button onClick={handleShutter} className={`w-20 h-20 rounded-full border-4 border-white p-1 transition-all ${isRecording ? 'scale-110 border-red-600 shadow-[0_0_20px_rgba(239,68,68,0.5)]' : ''}`}>
                    <div className={`w-full h-full bg-red-600 transition-all duration-300 ${isRecording ? 'rounded-xl scale-50' : 'rounded-full'}`} />
                </button>
                <div className="w-12 text-center">
                    <div className="text-red-500 font-black text-xl">{recTime > 0 ? recTime : ""}</div>
                </div>
            </div>

            <div className="flex gap-10 text-[12px] font-black uppercase tracking-[2px] mb-4">
                <button onClick={() => setMode('story')} className={`transition-all ${mode === 'story' ? 'text-white border-b-2 border-red-600 pb-1' : 'text-zinc-600'}`}>Story</button>
                <button onClick={() => setMode('shorts')} className={`transition-all ${mode === 'shorts' ? 'text-white border-b-2 border-red-600 pb-1' : 'text-zinc-600'}`}>Shorts</button>
                <button onClick={() => setMode('wallpaper')} className={`transition-all ${mode === 'wallpaper' ? 'text-white border-b-2 border-red-600 pb-1' : 'text-zinc-600'}`}>Walls</button>
            </div>
          </div>
        </div>
      )}

      {/* 🔵 VIEW 2: STUDIO EDITOR (Custom Text & Drag) */}
      {view === 'studio' && (
        <div className="h-full w-full flex flex-col bg-zinc-950 animate-in slide-in-from-right duration-500">
           <header className="p-5 flex justify-between items-center bg-black border-b border-white/5 pt-safe shadow-xl">
              <button onClick={() => { setView('camera'); setOverlayText(""); }} className="p-2 bg-zinc-900 rounded-full active:scale-90 transition"><ChevronLeft/></button>
              <h3 className="font-black italic text-red-500 tracking-tighter">OTAKU STUDIO</h3>
              <button onClick={() => setView('post')} className="bg-red-600 px-6 py-2 rounded-xl font-black text-xs shadow-lg active:scale-95 transition">NEXT</button>
           </header>
           
           {/* Draggable Work Area */}
           <div 
             ref={studioPreviewRef}
             className="flex-1 relative flex items-center justify-center overflow-hidden bg-black touch-none"
             onPointerMove={handleDrag}
             onPointerUp={() => isDragging.current = false}
           >
              {mediaBlob?.type.startsWith('video') ? (
                <video src={previewUrl!} autoPlay loop playsInline muted={isMuted} className="w-full h-full object-contain pointer-events-none" style={{ filter: activeFilter }} />
              ) : (
                <img src={previewUrl!} className="w-full h-full object-contain pointer-events-none" style={{ filter: activeFilter }} alt="preview" />
              )}
              
              {overlayText && (
                <span 
                  onPointerDown={() => isDragging.current = true}
                  style={{ left: `${textPos.x}%`, top: `${textPos.y}%`, transform: 'translate(-50%, -50%)' }}
                  className="absolute bg-red-600 px-5 py-2.5 rounded-2xl font-black text-xl shadow-2xl uppercase tracking-tighter whitespace-nowrap cursor-move active:scale-110 transition-transform"
                >
                  {overlayText}
                </span>
              )}
           </div>

           <div className="bg-black p-6 flex justify-around border-t border-white/5 pb-16">
              <StudioTool icon={<Smile/>} label="Filter" onClick={() => setActiveFilter(activeFilter === 'none' ? 'grayscale(1)' : 'none')} />
              <StudioTool icon={<Type/>} label="Text" onClick={() => setIsEditingText(true)} />
              {mediaBlob?.type.startsWith('video') && (
                <StudioTool icon={isMuted ? <VolumeX/> : <Volume2/>} label="Audio" onClick={() => setIsMuted(!isMuted)} />
              )}
              <StudioTool icon={<Trash2 className="text-red-500"/>} label="Reset" onClick={() => setView('camera')} />
           </div>

           {/* 📝 CUSTOM TEXT MODAL (No Browser Popup) */}
           {isEditingText && (
             <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col p-8 animate-in fade-in">
                <div className="flex justify-between items-center mb-10">
                   <h2 className="font-black italic text-xl">Type Overlay</h2>
                   <button onClick={() => setIsEditingText(false)} className="p-2 bg-white/5 rounded-full"><X/></button>
                </div>
                <input 
                   autoFocus
                   type="text" 
                   value={tempText} 
                   onChange={(e) => setTempText(e.target.value)}
                   className="w-full bg-zinc-900 border border-white/10 p-6 rounded-3xl text-2xl font-black text-center outline-none focus:border-red-600 transition-colors"
                   placeholder="YOUR TEXT HERE..."
                />
                <button 
                  onClick={() => { setOverlayText(tempText); setIsEditingText(false); }}
                  className="mt-8 w-full bg-red-600 py-5 rounded-3xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition"
                >
                  Apply Text
                </button>
             </div>
           )}
        </div>
      )}

      {/* 🟡 VIEW 3: FINAL POST */}
      {view === 'post' && (
        <div className="h-full w-full bg-black flex flex-col animate-in slide-in-from-bottom duration-500">
           <header className="p-5 border-b border-white/5 pt-safe flex items-center gap-4 bg-zinc-950">
              <button onClick={() => setView('studio')} className="p-2 bg-zinc-900 rounded-full active:scale-90 transition"><ArrowLeft/></button>
              <h3 className="font-black italic text-lg tracking-tighter uppercase">Final Sync</h3>
           </header>
           
           <div className="p-8 flex gap-6">
              <div className="w-28 h-40 bg-zinc-900 rounded-[30px] overflow-hidden border border-white/10 shrink-0 shadow-2xl">
                 {mediaBlob?.type.startsWith('video') ? <video src={previewUrl!} className="w-full h-full object-cover opacity-50" /> : <img src={previewUrl!} className="w-full h-full object-cover opacity-50" alt="thumb" />}
              </div>
              <textarea 
                placeholder="Write a sync caption..." 
                value={caption} 
                onChange={(e) => setCaption(e.target.value)} 
                className="flex-1 bg-transparent border-none outline-none text-sm resize-none pt-2 font-bold" 
              />
           </div>

           <div className="mt-auto p-6 pb-12 flex gap-4 bg-zinc-950 border-t border-white/5">
              <button onClick={() => router.push('/')} className="flex-1 py-5 bg-zinc-900 rounded-[24px] font-black text-xs uppercase active:scale-95 transition">Discard</button>
              <button 
                onClick={handleFinalPublish} 
                disabled={uploading} 
                className="flex-[2] py-5 bg-red-600 rounded-[24px] font-black text-xs uppercase shadow-xl active:scale-95 transition disabled:opacity-50"
              >
                {uploading ? 'Synching...' : `Publish ${mode}`}
              </button>
           </div>
        </div>
      )}
    </main>
  );
}

function StudioTool({ icon, label, onClick }: any) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 active:scale-90 transition group">
        <div className="w-14 h-14 bg-zinc-900 rounded-[20px] flex items-center justify-center text-zinc-400 border border-white/5 group-hover:text-white transition-colors">
            {icon}
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{label}</span>
    </button>
  );
}