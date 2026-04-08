import { jsPDF } from 'jspdf';
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
  getTeacherResponse,
  generateSpeech
} from './lib/gemini';
import { generateThesisPDF } from './lib/pdfGenerator';
import { generateWithNvidia, generateWithOpenRouter, getGeminiTTS } from './services/aiService';
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
  Volume2,
  LayoutGrid,
  ChevronLeft,
  MoreHorizontal,
  Monitor,
  Search,
  FileText,
  ArrowUpRight,
  Globe,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface ThesisTopic {
  id?: string;
  title: string;
  description: string;
  type: string;
  tags: string[];
  userId?: string;
  createdAt?: any;
}

interface Thesis {
  id: string;
  title: string;
  branch: string;
  sections: Record<string, string>;
  createdAt: any;
  userId: string;
}

interface ChatMessage {
  id?: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  status?: 'sent' | 'read';
  userId?: string;
}

interface Resource {
  id?: string;
  title: string;
  source: string;
  desc: string;
  content: string;
  userId?: string;
  createdAt?: any;
}

// --- Helpers ---
const toBase64 = (str: string) => {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch (e) {
    return str;
  }
};

const fromBase64 = (str: string) => {
  try {
    return decodeURIComponent(escape(atob(str)));
  } catch (e) {
    return str;
  }
};

const encodeStrings = (obj: any): any => {
  if (typeof obj === 'string') return toBase64(obj);
  if (Array.isArray(obj)) return obj.map(encodeStrings);
  if (typeof obj === 'object' && obj !== null && !(obj instanceof Timestamp)) {
    const encoded: any = {};
    for (const key in obj) {
      encoded[key] = encodeStrings(obj[key]);
    }
    return encoded;
  }
  return obj;
};

const decodeStrings = (obj: any): any => {
  if (typeof obj === 'string') return fromBase64(obj);
  if (Array.isArray(obj)) return obj.map(decodeStrings);
  if (typeof obj === 'object' && obj !== null && !(obj instanceof Timestamp)) {
    const decoded: any = {};
    for (const key in obj) {
      decoded[key] = decodeStrings(obj[key]);
    }
    return decoded;
  }
  return obj;
};

// --- Components ---

const VoiceTeacherPopup = ({ 
  isOpen, 
  onClose, 
  mode, 
  user, 
  notes, 
  status, 
  isListening 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  mode: 'interview' | 'teaching' | 'resources';
  user: User | null;
  notes: string[];
  status: string;
  isListening: boolean;
}) => {
  const notesEndRef = useRef<HTMLDivElement>(null);
  const [countdown, setCountdown] = useState(10);
  const [isClassStarted, setIsClassStarted] = useState(false);
  const [isPreparing, setIsPreparing] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    let timer: any;
    if (isOpen && isPreparing) {
      setCountdown(10);
      timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsPreparing(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen, isPreparing]);

  useEffect(() => {
    notesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [notes]);

  const handleStartClass = () => {
    setIsClassStarted(true);
    setIsPaused(false);
    const text = `Namaste ${user?.displayName?.split(' ')[0]}! Main Priyanka hoon. Aaj hum aapki MTech thesis ke baare mein baat karenge.`;
    generateSpeech(text);
  };

  const handleStopClass = () => {
    setIsClassStarted(false);
    onClose();
  };

  const handleHoldClass = () => {
    setIsPaused(!isPaused);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-white flex flex-col overflow-hidden"
        >
          {/* Vibrant Background */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] right-[-10%] w-[80%] h-[60%] bg-accent-pink/20 blur-[120px] rounded-full" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[80%] h-[60%] bg-gold/30 blur-[120px] rounded-full" />
            <div className="absolute top-[20%] left-[-20%] w-[60%] h-[50%] bg-accent-purple/10 blur-[100px] rounded-full" />
          </div>

          {/* Header */}
          <div className="p-6 flex items-center justify-between relative z-10">
            <NeumorphicButton onClick={onClose} className="p-3 rounded-2xl bg-white/80 backdrop-blur-md shadow-sm border border-white/40">
              <ChevronLeft size={24} className="text-dark" />
            </NeumorphicButton>
            <div className="text-center">
              <h2 className="text-lg font-black text-dark tracking-tighter">Priyanka AI</h2>
              <p className="text-[10px] text-muted font-black uppercase tracking-[0.2em]">{mode} Mode</p>
            </div>
            <div className="w-12" /> {/* Spacer */}
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8 relative z-10 overflow-hidden">
            {isPreparing ? (
              <div className="text-center space-y-6">
                <div className="relative">
                  <div className="w-32 h-32 rounded-full border-4 border-rust/20 flex items-center justify-center mx-auto">
                    <span className="text-4xl font-black text-rust">{countdown}</span>
                  </div>
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, ease: "linear" }}
                    className="absolute inset-0 border-t-4 border-rust rounded-full"
                  />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-dark tracking-tight">Teacher will talk soon</h3>
                  <p className="text-sm text-muted font-bold uppercase tracking-widest">Preparing your research session...</p>
                </div>
              </div>
            ) : !isClassStarted ? (
              <div className="text-center space-y-8">
                <div className="w-24 h-24 bg-rust/10 rounded-[2rem] flex items-center justify-center mx-auto animate-bounce">
                  <Volume2 size={40} className="text-rust" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-dark tracking-tight">Ready to Start</h3>
                  <p className="text-sm text-muted font-bold uppercase tracking-widest">Priyanka is waiting for you</p>
                </div>
                <NeumorphicButton 
                  onClick={handleStartClass}
                  variant="rust"
                  className="px-12 py-5 rounded-[2rem] text-sm font-black uppercase tracking-widest shadow-2xl animate-glow"
                >
                  Start Class
                </NeumorphicButton>
              </div>
            ) : (
              <>
                <div className="text-center space-y-2">
                  <p className="text-lg font-bold text-dark/60 tracking-tight">
                    {isPaused ? "Class Paused" : (isListening ? "Listening..." : "Priyanka is teaching")}
                  </p>
                </div>

                {/* Waveform Visualization */}
                <div className="flex items-center justify-center gap-3 h-32">
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{
                        height: (isListening && !isPaused) ? [40, 100, 60, 80, 40] : [40, 50, 40],
                        opacity: (isListening && !isPaused) ? [0.4, 1, 0.4] : 0.4
                      }}
                      transition={{
                        duration: 0.8,
                        repeat: Infinity,
                        delay: i * 0.1,
                        ease: "easeInOut"
                      }}
                      className="w-3 bg-rust rounded-full shadow-sm"
                    />
                  ))}
                </div>

                {/* Animated Notes List - Moving Up */}
                <div className="w-full max-w-sm h-64 overflow-y-auto scrollbar-hide space-y-4 p-4">
                  <AnimatePresence mode="popLayout">
                    {notes.map((note, i) => (
                      <motion.div
                        key={`note-${i}`}
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="neo-card p-4 bg-white/80 backdrop-blur-md border-white/40 shadow-md"
                      >
                        <p className="text-sm font-bold text-dark leading-relaxed">{note}</p>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <div ref={notesEndRef} />
                </div>
              </>
            )}
          </div>

          {/* Footer Controls */}
          {isClassStarted && (
            <div className="p-10 flex items-center justify-center gap-6 relative z-10">
              <NeumorphicButton 
                onClick={handleHoldClass}
                className={cn(
                  "p-5 rounded-full shadow-sm border border-white/40 transition-all",
                  isPaused ? "bg-rust text-white" : "bg-white/80 backdrop-blur-md text-dark"
                )}
              >
                {isPaused ? <Sparkles size={24} /> : <Monitor size={24} />}
              </NeumorphicButton>
              
              <div className="relative">
                <motion.div
                  animate={{ scale: (isListening && !isPaused) ? [1, 1.2, 1] : 1 }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 bg-rust/20 blur-2xl rounded-full"
                />
                <NeumorphicButton 
                  variant="rust"
                  className={cn(
                    "p-8 rounded-full border-none shadow-2xl relative z-10 transition-all",
                    (!isListening || isPaused) && "opacity-50 grayscale"
                  )}
                >
                  <Mic size={32} />
                </NeumorphicButton>
              </div>

              <NeumorphicButton onClick={handleStopClass} className="p-5 rounded-full bg-red-50 shadow-sm border border-red-100">
                <X size={24} className="text-red-500" />
              </NeumorphicButton>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const ResourcesPage = ({ isOpen, onClose, user, resources }: { isOpen: boolean; onClose: () => void; user: User | null; resources: Resource[] }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  const startAnalysis = () => {
    if (!user) return;
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    
    const interval = setInterval(async () => {
      setAnalysisProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsAnalyzing(false);
          
          const mockResources = [
            { 
              title: "University Libraries", 
              source: "IEEE Xplore / ACM Digital Library", 
              desc: "Access to institutional repositories and high-impact journals.",
              content: "This resource provides access to over 5 million documents from IEEE and ACM, covering the latest research in Computer Science and Engineering. It includes conference papers, journals, and technical standards essential for your MTech thesis."
            },
            { 
              title: "Media & News", 
              source: "TechCrunch / MIT Tech Review", 
              desc: "Current events and industry trends in AI and Robotics.",
              content: "Stay updated with the latest industry shifts. This resource aggregates news from top-tier tech publications, providing context on how research is being applied in the real world today."
            },
            { 
              title: "Wiki & Open Data", 
              source: "Kaggle / UCI Machine Learning", 
              desc: "Collaborative knowledge bases and open datasets.",
              content: "Access thousands of open-source datasets for your experiments. From road safety data to pothole detection benchmarks, these repositories are the backbone of modern data-driven research."
            },
            { 
              title: "Own Research", 
              source: "Local Experimental Data", 
              desc: "Experimental data and analysis from your own lab.",
              content: "A dedicated space for your primary research data. Organize your findings, experimental logs, and preliminary results to ensure a structured approach to your thesis writing."
            }
          ];

          // Save to Firebase
          mockResources.forEach(async (res) => {
            await addDoc(collection(db, 'resources'), encodeStrings({
              ...res,
              userId: user.uid,
              createdAt: Timestamp.now()
            }));
          });
          
          return 100;
        }
        return prev + 2;
      });
    }, 50);
  };

  const downloadPDF = (res: any) => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text(res.title, 20, 20);
    doc.setFontSize(12);
    doc.text(`Source: ${res.source}`, 20, 30);
    doc.line(20, 35, 190, 35);
    
    const splitText = doc.splitTextToSize(res.content, 170);
    doc.text(splitText, 20, 45);
    
    doc.save(`${res.title.replace(/\s+/g, '_')}_Resource.pdf`);
  };

  const downloadAllPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(24);
    doc.text("Complete Research Resources", 20, 20);
    doc.line(20, 25, 190, 25);
    
    let yPos = 40;
    resources.forEach((res, i) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(18);
      doc.text(`${i + 1}. ${res.title}`, 20, yPos);
      yPos += 10;
      doc.setFontSize(10);
      doc.text(`Source: ${res.source}`, 20, yPos);
      yPos += 10;
      doc.setFontSize(12);
      const splitText = doc.splitTextToSize(res.content, 170);
      doc.text(splitText, 20, yPos);
      yPos += splitText.length * 7 + 15;
    });
    
    doc.save("All_Research_Resources.pdf");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          className="fixed inset-0 z-[110] bg-cream flex flex-col"
        >
          <div className="p-6 flex items-center gap-4 border-b border-white/40 bg-white/50 backdrop-blur-md">
            <NeumorphicButton onClick={onClose} className="p-2.5 rounded-xl bg-white shadow-sm">
              <ChevronLeft size={20} className="text-dark" />
            </NeumorphicButton>
            <h2 className="text-xl font-black text-dark tracking-tighter">Research Resources</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            <div className="neo-card hero-gradient border-none p-6 space-y-4 shadow-sm relative overflow-hidden">
              {isAnalyzing && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-6 space-y-4">
                  <div className="w-full bg-cream h-2 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${analysisProgress}%` }}
                      className="h-full bg-rust"
                    />
                  </div>
                  <p className="text-[10px] font-black text-rust uppercase tracking-widest animate-pulse">Analyzing Global Models & Datasets...</p>
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rust/10 rounded-xl">
                  <BookOpen className="text-rust" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-dark leading-tight">Resource Teacher</h3>
                  <p className="text-[9px] text-muted font-black uppercase tracking-widest">Global Analysis Ready</p>
                </div>
              </div>
              <p className="text-xs text-muted font-bold leading-relaxed">
                I can help you find the best academic sources for your thesis. From university libraries to global research databases.
              </p>
              <NeumorphicButton 
                onClick={startAnalysis}
                disabled={isAnalyzing}
                className="w-full py-3 vibrant-gradient text-white border-none font-black uppercase tracking-widest text-[10px] animate-glow"
              >
                {resources.length > 0 ? "Re-Analyze Resources" : "Start Research Session"}
              </NeumorphicButton>
            </div>

            {resources.length > 0 && (
              <div className="grid grid-cols-1 gap-4">
                {resources.map((res, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="neo-card p-5 space-y-4 group hover:bg-white transition-all border-white/60"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h4 className="font-black text-dark text-base">{res.title}</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] font-black text-rust uppercase tracking-widest">Get from:</span>
                          <span className="text-[9px] font-bold text-muted">{res.source}</span>
                        </div>
                      </div>
                      <div className="p-2 bg-cream rounded-lg">
                        <Globe size={16} className="text-rust" />
                      </div>
                    </div>
                    
                    <p className="text-[11px] text-muted font-medium leading-relaxed">{res.desc}</p>
                    
                    <div className="flex gap-3 pt-2">
                      <NeumorphicButton 
                        onClick={() => setSelectedResource(res)}
                        className="flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest bg-cream border-none"
                      >
                        View Details
                      </NeumorphicButton>
                      <NeumorphicButton 
                        onClick={() => downloadPDF(res)}
                        className="p-2.5 rounded-xl bg-rust/10 text-rust border-none"
                      >
                        <Download size={16} />
                      </NeumorphicButton>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {resources.length > 0 && (
              <div className="pt-4">
                <NeumorphicButton 
                  onClick={downloadAllPDF}
                  className="w-full py-4 bg-dark text-white border-none font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                >
                  <FileText size={16} /> Download All Resources (PDF)
                </NeumorphicButton>
              </div>
            )}
          </div>

          {/* Resource Detail Popup */}
          <AnimatePresence>
            {selectedResource && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6"
                onClick={() => setSelectedResource(null)}
              >
                <motion.div 
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 20 }}
                  className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 space-y-6 shadow-2xl"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-dark tracking-tight">{selectedResource.title}</h3>
                    <p className="text-[10px] text-rust font-black uppercase tracking-widest">Source: {selectedResource.source}</p>
                  </div>
                  <div className="max-h-60 overflow-y-auto pr-2 scrollbar-hide">
                    <p className="text-sm text-muted font-bold leading-relaxed">
                      {selectedResource.content}
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <NeumorphicButton 
                      onClick={() => downloadPDF(selectedResource)}
                      variant="rust"
                      className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest"
                    >
                      Download PDF
                    </NeumorphicButton>
                    <NeumorphicButton 
                      onClick={() => setSelectedResource(null)}
                      className="px-6 py-4 text-[10px] font-black uppercase tracking-widest bg-cream border-none"
                    >
                      Close
                    </NeumorphicButton>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const NeumorphicButton = ({ 
  children, 
  onClick, 
  className, 
  disabled, 
  variant = 'flat' 
}: { 
  children: React.ReactNode; 
  onClick?: (e: React.MouseEvent) => void; 
  className?: string; 
  disabled?: boolean;
  variant?: 'flat' | 'pressed' | 'rust' | 'premium';
}) => (
  <motion.button
    whileTap={{ scale: 0.95 }}
    whileHover={{ scale: 1.02 }}
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "neo-btn",
      variant === 'pressed' && "neo-pressed",
      variant === 'rust' && "vibrant-gradient text-white border-none shadow-lg hover:shadow-xl",
      variant === 'premium' && "premium-btn vibrant-gradient border-none",
      disabled && "opacity-50 cursor-not-allowed",
      className
    )}
  >
    {children}
  </motion.button>
);

const BottomNav = ({ activeTab, setActiveTab, onVoiceClick }: { activeTab: string, setActiveTab: (t: string) => void, onVoiceClick: () => void }) => (
  <motion.div 
    initial={{ y: 100 }}
    animate={{ y: 0 }}
    className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-md glass-card h-16 flex items-center justify-around px-2 z-50 rounded-[2rem] shadow-[0_10px_30px_rgba(0,0,0,0.1)]"
  >
    <div className="flex items-center justify-between w-full px-4">
      <div className="flex items-center gap-6">
        <motion.button 
          whileHover={{ y: -2 }}
          onClick={() => setActiveTab('dashboard')} 
          className={cn("flex flex-col items-center gap-0.5 transition-all duration-300", activeTab === 'dashboard' ? "text-rust scale-110 font-black" : "text-muted/60")}
        >
          <LayoutGrid size={18} />
          <span className="text-[7px] font-black uppercase tracking-tighter">Home</span>
        </motion.button>
        <motion.button 
          whileHover={{ y: -2 }}
          onClick={() => setActiveTab('theses')} 
          className={cn("flex flex-col items-center gap-0.5 transition-all duration-300", activeTab === 'theses' ? "text-rust scale-110 font-black" : "text-muted/60")}
        >
          <BookOpen size={18} />
          <span className="text-[7px] font-black uppercase tracking-tighter">Classes</span>
        </motion.button>
      </div>
      
      <div className="relative -top-6">
        <div className="absolute inset-0 bg-rust/30 blur-xl rounded-full animate-pulse" />
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={onVoiceClick}
          className="p-4 bg-rust rounded-full shadow-[0_8px_25px_rgba(181,69,27,0.5)] border-4 border-white relative z-10 voice-wave"
        >
          <Volume2 size={24} className="text-white" />
        </motion.button>
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="text-[6px] font-black text-rust uppercase tracking-[0.2em]">PRIYANKA</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <motion.button 
          whileHover={{ y: -2 }}
          onClick={() => setActiveTab('tools')} 
          className={cn("flex flex-col items-center gap-0.5 transition-all duration-300", activeTab === 'tools' ? "text-rust scale-110 font-black" : "text-muted/60")}
        >
          <Sparkles size={18} />
          <span className="text-[7px] font-black uppercase tracking-tighter">AI Tools</span>
        </motion.button>
        <motion.button 
          whileHover={{ y: -2 }}
          onClick={() => setActiveTab('profile')} 
          className={cn("flex flex-col items-center gap-0.5 transition-all duration-300", activeTab === 'profile' ? "text-rust scale-110 font-black" : "text-muted/60")}
        >
          <UserIcon size={18} />
          <span className="text-[7px] font-black uppercase tracking-tighter">Profile</span>
        </motion.button>
      </div>
    </div>
  </motion.div>
);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [branch, setBranch] = useState('Computer Science & Engineering');
  const [keywords, setKeywords] = useState('YOLO, Pothole Detection, Road Safety, Deep Learning');
  const [topics, setTopics] = useState<ThesisTopic[]>([{
    title: "Real-Time Pothole Detection Using YOLO: A Comparative Analysis for Road Safety Applications",
    description: "A comprehensive study of YOLOv5, v7, v8, and v9 for automated road defect detection in diverse environments.",
    type: "MTech Thesis",
    tags: ["YOLO", "Computer Vision", "Road Safety"]
  }]);
  const [generatingTopics, setGeneratingTopics] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<ThesisTopic | null>(null);
  const [generatingThesis, setGeneratingThesis] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [activeThesis, setActiveThesis] = useState<Thesis | null>(null);
  
  // New State for Voice Teacher & Resources
  const [showVoiceTeacher, setShowVoiceTeacher] = useState(false);
  const [voiceTeacherMode, setVoiceTeacherMode] = useState<'interview' | 'teaching' | 'resources'>('teaching');
  const [voiceNotes, setVoiceNotes] = useState<string[]>([]);
  const [showResources, setShowResources] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [teacherStatus, setTeacherStatus] = useState('Ready to help');
  const [selectedThesisForImage, setSelectedThesisForImage] = useState<string>('none');

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
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...decodeStrings(doc.data()) } as Thesis));
      setTheses(data.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'theses');
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'chatMessages'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...decodeStrings(doc.data()) } as ChatMessage));
      setChatMessages(data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chatMessages');
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'topics'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...decodeStrings(doc.data()) } as ThesisTopic));
      if (data.length > 0) setTopics(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'topics');
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'resources'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...decodeStrings(doc.data()) } as Resource));
      setResources(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'resources');
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
    if (!branch || !user) return;
    setGeneratingTopics(true);
    try {
      const kwList = keywords.split(',').map(k => k.trim());
      const result = await generateThesisTopics(branch, kwList, attachedImage || undefined);
      
      // Save to Firebase
      for (const topic of result) {
        await addDoc(collection(db, 'topics'), encodeStrings({
          ...topic,
          userId: user.uid,
          createdAt: Timestamp.now()
        }));
      }
      
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
      const sections = [
        'Abstract', 'Introduction', 'Literature Review', 'Theoretical Background',
        'Dataset and Preprocessing', 'Methodology', 'System Design', 'Experimental Setup',
        'Results and Analysis', 'Discussion', 'Conclusion', 'Future Scope', 
        'References'
      ];
      const generatedSections: Record<string, string> = {};
      
      for (const section of sections) {
        // Humanizer prompt: Ask for natural, deep, academic writing
        const prompt = `Topic: ${topic.title}. Section: ${section}. 
        Write this section in a highly professional, human-like academic tone. 
        Include technical depth, real-world context, and simulated citations. 
        Aim for significant detail (simulating 8-10 pages of content). 
        Avoid robotic structures; use varied sentence lengths and deep critical analysis.`;
        
        const text = await generateThesisSection(section, prompt);
        generatedSections[section] = text;
      }

      const thesisData = {
        userId: user.uid,
        title: topic.title,
        branch,
        keywords: keywords.split(',').map(k => k.trim()),
        sections: generatedSections,
        pageCount: 110, // Target 110 pages
        createdAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, 'theses'), encodeStrings(thesisData));
      
      // Generate PDF
      await generateThesisPDF({
        title: topic.title,
        branch,
        sections: generatedSections
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
    const userMsg: ChatMessage = { 
      role: 'user', 
      content: chatInput, 
      timestamp: new Date().toISOString(),
      status: 'sent',
      userId: user.uid
    };
    
    try {
      await addDoc(collection(db, 'chatMessages'), encodeStrings(userMsg));
      setChatInput('');
      setIsThinking(true);

      const response = await getTeacherResponse(chatInput, user.displayName || 'Student', chatMessages);
      const modelMsg: ChatMessage = { 
        role: 'model', 
        content: response, 
        timestamp: new Date().toISOString(),
        status: 'read',
        userId: user.uid
      };
      
      await addDoc(collection(db, 'chatMessages'), encodeStrings(modelMsg));
      generateSpeech(response);
    } catch (error) {
      console.error("Chat failed", error);
    } finally {
      setIsThinking(false);
    }
  };

  const handleVoiceClick = () => {
    setVoiceTeacherMode('teaching');
    setShowVoiceTeacher(true);
    setTeacherStatus('Ready to start');
    setVoiceNotes(['Hello! I am Priyanka.', 'How can I help you with your thesis today?']);
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
            <p className="text-muted font-medium">build by useless · AI Research Companion</p>
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
      <header className="px-6 py-4 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-40 border-b border-white/40">
        <div className="flex items-center gap-3">
          <motion.img 
            whileHover={{ scale: 1.1 }}
            src={user.photoURL || ''} 
            className="w-9 h-9 rounded-full border-2 border-white shadow-sm cursor-pointer" 
            alt="profile" 
            onClick={() => setActiveTab('profile')}
          />
          <div className="hidden sm:block">
            <h1 className="text-xs font-black tracking-tight text-dark">THESIS STUDIO</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="px-4 py-2 rounded-full bg-accent-pink/10 text-accent-pink border-none text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-glow"
          >
            {user.displayName?.split(' ')[0]} <Sparkles size={12} className="animate-pulse" />
          </motion.div>
        </div>
      </header>

      <main className="p-6 max-w-3xl mx-auto space-y-12">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Welcome Card - Pressed UI */}
              <div className="neo-pressed p-6 rounded-[2.5rem] bg-white/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-rust/5 blur-3xl rounded-full -mr-10 -mt-10" />
                <div className="flex items-center justify-between relative z-10">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted font-black uppercase tracking-[0.2em]">Welcome back</p>
                    <h2 className="text-2xl font-black text-dark tracking-tighter flex items-center gap-2">
                      {user?.displayName?.split(' ')[0]} <motion.span animate={{ rotate: [0, 20, 0] }} transition={{ repeat: Infinity, duration: 2 }}>👋</motion.span>
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-white/60">
                    <Sparkles size={14} className="text-rust animate-pulse" />
                    <span className="text-[10px] font-black text-rust uppercase tracking-widest">Premium</span>
                  </div>
                </div>
                
                <div className="mt-6 flex items-center gap-4">
                  <div className="flex-1 h-1.5 bg-cream rounded-full overflow-hidden shadow-inner">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: '65%' }}
                      className="h-full vibrant-gradient"
                    />
                  </div>
                  <span className="text-[10px] font-black text-muted uppercase tracking-widest">65% Progress</span>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                  <Search size={18} className="text-muted group-focus-within:text-rust transition-colors" />
                </div>
                <input 
                  type="text" 
                  placeholder="Search your research..." 
                  className="w-full bg-white shadow-sm border border-white/60 rounded-[2rem] py-4 pl-14 pr-6 outline-none focus:ring-2 focus:ring-rust/20 transition-all font-bold text-dark text-xs"
                />
              </div>

              {/* Quick AI Tools Grid */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { id: 'chat', title: 'AI Assistant', icon: <MessageSquare size={20} />, color: 'bg-rust', tab: 'classroom' },
                  { id: 'image', title: 'Diagram Gen', icon: <ImageIcon size={20} />, color: 'bg-gold', tab: 'tools' },
                  { id: 'pdf', title: 'Chat With PDF', icon: <FileText size={20} />, color: 'bg-blue-400', tab: 'tools' },
                  { id: 'voice', title: 'Voice to text', icon: <Mic size={20} />, color: 'bg-rust', tab: 'tools' }
                ].map((tool) => (
                  <motion.div 
                    key={tool.id}
                    whileHover={{ y: -3 }}
                    onClick={() => setActiveTab(tool.tab as any)}
                    className="tool-card group cursor-pointer relative overflow-hidden p-4 rounded-[1.5rem]"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-lg", tool.color)}>
                        {tool.icon}
                      </div>
                      <ArrowUpRight size={16} className="text-muted group-hover:text-dark transition-colors" />
                    </div>
                    <h3 className="text-xs font-black text-dark leading-tight">{tool.title}</h3>
                  </motion.div>
                ))}
              </div>

              {/* Recently Used Tools */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-sm font-black text-dark tracking-tight">Recently Used Tools</h3>
                  <button className="text-[10px] font-black text-rust uppercase tracking-widest">See All</button>
                </div>
                <div className="space-y-3">
                  {[
                    { title: 'Chat Assistant', icon: <MessageSquare size={16} />, color: 'text-gold' },
                    { title: 'Chat With PDF', icon: <FileText size={16} />, color: 'text-accent-purple' },
                    { title: 'Image Generator', icon: <ImageIcon size={16} />, color: 'text-green-500' }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-white rounded-3xl shadow-sm border border-white/60 group hover:shadow-md transition-all">
                      <div className="flex items-center gap-4">
                        <div className={cn("w-10 h-10 rounded-2xl bg-cream flex items-center justify-center shadow-inner", item.color)}>
                          {item.icon}
                        </div>
                        <span className="text-sm font-bold text-dark">{item.title}</span>
                      </div>
                      <MoreHorizontal size={18} className="text-muted" />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'theses' && (
            <motion.div 
              key="theses"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto pr-2 scrollbar-hide"
            >
              <div className="flex items-center justify-between sticky top-0 bg-cream/90 backdrop-blur-sm z-10 py-2">
                <div>
                  <h2 className="text-2xl font-black text-dark tracking-tighter">Your Classes</h2>
                  <p className="text-muted text-[10px] font-black uppercase tracking-widest">Research modules with Priyanka</p>
                </div>
                <NeumorphicButton onClick={() => setActiveTab('new')} className="p-3 rounded-xl bg-rust text-white border-none shadow-md">
                  <Plus size={20} />
                </NeumorphicButton>
              </div>

              {theses.length === 0 ? (
                <div className="neo-card text-center py-10 space-y-6 relative overflow-hidden">
                  <div className="absolute -top-10 -left-10 w-40 h-40 bg-rust/5 rounded-full blur-3xl" />
                  
                  <div className="relative z-10">
                    <div className="w-20 h-20 bg-paper rounded-3xl flex items-center justify-center mx-auto shadow-inner mb-4">
                      <BookOpen className="text-muted/30" size={36} />
                    </div>
                    <div className="space-y-1 mb-6">
                      <p className="text-xl font-black text-dark">No classes yet</p>
                      <p className="text-[10px] text-muted font-bold max-w-[200px] mx-auto uppercase tracking-wider">Join your first MTech research class to start writing.</p>
                    </div>
                    <NeumorphicButton onClick={() => setActiveTab('new')} variant="rust" className="px-8 py-3 text-[10px] font-black tracking-widest uppercase animate-glow">
                      Join First Class
                    </NeumorphicButton>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3">
                  {theses.map((t) => (
                    <motion.div 
                      key={t.id} 
                      whileHover={{ y: -2 }}
                      onClick={() => {
                        setActiveThesis(t);
                        setActiveTab('classroom');
                      }}
                      className="neo-card p-4 space-y-3 group cursor-pointer border-white/40 hover:border-rust/20 transition-all"
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <h3 className="font-black text-lg text-dark group-hover:text-rust transition-colors leading-tight">{t.title}</h3>
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] font-black bg-rust/10 text-rust px-2 py-0.5 rounded-md uppercase tracking-wider">{t.branch}</span>
                            <span className="text-[8px] text-muted font-black uppercase tracking-widest">{new Date(t.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <NeumorphicButton className="p-2 rounded-lg bg-white/50" onClick={(e) => e.stopPropagation()}>
                            <Download size={14} className="text-muted" />
                          </NeumorphicButton>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Generated Thesis Pages Section */}
              <div className="pt-4 space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-sm font-black text-dark tracking-tight">Generated Thesis Pages</h3>
                  <button className="text-[9px] font-black text-rust uppercase tracking-widest">View All</button>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
                  {theses.length > 0 ? theses.map((t, i) => (
                    <motion.div 
                      key={`page-${i}`}
                      className="min-w-[240px] snap-center neo-card p-5 space-y-4 bg-white/60 border-white/40"
                    >
                      <div className="w-full aspect-[3/4] bg-cream rounded-xl shadow-inner flex flex-col p-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2">
                          <FileText size={16} className="text-rust/20" />
                        </div>
                        <div className="space-y-2">
                          <div className="h-2 w-3/4 bg-dark/5 rounded-full" />
                          <div className="h-2 w-full bg-dark/5 rounded-full" />
                          <div className="h-2 w-5/6 bg-dark/5 rounded-full" />
                          <div className="h-2 w-full bg-dark/5 rounded-full" />
                          <div className="h-2 w-2/3 bg-dark/5 rounded-full" />
                        </div>
                        <div className="mt-auto">
                          <p className="text-[8px] font-black text-dark/40 uppercase tracking-widest">Page {i + 1} of 110</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-xs font-black text-dark line-clamp-1">{t.title}</h4>
                        <NeumorphicButton 
                          onClick={() => generateThesisPDF(t)}
                          className="w-full py-2.5 bg-dark text-white border-none text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                        >
                          <Download size={12} /> Download PDF
                        </NeumorphicButton>
                      </div>
                    </motion.div>
                  )) : (
                    <div className="w-full py-10 text-center neo-pressed rounded-3xl bg-white/20">
                      <p className="text-[10px] text-muted font-black uppercase tracking-widest">No generated pages yet</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'classroom' && activeThesis && (
            <motion.div 
              key="classroom"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4">
                <NeumorphicButton onClick={() => setActiveTab('theses')} className="p-3 rounded-xl bg-white shadow-md">
                  <ChevronRight size={20} className="rotate-180 text-muted" />
                </NeumorphicButton>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-black text-dark truncate tracking-tight">{activeThesis.title}</h2>
                  <p className="text-[10px] text-muted font-black uppercase tracking-widest">{activeThesis.branch}</p>
                </div>
              </div>

              <div className="flex flex-col gap-6 h-[calc(100vh-220px)]">
                <div className="neo-card flex-1 overflow-y-auto p-8 space-y-10 scrollbar-hide border-white/40 shadow-xl">
                  {Object.entries(activeThesis.sections).map(([name, content]) => (
                    <div key={name} className="space-y-4">
                      <div className="flex items-center gap-3 border-b-2 border-rust/10 pb-3">
                        <div className="w-2 h-6 bg-rust rounded-full" />
                        <h3 className="text-lg font-black text-rust uppercase tracking-[0.15em]">{name}</h3>
                      </div>
                      <div className="text-ink font-bold leading-relaxed whitespace-pre-wrap text-sm antialiased">{content}</div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col h-[320px] shrink-0">
                  <div className="flex-1 overflow-y-auto space-y-4 p-5 neo-pressed rounded-[2.5rem] mb-4 scrollbar-hide bg-cream/30">
                    {chatMessages.length === 0 && (
                      <div className="text-center py-8 space-y-3">
                        <div className="w-14 h-14 bg-rust/10 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                          <Volume2 className="text-rust" size={28} />
                        </div>
                        <p className="text-dark font-black text-sm tracking-tight">Priyanka is here to help!</p>
                        <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Ask about your results or sources</p>
                      </div>
                    )}
                    {chatMessages.map((msg, i) => (
                      <motion.div 
                        key={i} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn("flex flex-col", msg.role === 'user' ? "items-end" : "items-start")}
                      >
                        <div className={cn(
                          "max-w-[85%] p-4 rounded-2xl text-xs font-bold shadow-sm leading-relaxed relative group",
                          msg.role === 'user' 
                            ? "bg-rust text-white rounded-tr-none shadow-[0_4px_15px_rgba(255,126,95,0.2)]" 
                            : "bg-white text-dark shadow-md rounded-tl-none border border-white/60"
                        )}>
                          {msg.content}
                          
                          <div className={cn(
                            "flex items-center gap-1 mt-1.5 opacity-60 text-[8px] font-black uppercase tracking-widest",
                            msg.role === 'user' ? "justify-end" : "justify-start"
                          )}>
                            <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {msg.role === 'user' && (
                              <span className="flex items-center">
                                {msg.status === 'read' ? (
                                  <div className="flex -space-x-1">
                                    <Check size={8} className="text-white" />
                                    <Check size={8} className="text-white" />
                                  </div>
                                ) : (
                                  <Check size={8} className="text-white" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    {isThinking && (
                      <div className="flex justify-start">
                        <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl rounded-tl-none shadow-md flex gap-1.5 border border-white/60">
                          <span className="w-1.5 h-1.5 bg-rust rounded-full animate-bounce" />
                          <span className="w-1.5 h-1.5 bg-rust rounded-full animate-bounce [animation-delay:0.2s]" />
                          <span className="w-1.5 h-1.5 bg-rust rounded-full animate-bounce [animation-delay:0.4s]" />
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="flex gap-2 glass-card p-2 rounded-full shadow-lg">
                    <input 
                      type="text" 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Ask Priyanka..."
                      className="flex-1 bg-cream/50 shadow-inner rounded-full px-5 py-3 outline-none border-2 border-transparent focus:border-rust transition-all font-bold text-dark text-xs"
                    />
                    <NeumorphicButton onClick={handleSendMessage} className="p-3 rounded-full bg-rust text-white border-none shadow-md">
                      <Send size={18} />
                    </NeumorphicButton>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'new' && (
            <motion.div 
              key="new"
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3">
                <NeumorphicButton onClick={() => setActiveTab('theses')} className="p-2.5 rounded-xl bg-white shadow-md">
                  <X size={20} className="text-muted" />
                </NeumorphicButton>
                <h2 className="text-2xl font-black text-dark tracking-tighter">Join Class</h2>
              </div>

              <div className="neo-card p-0 overflow-hidden border-none hero-gradient shadow-xl">
                <div className="p-6 space-y-6 relative">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-rust/5 rounded-full -mr-10 -mt-10 blur-3xl" />
                  
                  <div className="space-y-6 relative z-10">
                    <div className="space-y-3">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-rust/10 rounded-full">
                        <Sparkles size={12} className="text-rust" />
                        <span className="text-[9px] font-black text-rust uppercase tracking-[0.15em]">Research Topic</span>
                      </div>
                      <h3 className="text-xl font-black text-dark leading-tight tracking-tight">Real-Time Pothole Detection Using YOLO: A Comparative Analysis for Road Safety Applications</h3>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="text-[8px] font-black bg-rust/10 text-rust px-3 py-1.5 rounded-lg uppercase tracking-widest">CS & Engineering</span>
                        <span className="text-[8px] font-black bg-ink/10 text-ink px-3 py-1.5 rounded-lg uppercase tracking-widest">MTech Thesis</span>
                        <span className="text-[8px] font-black bg-gold/10 text-gold px-3 py-1.5 rounded-lg uppercase tracking-widest">110 Pages</span>
                      </div>
                    </div>

                    <div className="p-4 bg-white/40 backdrop-blur-sm rounded-2xl border border-white/60 shadow-inner">
                      <p className="text-xs font-bold text-muted leading-relaxed text-center">
                        Generate a comprehensive 110-page thesis with human-like academic writing and technical depth.
                      </p>
                    </div>
                  </div>

                  <div className="relative z-10 pt-2">
                    <NeumorphicButton 
                      onClick={() => handleGenerateThesis(topics[0])} 
                      disabled={generatingThesis}
                      variant="premium"
                      className="w-full py-5"
                    >
                      {generatingThesis ? (
                        <div className="flex items-center justify-center gap-3">
                          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                          <span className="text-sm font-black uppercase tracking-widest">Writing...</span>
                        </div>
                      ) : (
                        <span className="text-sm font-black uppercase tracking-widest">Start Generation</span>
                      )}
                    </NeumorphicButton>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div 
              key="chat"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col h-[calc(100vh-220px)] relative"
            >
              {/* Vibrant Background */}
              <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-30">
                <div className="absolute top-[-10%] right-[-10%] w-[80%] h-[60%] bg-accent-pink/20 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[80%] h-[60%] bg-gold/30 blur-[120px] rounded-full" />
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 p-4 scrollbar-hide relative z-10">
                {chatMessages.length === 0 && (
                  <div className="text-center py-16 space-y-8">
                    <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center mx-auto shadow-xl mb-8">
                      <MessageSquare className="text-rust" size={40} />
                    </div>
                    <div className="space-y-3">
                      <p className="text-2xl font-black text-dark tracking-tighter">Chat Assistant</p>
                      <p className="text-sm text-muted font-bold max-w-[240px] mx-auto">Hey! Great to see you. What's on your mind this afternoon?</p>
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
                      "max-w-[85%] p-5 rounded-[2rem] shadow-sm font-bold leading-relaxed text-sm",
                      msg.role === 'user' ? "bg-white/90 text-dark" : "bg-white text-dark border border-white/60"
                    )}>
                      {msg.content}
                    </div>
                  </motion.div>
                ))}
                {isThinking && (
                  <div className="flex justify-start">
                    <div className="bg-white/80 backdrop-blur-md p-5 rounded-[2rem] shadow-sm flex gap-2 border border-white/60">
                      <span className="w-2 h-2 bg-rust rounded-full animate-bounce" />
                      <span className="w-2 h-2 bg-rust rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="w-2 h-2 bg-rust rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              
              <div className="mt-4 flex items-center gap-2 p-3 bg-white/80 backdrop-blur-md rounded-[2.5rem] shadow-lg border border-white/60 relative z-10">
                <NeumorphicButton className="p-3 rounded-full bg-cream text-muted border-none">
                  <Plus size={20} />
                </NeumorphicButton>
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Message Lexica"
                  className="flex-1 bg-transparent px-2 py-3 outline-none font-bold text-dark text-sm"
                />
                <div className="flex items-center gap-2">
                  <NeumorphicButton onClick={handleVoiceClick} className="p-3 rounded-full bg-cream text-rust border-none">
                    <Mic size={20} />
                  </NeumorphicButton>
                  <NeumorphicButton onClick={handleSendMessage} variant="rust" className="p-3 rounded-full border-none shadow-md">
                    <Send size={20} />
                  </NeumorphicButton>
                </div>
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
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-dark tracking-tighter">AI Research Tools</h2>
                <p className="text-muted text-sm font-bold uppercase tracking-widest">Powered by Gemini 2.0</p>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="neo-card p-8 space-y-6 relative overflow-hidden group hero-gradient border-none">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-rust/5 rounded-full -mr-10 -mt-10 blur-2xl group-hover:bg-rust/10 transition-colors" />
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="p-4 bg-rust/10 rounded-2xl">
                      <ImageIcon className="text-rust" size={28} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-dark">Image Generation</h3>
                      <p className="text-[10px] text-muted font-black uppercase tracking-widest">Diagrams & Flowcharts</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted font-bold leading-relaxed relative z-10">Create high-fidelity research diagrams, flowcharts, or conceptual illustrations for your thesis chapters.</p>
                  <div className="relative z-10 space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest">Select Thesis Context</label>
                      <select 
                        value={selectedThesisForImage}
                        onChange={(e) => setSelectedThesisForImage(e.target.value)}
                        className="w-full bg-cream shadow-inner rounded-2xl p-4 outline-none border-2 border-transparent focus:border-rust transition-all font-bold text-dark text-sm"
                      >
                        <option value="none">None (Manual Entry)</option>
                        {theses.map(t => (
                          <option key={t.id} value={t.id}>{t.title}</option>
                        ))}
                      </select>
                    </div>
                    <input type="text" placeholder="Describe the diagram..." className="w-full bg-cream shadow-inner rounded-2xl p-4 outline-none border-2 border-transparent focus:border-rust transition-all font-bold text-dark text-sm" />
                    <NeumorphicButton variant="premium" className="w-full py-4 text-xs">Generate Diagram</NeumorphicButton>
                  </div>
                </div>

                <div className="neo-card p-8 space-y-6 relative overflow-hidden group hero-gradient border-none">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-ink/5 rounded-full -mr-10 -mt-10 blur-2xl group-hover:bg-ink/10 transition-colors" />
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="p-4 bg-ink/5 rounded-2xl">
                      <Video className="text-ink" size={28} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-dark">Video Synthesis</h3>
                      <p className="text-[10px] text-muted font-black uppercase tracking-widest">Presentation AI</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted font-bold leading-relaxed relative z-10">Animate your research findings into professional presentations or explainer videos for your viva.</p>
                  <NeumorphicButton variant="premium" className="w-full py-4 text-xs !bg-ink !from-ink !to-dark relative z-10">Upload & Animate</NeumorphicButton>
                </div>

                <div className="neo-card p-8 space-y-6 relative overflow-hidden group hero-gradient border-none">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-full -mr-10 -mt-10 blur-2xl group-hover:bg-gold/10 transition-colors" />
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="p-4 bg-gold/10 rounded-2xl">
                      <Mic className="text-gold" size={28} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-dark">Voice & Transcription</h3>
                      <p className="text-[10px] text-muted font-black uppercase tracking-widest">Interview AI</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted font-bold leading-relaxed relative z-10">Transcribe research interviews or have a real-time voice conversation with the AI to brainstorm ideas.</p>
                  <div className="flex gap-4 relative z-10">
                    <NeumorphicButton 
                      onClick={() => {
                        setVoiceTeacherMode('interview');
                        setShowVoiceTeacher(true);
                      }}
                      className="flex-1 py-4 font-black text-xs uppercase tracking-widest rust-gradient text-white border-none"
                    >
                      Live API
                    </NeumorphicButton>
                    <NeumorphicButton 
                      onClick={() => {
                        setVoiceTeacherMode('teaching');
                        setShowVoiceTeacher(true);
                      }}
                      className="flex-1 py-4 font-black text-xs uppercase tracking-widest bg-white border-none shadow-lg"
                    >
                      Teacher Talk
                    </NeumorphicButton>
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
              className="space-y-6"
            >
              {/* Horizontal Compact Profile - Pressed UI with Glow */}
              <div className="neo-pressed p-5 rounded-[2.5rem] bg-white/30 relative overflow-hidden animate-glow">
                <div className="absolute top-0 right-0 w-32 h-32 bg-rust/5 blur-3xl rounded-full -mr-10 -mt-10" />
                <div className="flex items-center gap-5 relative z-10">
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 bg-rust/20 blur-xl rounded-full scale-125" />
                    <img src={user.photoURL || ''} className="w-16 h-16 rounded-2xl border-2 border-white shadow-lg relative z-10" alt="profile" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-black text-dark tracking-tight truncate">{user.displayName}</h2>
                    <p className="text-[9px] text-muted font-black uppercase tracking-widest truncate">{user.email}</p>
                    <div className="flex gap-4 mt-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-rust">{theses.length}</span>
                        <span className="text-[7px] uppercase font-black text-muted tracking-widest">Projects</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-ink">{chatMessages.length}</span>
                        <span className="text-[7px] uppercase font-black text-muted tracking-widest">Messages</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <NeumorphicButton 
                  onClick={() => {
                    setVoiceTeacherMode('teaching');
                    setShowVoiceTeacher(true);
                  }}
                  className="w-full flex items-center justify-between py-4 px-6 group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-rust/10 rounded-xl group-hover:bg-rust group-hover:text-white transition-all duration-300">
                      <Mic size={20} className="text-rust group-hover:text-white" />
                    </div>
                    <div className="text-left">
                      <span className="font-black text-dark text-sm block">Voice Settings</span>
                      <span className="text-[9px] text-muted font-bold uppercase tracking-widest">Configure Priyanka</span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-muted group-hover:translate-x-1 transition-transform" />
                </NeumorphicButton>
                
                <NeumorphicButton className="w-full flex items-center justify-between py-4 px-6 group">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-ink/5 rounded-xl group-hover:bg-ink group-hover:text-white transition-all duration-300">
                      <ImageIcon size={20} className="text-ink group-hover:text-white" />
                    </div>
                    <div className="text-left">
                      <span className="font-black text-dark text-sm block">Image Assets</span>
                      <span className="text-[9px] text-muted font-black uppercase tracking-widest">Manage Diagrams</span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-muted group-hover:translate-x-1 transition-transform" />
                </NeumorphicButton>

                <NeumorphicButton 
                  onClick={() => setShowResources(true)}
                  className="w-full flex items-center justify-between py-4 px-6 group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-gold/10 rounded-xl group-hover:bg-gold group-hover:text-white transition-all duration-300">
                      <BookOpen size={20} className="text-gold group-hover:text-white" />
                    </div>
                    <div className="text-left">
                      <span className="font-black text-dark text-sm block">Resources</span>
                      <span className="text-[9px] text-muted font-black uppercase tracking-widest">Academic Sources</span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-muted group-hover:translate-x-1 transition-transform" />
                </NeumorphicButton>
              </div>

              <NeumorphicButton onClick={handleLogout} className="w-full py-4 text-red-500 font-black text-[10px] tracking-[0.2em] uppercase hover:bg-red-50 border-none">
                <LogOut size={18} className="inline mr-2" />
                Sign Out
              </NeumorphicButton>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} onVoiceClick={handleVoiceClick} />

      <VoiceTeacherPopup 
        isOpen={showVoiceTeacher} 
        onClose={() => setShowVoiceTeacher(false)} 
        mode={voiceTeacherMode}
        user={user}
        notes={voiceNotes}
        status={teacherStatus}
        isListening={isListening}
      />

      <ResourcesPage 
        isOpen={showResources} 
        onClose={() => setShowResources(false)} 
        user={user} 
        resources={resources}
      />
    </div>
  );
}
