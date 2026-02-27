// app/upload/page.tsx
"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { 
  X, RefreshCw, Zap, Smile, Mic, Image as ImageIcon, 
  ChevronLeft, ArrowLeft 
} from "lucide-react";

type UploadMode = 'story' | 'video' | 'wallpaper';
type ViewState = 'camera' | 'editor' | 'post';

export default function UploadStudio() {
  const { user, userData } = useAuth();
  const router = useRouter();

  // State Management
  const [view, setView] = useState<ViewState>('camera');
  const [mode, setMode] = useState<UploadMode>('video');
  const[isRecording, setIsRecording] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Refs for Camera and Media
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement | HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const currentBlobRef = useRef<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Initialize Camera
  useEffect(() => {
    if (!user) {
      router.push('/auth');
      return;
    }

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "user" }, 
          audio: true 
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera access denied or unavailable", err);
        alert("Camera access is required to use the studio.");
      }
    };

    if (view === 'camera') {
      startCamera();
    }

    // Cleanup: Stop camera when leaving page or changing views
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [view, user, router]);

  // Recording Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecTime((prev) => {
          if (prev >= 60) {
            stopRecording(); // Auto-stop at 60s
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Capture Logic
  const handleShutter = () => {
    if (mode === 'wallpaper') {
      takePhoto();
    } else {
      if (isRecording) stopRecording();
      else startRecording();
    }
  };

  const takePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Mirror the image
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, 0, 0);
    
    canvas.toBlob((blob) => {
      if (blob) {
        currentBlobRef.current = blob;
        setPreviewUrl(URL.createObjectURL(blob));
        setView('editor');
      }
    }, 'image/jpeg', 0.9);
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current =[];
    try {
      mediaRecorderRef.current = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });
    } catch (e) {
      mediaRecorderRef.current = new MediaRecorder(streamRef.current);
    }

    mediaRecorderRef.current.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/mp4' });
      currentBlobRef.current = blob;
      setPreviewUrl(URL.createObjectURL(blob));
      setView('editor');
    };

    mediaRecorderRef.current.start();
    setRecTime(0);
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      currentBlobRef.current = file;
      setPreviewUrl(URL.createObjectURL(file));
      setView('editor');
    }
  };

  // Upload to Cloudinary & Firestore
  const handlePublish = async () => {
    if (!currentBlobRef.current || !user || !userData) return;
    setUploading(true);

    const isVideo = currentBlobRef.current.type.startsWith('video');
    const resourceType = isVideo ? 'video' : 'image';
    
    const formData = new FormData();
    formData.append('file', currentBlobRef.current);
    formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);

    try {
      // 1. Upload to Cloudinary
      const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (!data.secure_url) throw new Error("Cloudinary upload failed");

      // 2. Save to Firestore
      await addDoc(collection(db, "wallpapers"), {
        title: caption.trim() || "Otaku Creation",
        url: data.secure_url,
        fileType: resourceType,
        category: mode, // 'story', 'video', 'wallpaper'
        isStory: mode === 'story',
        userId: user.uid,
        username: userData.username,
        createdAt: serverTimestamp(),
        likes:[],
        views: 0
      });

      router.push('/');
    } catch (error) {
      console.error("Publish error:", error);
      alert("Failed to publish. Please try again.");
      setUploading(false);
    }
  };

  return (
    <div className="bg-black h-screen w-full text-white overflow-hidden relative">
      
      {/* ================= VIEW 1: CAMERA ================= */}
      <div className={`absolute inset-0 transition-transform duration-500 ${view === 'camera' ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Top Bar */}
        <div className="absolute top-0 w-full p-6 flex justify-between items-center z-50">
          <button onClick={() => router.back()}><X className="w-6 h-6" /></button>
          {isRecording && (
            <div className="bg-black/50 backdrop-blur-md px-4 py-1.5 rounded-full flex items-center gap-2">
              <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
              <span className="text-[10px] font-black tracking-widest">00:{String(recTime).padStart(2, '0')}</span>
            </div>
          )}
          <div className="w-6" /> {/* Spacer */}
        </div>

        {/* Camera Stream */}
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
        
        {/* Recording Progress Bar */}
        {isRecording && (
          <div className="absolute top-0 left-0 h-1 bg-red-600 z-50 transition-all duration-1000" style={{ width: `${(recTime / 60) * 100}%` }} />
        )}

        {/* Sidebar Tools */}
        <div className="absolute right-4 top-24 flex flex-col gap-5 z-40">
          <ToolButton icon={<RefreshCw />} label="Flip" />
          <ToolButton icon={<Zap />} label="Speed" />
          <ToolButton icon={<Smile />} label="Magic" />
          <ToolButton icon={<Mic />} label="Voice" />
        </div>

        {/* Bottom Shutter Area */}
        <div className="absolute bottom-0 w-full h-48 bg-gradient-to-t from-black/90 to-transparent flex flex-col items-center justify-end pb-8 z-40">
          <div className="flex items-center justify-center w-full relative mb-6">
            
            {/* Gallery Button */}
            <button onClick={() => fileInputRef.current?.click()} className="absolute left-10 flex flex-col items-center">
              <div className="w-10 h-10 rounded-xl border-2 border-white bg-zinc-800 flex items-center justify-center overflow-hidden">
                <ImageIcon className="w-5 h-5 text-white" />
              </div>
              <span className="text-[9px] font-bold mt-1 uppercase tracking-widest">Gallery</span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              hidden 
              accept={mode === 'wallpaper' ? 'image/*' : mode === 'video' ? 'video/*' : 'video/*,image/*'} 
              onChange={handleGallerySelect} 
            />

            {/* Shutter Button */}
            <button 
              onClick={handleShutter}
              className={`w-[75px] h-[75px] rounded-full border-4 border-white flex items-center justify-center transition-all ${isRecording ? 'p-4' : 'p-1'}`}
            >
              <div className={`bg-red-600 w-full h-full transition-all ${isRecording ? 'rounded-lg scale-75 animate-pulse' : 'rounded-full'}`} />
            </button>
          </div>

          {/* Mode Tabs */}
          <div className="flex gap-8 text-[11px] font-black uppercase tracking-widest">
            <ModeTab current={mode} target="story" onClick={() => setMode('story')} />
            <ModeTab current={mode} target="video" onClick={() => setMode('video')} />
            <ModeTab current={mode} target="wallpaper" onClick={() => setMode('wallpaper')} />
          </div>
        </div>
      </div>


      {/* ================= VIEW 2: EDITOR PREVIEW ================= */}
      <div className={`absolute inset-0 bg-zinc-950 transition-transform duration-500 z-50 flex flex-col ${view === 'editor' ? 'translate-x-0' : 'translate-x-full'}`}>
        <header className="p-5 flex justify-between items-center bg-black border-b border-white/5">
          <button onClick={() => { setView('camera'); setPreviewUrl(null); }}><ChevronLeft /></button>
          <h3 className="font-black italic text-red-500">STUDIO</h3>
          <button onClick={() => setView('post')} className="bg-red-600 px-6 py-2 rounded-xl font-black text-xs">NEXT</button>
        </header>
        
        <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
          {currentBlobRef.current?.type.startsWith('video') ? (
            <video src={previewUrl!} autoPlay loop playsInline className="w-full h-full object-contain" />
          ) : (
            <img src={previewUrl!} className="w-full h-full object-contain" />
          )}
        </div>
      </div>


      {/* ================= VIEW 3: PUBLISH POST ================= */}
      <div className={`absolute inset-0 bg-black transition-transform duration-500 z-50 flex flex-col ${view === 'post' ? 'translate-x-0' : 'translate-x-full'}`}>
        <header className="p-5 flex items-center gap-4 border-b border-white/5">
          <button onClick={() => setView('editor')}><ArrowLeft /></button>
          <h3 className="font-bold">New Post</h3>
        </header>

        <div className="p-6 flex-1">
          <div className="flex gap-4 mb-6">
            <div className="w-28 h-40 bg-zinc-900 rounded-2xl overflow-hidden border border-white/10 shrink-0">
              {currentBlobRef.current?.type.startsWith('video') ? (
                <video src={previewUrl!} className="w-full h-full object-cover opacity-80" />
              ) : (
                <img src={previewUrl!} className="w-full h-full object-cover opacity-80" />
              )}
            </div>
            <textarea 
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write a caption... #anime" 
              className="flex-1 bg-transparent border-none outline-none text-sm resize-none h-40 font-medium"
            />
          </div>
        </div>

        <div className="p-6 pb-10 flex gap-3 bg-zinc-950 border-t border-white/5">
          <button className="flex-1 bg-zinc-900 py-4 rounded-2xl font-black text-sm border border-white/5">DRAFT</button>
          <button 
            onClick={handlePublish}
            disabled={uploading}
            className="flex-[2] bg-red-600 py-4 rounded-2xl font-black text-sm shadow-xl shadow-red-600/20 active:scale-95 transition disabled:opacity-50"
          >
            {uploading ? 'PUBLISHING...' : 'PUBLISH'}
          </button>
        </div>
      </div>

    </div>
  );
}

// Helper Components
function ToolButton({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 cursor-pointer opacity-80 active:scale-90 transition">
      <div className="w-11 h-11 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10">
        {icon}
      </div>
      <span className="text-[9px] font-bold text-shadow-md">{label}</span>
    </div>
  );
}

function ModeTab({ current, target, onClick }: { current: string, target: string, onClick: () => void }) {
  const isActive = current === target;
  return (
    <div 
      onClick={onClick}
      className={`cursor-pointer transition-all ${isActive ? 'opacity-100 border-b-2 border-white pb-1' : 'opacity-40 pb-1.5'}`}
    >
      {target}
    </div>
  );
}