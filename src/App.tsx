import React, { useState, useEffect, useRef } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  Timestamp, 
  User,
  handleFirestoreError,
  OperationType
} from './firebase';
import { 
  generateThesisTopics, 
  generateThesisSection, 
  getThinkingResponse 
} from './lib/gemini';
import { speakWithPriyanka } from './lib/elevenlabs';
import { cn } from './lib/utils';
import { 
  BookOpen, 
  MessageSquare, 
  User as UserIcon, 
  Plus, 
  Send, 
  LogOut, 
  Sparkles, 
  ChevronRight,
  Download,
  Trash2,
  Mic,
  Image as ImageIcon,
  Video,
  Paperclip,
  X,
  Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface ThesisTopic {
  title: string;
  description: string;
  type: string;
  tags: string[];
}

interface Thesis {
  id: string;
  title: string;
  branch: string;
  sections: Record<string, string>;
  createdAt: any;
}

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

// --- Components ---

const NeumorphicButton = ({ 
  children, 
  onClick, 
  className, 
  disabled, 
  variant = 'flat' 
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  className?: string; 
  disabled?: boolean;
  variant?: 'flat' | 'pressed' | 'rust';
}) => (
  <motion.button
    whileTap={{ scale: 0.95 }}
    whileHover={{ scale: 1.02 }}
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "neo-btn",
      variant === 'pressed' && "neo-pressed",
      variant === 'rust' && "bg-rust text-white shadow-none hover:bg-rust/90",
      disabled && "opacity-50 cursor-not-allowed",
      className
    )}
  >
    {children}
  </motion.button>
);

const BottomNav = ({ activeTab, setActiveTab, onVoiceClick }: { activeTab: string, setActiveTab: (t: string) => void, onVoiceClick: () => void }) => (
  <div className="bottom-nav">
    <button onClick={() => setActiveTab('theses')} className={cn("nav-item", activeTab === 'theses' && "nav-item-active")}>
      <BookOpen size={24} />
      <span className="text-[10px] font-medium">Theses</span>
    </button>
    <button onClick={() => setActiveTab('chat')} className={cn("nav-item", activeTab === 'chat' && "nav-item-active")}>
      <MessageSquare size={24} />
      <span className="text-[10px] font-medium">AI Chat</span>
    </button>
    <button onClick={onVoiceClick} className="nav-item group">
      <div className="p-4 bg-rust rounded-full -mt-12 shadow-lg group-hover:scale-110 transition-transform">
        <Volume2 size={24} className="text-white" />
      </div>
      <span className="text-[10px] font-medium mt-1">Priyanka</span>
    </button>
    <button onClick={() => setActiveTab('tools')} className={cn("nav-item", activeTab === 'tools' && "nav-item-active")}>
      <Sparkles size={24} />
      <span className="text-[10px] font-medium">AI Tools</span>
    </button>
    <button onClick={() => setActiveTab('profile')} className={cn("nav-item", activeTab === 'profile' && "nav-item-active")}>
      <UserIcon size={24} />
      <span className="text-[10px] font-medium">Profile</span>
    </button>
  </div>
);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('theses');
  const [loading, setLoading] = useState(true);
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [branch, setBranch] = useState('');
  const [keywords, setKeywords] = useState('');
  const [topics, setTopics] = useState<ThesisTopic[]>([]);
  const [generatingTopics, setGeneratingTopics] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<ThesisTopic | null>(null);
  const [generatingThesis, setGeneratingThesis] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'theses'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Thesis));
      setTheses(data.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'theses');
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFindTopics = async () => {
    if (!branch) return;
    setGeneratingTopics(true);
    try {
      const kwList = keywords.split(',').map(k => k.trim());
      const result = await generateThesisTopics(branch, kwList, attachedImage || undefined);
      setTopics(result);
    } catch (error) {
      console.error("Failed to find topics", error);
    } finally {
      setGeneratingTopics(false);
    }
  };

  const handleGenerateThesis = async (topic: ThesisTopic) => {
    if (!user) return;
    setGeneratingThesis(true);
    try {
      // Generate many sections to simulate a "long" thesis
      const sections = [
        'Abstract', 'Introduction', 'Literature Review', 'Methodology', 
        'System Design', 'Implementation', 'Results', 'Discussion', 'Conclusion'
      ];
      const generatedSections: Record<string, string> = {};
      
      for (const section of sections) {
        const text = await generateThesisSection(section, `Topic: ${topic.title}. Description: ${topic.description}. This is a deep-dive academic section.`);
        generatedSections[section] = text;
      }

      await addDoc(collection(db, 'theses'), {
        userId: user.uid,
        title: topic.title,
        branch,
        keywords: keywords.split(',').map(k => k.trim()),
        sections: generatedSections,
        createdAt: Timestamp.now()
      });
      
      setSelectedTopic(null);
      setTopics([]);
      setActiveTab('theses');
      setAttachedImage(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'theses');
    } finally {
      setGeneratingThesis(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !user) return;
    const userMsg: ChatMessage = { role: 'user', content: chatInput, timestamp: new Date().toISOString() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsThinking(true);

    try {
      const response = await getThinkingResponse(chatInput);
      const modelMsg: ChatMessage = { role: 'model', content: response, timestamp: new Date().toISOString() };
      setChatMessages(prev => [...prev, modelMsg]);
    } catch (error) {
      console.error("Chat failed", error);
    } finally {
      setIsThinking(false);
    }
  };

  const handleVoiceClick = () => {
    const text = "Haan batao aap kya jaanna chahte hain? Kya aap kisi mein badlaav karwana chahte hain ya aapko kuch samajhna hai topic ke baare mein?";
    speakWithPriyanka(text);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-rust border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-cream">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="neo-card max-w-md w-full text-center space-y-8 animate-float"
        >
          <div className="w-24 h-24 bg-rust/10 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner">
            <Sparkles className="text-rust" size={48} />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-ink">Thesis Studio</h1>
            <p className="text-muted font-medium">Build by useless · AI Research Companion</p>
          </div>
          <NeumorphicButton onClick={handleLogin} variant="rust" className="w-full py-5 text-lg">
            Sign in with Google
          </NeumorphicButton>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream pb-32">
      {/* --- Header --- */}
      <header className="p-8 flex items-center justify-between sticky top-0 bg-cream/80 backdrop-blur-md z-40">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rust rounded-xl shadow-lg">
            <Sparkles className="text-white" size={20} />
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-dark">THESIS STUDIO</h1>
        </div>
        <div className="flex items-center gap-4">
          <motion.img 
            whileHover={{ scale: 1.1 }}
            src={user.photoURL || ''} 
            className="w-12 h-12 rounded-2xl border-2 border-white shadow-xl cursor-pointer" 
            alt="profile" 
            onClick={() => setActiveTab('profile')}
          />
        </div>
      </header>

      <main className="p-6 max-w-3xl mx-auto space-y-12">
        <AnimatePresence mode="wait">
          {activeTab === 'theses' && (
            <motion.div 
              key="theses"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black text-dark">Your Research</h2>
                  <p className="text-muted text-sm font-medium">Manage your academic projects</p>
                </div>
                <NeumorphicButton onClick={() => setActiveTab('new')} className="p-4 rounded-2xl">
                  <Plus size={24} />
                </NeumorphicButton>
              </div>

              {theses.length === 0 ? (
                <div className="neo-card text-center py-20 space-y-6">
                  <div className="w-20 h-20 bg-paper rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <BookOpen className="text-muted/40" size={40} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xl font-bold text-muted">No research found</p>
                    <p className="text-sm text-muted/60 max-w-xs mx-auto">Start your first AI-powered thesis by clicking the button below.</p>
                  </div>
                  <NeumorphicButton onClick={() => setActiveTab('new')} variant="rust" className="px-10">
                    Create New Thesis
                  </NeumorphicButton>
                </div>
              ) : (
                <div className="grid gap-6">
                  {theses.map((t) => (
                    <motion.div 
                      key={t.id} 
                      whileHover={{ y: -5 }}
                      className="neo-card space-y-4 group"
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <h3 className="font-black text-xl text-dark group-hover:text-rust transition-colors">{t.title}</h3>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black bg-rust/10 text-rust px-2 py-1 rounded-md uppercase tracking-wider">{t.branch}</span>
                            <span className="text-[10px] text-muted font-bold">{new Date(t.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <NeumorphicButton className="p-2 rounded-xl">
                            <Download size={18} />
                          </NeumorphicButton>
                          <NeumorphicButton className="p-2 rounded-xl text-red-500">
                            <Trash2 size={18} />
                          </NeumorphicButton>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-2">
                        {Object.keys(t.sections).map(s => (
                          <span key={s} className="text-[10px] font-bold bg-white/50 px-3 py-1.5 rounded-lg border border-white shadow-sm">{s}</span>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'new' && (
            <motion.div 
              key="new"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="space-y-8"
            >
              <div className="flex items-center gap-4">
                <NeumorphicButton onClick={() => setActiveTab('theses')} className="p-3 rounded-xl">
                  <X size={20} />
                </NeumorphicButton>
                <h2 className="text-3xl font-black text-dark">New Research</h2>
              </div>

              <div className="neo-card space-y-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-[0.2em] text-muted ml-1">Engineering Branch</label>
                    <select 
                      value={branch} 
                      onChange={(e) => setBranch(e.target.value)}
                      className="w-full bg-cream shadow-inner rounded-2xl p-4 outline-none border-2 border-transparent focus:border-rust transition-all font-bold text-dark"
                    >
                      <option value="">Select Branch</option>
                      <option>Computer Science & Engineering</option>
                      <option>Electronics & Communication</option>
                      <option>Mechanical Engineering</option>
                      <option>Civil Engineering</option>
                      <option>Data Science & AI</option>
                      <option>Biotechnology</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-[0.2em] text-muted ml-1">Research Keywords</label>
                    <input 
                      type="text" 
                      value={keywords}
                      onChange={(e) => setKeywords(e.target.value)}
                      placeholder="e.g. Neural Networks, Sustainable Energy..."
                      className="w-full bg-cream shadow-inner rounded-2xl p-4 outline-none border-2 border-transparent focus:border-rust transition-all font-bold text-dark"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-[0.2em] text-muted ml-1">Topic Image (Optional)</label>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-32 bg-cream shadow-inner rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-rust transition-all overflow-hidden"
                    >
                      {attachedImage ? (
                        <img src={attachedImage} className="w-full h-full object-cover" alt="preview" />
                      ) : (
                        <>
                          <Paperclip className="text-muted mb-2" />
                          <span className="text-xs font-bold text-muted">Upload image for AI analysis</span>
                        </>
                      )}
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                  </div>
                </div>

                <NeumorphicButton 
                  onClick={handleFindTopics} 
                  disabled={!branch || generatingTopics}
                  variant="rust"
                  className="w-full py-5 text-lg font-black"
                >
                  {generatingTopics ? (
                    <div className="flex items-center justify-center gap-3">
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                      ANALYZING...
                    </div>
                  ) : "FIND RESEARCH TOPICS"}
                </NeumorphicButton>
              </div>

              {topics.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <h3 className="text-xl font-black text-dark ml-1">Suggested Topics</h3>
                  <div className="grid gap-6">
                    {topics.map((t, i) => (
                      <motion.div 
                        key={i} 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0, transition: { delay: i * 0.1 } }}
                        onClick={() => setSelectedTopic(t)}
                        className={cn(
                          "neo-card cursor-pointer transition-all border-4", 
                          selectedTopic === t ? "border-rust" : "border-transparent"
                        )}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-black text-lg text-dark">{t.title}</h4>
                          <span className="text-[10px] font-black bg-paper px-2 py-1 rounded-md border border-border">{t.type}</span>
                        </div>
                        <p className="text-sm text-muted font-medium leading-relaxed">{t.description}</p>
                        <div className="flex flex-wrap gap-2 mt-4">
                          {t.tags.map(tag => <span key={tag} className="text-[10px] font-bold bg-cream px-3 py-1.5 rounded-lg shadow-sm">#{tag}</span>)}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  {selectedTopic && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="sticky bottom-32"
                    >
                      <NeumorphicButton 
                        onClick={() => handleGenerateThesis(selectedTopic)}
                        disabled={generatingThesis}
                        variant="rust"
                        className="w-full py-6 text-xl font-black shadow-2xl"
                      >
                        {generatingThesis ? (
                          <div className="flex items-center justify-center gap-3">
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-6 h-6 border-3 border-white border-t-transparent rounded-full" />
                            WRITING 50+ PAGES...
                          </div>
                        ) : "START DEEP THESIS WRITING"}
                      </NeumorphicButton>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div 
              key="chat"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col h-[calc(100vh-280px)]"
            >
              <div className="flex-1 overflow-y-auto space-y-6 p-4 scrollbar-hide">
                {chatMessages.length === 0 && (
                  <div className="text-center py-20 space-y-6">
                    <div className="w-24 h-24 bg-rust/10 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-inner">
                      <MessageSquare className="text-rust" size={40} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-2xl font-black text-dark">Research Assistant</p>
                      <p className="text-sm text-muted font-medium">Ask me anything about your MTech thesis</p>
                    </div>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}
                  >
                    <div className={cn(
                      "max-w-[85%] p-5 rounded-[2rem] shadow-lg font-medium leading-relaxed",
                      msg.role === 'user' ? "bg-rust text-white rounded-tr-none" : "bg-white text-ink rounded-tl-none border border-white"
                    )}>
                      {msg.content}
                    </div>
                  </motion.div>
                ))}
                {isThinking && (
                  <div className="flex justify-start">
                    <div className="bg-white p-5 rounded-[2rem] rounded-tl-none shadow-lg flex gap-2">
                      <span className="w-2.5 h-2.5 bg-rust rounded-full animate-bounce" />
                      <span className="w-2.5 h-2.5 bg-rust rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="w-2.5 h-2.5 bg-rust rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              
              <div className="mt-6 flex gap-3 p-2">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type your research query..."
                  className="flex-1 bg-cream shadow-inner rounded-[2rem] px-6 py-4 outline-none border-2 border-transparent focus:border-rust transition-all font-bold text-dark"
                />
                <NeumorphicButton onClick={handleSendMessage} className="p-4 rounded-full">
                  <Send size={24} />
                </NeumorphicButton>
              </div>
            </motion.div>
          )}

          {activeTab === 'tools' && (
            <motion.div 
              key="tools"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <h2 className="text-3xl font-black text-dark">AI Research Tools</h2>
              <div className="grid gap-6">
                <div className="neo-card space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-rust/10 rounded-2xl">
                      <ImageIcon className="text-rust" size={28} />
                    </div>
                    <h3 className="text-xl font-black text-dark">Image Generation</h3>
                  </div>
                  <p className="text-sm text-muted font-medium leading-relaxed">Create high-fidelity research diagrams, flowcharts, or conceptual illustrations.</p>
                  <input type="text" placeholder="Describe the diagram..." className="w-full bg-cream shadow-inner rounded-2xl p-4 outline-none border-2 border-transparent focus:border-rust transition-all font-bold text-dark" />
                  <div className="flex gap-3">
                    {['1K', '2K', '4K'].map(s => (
                      <button key={s} className="flex-1 py-3 bg-cream shadow-inner rounded-xl text-xs font-black text-muted hover:text-rust transition-colors">{s}</button>
                    ))}
                  </div>
                  <NeumorphicButton variant="rust" className="w-full py-4 font-black">GENERATE DIAGRAM</NeumorphicButton>
                </div>

                <div className="neo-card space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-rust/10 rounded-2xl">
                      <Video className="text-rust" size={28} />
                    </div>
                    <h3 className="text-xl font-black text-dark">Video Synthesis</h3>
                  </div>
                  <p className="text-sm text-muted font-medium leading-relaxed">Animate your research findings into professional 16:9 or 9:16 presentations.</p>
                  <NeumorphicButton variant="rust" className="w-full py-4 font-black">UPLOAD & ANIMATE</NeumorphicButton>
                </div>

                <div className="neo-card space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-rust/10 rounded-2xl">
                      <Mic className="text-rust" size={28} />
                    </div>
                    <h3 className="text-xl font-black text-dark">Voice & Transcription</h3>
                  </div>
                  <p className="text-sm text-muted font-medium leading-relaxed">Transcribe interviews or have a real-time voice conversation with the AI.</p>
                  <div className="flex gap-4">
                    <NeumorphicButton className="flex-1 font-black">LIVE API</NeumorphicButton>
                    <NeumorphicButton className="flex-1 font-black">TRANSCRIBE</NeumorphicButton>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="neo-card text-center space-y-6">
                <div className="relative inline-block">
                  <img src={user.photoURL || ''} className="w-32 h-32 rounded-[2.5rem] mx-auto border-4 border-white shadow-2xl" alt="profile" />
                  <div className="absolute -bottom-2 -right-2 bg-rust p-2 rounded-xl shadow-lg">
                    <Sparkles size={16} className="text-white" />
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-black text-dark">{user.displayName}</h2>
                  <p className="text-muted font-bold">{user.email}</p>
                </div>
                <div className="grid grid-cols-2 gap-6 pt-4">
                  <div className="neo-pressed p-6 rounded-[2rem]">
                    <div className="text-3xl font-black text-rust">{theses.length}</div>
                    <div className="text-[10px] uppercase font-black text-muted tracking-widest">Projects</div>
                  </div>
                  <div className="neo-pressed p-6 rounded-[2rem]">
                    <div className="text-3xl font-black text-rust">{chatMessages.length}</div>
                    <div className="text-[10px] uppercase font-black text-muted tracking-widest">Messages</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <NeumorphicButton className="w-full flex items-center justify-between py-5">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-rust/10 rounded-xl"><Mic size={20} className="text-rust" /></div>
                    <span className="font-bold">Voice Settings</span>
                  </div>
                  <ChevronRight size={20} className="text-muted" />
                </NeumorphicButton>
                <NeumorphicButton className="w-full flex items-center justify-between py-5">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-rust/10 rounded-xl"><ImageIcon size={20} className="text-rust" /></div>
                    <span className="font-bold">Image Assets</span>
                  </div>
                  <ChevronRight size={20} className="text-muted" />
                </NeumorphicButton>
              </div>

              <NeumorphicButton onClick={handleLogout} className="w-full py-5 text-red-500 font-black">
                <LogOut size={20} className="inline mr-2" />
                SIGN OUT
              </NeumorphicButton>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} onVoiceClick={handleVoiceClick} />
    </div>
  );
}
