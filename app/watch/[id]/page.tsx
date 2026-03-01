// app/watch/[id]/page.tsx
import { Metadata } from "next";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import WatchClient from "./WatchClient";

type Props = {
  params: { id: string };
  searchParams: { uid?: string };
};

// 🟢 THIS HANDLES THE LINK PREVIEW (OpenGraph)
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = params.id;
  try {
    const docRef = doc(db, "wallpapers", id);
    const snap = await getDoc(docRef);

    if (!snap.exists()) return { title: "Video Not Found" };

    const video = snap.data();
    // Cloudinary thumbnail trick: change .mp4 to .jpg
    const thumbnailUrl = video.url.replace(/\.[^/.]+$/, "") + ".jpg";

    return {
      title: `${video.title || 'Anime Sync'} • OTAKUWALL`,
      description: `Watch this sync by @${video.username} on OtakuWall.`,
      openGraph: {
        title: video.title,
        description: `Watch on OtakuWall`,
        images: [thumbnailUrl],
        videos: [{ url: video.url, type: "video/mp4" }],
        type: "video.other",
      },
      twitter: {
        card: "player",
        images: [thumbnailUrl],
      },
    };
  } catch (e) {
    return { title: "Watch • OTAKUWALL" };
  }
}

export default function Page({ params, searchParams }: Props) {
  // Pass the ID and the UID (if it exists) to the Client Component
  return <WatchClient id={params.id} filterUid={searchParams.uid} />;
}