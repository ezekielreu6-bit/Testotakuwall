"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePaystackPayment } from "react-paystack";
import { auth, db } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { 
  ArrowLeft, Zap, Star, ChevronRight 
} from "lucide-react";

type PlanType = 'monthly' | 'yearly';

// Your Specific Red Tick Path
const rosettePath = "M22.5 12.5c0-1.58-.88-2.95-2.18-3.65.54-1.53.22-3.26-1.08-4.56s-3.03-1.62-4.56-1.08C13.98 1.91 12.61 1.03 11.03 1.03s-2.95.88-3.65 2.18c-1.53-.54-3.26-.22-4.56 1.08s-1.62 3.03-1.08 4.56C.41 10.02-.47 11.39-.47 12.97s.88 2.95 2.18 3.65c-.54 1.53-.22 3.26 1.08 4.56s3.03 1.62 4.56 1.08c.7 1.3 2.07 2.18 3.65 2.18s2.95-.88 3.65-2.18c1.53.54 3.26.22 4.56-1.08s1.62-3.03 1.08-4.56c1.3-.7 2.18-2.07 2.18-3.65zm-12.66 5.04l-4.25-4.25 1.41-1.41 2.84 2.84 6.76-6.76 1.41 1.41-8.17 8.17z";

export default function PremiumPage() {
  const { user, userData } = useAuth();
  const router = useRouter();
  
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('monthly');
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // PAYSTACK SUBSCRIPTION PLANS
  const PLANS = {
    monthly: { 
      code: 'PLN_ajnhis84ifn88hh', 
      price: '₦2,000', 
      label: 'Monthly', 
      amount: 200000 
    },
    yearly: { 
      code: 'PLN_fc0bgr4rzi3eily', 
      price: '₦20,000', 
      label: 'Yearly', 
      amount: 2000000,
      save: 'Save 17%' 
    }
  };

  const config = {
    reference: (new Date()).getTime().toString(),
    email: user?.email || "",
    plan: PLANS[selectedPlan].code,
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "",
  };

  const initializePayment = usePaystackPayment(config);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSuccess = async (reference: any) => {
    if (!user) return;
    setProcessing(true);
    showToast("Subscription Active! Updating Profile...");

    try {
      const expiryDate = new Date();
      if (selectedPlan === 'monthly') expiryDate.setDate(expiryDate.getDate() + 30);
      else expiryDate.setFullYear(expiryDate.getFullYear() + 1);

      await updateDoc(doc(db, "users", user.uid), {
        isPremium: true,
        premiumPlan: selectedPlan,
        paystackReference: reference.reference,
        premiumExpiry: expiryDate,
        updatedAt: serverTimestamp()
      });

      router.push('/profile');
    } catch (e) {
      showToast("Sync Error. Please contact support.");
    } finally {
      setProcessing(false);
    }
  };

  const handleSubscribe = () => {
    if (!user) return router.push('/auth');
    if (processing) return;
    
    if (userData?.isPremium) {
      showToast("You are already a Pro Member!");
      return;
    }

    // FIX: Cast to any to bypass strict TypeScript argument length check
    (initializePayment as any)(handleSuccess, () => showToast("Transaction Cancelled"));
  };

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden flex flex-col">
      
      <div className="absolute top-[-10%] left-[-20%] w-[500px] h-[500px] bg-red-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-white text-black px-6 py-3 rounded-full font-bold text-sm shadow-2xl z-50 animate-in slide-in-from-top-4">
          {toast}
        </div>
      )}

      <header className="fixed top-0 w-full p-4 z-40 flex justify-between items-center">
        <button 
          onClick={() => router.back()} 
          className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center active:scale-95 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-sm tracking-widest uppercase opacity-50">Membership</span>
        <div className="w-10" />
      </header>

      <div className="pt-24 pb-32 px-6 max-w-lg mx-auto relative z-10 flex-1 flex flex-col">
        <div className="text-center mb-8">
          <div className="relative inline-block mb-6">
            <div className="w-24 h-24 bg-gradient-to-tr from-red-600 to-orange-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-red-600/30 rotate-3">
              <svg viewBox="0 0 24 24" className="w-12 h-12 fill-white drop-shadow-md">
                <path d={rosettePath}/>
              </svg>
            </div>
            <div className="absolute -bottom-2 -right-2 bg-white text-black text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">
              Verified
            </div>
          </div>
          <h1 className="text-4xl font-black italic tracking-tighter mb-2">
            Otaku<span className="text-red-600">Pro</span>
          </h1>
          <p className="text-zinc-400 text-sm font-medium leading-relaxed max-w-xs mx-auto">
            Get the Red Tick. Unlock the full potential of OtakuWall.
          </p>
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition">
            <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center shrink-0">
               <svg viewBox="0 0 24 24" className="w-5 h-5 fill-red-500">
                <path d={rosettePath}/>
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Verified Badge</h3>
              <p className="text-xs text-zinc-500">Get the red tick next to your name.</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition">
            <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Live Wallpapers</h3>
              <p className="text-xs text-zinc-500">Access exclusive moving video backgrounds.</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition">
            <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center shrink-0">
              <Star className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Ad-Free Experience</h3>
              <p className="text-xs text-zinc-500">Browse the feed without interruptions.</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <PlanCard 
            type="monthly" 
            price={PLANS.monthly.price} 
            selected={selectedPlan === 'monthly'} 
            onClick={() => setSelectedPlan('monthly')}
          />
          <PlanCard 
            type="yearly" 
            price={PLANS.yearly.price} 
            selected={selectedPlan === 'yearly'} 
            onClick={() => setSelectedPlan('yearly')}
            badge={PLANS.yearly.save}
          />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/90 to-transparent z-40">
        <button 
          onClick={handleSubscribe}
          disabled={processing || userData?.isPremium}
          className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 ${
            userData?.isPremium 
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
              : 'bg-red-600 text-white shadow-red-600/20'
          }`}
        >
          {processing ? 'Processing...' : userData?.isPremium ? 'Plan Active' : `Subscribe • ${PLANS[selectedPlan].price}`}
          {!userData?.isPremium && !processing && <ChevronRight className="w-4 h-4" />}
        </button>
        <p className="text-center text-[10px] text-zinc-600 font-bold mt-4 uppercase">
          Secured by Paystack • Cancel Anytime
        </p>
      </div>
    </main>
  );
}

function PlanCard({ type, price, selected, onClick, badge }: { type: string, price: string, selected: boolean, onClick: () => void, badge?: string }) {
  return (
    <div 
      onClick={onClick}
      className={`relative p-5 rounded-3xl border-2 transition-all duration-300 cursor-pointer flex justify-between items-center ${
        selected 
          ? 'bg-red-600/10 border-red-600 shadow-[0_0_30px_rgba(239,68,68,0.2)]' 
          : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
      }`}
    >
      {badge && (
        <div className="absolute -top-3 left-6 bg-white text-black text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-wide shadow-md">
          {badge}
        </div>
      )}
      
      <div className="flex items-center gap-4">
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${selected ? 'border-red-600' : 'border-zinc-600'}`}>
          {selected && <div className="w-2.5 h-2.5 bg-red-600 rounded-full" />}
        </div>
        <div>
          <h3 className="font-black text-sm uppercase">{type}</h3>
          <p className="text-xs text-zinc-500 font-medium">Billed every {type === 'monthly' ? 'month' : 'year'}</p>
        </div>
      </div>
      
      <span className={`text-xl font-black ${selected ? 'text-white' : 'text-zinc-400'}`}>{price}</span>
    </div>
  );
}