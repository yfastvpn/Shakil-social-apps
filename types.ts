export interface UserProfile {
  userId: string; // 6-digit ID
  name: string;
  coins: number;
  earnings: number;
  spent: number; // For Ranking
  level: number;
  family: string;
  rank: number;
  avatarUrl: string;
  isVip: boolean;
  // New Social Fields
  followers: number;
  following: number;
  followingIds?: string[]; // List of IDs this user is following
  giftsReceived?: Record<string, number>; // Gift ID -> Count
  isOnline: boolean;
  bio?: string;
}

export interface Room {
  id: string;
  name: string;
  category: string;
  listeners: number;
  image: string;
  creatorId?: string; // If null, it's a system room
}

export interface Seat {
  id: number;
  user: UserProfile | null;
  isMuted: boolean;
  isLocked: boolean;
  isTalking: boolean;
}

export interface GiftItem {
  id: string;
  name: string;
  icon: string;
  cost: number;
}

export interface ChatMessage {
  id: string;
  sender: string;
  senderId?: string;
  text: string;
  isAi: boolean;
  timestamp: Date;
}

export enum AppView {
  LOGIN = 'LOGIN',
  HOME = 'HOME',
  ROOM = 'ROOM',
  RANKING = 'RANKING',
  PROFILE = 'PROFILE',
  AI_CHAT = 'AI_CHAT'
}