"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { 
  X, RefreshCw, Zap, Smile, ImageIcon, ChevronLeft, 
  ArrowLeft, Type, Volume2, VolumeX, Trash2 
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
  
  // Editor Tools
  const [activeFilter, setActiveFilter] = useState("none");
  const [overlayText, setOverlayText] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const startStream = async () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      try {
        const s = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } }, 
          audio: true 
        });
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch (err) { console.error("Camera Error", err); }
    };
    if (view === 'camera') startStream();
    return () => stream?.getTracks().forEach(t => t.stop());
  }, [view, facingMode, user]);

  useEffect(() => {
    let int: any;
    if (isRecording) int = setInterval(() => setRecTime(p => p + 1), 1000);
    return () => clearInterval(int);
  }, [isRecording]);

  const capturePhoto = () => {
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
  };

  const startVideo = () => {
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
  };

  const stopVideo = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); };

  const handleShutter = () => {
    if (mode === 'wallpaper') return capturePhoto();
    if (mode === 'shorts') return isRecording ? stopVideo() : startVideo();
    capturePhoto(); 
  };

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
        isLive: false,
        userId: user.uid,
        username: userData.username,
        createdAt: serverTimestamp(),
        likes: [],
        views: 0,
        filter: activeFilter
      });
      router.push('/');
    } catch (e) { alert("Upload Error"); setUploading(false); }
  };

  return (
    <main className="h-screen w-screen bg-black text-white overflow-hidden relative">
      
      {/* 🟢 VIEW 1: CAMERA */}
      {view === 'camera' && (
        <div className="h-full w-full relative animate-in fade-in">
          <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${facingMode === 'user' ? 'transform -scale-x-100' : ''}`} />
          
          {/* Top Controls */}
          <div className="absolute top-0 w-full p-6 flex justify-between items-center z-50 pt-safe">
            <button onClick={() => router.back()} className="p-2 bg-black/20 backdrop-blur-md rounded-full active:scale-90 transition"><X/></button>
            {isRecording && <div className="bg-red-600 px-4 py-1.5 rounded-full font-black text-[10px] animate-pulse">00:{String(recTime).padStart(2, '0')}</div>}
            <button onClick={() => setFacingMode(f => f === "user" ? "environment" : "user")} className="p-2 bg-black/20 backdrop-blur-md rounded-full active:rotate-180 transition-all duration-500"><RefreshCw/></button>
          </div>

          {/* Elevated Shutter & Tabs Area */}
          <div className="absolute bottom-0 w-full h-80 bg-gradient-to-t from-black/95 via-black/40 to-transparent flex flex-col items-center justify-end pb-16 px-6">
            
            {/* Action Row */}
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

                <button className="flex flex-col items-center gap-1.5 opacity-60 active:scale-90 transition">
                    <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center border border-white/10 shadow-lg"><Zap className="w-6 h-6"/></div>
                    <span className="text-[10px] font-black uppercase tracking-tighter text-zinc-400">Flash</span>
                </button>
            </div>

            {/* ⬆️ RAISED MODE TABS */}
            <div className="flex gap-10 text-[12px] font-black uppercase tracking-[2px] mb-4">
                <button onClick={() => setMode('story')} className={`transition-all ${mode === 'story' ? 'text-white border-b-2 border-red-600 pb-1' : 'text-zinc-600'}`}>Story</button>
                <button onClick={() => setMode('shorts')} className={`transition-all ${mode === 'shorts' ? 'text-white border-b-2 border-red-600 pb-1' : 'text-zinc-600'}`}>Shorts</button>
                <button onClick={() => setMode('wallpaper')} className={`transition-all ${mode === 'wallpaper' ? 'text-white border-b-2 border-red-600 pb-1' : 'text-zinc-600'}`}>Walls</button>
            </div>
          </div>
        </div>
      )}

      {/* 🔵 VIEW 2: STUDIO EDITOR */}
      {view === 'studio' && (
        <div className="h-full w-full flex flex-col bg-zinc-950 animate-in slide-in-from-right duration-500">
           <header className="p-5 flex justify-between items-center bg-black border-b border-white/5 pt-safe shadow-xl">
              <button onClick={() => setView('camera')} className="p-2 bg-zinc-900 rounded-full active:scale-90 transition"><ChevronLeft/></button>
              <h3 className="font-black italic text-red-500 tracking-tighter">OTAKU STUDIO</h3>
              <button onClick={() => setView('post')} className="bg-red-600 px-6 py-2 rounded-xl font-black text-xs shadow-lg active:scale-95 transition">NEXT</button>
           </header>
           
           <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
              {mediaBlob?.type.startsWith('video') ? (
                <video src={previewUrl!} autoPlay loop playsInline muted={isMuted} className="w-full h-full object-contain" style={{ filter: activeFilter }} />
              ) : (
                <img src={previewUrl!} className="w-full h-full object-contain" style={{ filter: activeFilter }} alt="preview" />
              )}
              {overlayText && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="bg-red-600 px-6 py-3 rounded-2xl font-black text-2xl shadow-2xl animate-pulse uppercase tracking-tighter">
                    {overlayText}
                  </span>
                </div>
              )}
           </div>

           <div className="bg-black p-6 flex justify-around border-t border-white/5 pb-16">
              <StudioTool icon={<Smile/>} label="Filter" onClick={() => setActiveFilter(activeFilter === 'none' ? 'grayscale(1)' : 'none')} />
              <StudioTool icon={<Type/>} label="Text" onClick={() => setOverlayText(prompt("Add Caption Overlay:") || "")} />
              {mediaBlob?.type.startsWith('video') && (
                <StudioTool icon={isMuted ? <VolumeX/> : <Volume2/>} label="Audio" onClick={() => setIsMuted(!isMuted)} />
              )}
              <StudioTool icon={<Trash2 className="text-red-500"/>} label="Reset" onClick={() => { setView('camera'); setOverlayText(""); setActiveFilter("none"); }} />
           </div>
        </div>
      )}

      {/* 🟡 VIEW 3: FINAL PUBLISH */}
      {view === 'post' && (
        <div className="h-full w-full bg-black flex flex-col animate-in slide-in-from-bottom duration-500">
           <header className="p-5 border-b border-white/5 pt-safe flex items-center gap-4 bg-zinc-950 shadow-xl">
              <button onClick={() => setView('studio')} className="p-2 bg-zinc-900 rounded-full active:scale-90 transition"><ArrowLeft/></button>
              <h3 className="font-black italic text-lg tracking-tighter uppercase">Final Sync</h3>
           </header>
           
           <div className="p-8 flex gap-6">
              <div className="w-28 h-40 bg-zinc-900 rounded-[30px] overflow-hidden border border-white/10 shrink-0 shadow-2xl">
                 {mediaBlob?.type.startsWith('video') ? (
                    <video src={previewUrl!} className="w-full h-full object-cover opacity-50" />
                 ) : (
                    <img src={previewUrl!} className="w-full h-full object-cover opacity-50" alt="thumb" />
                 )}
              </div>
              <textarea 
                placeholder="Write a sync caption... #anime #otakuwall" 
                value={caption} 
                onChange={(e) => setCaption(e.target.value)} 
                className="flex-1 bg-transparent border-none outline-none text-sm resize-none pt-2 font-bold placeholder:text-zinc-700" 
              />
           </div>

           <div className="mt-auto p-6 pb-12 flex gap-4 bg-zinc-950 border-t border-white/5">
              <button onClick={() => router.push('/')} className="flex-1 py-5 bg-zinc-900 rounded-[24px] font-black text-xs uppercase border border-white/5 active:scale-95 transition">Discard</button>
              <button 
                onClick={handleFinalPublish} 
                disabled={uploading} 
                className="flex-[2] py-5 bg-red-600 rounded-[24px] font-black text-xs uppercase shadow-xl shadow-red-900/40 active:scale-95 transition disabled:opacity-50"
              >
                {uploading ? 'Processing Sync...' : 'Publish to Feed'}
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