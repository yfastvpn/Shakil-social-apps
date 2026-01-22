import React, { useState, useEffect, useRef } from 'react';
import { AppView, UserProfile, Seat, GiftItem, ChatMessage, Room } from './types';
import { generateChatResponse, generateSpeech, connectLiveSession } from './services/geminiService';
import { 
  HomeIcon, UsersIcon, AwardIcon, UserIcon, MicIcon, MicOffIcon, 
  GiftIcon, BotIcon, SendIcon, EditIcon, GamepadIcon, GoogleIcon, PhoneIcon,
  SearchIcon, FilterIcon
} from './components/Icons';

// --- Constants & Mock Data ---

const AVAILABLE_GIFTS: GiftItem[] = [
  { id: '1', name: 'Rose', icon: '🌹', cost: 10 },
  { id: '2', name: 'Heart', icon: '❤️', cost: 50 },
  { id: '3', name: 'Diamond', icon: '💎', cost: 100 },
  { id: '4', name: 'Car', icon: '🏎️', cost: 500 },
  { id: '5', name: 'Castle', icon: '🏰', cost: 1000 },
  { id: '6', name: 'Rocket', icon: '🚀', cost: 5000 },
];

// UPDATED COIN RATE: $1 = 1,000,000 Coins
const COIN_PACKAGES = [
  { coins: 1000000, price: "$1.00" },
  { coins: 5000000, price: "$5.00" },
  { coins: 12000000, price: "$10.00" },
  { coins: 65000000, price: "$50.00" },
];

const COUNTRIES = [
  { code: '+880', name: 'Bangladesh', flag: '🇧🇩' },
  { code: '+91', name: 'India', flag: '🇮🇳' },
  { code: '+1', name: 'USA', flag: '🇺🇸' },
  { code: '+968', name: 'Oman', flag: '🇴🇲' },
  { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+971', name: 'UAE', flag: '🇦🇪' },
  { code: '+44', name: 'UK', flag: '🇬🇧' },
];

const MOCK_LEADERBOARD: UserProfile[] = [
  { userId: '100001', name: 'Shakil', coins: 5000, earnings: 50000, spent: 120000, avatarUrl: 'https://picsum.photos/100/100?random=1', svip: 5, rank: 1, level: 50, family: 'Elite BD', isVip: true, followers: 5020, following: 120, isOnline: true, bio: "King of the North", giftsReceived: { '1': 50, '3': 10 } } as any,
  { userId: '100002', name: 'Rahul', coins: 200, earnings: 32000, spent: 85000, avatarUrl: 'https://picsum.photos/100/100?random=2', svip: 3, rank: 2, level: 42, family: 'Warriors', isVip: true, followers: 300, following: 10, isOnline: false, bio: "Music Lover", giftsReceived: { '2': 100 } } as any,
  { userId: '100003', name: 'Sarah', coins: 100, earnings: 15000, spent: 45000, avatarUrl: 'https://picsum.photos/100/100?random=3', svip: 2, rank: 3, level: 30, family: 'None', isVip: false, followers: 1200, following: 500, isOnline: true, bio: "Just here to chat", giftsReceived: { '1': 500 } } as any,
  { userId: '100004', name: 'Tanvir', coins: 50, earnings: 8000, spent: 12000, avatarUrl: 'https://picsum.photos/100/100?random=4', svip: 1, rank: 4, level: 15, family: 'Elite BD', isVip: false, followers: 50, following: 20, isOnline: true, bio: "Gamer", giftsReceived: {} } as any,
];

// Mock Rooms Data
const MOCK_ROOMS: Room[] = [
  { id: '3707', name: 'BD Voice Chat', category: 'Chat', listeners: 145, image: 'https://picsum.photos/200/200?random=101' },
  { id: '8821', name: 'Music Lounge', category: 'Music', listeners: 89, image: 'https://picsum.photos/200/200?random=102' },
  { id: '4040', name: 'Gaming Zone', category: 'Games', listeners: 56, image: 'https://picsum.photos/200/200?random=103' },
  { id: '1212', name: 'Late Night Talks', category: 'Chat', listeners: 230, image: 'https://picsum.photos/200/200?random=104' },
];

const ROOM_CATEGORIES = ['All', 'Chat', 'Music', 'Games'];

// The AI Agent Profile
const SUPPORT_AGENT: UserProfile = {
  userId: '100000',
  name: "Nila (Support)",
  coins: 999999,
  earnings: 0,
  spent: 0,
  level: 99,
  family: "Official",
  rank: 0,
  avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=Nila&clothing=blazerAndShirt&hairColor=black", 
  isVip: true,
  followers: 999999,
  following: 0,
  isOnline: true,
  bio: "Official AI Assistant of Shakil Social."
};

// Helper: Decode Base64 to ArrayBuffer (for standard TTS)
function base64ToArrayBuffer(base64: string) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

const App: React.FC = () => {
  // --- State ---
  const [currentView, setCurrentView] = useState<AppView>(AppView.LOGIN);
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    userId: '', // Will be generated
    name: "Guest",
    coins: 1000, 
    earnings: 0,
    spent: 0,
    level: 1,
    family: "None",
    rank: 1,
    avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=G&backgroundColor=b6e3f4",
    isVip: false,
    followers: 0,
    following: 0,
    followingIds: [],
    giftsReceived: {},
    isOnline: true,
    bio: "Hey there! I am using Shakil Social."
  });

  // Login State
  const [loginStep, setLoginStep] = useState<'MENU' | 'PHONE_INPUT' | 'OTP'>('MENU');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showCountryList, setShowCountryList] = useState(false);

  // Edit Profile State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', avatar: '', family: '' });

  // Voice Room State
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showGameModal, setShowGameModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [selectedSeatForGift, setSelectedSeatForGift] = useState<number | null>(null);

  // Custom Room Creation State
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [customRooms, setCustomRooms] = useState<Room[]>([]);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomCategory, setNewRoomCategory] = useState("Chat");

  // User Profile Interaction State
  const [viewingProfile, setViewingProfile] = useState<UserProfile | null>(null);
  const [showFollowingList, setShowFollowingList] = useState(false);
  
  // Private Chat State
  const [activePrivateChatUser, setActivePrivateChatUser] = useState<UserProfile | null>(null);
  const [privateMessages, setPrivateMessages] = useState<Record<string, ChatMessage[]>>({});
  const [privateChatInput, setPrivateChatInput] = useState("");

  // Home Screen Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortBy, setSortBy] = useState("Popular"); 

  // Room Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // Game State
  const [selectedGame, setSelectedGame] = useState<'777' | 'GEDI' | 'LUDO' | null>(null);
  const [gameResult, setGameResult] = useState<string>("");
  // Ludo State
  const [ludoDice, setLudoDice] = useState(1);
  const [ludoTurn, setLudoTurn] = useState<'RED' | 'GREEN' | 'BLUE' | 'YELLOW'>('RED');
  const [ludoPos, setLudoPos] = useState({ RED: 0, GREEN: 0, BLUE: 0, YELLOW: 0 });

  // Live Call State
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const liveSessionCleanupRef = useRef<(() => void) | null>(null);

  // Audio Context Ref
  const audioContextRef = useRef<AudioContext | null>(null);

  // --- Effects ---

  // Initialize seats when entering a room
  useEffect(() => {
    if (activeRoomId) {
      const initialSeats = Array.from({ length: 9 }, (_, i) => ({
        id: i + 1,
        user: null as UserProfile | null,
        isMuted: true,
        isLocked: false,
        isTalking: false
      }));

      // If it's the Support Room, put Nila in Seat 1
      if (activeRoomId === 'support_room') {
        initialSeats[0].user = SUPPORT_AGENT;
        initialSeats[0].isMuted = false;
        
        const welcomeText = "হ্যালো! আসসালামু আলাইকুম! আমি নীলা! শাকিল সোশ্যাল অ্যাপে স্বাগতম! আমি কি সাহায্য করতে পারি?";
        
        setMessages([{
          id: 'welcome',
          sender: 'Nila (Support)',
          text: welcomeText,
          isAi: true,
          timestamp: new Date()
        }]);

        // AUTO-SPEAK GREETING (Bangla)
        generateSpeech(welcomeText).then(audio => {
            if (audio) playAiAudio(audio);
        });
      } 
      // If it's a custom room I created, put me in Seat 1 (Creator)
      else {
          const room = customRooms.find(r => r.id === activeRoomId);
          if (room && room.creatorId === currentUser.userId) {
              initialSeats[0].user = currentUser;
              initialSeats[0].isMuted = false;
          }
      }
      setSeats(initialSeats);
    }
  }, [activeRoomId, customRooms, currentUser]);
  
  // Simulate random talking animation
  useEffect(() => {
    if (!activeRoomId) return;
    const interval = setInterval(() => {
      setSeats(prev => prev.map(seat => {
        if (activeRoomId === 'support_room' && seat.id === 1) return seat;
        return {
          ...seat,
          isTalking: seat.user ? Math.random() > 0.6 : false
        };
      }));
    }, 600);
    return () => clearInterval(interval);
  }, [activeRoomId]);


  // --- Logic Handlers ---

  const handleGoogleLogin = () => {
    const randomId = Math.floor(100000 + Math.random() * 900000).toString();
    const newUser: UserProfile = {
      ...currentUser,
      userId: randomId,
      name: "Google User",
      avatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${randomId}`,
      followingIds: [],
    };
    setCurrentUser(newUser);
    setCurrentView(AppView.HOME);
    setLoginStep('MENU');
  };

  const handlePhoneLoginSubmit = () => {
    if (phoneNumber.length < 5) {
      alert("Please enter a valid phone number");
      return;
    }
    setLoginStep('OTP');
  };

  const verifyOtpAndLogin = () => {
    if (otpCode.length !== 4) {
      alert("Enter 4-digit code (Use 1234)");
      return;
    }
    const randomId = Math.floor(100000 + Math.random() * 900000).toString();
    const newUser: UserProfile = {
      ...currentUser,
      userId: randomId,
      name: `User ${phoneNumber.slice(-4)}`,
      avatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${phoneNumber}`,
      followingIds: [],
    };
    setCurrentUser(newUser);
    setCurrentView(AppView.HOME);
    setLoginStep('MENU');
    setPhoneNumber('');
    setOtpCode('');
  };

  const createRoom = () => {
      if (!newRoomName.trim()) return alert("Enter room name");
      
      const newRoom: Room = {
          id: Math.floor(1000 + Math.random() * 9000).toString(),
          name: newRoomName,
          category: newRoomCategory,
          listeners: 1,
          image: `https://picsum.photos/200/200?random=${Date.now()}`,
          creatorId: currentUser.userId
      };
      
      setCustomRooms([...customRooms, newRoom]);
      setShowCreateRoomModal(false);
      setNewRoomName("");
      joinRoom(newRoom.id);
  };

  const joinRoom = (roomId: string) => {
    setActiveRoomId(roomId);
    setCurrentView(AppView.ROOM);
  };

  const leaveRoom = () => {
    if (liveSessionCleanupRef.current) {
        liveSessionCleanupRef.current();
        liveSessionCleanupRef.current = null;
    }
    setIsLiveConnected(false);
    if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
    setActiveRoomId(null);
    setSeats([]);
    setMessages([]);
    setShowGameModal(false);
    setShowLeaveConfirm(false);
    setCurrentView(AppView.HOME);
  };

  // --- Profile Interaction Logic ---
  const handleFollowUser = (target: UserProfile) => {
      const isFollowing = currentUser.followingIds?.includes(target.userId);
      
      if (isFollowing) {
          // Unfollow
          setCurrentUser(prev => ({
              ...prev,
              following: Math.max(0, prev.following - 1),
              followingIds: prev.followingIds?.filter(id => id !== target.userId) || []
          }));
          // Update the viewed profile to show decreased count immediately
          setViewingProfile(prev => prev ? ({...prev, followers: Math.max(0, prev.followers - 1)}) : null);
      } else {
          // Follow
          setCurrentUser(prev => ({
              ...prev,
              following: prev.following + 1,
              followingIds: [...(prev.followingIds || []), target.userId]
          }));
          // Update the viewed profile to show increased count immediately
          setViewingProfile(prev => prev ? ({...prev, followers: prev.followers + 1}) : null);
      }
  };

  const handleJoinFamily = (target: UserProfile) => {
      if (target.family === "None") return alert("This user has no family.");
      setCurrentUser({...currentUser, family: target.family});
      alert(`You joined the ${target.family} family!`);
      setViewingProfile(null);
  };

  const openPrivateChat = (target: UserProfile) => {
      setViewingProfile(null);
      setActivePrivateChatUser(target);
  };

  const sendPrivateMessage = () => {
      if (!activePrivateChatUser || !privateChatInput.trim()) return;
      
      const chatId = activePrivateChatUser.userId;
      const newMsg: ChatMessage = {
          id: Date.now().toString(),
          sender: currentUser.name,
          senderId: currentUser.userId,
          text: privateChatInput,
          isAi: false,
          timestamp: new Date()
      };

      setPrivateMessages(prev => ({
          ...prev,
          [chatId]: [...(prev[chatId] || []), newMsg]
      }));
      setPrivateChatInput("");
  };

  // --- Live API & Seat Logic ---

  const startLiveCall = async () => {
    try {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        }
        setMessages(prev => [...prev, { id: 'system-connecting', sender: 'System', text: 'Connecting...', isAi: true, timestamp: new Date() }]);
        const cleanup = await connectLiveSession(
            audioContextRef.current,
            (isActive) => { setSeats(prev => prev.map(s => s.id === 1 ? { ...s, isTalking: isActive } : s)); },
            (text) => { }
        );
        liveSessionCleanupRef.current = cleanup;
        setIsLiveConnected(true);
        setMessages(prev => [...prev, { id: 'system-connected', sender: 'System', text: 'Connected!', isAi: true, timestamp: new Date() }]);
    } catch (e) {
        console.error("Failed to start live call", e);
        alert("Connection failed.");
    }
  };

  const stopLiveCall = () => {
      if (liveSessionCleanupRef.current) {
          liveSessionCleanupRef.current();
          liveSessionCleanupRef.current = null;
      }
      setIsLiveConnected(false);
      setMessages(prev => [...prev, { id: 'system-disconnected', sender: 'System', text: 'Ended.', isAi: true, timestamp: new Date() }]);
  };

  const handleSeatClick = (clickedSeat: Seat) => {
    // 1. If seat has a user, open Profile Modal (instead of direct gift)
    if (clickedSeat.user) {
        setViewingProfile(clickedSeat.user);
        // Note: We might want to store selectedSeatForGift if we gift from profile later
        setSelectedSeatForGift(clickedSeat.id); 
        return;
    }

    // 2. If seat is empty, logic to sit or move
    const myCurrentSeatIndex = seats.findIndex(s => s.user?.userId === currentUser.userId);
    if (myCurrentSeatIndex !== -1) {
        setSeats(prev => {
            const newSeats = [...prev];
            newSeats[myCurrentSeatIndex] = { ...newSeats[myCurrentSeatIndex], user: null, isMuted: true, isTalking: false };
            newSeats[clickedSeat.id - 1] = { ...newSeats[clickedSeat.id - 1], user: currentUser, isMuted: false };
            return newSeats;
        });
    } else {
        setSeats(prev => {
            const newSeats = [...prev];
            newSeats[clickedSeat.id - 1] = { ...newSeats[clickedSeat.id - 1], user: currentUser, isMuted: false };
            return newSeats;
        });
    }
  };

  const toggleMute = () => {
    setSeats(prev => prev.map(s => s.user?.name === currentUser.name ? { ...s, isMuted: !s.isMuted } : s));
  };

  const handleSendGift = (gift: GiftItem) => {
    // Use viewingProfile if open, otherwise fallback to seat selection (legacy)
    const receiver = viewingProfile || seats.find(s => s.id === selectedSeatForGift)?.user;
    
    if (!receiver) {
        setShowGiftModal(false);
        return;
    }

    if (currentUser.coins >= gift.cost) {
      setCurrentUser(prev => ({ ...prev, coins: prev.coins - gift.cost, spent: prev.spent + gift.cost }));
      
      // Update Receiver's Gift History in State
      // Note: In a real app this is a backend call. Here we simulate updating the viewed profile.
      if (viewingProfile && viewingProfile.userId === receiver.userId) {
          setViewingProfile(prev => {
              if (!prev) return null;
              const currentGifts = prev.giftsReceived || {};
              return {
                  ...prev,
                  giftsReceived: {
                      ...currentGifts,
                      [gift.id]: (currentGifts[gift.id] || 0) + 1
                  }
              };
          });
      }

      alert(`Sent ${gift.name} to ${receiver.name}!`);
      setShowGiftModal(false);
    } else {
      setShowGiftModal(false);
      setViewingProfile(null); // Close profile to show wallet clearly
      setShowWalletModal(true); 
    }
  };

  const buyCoins = (amount: number) => {
    alert(`Successfully purchased ${(amount/1000000).toFixed(1)}M coins!`);
    setCurrentUser(prev => ({ ...prev, coins: prev.coins + amount }));
    setShowWalletModal(false);
  };

  const playGame = (game: '777' | 'GEDI') => {
    const cost = 100;
    if (currentUser.coins < cost) {
        alert("Need 100 coins");
        return;
    }
    setCurrentUser(prev => ({ ...prev, coins: prev.coins - cost, spent: prev.spent + cost }));
    const isWin = Math.random() > 0.6;
    const win = isWin ? (game === '777' ? 500 : 200) : 0;
    setGameResult(win > 0 ? `Won ${win}!` : "Lost.");
    if (win > 0) setCurrentUser(prev => ({ ...prev, coins: prev.coins + win }));
  };

  const rollLudoDice = () => {
      const roll = Math.ceil(Math.random() * 6);
      setLudoDice(roll);
      // Simple movement simulation
      setLudoPos(prev => ({
          ...prev,
          [ludoTurn]: (prev[ludoTurn] + roll) % 50 // Mock board size
      }));
      // Change Turn
      const turns: ('RED' | 'GREEN' | 'BLUE' | 'YELLOW')[] = ['RED', 'GREEN', 'BLUE', 'YELLOW'];
      const nextIdx = (turns.indexOf(ludoTurn) + 1) % 4;
      setTimeout(() => setLudoTurn(turns[nextIdx]), 1000);
  };

  const playAiAudio = async (base64Audio: string) => {
    // ... existing audio logic
    try {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const ctx = audioContextRef.current;
        const arrayBuffer = base64ToArrayBuffer(base64Audio);
        const int16Data = new Int16Array(arrayBuffer);
        const float32Data = new Float32Array(int16Data.length);
        for (let i = 0; i < int16Data.length; i++) { float32Data[i] = int16Data[i] / 32768.0; }
        const buffer = ctx.createBuffer(1, float32Data.length, 24000);
        buffer.getChannelData(0).set(float32Data);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        setSeats(prev => prev.map(s => s.id === 1 ? { ...s, isTalking: true } : s));
        source.start();
        source.onended = () => { setSeats(prev => prev.map(s => s.id === 1 ? { ...s, isTalking: false } : s)); };
    } catch (e) { console.error(e); }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const newUserMsg: ChatMessage = { id: Date.now().toString(), sender: currentUser.name, text: chatInput, isAi: false, timestamp: new Date() };
    setMessages(prev => [...prev, newUserMsg]);
    setChatInput("");
    setIsTyping(true);

    // AI Logic RESTRICTION: Only in support_room
    if (activeRoomId === 'support_room') {
        const responseText = await generateChatResponse(chatInput, []);
        const newAiMsg: ChatMessage = { id: (Date.now() + 1).toString(), sender: "Nila (Support)", text: responseText, isAi: true, timestamp: new Date() };
        setMessages(prev => [...prev, newAiMsg]);
        
        if (!isLiveConnected) {
            const audioBase64 = await generateSpeech(responseText);
            if (audioBase64) await playAiAudio(audioBase64);
        }
    }
    setIsTyping(false);
  };

  const startEditing = () => {
    setEditForm({ name: currentUser.name, avatar: currentUser.avatarUrl, family: currentUser.family });
    setIsEditing(true);
  };
  
  const saveProfile = () => {
    setCurrentUser(prev => ({ ...prev, name: editForm.name, avatarUrl: editForm.avatar, family: editForm.family }));
    setIsEditing(false);
  };

  // --- Render Sections ---

  const renderLogin = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-6 relative overflow-hidden">
      {/* ... Existing Login UI ... */}
      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
      <div className="w-40 h-40 bg-purple-600 rounded-full blur-[80px] absolute top-10 left-10"></div>
      <div className="w-40 h-40 bg-red-600 rounded-full blur-[80px] absolute bottom-10 right-10"></div>

      <div className="z-10 w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-tr from-red-500 to-purple-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-red-500/30">
            <span className="text-4xl">💎</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Shakil Social</h1>
          <p className="text-slate-400 text-sm">Voice, Games & Friends</p>
        </div>

        {loginStep === 'MENU' && (
          <div className="space-y-4">
            <button onClick={handleGoogleLogin} className="w-full bg-white text-slate-900 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-3 hover:bg-slate-100 transition-colors"><GoogleIcon className="w-5 h-5" />Continue with Google</button>
            <button onClick={() => setLoginStep('PHONE_INPUT')} className="w-full bg-slate-800 border border-slate-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-3 hover:bg-slate-700 transition-colors"><PhoneIcon className="w-5 h-5 text-green-400" />Continue with Phone</button>
          </div>
        )}

        {loginStep === 'PHONE_INPUT' && (
          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 animate-slide-up">
              <button onClick={() => setLoginStep('MENU')} className="text-slate-400 text-xs mb-4 flex items-center gap-1">← Back</button>
              <h3 className="text-lg font-bold mb-4">Enter Phone Number</h3>
              <div className="space-y-4">
                 <div className="relative">
                    <label className="text-[10px] text-slate-400 mb-1 block">Country</label>
                    <button onClick={() => setShowCountryList(!showCountryList)} className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 flex justify-between items-center text-sm">
                        <span className="flex items-center gap-2"><span className="text-xl">{selectedCountry.flag}</span><span>{selectedCountry.name}</span></span>
                        <span className="text-slate-400">{selectedCountry.code}</span>
                    </button>
                    {showCountryList && (
                       <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-xl max-h-48 overflow-y-auto z-20 shadow-xl">
                          {COUNTRIES.map(c => (
                             <div key={c.name} onClick={() => { setSelectedCountry(c); setShowCountryList(false); }} className="p-3 hover:bg-slate-700 flex justify-between items-center cursor-pointer border-b border-slate-700/50">
                                <span className="flex items-center gap-2"><span className="text-xl">{c.flag}</span><span className="text-sm">{c.name}</span></span>
                                <span className="text-xs text-slate-400">{c.code}</span>
                             </div>
                          ))}
                       </div>
                    )}
                 </div>
                 <div>
                    <label className="text-[10px] text-slate-400 mb-1 block">Phone Number</label>
                    <div className="flex gap-2">
                       <div className="bg-slate-900 border border-slate-600 rounded-xl px-3 py-3 text-sm text-slate-400 flex items-center justify-center min-w-[60px]">{selectedCountry.code}</div>
                       <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-3 py-3 text-sm text-white focus:border-indigo-500 focus:outline-none" placeholder="1XXXXXXX" />
                    </div>
                 </div>
                 <button onClick={handlePhoneLoginSubmit} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl mt-2">Send Code</button>
              </div>
          </div>
        )}

        {loginStep === 'OTP' && (
          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 animate-slide-up">
              <button onClick={() => setLoginStep('PHONE_INPUT')} className="text-slate-400 text-xs mb-4 flex items-center gap-1">← Change Number</button>
              <h3 className="text-lg font-bold mb-2">Verify Phone</h3>
              <p className="text-xs text-slate-400 mb-6">Code sent to {selectedCountry.code} {phoneNumber}</p>
              <div className="space-y-4">
                 <input type="text" maxLength={4} value={otpCode} onChange={(e) => setOtpCode(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-3 text-center text-2xl tracking-widest text-white focus:border-indigo-500 focus:outline-none" placeholder="0000" />
                 <p className="text-[10px] text-slate-500 text-center mt-2">Enter '1234' for demo</p>
                 <button onClick={verifyOtpAndLogin} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl mt-2">Verify & Login</button>
              </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderNav = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-lg border-t border-slate-700 pb-safe px-5 flex justify-between items-center z-50 h-14">
      <button onClick={() => setCurrentView(AppView.HOME)} className={`flex flex-col items-center gap-0.5 w-10 ${currentView === AppView.HOME ? 'text-amber-400' : 'text-slate-500'}`}><HomeIcon className="w-5 h-5" /></button>
      <button onClick={() => setCurrentView(AppView.RANKING)} className={`flex flex-col items-center gap-0.5 w-10 ${currentView === AppView.RANKING ? 'text-amber-400' : 'text-slate-500'}`}><AwardIcon className="w-5 h-5" /></button>
      <div className="relative -top-5">
         <button onClick={() => setShowCreateRoomModal(true)} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full p-3 shadow-lg shadow-orange-500/30">
           <span className="text-xl font-bold">+</span>
         </button>
      </div>
      <button onClick={() => setCurrentView(AppView.AI_CHAT)} className={`flex flex-col items-center gap-0.5 w-10 ${currentView === AppView.AI_CHAT ? 'text-amber-400' : 'text-slate-500'}`}><SendIcon className="w-5 h-5" /></button>
      <button onClick={() => setCurrentView(AppView.PROFILE)} className={`flex flex-col items-center gap-0.5 w-10 ${currentView === AppView.PROFILE ? 'text-amber-400' : 'text-slate-500'}`}><UserIcon className="w-5 h-5" /></button>
    </div>
  );

  const renderHome = () => {
    // Combine mock rooms and user created custom rooms
    const allRooms = [...MOCK_ROOMS, ...customRooms];
    
    const filteredRooms = allRooms.filter(room => {
      const matchesSearch = room.name.toLowerCase().includes(searchQuery.toLowerCase()) || room.id.includes(searchQuery);
      const matchesCategory = activeCategory === 'All' || room.category === activeCategory;
      return matchesSearch && matchesCategory;
    }).sort((a, b) => {
        if (sortBy === 'Popular') return b.listeners - a.listeners;
        return 0;
    });

    return (
    <div className="p-3 pt-4 pb-20 space-y-3 animate-fade-in bg-slate-900 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold text-white">Shakil Social</h1>
          <p className="text-[10px] text-slate-400">ID: {currentUser.userId}</p>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setShowWalletModal(true)} className="bg-slate-800 px-2 py-1 rounded-full border border-slate-700 flex items-center gap-1">
               <span className="text-[10px] text-yellow-400 font-bold">🪙 {(currentUser.coins/1000000).toFixed(1)}M</span>
               <span className="text-[10px] text-green-400 font-bold">+</span>
            </button>
        </div>
      </div>

      <div onClick={() => joinRoom('support_room')} className="bg-gradient-to-r from-pink-600 to-purple-700 rounded-xl p-3 border border-pink-500/30 shadow-lg relative overflow-hidden cursor-pointer">
        <div className="flex items-center gap-3">
            <div className="relative">
                <img src={SUPPORT_AGENT.avatarUrl} className="w-12 h-12 rounded-full border-2 border-white" alt="Agent" />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-purple-700 rounded-full"></span>
            </div>
            <div>
                <h3 className="font-bold text-white text-sm">Customer Service</h3>
                <p className="text-[10px] text-pink-100">Host: Nila</p>
                <div className="mt-1 bg-white/20 inline-block px-1.5 py-0.5 rounded text-[9px] text-white">Official Help Center</div>
            </div>
        </div>
        <div className="absolute right-3 top-1/2 -translate-y-1/2"><button className="bg-white text-purple-700 text-xs font-bold px-3 py-1.5 rounded-full">Join</button></div>
      </div>

      <div className="relative">
         <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><SearchIcon className="w-4 h-4" /></div>
         <input type="text" placeholder="Search ID or Room Name" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-xs text-white focus:border-indigo-500 focus:outline-none" />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
         <button onClick={() => setSortBy(sortBy === 'Popular' ? 'Newest' : 'Popular')} className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-full flex items-center gap-1 min-w-max">
             <FilterIcon className="w-3 h-3 text-slate-400" />
             <span className="text-[10px] text-slate-300">{sortBy === 'Popular' ? '🔥 Hot' : '✨ New'}</span>
         </button>
         {ROOM_CATEGORIES.map(cat => (
             <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-colors border ${activeCategory === cat ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'} min-w-max`}>{cat}</button>
         ))}
      </div>

      <div className="flex justify-between items-center mt-2">
         <h3 className="text-xs font-semibold text-slate-300">{searchQuery ? 'Search Results' : 'Popular Rooms'}</h3>
         <span className="text-[9px] text-slate-500">{filteredRooms.length} Found</span>
      </div>
      
      {filteredRooms.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
            {filteredRooms.map(room => (
                <div key={room.id} onClick={() => joinRoom(room.id)} className="bg-slate-800 rounded-xl p-2 cursor-pointer border border-slate-700 hover:border-slate-500 transition-colors group">
                    <div className="w-full h-24 bg-slate-900 rounded-lg mb-2 relative overflow-hidden">
                        <img src={room.image} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt={room.name} />
                        <div className="absolute bottom-1 left-1 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] font-mono text-white flex items-center gap-1">ID: {room.id}</div>
                        <div className="absolute top-1 right-1 bg-indigo-600/90 px-1.5 py-0.5 rounded text-[8px] font-bold text-white uppercase">{room.category}</div>
                    </div>
                    <h4 className="font-bold text-xs text-white truncate">{room.name}</h4>
                    <div className="flex items-center gap-1 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                        <p className="text-[9px] text-slate-400">{room.listeners} listening</p>
                    </div>
                </div>
            ))}
        </div>
      ) : (
          <div className="flex flex-col items-center justify-center py-10 text-slate-500">
              <span className="text-2xl mb-2">🔍</span>
              <p className="text-xs">No rooms found.</p>
          </div>
      )}
    </div>
    );
  };

  const renderRanking = () => {
    // ... Existing Ranking UI ...
    const sorted = [...MOCK_LEADERBOARD].sort((a, b) => b.spent - a.spent);
    return (
      <div className="min-h-screen bg-slate-900 pb-20">
        <div className="bg-gradient-to-b from-amber-600 to-slate-900 p-4 pb-10 relative">
          {/* Back Button for Ranking */}
          <button onClick={() => setCurrentView(AppView.HOME)} className="absolute top-4 left-4 p-2 bg-black/20 rounded-full text-white hover:bg-black/40 z-20">
             ←
          </button>
          <h2 className="text-center font-bold text-lg mb-6">Wealth Ranking 🏆</h2>
          <div className="flex justify-center items-end gap-4">
            <div className="flex flex-col items-center">
               <img src={sorted[1].avatarUrl} className="w-12 h-12 rounded-full border-2 border-slate-300" />
               <div className="bg-slate-300 text-slate-900 text-[10px] font-bold px-2 rounded-full -mt-2 z-10">2</div>
               <span className="text-xs font-bold mt-1">{sorted[1].name}</span>
               <span className="text-[9px] text-amber-300">{(sorted[1].spent/1000000).toFixed(1)}M 🪙</span>
            </div>
            <div className="flex flex-col items-center mb-4">
               <div className="text-2xl animate-bounce">👑</div>
               <img src={sorted[0].avatarUrl} className="w-16 h-16 rounded-full border-4 border-yellow-400 shadow-lg shadow-yellow-500/50" />
               <div className="bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 rounded-full -mt-2 z-10">1</div>
               <span className="text-sm font-bold mt-1 text-yellow-400">{sorted[0].name}</span>
               <span className="text-[10px] text-amber-200">{(sorted[0].spent/1000000).toFixed(1)}M 🪙</span>
            </div>
            <div className="flex flex-col items-center">
               <img src={sorted[2].avatarUrl} className="w-12 h-12 rounded-full border-2 border-orange-400" />
               <div className="bg-orange-400 text-orange-900 text-[10px] font-bold px-2 rounded-full -mt-2 z-10">3</div>
               <span className="text-xs font-bold mt-1">{sorted[2].name}</span>
               <span className="text-[9px] text-amber-300">{(sorted[2].spent/1000000).toFixed(1)}M 🪙</span>
            </div>
          </div>
        </div>
        
        <div className="px-3 space-y-2 -mt-4">
          {sorted.slice(3).map((u, i) => (
             <div key={i} className="bg-slate-800 p-2 rounded-xl flex items-center justify-between border border-slate-700">
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 font-bold w-4 text-center">{i + 4}</span>
                  <img src={u.avatarUrl} className="w-8 h-8 rounded-full" />
                  <div>
                    <div className="text-xs font-bold">{u.name}</div>
                    <div className="text-[9px] text-slate-400">ID: {u.userId}</div>
                  </div>
                </div>
                <div className="text-amber-400 text-xs font-bold">{(u.spent/1000000).toFixed(2)}M 🪙</div>
             </div>
          ))}
          <div className="fixed bottom-16 left-3 right-3 bg-slate-700 p-2 rounded-xl flex items-center justify-between border border-amber-500/30 shadow-lg">
             <div className="flex items-center gap-3">
                <span className="text-slate-300 font-bold w-4 text-center">-</span>
                <img src={currentUser.avatarUrl} className="w-8 h-8 rounded-full" />
                <div>
                  <div className="text-xs font-bold text-white">You</div>
                  <div className="text-[9px] text-slate-400">Spent</div>
                </div>
             </div>
             <div className="text-amber-400 text-xs font-bold">{(currentUser.spent/1000000).toFixed(2)}M 🪙</div>
          </div>
        </div>
      </div>
    );
  };

  const renderRoom = () => (
    <div className="flex flex-col h-screen bg-slate-900 relative">
      {/* Z-Index Fix: Increase to z-30 to stay above scrollable content */}
      <div className="p-3 pt-4 flex justify-between items-center bg-slate-900/50 backdrop-blur z-30 absolute top-0 w-full">
        <div>
          <h2 className="font-bold text-sm shadow-black drop-shadow-md">
            {activeRoomId === 'support_room' ? 'Customer Service' : 'Voice Chat'}
          </h2>
          <span className="text-[10px] text-slate-300 shadow-black drop-shadow-md">
            ID: {activeRoomId === 'support_room' ? '100000' : activeRoomId}
          </span>
        </div>
        <button onClick={() => setShowLeaveConfirm(true)} className="bg-red-500/80 px-3 py-1.5 rounded-full text-white hover:bg-red-600 transition-colors flex items-center gap-1">
          <span className="text-[10px] font-bold uppercase">Leave</span>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>

      <div className="absolute inset-0 z-0 opacity-50">
        <img src="https://picsum.photos/400/800?blur=4" className="w-full h-full object-cover" />
      </div>

      <div className="flex-1 p-3 pt-16 grid grid-cols-3 gap-y-4 gap-x-2 content-start z-10 overflow-y-auto pb-48">
        {seats.map((seat) => (
          <div key={seat.id} className="flex flex-col items-center relative">
            <div onClick={() => handleSeatClick(seat)} className={`w-14 h-14 rounded-full flex items-center justify-center border-[1.5px] cursor-pointer transition-all duration-300 ${seat.user ? 'border-white bg-slate-800' : 'border-white/30 bg-black/20'} ${seat.isTalking ? 'ring-2 ring-green-400 scale-105' : ''}`}>
              {seat.user ? (
                <img src={seat.user.avatarUrl} alt={seat.user.name} className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-white/30 text-xs font-bold">{seat.id}</span>
              )}
              {seat.user && (
                 <div className={`absolute bottom-0 right-0 p-0.5 rounded-full ${seat.isMuted ? 'bg-black/50' : 'bg-green-500'} border border-white/20`}>
                   {seat.isMuted ? <MicOffIcon className="w-2 h-2 text-white" /> : <MicIcon className="w-2 h-2 text-white" />}
                 </div>
              )}
            </div>
            <span className="mt-1 text-[9px] font-medium text-white truncate w-full text-center shadow-black drop-shadow-md">
              {seat.user ? seat.user.name : "Wait"}
            </span>
          </div>
        ))}
      </div>

      {/* In-Room Chat Overlay */}
      <div className="absolute bottom-16 left-0 right-0 h-32 px-3 z-10 pointer-events-none">
         <div className="flex flex-col justify-end h-full space-y-1">
            {messages.slice(-3).map(msg => (
                <div key={msg.id} className="bg-black/40 backdrop-blur-sm self-start rounded-lg px-2 py-1 max-w-[80%] border border-white/5 animate-fade-in">
                    <span className={`text-[10px] font-bold mr-1 ${msg.isAi ? 'text-pink-400' : 'text-amber-400'}`}>{msg.sender}:</span>
                    <span className="text-[10px] text-white">{msg.text}</span>
                </div>
            ))}
         </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-slate-900 px-3 py-2 flex gap-2 items-center z-20 border-t border-slate-800">
        {activeRoomId === 'support_room' ? (
            isLiveConnected ? (
                <button onClick={stopLiveCall} className="flex-1 bg-red-600 rounded-full py-3 text-white font-bold flex items-center justify-center gap-2 animate-pulse"><span className="text-xl">📞</span> End Call with Nila</button>
            ) : (
                <button onClick={startLiveCall} className="flex-1 bg-green-600 rounded-full py-3 text-white font-bold flex items-center justify-center gap-2 hover:bg-green-500 transition-colors"><span className="text-xl">🎧</span> Call Support (Live)</button>
            )
        ) : (
            <>
                <button onClick={() => setShowGameModal(true)} className="bg-amber-500 p-2 rounded-full text-white animate-bounce-short shadow-lg shadow-amber-500/20"><GamepadIcon className="w-4 h-4" /></button>
                <input className="flex-1 bg-slate-800 rounded-full px-3 py-2 text-xs text-white border border-slate-700 focus:outline-none focus:border-indigo-500" placeholder="Say something..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} />
                <button onClick={handleSendMessage} className="bg-indigo-600 p-2 rounded-full text-white"><SendIcon className="w-4 h-4" /></button>
                <button onClick={() => setShowGiftModal(true)} className="bg-gradient-to-r from-pink-500 to-rose-500 p-2 rounded-full text-white"><GiftIcon className="w-4 h-4" /></button>
            </>
        )}
      </div>

      {showGameModal && !selectedGame && (
         <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 w-full max-w-xs rounded-2xl border border-amber-500/50 p-4 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-red-500"></div>
               <button onClick={() => setShowGameModal(false)} className="absolute top-2 right-2 text-slate-400 text-xs">✕</button>
               <h3 className="text-center font-bold text-lg mb-4 text-amber-400">🎮 Game Zone</h3>
               {gameResult && <div className="bg-slate-900 p-2 rounded-lg text-center mb-4 text-xs font-bold text-white border border-slate-700 animate-pulse">{gameResult}</div>}
               <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => playGame('777')} className="bg-gradient-to-b from-red-600 to-red-800 p-4 rounded-xl border border-red-500 hover:scale-105 transition-transform">
                     <div className="text-3xl mb-1">🎰</div><div className="font-bold text-xs">777 Slots</div><div className="text-[9px] text-red-200">Win 500</div>
                  </button>
                  <button onClick={() => playGame('GEDI')} className="bg-gradient-to-b from-green-600 to-green-800 p-4 rounded-xl border border-green-500 hover:scale-105 transition-transform">
                     <div className="text-3xl mb-1">🎲</div><div className="font-bold text-xs">Gedi</div><div className="text-[9px] text-green-200">Win 200</div>
                  </button>
                  <button onClick={() => setSelectedGame('LUDO')} className="col-span-2 bg-gradient-to-r from-blue-600 to-purple-600 p-4 rounded-xl border border-blue-400 hover:scale-105 transition-transform">
                     <div className="text-3xl mb-1">🎲</div><div className="font-bold text-xs">Play Ludo</div><div className="text-[9px] text-blue-200">New</div>
                  </button>
               </div>
               <p className="text-center text-[10px] text-slate-500 mt-4">Cost: 100 Coins per play (Slots/Gedi)</p>
            </div>
         </div>
      )}

      {/* Ludo Game Modal */}
      {showGameModal && selectedGame === 'LUDO' && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-sm rounded-2xl p-4 relative shadow-2xl">
                  <button onClick={() => { setSelectedGame(null); setShowGameModal(false); }} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-2 w-8 h-8 flex items-center justify-center font-bold shadow-lg">✕</button>
                  <h3 className="text-center font-bold text-slate-800 mb-4 text-xl">🎲 LUDO STAR</h3>
                  
                  {/* Mock Ludo Board Visual */}
                  <div className="w-full aspect-square bg-white border-2 border-slate-300 relative grid grid-cols-11 grid-rows-11 text-[0px] shadow-inner mb-4">
                      {/* Bases */}
                      <div className="col-span-4 row-span-4 bg-red-500 border-2 border-slate-800 rounded-lg m-1 relative"><div className="absolute inset-4 bg-white rounded-full flex items-center justify-center"><div className="w-8 h-8 bg-red-500 rounded-full animate-pulse"></div></div></div>
                      <div className="col-span-3 row-span-4 bg-white flex flex-col">{[...Array(12)].map((_,i) => <div key={i} className={`flex-1 border border-slate-200 ${i===1||i===4||i===7||i===10 ? 'bg-green-100' : ''}`}></div>)}</div>
                      <div className="col-span-4 row-span-4 bg-green-500 border-2 border-slate-800 rounded-lg m-1 relative"><div className="absolute inset-4 bg-white rounded-full flex items-center justify-center"><div className="w-8 h-8 bg-green-500 rounded-full"></div></div></div>
                      
                      <div className="col-span-4 row-span-3 bg-white flex">{[...Array(12)].map((_,i) => <div key={i} className={`flex-1 border border-slate-200`}></div>)}</div>
                      <div className="col-span-3 row-span-3 bg-slate-100 border flex items-center justify-center font-bold text-sm text-slate-400">HOME</div>
                      <div className="col-span-4 row-span-3 bg-white flex">{[...Array(12)].map((_,i) => <div key={i} className={`flex-1 border border-slate-200`}></div>)}</div>

                      <div className="col-span-4 row-span-4 bg-blue-500 border-2 border-slate-800 rounded-lg m-1 relative"><div className="absolute inset-4 bg-white rounded-full flex items-center justify-center"><div className="w-8 h-8 bg-blue-500 rounded-full"></div></div></div>
                      <div className="col-span-3 row-span-4 bg-white flex flex-col">{[...Array(12)].map((_,i) => <div key={i} className={`flex-1 border border-slate-200`}></div>)}</div>
                      <div className="col-span-4 row-span-4 bg-yellow-400 border-2 border-slate-800 rounded-lg m-1 relative"><div className="absolute inset-4 bg-white rounded-full flex items-center justify-center"><div className="w-8 h-8 bg-yellow-400 rounded-full"></div></div></div>
                  </div>

                  <div className="flex justify-between items-center bg-slate-100 p-4 rounded-xl">
                      <div className="text-center">
                          <div className={`text-xs font-bold ${ludoTurn === 'RED' ? 'text-red-500' : 'text-slate-400'}`}>Red</div>
                          <div className="text-lg font-bold text-slate-700">{ludoPos.RED}</div>
                      </div>
                      <button onClick={rollLudoDice} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-lg shadow-lg hover:bg-indigo-500 active:scale-95 transition-all">
                          Roll: {ludoDice}
                      </button>
                      <div className="text-center">
                          <div className={`text-xs font-bold ${ludoTurn === 'GREEN' ? 'text-green-500' : 'text-slate-400'}`}>Green</div>
                          <div className="text-lg font-bold text-slate-700">{ludoPos.GREEN}</div>
                      </div>
                  </div>
                  <div className="text-center mt-2 text-xs text-slate-400">Current Turn: <span className="font-bold uppercase">{ludoTurn}</span></div>
              </div>
          </div>
      )}

      {/* Gift Modal */}
      {showGiftModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end">
          <div className="w-full bg-slate-800 rounded-t-2xl p-4 border-t border-slate-700 animate-slide-up">
             <div className="flex justify-between items-center mb-3">
               <h3 className="font-bold text-sm text-white">Send Gift</h3>
               <div className="flex items-center gap-2"><span className="text-yellow-400 text-xs font-mono">{currentUser.coins} 🪙</span><button onClick={() => { setShowGiftModal(false); setShowWalletModal(true); }} className="bg-green-600 px-2 py-0.5 rounded text-[10px]">Topup</button></div>
             </div>
             <div className="grid grid-cols-3 gap-2 mb-4">
                {AVAILABLE_GIFTS.map(gift => (
                  <button key={gift.id} onClick={() => handleSendGift(gift)} className="flex flex-col items-center p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-transparent hover:border-indigo-500 transition-all">
                    <span className="text-xl mb-0.5">{gift.icon}</span><span className="text-[10px] font-medium text-slate-300">{gift.name}</span><span className="text-[9px] text-yellow-400">🪙 {gift.cost}</span>
                  </button>
                ))}
             </div>
             <button onClick={() => setShowGiftModal(false)} className="w-full text-center text-xs text-slate-500 py-2">Close</button>
          </div>
        </div>
      )}

      {/* Leave Room Modal */}
      {showLeaveConfirm && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
           <div className="bg-slate-800 rounded-2xl p-5 border border-slate-600 w-full max-w-[280px]">
              <h3 className="text-lg font-bold mb-2">Leave Room?</h3>
              <p className="text-sm text-slate-400 mb-5">Are you sure you want to exit the voice chat?</p>
              <div className="flex gap-3">
                 <button onClick={() => setShowLeaveConfirm(false)} className="flex-1 bg-slate-700 py-2 rounded-lg text-sm">Cancel</button>
                 <button onClick={leaveRoom} className="flex-1 bg-red-600 py-2 rounded-lg text-sm font-bold">Leave</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );

  const renderProfile = () => (
    <div className="min-h-screen pb-20 bg-slate-900 relative overflow-y-auto">
        {/* ... Existing Profile UI ... */}
        <div className="bg-gradient-to-b from-red-900 via-red-800 to-slate-900 pt-8 pb-4 px-4 rounded-b-[2rem] shadow-xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-40 h-40 bg-red-500/20 blur-3xl rounded-full pointer-events-none"></div>
             
             {/* Added Back Button for Profile */}
             <div className="flex justify-between items-center mb-4">
                 <button onClick={() => setCurrentView(AppView.HOME)} className="text-white/80 p-2 bg-black/20 rounded-full hover:bg-black/40">
                    ←
                 </button>
                 <button className="text-white/80"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></button>
             </div>

             <div className="flex items-center gap-3 mb-6">
                 <div className="relative">
                    <img src={currentUser.avatarUrl} className="w-16 h-16 rounded-full border-2 border-white/80" alt="profile" />
                 </div>
                 <div className="flex-1 text-white">
                     <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold">{currentUser.name}</h2>
                        {currentUser.isVip && <span className="bg-yellow-500 text-[8px] font-bold text-black px-1 rounded">SVIP</span>}
                     </div>
                     <div className="flex items-center gap-2 text-[10px] text-white/80 mt-1">
                        <span className="bg-white/20 px-1 rounded flex items-center gap-0.5">🇧🇩</span>
                        <span>ID: {currentUser.userId}</span>
                     </div>
                     <div className="flex gap-2 mt-1.5">
                        <span className="bg-slate-400/30 px-1.5 py-0.5 rounded-full text-[9px] border border-white/10">🪙 Lv.{currentUser.level}</span>
                     </div>
                 </div>
             </div>

             <div className="flex justify-between px-2 mb-4">
                 <div className="text-center">
                      <div className="font-bold text-white text-sm">0</div>
                      <div className="text-[10px] text-white/70">Visitor</div>
                 </div>
                 <div className="text-center cursor-pointer hover:bg-white/10 rounded-lg p-1" onClick={() => setShowFollowingList(true)}>
                      <div className="font-bold text-white text-sm">{currentUser.following}</div>
                      <div className="text-[10px] text-white/70">Following</div>
                 </div>
                 <div className="text-center">
                      <div className="font-bold text-white text-sm">{currentUser.followers}</div>
                      <div className="text-[10px] text-white/70">Followers</div>
                 </div>
                 <div className="text-center">
                      <div className="font-bold text-white text-sm">0</div>
                      <div className="text-[10px] text-white/70">Fans</div>
                 </div>
             </div>
        </div>
        
        {/* Profile Menu Items */}
        <div className="px-3 -mt-2">
            <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-xl p-3 flex justify-between items-center text-white relative overflow-hidden">
                    <div><div className="font-bold text-xs">Family</div><div className="text-[9px] flex items-center gap-1 mt-0.5">Check now <span className="text-[8px]">▶</span></div></div>
                    <div className="text-2xl">🛡️</div>
                </div>
                <div onClick={() => setShowWalletModal(true)} className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-xl p-3 flex justify-between items-center text-white cursor-pointer">
                    <div><div className="font-bold text-xs">Wallet</div><div className="text-[9px] flex items-center gap-1 mt-0.5">Recharge <span className="text-[8px]">▶</span></div></div>
                    <div className="text-2xl">🪙</div>
                </div>
            </div>
            
            <div className="bg-slate-800 rounded-2xl overflow-hidden mb-4 border border-slate-700">
                <div onClick={startEditing} className="flex items-center justify-between p-3 hover:bg-slate-700/50 cursor-pointer"><span className="text-xs">Edit Profile</span><span className="text-slate-400">›</span></div>
                <div onClick={() => setCurrentView(AppView.LOGIN)} className="flex items-center justify-between p-3 border-t border-slate-700 hover:bg-slate-700/50 cursor-pointer"><span className="text-xs text-red-400">Log Out</span></div>
            </div>

            {isEditing && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 w-full max-w-[280px] rounded-2xl p-4 border border-slate-700">
                        <h3 className="text-base font-bold mb-3">Edit Profile</h3>
                        <div className="space-y-2.5">
                            <input type="text" value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white" placeholder="Display Name" />
                        </div>
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => setIsEditing(false)} className="flex-1 bg-slate-700 text-white py-2 rounded-lg text-xs">Cancel</button>
                            <button onClick={saveProfile} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-xs">Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
        
        {/* Following List Modal */}
        {showFollowingList && (
           <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] flex items-center justify-center p-6">
              <div className="bg-slate-800 rounded-2xl w-full max-w-sm p-4 border border-slate-600 h-[60vh] flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-sm">Following ({currentUser.following})</h3>
                      <button onClick={() => setShowFollowingList(false)} className="text-slate-400">✕</button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2">
                     {currentUser.followingIds && currentUser.followingIds.length > 0 ? (
                        // Map through IDs. In a real app we'd fetch users. Here we try to find in mock data or show placeholder.
                        currentUser.followingIds.map(id => {
                            const foundUser = MOCK_LEADERBOARD.find(u => u.userId === id) || (id === SUPPORT_AGENT.userId ? SUPPORT_AGENT : null);
                            return (
                               <div key={id} className="bg-slate-700/50 p-2 rounded-xl flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                      <img src={foundUser?.avatarUrl || `https://api.dicebear.com/9.x/avataaars/svg?seed=${id}`} className="w-8 h-8 rounded-full" />
                                      <div>
                                          <div className="font-bold text-xs">{foundUser?.name || 'Unknown User'}</div>
                                          <div className="text-[10px] text-slate-400">ID: {id}</div>
                                      </div>
                                  </div>
                                  <button onClick={() => handleFollowUser(foundUser || { userId: id } as UserProfile)} className="bg-slate-600 text-[10px] px-2 py-1 rounded-full text-white">Unfollow</button>
                               </div>
                            );
                        })
                     ) : (
                        <div className="text-center text-slate-500 mt-10 text-xs">You are not following anyone yet.</div>
                     )}
                  </div>
              </div>
           </div>
        )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans w-full mx-auto relative shadow-2xl overflow-hidden text-sm">
      {currentView === AppView.LOGIN && renderLogin()}
      {currentView === AppView.HOME && renderHome()}
      {currentView === AppView.ROOM && renderRoom()}
      {currentView === AppView.RANKING && renderRanking()} 
      {currentView === AppView.PROFILE && renderProfile()}
      
      {/* AI Chat View */}
      {currentView === AppView.AI_CHAT && (
          <div className="flex flex-col h-screen bg-slate-900">
            <div className="p-3 pt-4 border-b border-slate-800 flex items-center gap-2"><button onClick={() => setCurrentView(AppView.HOME)} className="text-slate-400">←</button><div className="font-bold text-sm">Shakil AI Assistant</div></div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.isAi ? 'justify-start' : 'justify-end'}`}><div className={`max-w-[85%] p-2 rounded-2xl ${msg.isAi ? 'bg-slate-800 text-slate-200' : 'bg-indigo-600 text-white'}`}><p className="text-xs">{msg.text}</p></div></div>
                ))}
            </div>
            <div className="p-2 pb-16 border-t border-slate-800 flex gap-2"><input className="flex-1 bg-slate-800 rounded-full px-3 py-2 text-xs text-white" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Ask Nila..." /><button onClick={handleSendMessage} className="bg-indigo-600 p-2 rounded-full"><SendIcon className="w-4 h-4" /></button></div>
          </div>
      )}

      {/* Private Chat Modal */}
      {activePrivateChatUser && (
        <div className="absolute inset-0 bg-slate-900 z-[70] flex flex-col">
            <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center gap-3">
                <button onClick={() => setActivePrivateChatUser(null)} className="text-slate-400">←</button>
                <img src={activePrivateChatUser.avatarUrl} className="w-8 h-8 rounded-full" />
                <div>
                    <h3 className="font-bold text-sm">{activePrivateChatUser.name}</h3>
                    <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${activePrivateChatUser.isOnline ? 'bg-green-500' : 'bg-slate-500'}`}></div>
                        <span className="text-[10px] text-slate-400">{activePrivateChatUser.isOnline ? 'Online' : 'Offline'}</span>
                    </div>
                </div>
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-900">
                {(privateMessages[activePrivateChatUser.userId] || []).map(msg => (
                    <div key={msg.id} className={`flex ${msg.senderId === currentUser.userId ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-2xl text-xs ${msg.senderId === currentUser.userId ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none'}`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                {(privateMessages[activePrivateChatUser.userId] || []).length === 0 && (
                    <div className="text-center text-slate-500 mt-10 text-xs">Start messaging {activePrivateChatUser.name}</div>
                )}
            </div>
            <div className="p-3 border-t border-slate-800 bg-slate-800 flex gap-2">
                <input value={privateChatInput} onChange={(e) => setPrivateChatInput(e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded-full px-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500" placeholder="Type a message..." />
                <button onClick={sendPrivateMessage} className="bg-indigo-600 p-2 rounded-full text-white"><SendIcon className="w-4 h-4" /></button>
            </div>
        </div>
      )}

      {/* User Profile View Modal (When clicking a user) */}
      {viewingProfile && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[65] flex items-center justify-center p-6">
            <div className="bg-slate-800 rounded-3xl w-full max-w-sm border border-slate-600 relative overflow-hidden animate-slide-up">
                <button onClick={() => setViewingProfile(null)} className="absolute top-3 right-3 text-slate-400 z-10 bg-black/20 p-1 rounded-full">✕</button>
                <div className="h-24 bg-gradient-to-r from-indigo-600 to-purple-600"></div>
                <div className="px-5 pb-5">
                    <div className="relative -mt-10 mb-3 flex justify-between items-end">
                        <img src={viewingProfile.avatarUrl} className="w-20 h-20 rounded-full border-4 border-slate-800" />
                        <div className="flex gap-2 mb-1">
                            {viewingProfile.userId !== currentUser.userId && (
                                <button onClick={() => handleFollowUser(viewingProfile)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${currentUser.followingIds?.includes(viewingProfile.userId) ? 'bg-slate-600 text-slate-300' : 'bg-indigo-600 text-white'}`}>
                                   {currentUser.followingIds?.includes(viewingProfile.userId) ? 'Unfollow' : 'Follow'}
                                </button>
                            )}
                            <button onClick={() => openPrivateChat(viewingProfile)} className="bg-slate-700 text-white p-1.5 rounded-full"><SendIcon className="w-4 h-4" /></button>
                        </div>
                    </div>
                    
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        {viewingProfile.name}
                        {viewingProfile.isOnline && <span className="w-2.5 h-2.5 bg-green-500 rounded-full border border-slate-800"></span>}
                    </h2>
                    <p className="text-slate-400 text-xs mb-3">ID: {viewingProfile.userId}</p>
                    <p className="text-slate-300 text-sm mb-4">{viewingProfile.bio || "No bio available."}</p>

                    <div className="flex justify-between text-center bg-slate-900/50 p-3 rounded-xl mb-4">
                        <div><div className="font-bold text-sm">{viewingProfile.followers}</div><div className="text-[10px] text-slate-400">Followers</div></div>
                        <div><div className="font-bold text-sm">{viewingProfile.following}</div><div className="text-[10px] text-slate-400">Following</div></div>
                        <div><div className="font-bold text-sm">{viewingProfile.family !== "None" ? viewingProfile.family : "-"}</div><div className="text-[10px] text-slate-400">Family</div></div>
                    </div>

                    {/* GIFT HISTORY SECTION */}
                    <div className="bg-slate-900/50 p-3 rounded-xl mb-4">
                        <div className="text-[10px] text-slate-400 mb-2 uppercase font-bold tracking-wider">Gift Cabinet</div>
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            {viewingProfile.giftsReceived && Object.keys(viewingProfile.giftsReceived).length > 0 ? (
                                Object.entries(viewingProfile.giftsReceived).map(([giftId, count]) => {
                                    const gift = AVAILABLE_GIFTS.find(g => g.id === giftId);
                                    if (!gift) return null;
                                    return (
                                        <div key={giftId} className="flex flex-col items-center bg-slate-800 p-2 rounded-lg min-w-[60px] border border-slate-700">
                                            <span className="text-xl">{gift.icon}</span>
                                            <span className="text-[9px] font-bold text-slate-300 mt-1">x{count}</span>
                                        </div>
                                    )
                                })
                            ) : (
                                <div className="text-[10px] text-slate-500 w-full text-center py-2">No gifts received yet.</div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => { setShowGiftModal(true); /* viewingProfile remains active to target gift */ }} className="bg-gradient-to-r from-pink-500 to-rose-500 py-2.5 rounded-xl font-bold text-xs flex justify-center items-center gap-2"><GiftIcon className="w-4 h-4" /> Send Gift</button>
                        
                        {viewingProfile.family !== "None" && viewingProfile.family !== currentUser.family ? (
                            <button onClick={() => handleJoinFamily(viewingProfile)} className="bg-slate-700 border border-slate-600 py-2.5 rounded-xl font-bold text-xs">Join Family</button>
                        ) : (
                            <button disabled className="bg-slate-800 border border-slate-700 text-slate-500 py-2.5 rounded-xl font-bold text-xs cursor-not-allowed">Join Family</button>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Create Room Modal */}
      {showCreateRoomModal && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
            <div className="bg-slate-800 rounded-2xl w-full max-w-sm p-5 border border-slate-600 animate-slide-up">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Create Room</h3>
                    <button onClick={() => setShowCreateRoomModal(false)} className="text-slate-400">✕</button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">Room Name</label>
                        <input value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-indigo-500 focus:outline-none" placeholder="Ex: Chill Vibes" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">Category</label>
                        <div className="flex gap-2">
                            {['Chat', 'Music', 'Games'].map(cat => (
                                <button key={cat} onClick={() => setNewRoomCategory(cat)} className={`flex-1 py-2 rounded-lg text-xs font-bold border ${newRoomCategory === cat ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>{cat}</button>
                            ))}
                        </div>
                    </div>
                    <button onClick={createRoom} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold mt-2">Create & Join</button>
                </div>
            </div>
        </div>
      )}

      {/* Wallet Modal (Global) */}
      {showWalletModal && (
         <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end">
            <div className="w-full bg-slate-800 rounded-t-2xl p-5 border-t border-slate-700 animate-slide-up">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">My Wallet</h3>
                    <button onClick={() => setShowWalletModal(false)} className="text-slate-400">✕</button>
                </div>
                <div className="bg-slate-900 p-3 rounded-xl mb-4 flex justify-between items-center">
                    <div>
                        <p className="text-slate-400 text-xs">Current Balance</p>
                        <p className="text-xl font-bold text-yellow-400">{(currentUser.coins/1000000).toFixed(2)}M 🪙</p>
                    </div>
                    <div className="bg-yellow-400/10 p-2 rounded-lg">
                        <GiftIcon className="w-6 h-6 text-yellow-400" />
                    </div>
                </div>
                <div className="space-y-2">
                    {COIN_PACKAGES.map((pkg, i) => (
                        <button key={i} onClick={() => buyCoins(pkg.coins)} className="w-full flex justify-between items-center bg-slate-700/50 p-3 rounded-xl hover:bg-slate-700 border border-slate-600">
                            <div className="flex items-center gap-2">
                                <span className="text-yellow-400">🪙</span>
                                <span className="font-bold">{(pkg.coins/1000000)}M</span>
                            </div>
                            <span className="bg-indigo-600 px-3 py-1 rounded-lg text-xs font-bold">{pkg.price}</span>
                        </button>
                    ))}
                </div>
            </div>
         </div>
      )}
      
      {(currentView !== AppView.ROOM && currentView !== AppView.AI_CHAT && currentView !== AppView.LOGIN && !activePrivateChatUser) && renderNav()}
    </div>
  );
};

export default App;