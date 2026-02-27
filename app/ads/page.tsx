"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePaystackPayment } from "react-paystack";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { 
  ArrowLeft, UploadCloud, Smartphone, Globe, 
  X, AlertCircle, CheckCircle2, Video 
} from "lucide-react";

type AdType = 'website' | 'app';

export default function CreateAdPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  // Form State
  const [adType, setAdType] = useState<AdType>('website');
  const [link, setLink] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [duration, setDuration] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Processing State
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("0%");
  const [toast, setToast] = useState<{msg: string, err?: boolean} | null>(null);

  const PRICE_PER_DAY = 1500; // Naira
  const totalAmount = duration * PRICE_PER_DAY;

  // Paystack Config (One-Time Payment)
  const config = {
    reference: (new Date()).getTime().toString(),
    email: user?.email || "",
    amount: totalAmount * 100, // Kobo
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "",
  };

  const initializePayment = usePaystackPayment(config);

  const showToast = (msg: string, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.size > 70 * 1024 * 1024) return showToast("File too large (Max 70MB)", true);
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
    }
  };

  const handlePublish = async (reference: any) => {
    if (!user || !file) return;
    setUploading(true);
    setUploadProgress("Start");

    try {
      // 1. Upload Video to Cloudinary
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);

      // Use XMLHttpRequest for progress tracking (fetch doesn't support upload progress easily)
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/video/upload`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const p = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(`${p}%`);
        }
      };

      xhr.onload = async () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          setUploadProgress("Saving...");
          
          // 2. Save to Firestore
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + duration);

          await addDoc(collection(db, "ads"), {
            userId: user.uid,
            videoUrl: data.secure_url,
            link,
            title,
            description: desc,
            type: adType,
            createdAt: serverTimestamp(),
            expiryDate: expiryDate,
            daysPaid: duration,
            paymentRef: reference.reference,
            amountPaid: totalAmount,
            views: 0,
            clicks: 0,
            active: true
          });

          showToast("Ad Published Successfully!");
          setTimeout(() => router.push('/'), 1500);
        } else {
          throw new Error("Upload failed");
        }
      };

      xhr.onerror = () => { throw new Error("Network error"); };
      xhr.send(formData);

    } catch (e) {
      setUploading(false);
      showToast("Publishing Failed. Contact Support.", true);
    }
  };

  const triggerPayment = () => {
    if (!link || !title || !desc) return showToast("Please fill all fields", true);
    if (!file) return showToast("Please upload a video", true);
    
    initializePayment(handlePublish, () => showToast("Payment Cancelled", true));
  };

  return (
    <main className="min-h-screen bg-black text-white pb-32 relative">
      
      {/* Toast */}
      {toast && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full font-bold text-sm shadow-2xl z-50 animate-in slide-in-from-top-4 border-l-4 ${toast.err ? 'bg-zinc-900 border-yellow-500 text-yellow-500' : 'bg-zinc-900 border-green-500 text-green-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="fixed top-0 w-full p-4 z-40 flex items-center gap-4 bg-black/90 backdrop-blur-md border-b border-white/5">
        <button onClick={() => router.back()}><ArrowLeft className="w-6 h-6 text-zinc-400" /></button>
        <h1 className="font-black italic text-lg tracking-wide">Create Ad</h1>
      </header>

      <div className="pt-24 px-6 max-w-lg mx-auto space-y-8">
        
        {/* Ad Type Selector */}
        <div>
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 block">Target Destination</label>
          <div className="flex bg-zinc-900 p-1 rounded-2xl border border-white/5">
            <button 
              onClick={() => setAdType('website')}
              className={`flex-1 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${adType === 'website' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500'}`}
            >
              <Globe className="w-4 h-4" /> Website
            </button>
            <button 
              onClick={() => setAdType('app')}
              className={`flex-1 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${adType === 'app' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500'}`}
            >
              <Smartphone className="w-4 h-4" /> App
            </button>
          </div>
        </div>

        {/* Input Fields */}
        <div className="space-y-5">
          <div>
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">
              {adType === 'website' ? 'Website URL' : 'Play Store / App Store Link'}
            </label>
            <input 
              type="url" 
              value={link}
              onChange={e => setLink(e.target.value)}
              placeholder="https://..." 
              className="w-full bg-zinc-900 border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-red-600 transition font-bold text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Ad Title</label>
            <input 
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={30}
              placeholder="e.g. Play the new RPG!" 
              className="w-full bg-zinc-900 border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-red-600 transition font-bold text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Short Description</label>
            <input 
              type="text" 
              value={desc}
              onChange={e => setDesc(e.target.value)}
              maxLength={50}
              placeholder="Brief tagline..." 
              className="w-full bg-zinc-900 border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-red-600 transition font-bold text-sm"
            />
          </div>
        </div>

        {/* Video Upload Area */}
        <div>
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Video Creative (9:16)</label>
          <label className={`relative block w-full aspect-[16/9] rounded-3xl border-2 border-dashed transition-all overflow-hidden cursor-pointer group ${file ? 'border-red-600/50 bg-black' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-600'}`}>
            <input type="file" hidden accept="video/mp4,video/webm" onChange={handleFileSelect} />
            
            {previewUrl ? (
              <video src={previewUrl} className="w-full h-full object-cover" autoPlay muted loop playsInline />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 group-hover:text-zinc-300 transition">
                <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mb-3">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wide">Tap to upload video</span>
              </div>
            )}

            {file && (
              <button 
                onClick={(e) => { e.preventDefault(); setFile(null); setPreviewUrl(null); }}
                className="absolute top-2 right-2 bg-black/60 text-white p-2 rounded-full backdrop-blur-md"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </label>
        </div>

        {/* Budget Slider */}
        <div className="bg-zinc-900/50 p-6 rounded-3xl border border-white/5">
          <div className="flex justify-between items-end mb-4">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Duration</label>
            <div className="text-right">
              <span className="text-3xl font-black text-white">{duration}</span>
              <span className="text-xs font-bold text-zinc-500 uppercase ml-1">Days</span>
            </div>
          </div>
          <input 
            type="range" 
            min="1" 
            max="30" 
            value={duration} 
            onChange={(e) => setDuration(parseInt(e.target.value))}
            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-600"
          />
          <div className="flex justify-between mt-3 text-[10px] font-bold text-zinc-600 uppercase">
            <span>1 Day</span>
            <span>30 Days</span>
          </div>
        </div>

        {/* Price Summary */}
        <div className="bg-gradient-to-br from-red-600/20 to-zinc-900 p-6 rounded-3xl border border-red-600/30">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-zinc-400">Rate per day</span>
            <span className="text-sm font-bold text-white">₦{PRICE_PER_DAY.toLocaleString()}</span>
          </div>
          <div className="h-px bg-white/10 my-3"></div>
          <div className="flex justify-between items-center">
            <span className="text-lg font-black italic text-white">Total Budget</span>
            <span className="text-2xl font-black text-red-500">₦{totalAmount.toLocaleString()}</span>
          </div>
        </div>

      </div>

      {/* Upload Overlay */}
      {uploading && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-6">
          <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-6"></div>
          <h2 className="text-2xl font-black italic mb-2">Publishing Ad...</h2>
          <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">{uploadProgress}</p>
          <p className="text-zinc-600 text-xs mt-8">Do not close this window</p>
        </div>
      )}

      {/* Sticky Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/90 to-transparent z-40">
        <button 
          onClick={triggerPayment}
          disabled={uploading}
          className="w-full bg-red-600 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-red-900/40 active:scale-95 transition flex justify-center items-center gap-2"
        >
          {uploading ? 'Processing...' : `Pay & Publish • ₦${totalAmount.toLocaleString()}`}
        </button>
      </div>

    </main>
  );
}