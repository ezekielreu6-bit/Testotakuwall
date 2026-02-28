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
  blockedUids?: string[]; // This fixes your build error
}

export interface Wallpaper {
  id: string;
  title: string;
  url: string;
  fileType: 'video' | 'image';
  userId: string;
  username: string;
  isLive?: boolean;
  isStory?: boolean;
  category?: string;
  repostedFrom?: string;
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
  pinnedBy?: string[]; // Ensures pinning logic works
  syncCount?: number;
  unread?: Record<string, number>;
}

export interface Message {
  id: string;
  text?: string;
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