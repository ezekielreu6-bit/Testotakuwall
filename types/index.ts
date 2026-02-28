// types/index.ts

export interface UserData {
  uid: string;
  username: string;
  email: string;
  photoURL: string;
  isPremium?: boolean;
  banned?: boolean;
  bio?: string;
  createdAt?: any;
  premiumPlan?: string;
  premiumExpiry?: any;
}

export interface Wallpaper {
  id: string;
  title: string;
  url: string;
  fileType: 'video' | 'image';
  userId: string;
  username: string;
  isLive?: boolean;
  isStory?: boolean;     // Added for Story logic
  category?: string;    // Added for Filtering
  repostedFrom?: string; // This fixes your specific build error
  likes: string[];
  views: number;
  createdAt: any;
}

export interface Chat {
  id: string;
  chatName: string;
  chatAvatar: string;
  participants: string[];
  lastActivity: any;
  lastMsg?: string;
  isGroup: boolean;
  ownerId?: string;
  pinnedBy?: string[];
  syncCount?: number;
  unread?: Record<string, number>;
}

// types/index.ts

export interface Message {
  id: string;
  text?: string;
  // Added 'sticker' here to allow the comparison
  type?: 'text' | 'video' | 'poll' | 'sticker'; 
  senderId: string;
  timestamp: any;
  reaction?: string;
  mediaUrl?: string;
  options?: { text: string; votes: string[] }[];
}
export interface Report {
  id: string;
  contentId: string;
  reason: string;
  reporter: string;
  timestamp: any;
  status: string;
}
