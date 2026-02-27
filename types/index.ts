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
}

export interface Wallpaper {
  id: string;
  title: string;
  url: string;
  fileType: 'video' | 'image';
  userId: string;
  username: string;
  isLive?: boolean;
  likes: string[];
  views: number;
  createdAt: any;
}
// types/index.ts (Append to existing)
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

export interface Message {
  id: string;
  text?: string;
  type?: 'text' | 'video' | 'poll';
  senderId: string;
  timestamp: any;
  reaction?: string;
  mediaUrl?: string;
  options?: { text: string; votes: string[] }[];
}