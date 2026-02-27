// app/auth/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup, 
  sendPasswordResetEmail 
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { X, Info } from "lucide-react";

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "error" | "success" } | null>(null);

  const showToast = (msg: string, type: "error" | "success" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAuth = async () => {
    if (!email || !password) return showToast("Fill all fields", "error");
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const uname = "otaku" + Math.floor(100000 + Math.random() * 900000);
        await setDoc(doc(db, "users", cred.user.uid), {
          uid: cred.user.uid,
          username: uname,
          email,
          photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${uname}`,
          createdAt: serverTimestamp(),
        });
      }
      router.push("/");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const userRef = doc(db, "users", result.user.uid);
      const docSnap = await getDoc(userRef);
      if (!docSnap.exists()) {
        await setDoc(userRef, {
          uid: result.user.uid,
          username: "otaku" + Math.floor(100000 + Math.random() * 900000),
          email: result.user.email,
          photoURL: result.user.photoURL,
          createdAt: serverTimestamp(),
        });
      }
      router.push("/");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  return (
    <main className="max-w-md mx-auto px-6 pt-20">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-20 right-0 p-4 rounded-l-lg shadow-lg flex items-center gap-2 z-50 ${toast.type === 'error' ? 'bg-zinc-900 border-l-4 border-red-500' : 'bg-zinc-900 border-l-4 border-green-500'}`}>
          <Info className="w-4 h-4" />
          <span className="font-bold text-sm">{toast.msg}</span>
        </div>
      )}

      <header className="fixed top-0 left-0 right-0 h-[60px] bg-black/90 backdrop-blur-md border-b border-zinc-900 flex items-center justify-between px-4 z-40">
        <h1 className="text-2xl font-black tracking-tighter"><span className="text-red-600">OTAKU</span>WALL</h1>
        <button onClick={() => router.push("/")} className="text-zinc-400 p-2"><X /></button>
      </header>

      <div className="flex justify-center gap-12 mb-10 mt-4 border-b border-zinc-900">
        <button onClick={() => setIsLogin(true)} className={`pb-2 font-bold ${isLogin ? 'text-white border-b-2 border-red-500' : 'text-zinc-500'}`}>Login</button>
        <button onClick={() => setIsLogin(false)} className={`pb-2 font-bold ${!isLogin ? 'text-white border-b-2 border-red-500' : 'text-zinc-500'}`}>Sign Up</button>
      </div>

      <button onClick={signInWithGoogle} className="w-full flex items-center justify-center gap-3 bg-white text-black py-4 rounded-xl font-bold mb-6 active:scale-95 transition">
        Continue with Google
      </button>

      <div className="flex items-center my-6"><div className="flex-1 h-[1px] bg-zinc-800"></div><span className="px-4 text-xs text-zinc-500 font-bold">OR</span><div className="flex-1 h-[1px] bg-zinc-800"></div></div>

      <div className="space-y-4">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email Address" className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl outline-none focus:border-red-500 transition" />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl outline-none focus:border-red-500 transition" />
        
        {isLogin && <div className="text-right"><button onClick={() => sendPasswordResetEmail(auth, email).then(() => showToast("Reset email sent"))} className="text-xs text-zinc-500 font-bold hover:text-red-500">Forgot password?</button></div>}
        
        <button onClick={handleAuth} disabled={loading} className="w-full bg-red-600 py-4 rounded-xl font-bold text-lg active:scale-95 transition disabled:opacity-50">
          {loading ? "Processing..." : isLogin ? "Login" : "Create Account"}
        </button>
      </div>
    </main>
  );
}