// app/user/[uid]/page.tsx
import { Metadata } from "next";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import ProfileClient from "./ProfileClient";

type Props = {
  params: { uid: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const uid = params.uid;

  try {
    const docRef = doc(db, "users", uid);
    const snap = await getDoc(docRef);

    if (!snap.exists()) return { title: "User Not Found • OTAKUWALL" };

    const userData = snap.data();
    const username = userData.username || "otaku";
    
    // Ensure the image URL is absolute and high quality for previews
    const previewImage = userData.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${uid}`;

    return {
      title: `@${username} • OTAKUWALL`,
      description: userData.bio || `Check out @${username}'s anime syncs on OtakuWall.`,
      openGraph: {
        title: `@${username} on OTAKUWALL`,
        description: userData.bio || `View epic anime wallpapers and syncs.`,
        url: `https://otakuwall.vercel.app/user/${uid}`, // Change to your real domain
        siteName: "OTAKUWALL",
        images: [
          {
            url: previewImage,
            width: 1200,
            height: 630,
            alt: username,
          },
        ],
        type: "profile",
      },
      twitter: {
        card: "summary_large_image",
        title: `@${username} • OTAKUWALL`,
        description: userData.bio || `Watch anime syncs by @${username}`,
        images: [previewImage],
      },
    };
  } catch (error) {
    return { title: "Profile • OTAKUWALL" };
  }
}

export default function Page({ params }: Props) {
  return <ProfileClient uid={params.uid} />;
}