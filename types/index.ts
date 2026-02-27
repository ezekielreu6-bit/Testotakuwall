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