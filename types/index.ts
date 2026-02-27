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