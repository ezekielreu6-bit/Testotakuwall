// app/user/[uid]/page.tsx
import { Metadata } from "next";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import ProfileClient from "./ProfileClient";

type Props = {
  params: { uid: string };
};

// 🟢 THIS HANDLES THE SOCIAL MEDIA PREVIEW (WhatsApp, Twitter, etc.)
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const uid = params.uid;

  try {
    const docRef = doc(db, "users", uid);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return { title: "User Not Found • OTAKUWALL" };
    }

    const userData = snap.data();
    const username = userData.username || "otaku";

    return {
      title: `@${username} • OTAKUWALL`,
      description: `View anime syncs and 4K wallpapers by @${username} on OtakuWall.`,
      openGraph: {
        title: `@${username} on OTAKUWALL`,
        description: userData.bio || `Check out @${username}'s profile for epic anime content.`,
        url: `https://otakuwall.vercel.app/user/${uid}`, // Replace with your domain
        siteName: "OTAKUWALL",
        images: [
          {
            url: userData.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${uid}`,
            width: 800,
            height: 800,
          },
        ],
        type: "profile",
      },
      twitter: {
        card: "summary_large_image",
        title: `@${username} • OTAKUWALL`,
        description: userData.bio || `View anime syncs by @${username}`,
        images: [userData.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${uid}`],
      },
    };
  } catch (error) {
    return { title: "Profile • OTAKUWALL" };
  }
}

export default function Page({ params }: Props) {
  return <ProfileClient uid={params.uid} />;
}