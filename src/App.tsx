import React, { useState, useEffect, useRef } from 'react';
import { 
  Plane, 
  Calendar, 
  MapPin, 
  Clock, 
  Compass, 
  Volume2, 
  VolumeX, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  UserCheck, 
  XCircle, 
  ShieldCheck, 
  Award, 
  Navigation, 
  Trophy, 
  Play, 
  HelpCircle,
  Copy,
  ChevronRight,
  Share2,
  Camera,
  Upload,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { sfx } from './audio';
import { db, handleFirestoreError, OperationType } from './firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

// Interface for RSVP responses
interface CrewMember {
  id: string;
  name: string;
  status: 'confirmed' | 'declined';
  ration?: string;
  copilots: number;
  timestamp: string;
}

const FOUNDER_CREW: CrewMember[] = [
  {
    id: '1',
    name: 'Comandante Mateo Garfias (Cumpleañero)',
    status: 'confirmed',
    ration: 'Suprema Mateo 6 (Dulces y Pastel)',
    copilots: 0,
    timestamp: '2026-06-20T14:00:00.000Z'
  },
  {
    id: '2',
    name: 'Mamá (Jefa de Logística)',
    status: 'confirmed',
    ration: 'Estándar F-18 (Comida general)',
    copilots: 0,
    timestamp: '2026-06-20T14:00:01.000Z'
  },
  {
    id: '3',
    name: 'Papá (Líder de Escuadrón)',
    status: 'confirmed',
    ration: 'Estándar F-18 (Comida general)',
    copilots: 0,
    timestamp: '2026-06-20T14:00:02.000Z'
  }
];

export default function App() {
  // Navigation / Flight Sequence States
  const [flightPhase, setFlightPhase] = useState<'preflight' | 'takeoff' | 'active'>('preflight');
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isEngineHumming, setIsEngineHumming] = useState(false);
  
  // Custom Captain Photo states
  const [captainPhoto, setCaptainPhoto] = useState<string>('');
  const [overlayHelmet, setOverlayHelmet] = useState<boolean>(true);
  
  // Launch checklist states
  const [checklist, setChecklist] = useState({
    fuel: true,
    cabinPressure: true,
    enginesOn: false,
    coPilotsAssembled: false
  });

  // Countdown timer states
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isLaunched: false
  });

  // RSVP database
  const [crewRoster, setCrewRoster] = useState<CrewMember[]>([]);
  const [crewFilter, setCrewFilter] = useState<'all' | 'confirmed' | 'declined'>('all');
  const [formData, setFormData] = useState({
    name: '',
    status: 'confirmed',
    ration: 'Estándar F-18 (Comida general)',
    copilots: 0
  });

  // Notifications
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Takeoff sequence counts
  const [countdownNum, setCountdownNum] = useState<number | string>('');

  // Mini-Game state
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover' | 'won'>('idle');
  const [playerY, setPlayerY] = useState(50); // 0 (top) to 100 (bottom) percentage
  const [obstacles, setObstacles] = useState<Array<{ id: number; x: number; y: number; width: number; height: number; type: 'cloud' | 'bird' }>>([]);
  const [score, setScore] = useState(0);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [unlockedMedal, setUnlockedMedal] = useState(false);
  const gameLoopRef = useRef<number | null>(null);
  const lastObstacleSpawnRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);
  const obstaclesRef = useRef<any[]>([]);
  const playerYRef = useRef<number>(50);

  // Address
  const eventAddress = "Laurel 8, El manto, Iztapalapa, CDMX";
  const eventCoordinates = "19.3512, -99.0768"; // El Manto, Iztapalapa

  // Sync state refs to game loops
  useEffect(() => {
    playerYRef.current = playerY;
  }, [playerY]);

  // Load RSVP List from Cloud Firestore in real-time
  useEffect(() => {
    const pathForOnSnapshot = 'crew';
    try {
      const unsub = onSnapshot(collection(db, pathForOnSnapshot), (snapshot) => {
        const dbList: CrewMember[] = [];
        snapshot.forEach((docRef) => {
          const data = docRef.data();
          dbList.push({
            id: docRef.id,
            name: data.name || '',
            status: data.status || 'confirmed',
            copilots: Number(data.copilots) || 0,
            timestamp: data.timestamp || new Date().toISOString()
          });
        });
        
        // Sort dynamic pilots by timestamp descending
        dbList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setCrewRoster(dbList);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, pathForOnSnapshot);
      });
      return () => unsub();
    } catch (error) {
      console.error("error setting up real-time sync: ", error);
    }
  }, []);

  // Load captain photo context and other local preferences
  useEffect(() => {
    const savedPhoto = localStorage.getItem('mateo_captain_photo_v1');
    if (savedPhoto) {
      setCaptainPhoto(savedPhoto);
    }
    const savedOverlay = localStorage.getItem('mateo_helmet_overlay_v1');
    if (savedOverlay !== null) {
      setOverlayHelmet(savedOverlay === 'true');
    }
  }, []);

  // Countdown Calculator to Saturday, June 20, 2026 14:00 (CDMX Central Time)
  useEffect(() => {
    const targetDate = new Date('2026-06-20T14:00:00-06:00').getTime(); // central daylight/standard Mexico time

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference <= 0) {
        setTimeLeft(prev => ({ ...prev, isLaunched: true }));
        clearInterval(timer);
      } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds, isLaunched: false });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Handle ambient cockpit engine audio
  useEffect(() => {
    if (isAudioEnabled && flightPhase === 'active') {
      sfx.startAmbientHum();
      setIsEngineHumming(true);
    } else {
      sfx.stopAmbientHum();
      setIsEngineHumming(false);
    }
    return () => {
      sfx.stopAmbientHum();
    };
  }, [isAudioEnabled, flightPhase]);

  // Audio Toggle Controller
  const toggleSound = () => {
    const nextState = !isAudioEnabled;
    setIsAudioEnabled(nextState);
    if (nextState) {
      if (flightPhase === 'preflight') {
        sfx.playCockpitCheckBeeps();
      } else {
        sfx.playBeep(880, 0.1);
      }
    }
  };

  // Turn Engines On Switch
  const toggleEnginesOn = () => {
    const nextState = !checklist.enginesOn;
    setChecklist(prev => ({ ...prev, enginesOn: nextState }));
    if (nextState && isAudioEnabled) {
      sfx.playCockpitCheckBeeps();
    }
  };

  // Handle custom captain photo upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const base64String = event.target.result as string;
          setCaptainPhoto(base64String);
          localStorage.setItem('mateo_captain_photo_v1', base64String);
          setFeedbackMsg('📸 ¡Foto del Capitán Mateo cargada con éxito!');
          if (isAudioEnabled) sfx.playBeep(1200, 0.08);
          setTimeout(() => setFeedbackMsg(''), 3000);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const resetCaptainPhoto = () => {
    setCaptainPhoto('');
    localStorage.removeItem('mateo_captain_photo_v1');
    setFeedbackMsg('🎨 Avatar restaurado a caricatura vector.');
    if (isAudioEnabled) sfx.playBeep(600, 0.08);
    setTimeout(() => setFeedbackMsg(''), 3000);
  };

  const toggleHelmet = () => {
    const nextVal = !overlayHelmet;
    setOverlayHelmet(nextVal);
    localStorage.setItem('mateo_helmet_overlay_v1', String(nextVal));
    setFeedbackMsg(nextVal ? '🪖 Equipaje del piloto: ¡Casco táctico activado!' : '👨🏻 Soltar casco táctico');
    if (isAudioEnabled) sfx.playBeep(990, 0.05);
    setTimeout(() => setFeedbackMsg(''), 2500);
  };

  // Launch pre-flight check countdown and full invitation
  const triggerTakeoff = () => {
    if (!checklist.enginesOn) {
      setFeedbackMsg('⚠️ ALERTA: DEBE ENCENDER LOS MOTORES DE REACCIÓN PRIMERO');
      if (isAudioEnabled) sfx.playBeep(220, 0.3, 'sawtooth');
      setTimeout(() => setFeedbackMsg(''), 3000);
      return;
    }

    setFlightPhase('takeoff');
    setCountdownNum(3);
    if (isAudioEnabled) sfx.playBeep(440, 0.2);

    // Countdown logic
    setTimeout(() => {
      setCountdownNum(2);
      if (isAudioEnabled) sfx.playBeep(440, 0.2);
    }, 1000);

    setTimeout(() => {
      setCountdownNum(1);
      if (isAudioEnabled) sfx.playBeep(440, 0.2);
    }, 2000);

    setTimeout(() => {
      setCountdownNum('¡IGNICIÓN DE POSTQUEMADOR!');
      if (isAudioEnabled) {
        sfx.playTakeoffRoar(() => {
          setFlightPhase('active');
          if (isAudioEnabled) {
            sfx.playJetFlyby();
          }
        });
      } else {
        setTimeout(() => {
          setFlightPhase('active');
        }, 1200);
      }
    }, 3000);
  };

  // Address copy to clipboard
  const copyAddressToClipboard = () => {
    navigator.clipboard.writeText(eventAddress);
    setFeedbackMsg('🗺️ ¡Dirección copiada al portapapeles!');
    if (isAudioEnabled) sfx.playBeep(1200, 0.05);
    setTimeout(() => setFeedbackMsg(''), 2500);
  };

  // Form Submission
  const handleRsvpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsLoading(true);
    if (isAudioEnabled) sfx.playBeep(1000, 0.1);

    const docId = 'crew_' + Date.now().toString() + '_' + Math.floor(Math.random() * 1000);
    const newCrew: CrewMember = {
      id: docId,
      name: formData.name.trim(),
      status: formData.status as 'confirmed' | 'declined',
      copilots: formData.copilots,
      timestamp: new Date().toISOString()
    };

    const pathForWrite = `crew/${docId}`;
    try {
      await setDoc(doc(db, 'crew', docId), {
        id: newCrew.id,
        name: newCrew.name,
        status: newCrew.status,
        copilots: newCrew.copilots,
        timestamp: newCrew.timestamp
      });

      // Update local checklist copilots assembled status
      setChecklist(prev => ({ ...prev, coPilotsAssembled: true }));

      // Reset Form fields
      setFormData({
        name: '',
        status: 'confirmed',
        ration: 'Estándar F-18 (Comida general)',
        copilots: 0
      });
      setIsLoading(false);

      if (newCrew.status === 'confirmed') {
        setFeedbackMsg(`✈️ ¡Felicidades Piloto! Te has incorporado al Escuadrón Mateo.`);
        if (isAudioEnabled) sfx.playJetFlyby();
      } else {
        setFeedbackMsg(`🫡 ¡Entendido! Quedas en reserva para misiones secundarias.`);
      }

      setTimeout(() => setFeedbackMsg(''), 5000);
    } catch (error) {
      setIsLoading(false);
      handleFirestoreError(error, OperationType.WRITE, pathForWrite);
    }
  };

  // Quick Action to delete a guest (except the family squadron)
  const removeCrewMember = async (id: string) => {
    if (['1', '2', '3'].includes(id)) {
      setFeedbackMsg('⛔ ERROR: Los pilotos fundadores no pueden ser removidos.');
      if (isAudioEnabled) sfx.playBeep(330, 0.2, 'triangle');
      setTimeout(() => setFeedbackMsg(''), 3000);
      return;
    }

    const pathForDelete = `crew/${id}`;
    try {
      await deleteDoc(doc(db, 'crew', id));
      setFeedbackMsg(`🗑️ Piloto removido del sistema de vuelo.`);
      if (isAudioEnabled) sfx.playBeep(600, 0.08);
      setTimeout(() => setFeedbackMsg(''), 2500);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, pathForDelete);
    }
  };

  // ==========================================
  // MINI-GAME: EVADIR TURBULENCIA (FLYING ESCAPE GAME)
  // ==========================================
  const startGame = () => {
    setIsNewHighScore(false);
    setScore(0);
    scoreRef.current = 0;
    setPlayerY(50);
    playerYRef.current = 50;
    setObstacles([]);
    obstaclesRef.current = [];
    setGameState('playing');
    lastObstacleSpawnRef.current = Date.now();
    
    if (isAudioEnabled) {
      sfx.playJetFlyby();
    }

    // Start Game loop
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    gameLoopRef.current = requestAnimationFrame(gameStep);
  };

  const gameStep = (timestamp: number) => {
    // 1. Move existing obstacles
    const currentObstacles = [...obstaclesRef.current];
    const speed = 0.8 + scoreRef.current * 0.05; // increases speed with score

    const movedObstacles = currentObstacles
      .map(obs => ({ ...obs, x: obs.x - speed }))
      .filter(obs => obs.x > -20); // Keep those on screen

    // 2. Spawn new obstacles
    const now = Date.now();
    if (now - lastObstacleSpawnRef.current > 1500) {
      const type = Math.random() > 0.5 ? 'cloud' : 'bird';
      const obsY = Math.random() * 85 + 5; // vertical placement percentage
      const newObs = {
        id: Math.random(),
        x: 105, // start off-screen
        y: obsY,
        width: type === 'cloud' ? 24 : 14,
        height: type === 'cloud' ? 14 : 10,
        type: type as 'cloud' | 'bird'
      };

      movedObstacles.push(newObs);
      lastObstacleSpawnRef.current = now;
      
      // Dodged an obstacle point trigger
      if (currentObstacles.length > movedObstacles.length) {
        scoreRef.current += 1;
        setScore(scoreRef.current);
        if (isAudioEnabled) sfx.playBeep(1200, 0.04);

        if (scoreRef.current === 6 && !unlockedMedal) {
          setUnlockedMedal(true);
          setFeedbackMsg('🎖️ CUMPLIDO: ¡Alcanzaste 6 puntos! Cumpleaños 6 de Mateo desbloqueado!');
          setTimeout(() => setFeedbackMsg(''), 4000);
        }
      }
    }

    // 3. Collision Detection
    const playerBox = {
      x: 15, // horizontal alignment percentage
      y: playerYRef.current,
      width: 12,
      height: 8
    };

    let collision = false;
    for (let i = 0; i < movedObstacles.length; i++) {
      const o = movedObstacles[i];
      // simplified percentage-based AABB overlap check
      const horizontalMatch = (playerBox.x + playerBox.width > o.x) && (playerBox.x < o.x + o.width);
      const verticalMatch = (playerBox.y + playerBox.height > o.y) && (playerBox.y < o.y + o.height);
      
      if (horizontalMatch && verticalMatch) {
        collision = true;
        break;
      }
    }

    obstaclesRef.current = movedObstacles;
    setObstacles(movedObstacles);

    if (collision) {
      setGameState('gameover');
      if (isAudioEnabled) sfx.playBeep(150, 0.4, 'sawtooth');
      
      // Save High Score
      const savedHigh = localStorage.getItem('mateo_pilot_highscore') || '0';
      if (scoreRef.current > parseInt(savedHigh)) {
        localStorage.setItem('mateo_pilot_highscore', scoreRef.current.toString());
        setIsNewHighScore(true);
      }
    } else {
      gameLoopRef.current = requestAnimationFrame(gameStep);
    }
  };

  const movePlayer = (direction: 'up' | 'down') => {
    if (gameState !== 'playing') return;
    setPlayerY(prevY => {
      const step = 15;
      const nextY = direction === 'up' ? Math.max(5, prevY - step) : Math.min(85, prevY + step);
      if (isAudioEnabled) sfx.playBeep(440, 0.02);
      return nextY;
    });
  };

  // Touch listener for keyboard game controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;
      if (e.key === 'ArrowUp' || e.key === 'w') {
        e.preventDefault();
        movePlayer('up');
      } else if (e.key === 'ArrowDown' || e.key === 's') {
        e.preventDefault();
        movePlayer('down');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  // Clean game loop on unmount
  useEffect(() => {
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between font-sans relative overflow-x-hidden selection:bg-orange-500 selection:text-white">
      
      {/* Dynamic Background Grid Pattern overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-30 pointer-events-none z-0"></div>
      
      {/* Left/Right Green indicator lines */}
      <div className="absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b from-cyan-500/50 via-emerald-500/50 to-orange-500/50 pointer-events-none"></div>
      <div className="absolute top-0 bottom-0 right-0 w-1 bg-gradient-to-b from-cyan-500/50 via-emerald-500/50 to-orange-500/50 pointer-events-none"></div>

      {/* Persistent Audio Indicator Block on top corner */}
      <div className="w-full max-w-6xl mx-auto px-4 pt-4 flex justify-between items-center z-20">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Plane className="w-6 h-6 text-orange-500 animate-pulse transform -rotate-45" />
            <div className="absolute -inset-1 bg-orange-500/20 rounded-full blur-sm animate-ping"></div>
          </div>
          <div>
            <div className="text-[10px] tracking-[0.2em] uppercase text-cyan-400 font-mono font-semibold">CÓDIGO DE MISIÓN</div>
            <span className="text-sm font-bold tracking-tight text-white font-mono">MATEO-06-LAUNCH</span>
          </div>
        </div>

        {/* Global Sound controller */}
        <button
          onClick={toggleSound}
          id="sound_toggle_btn"
          className={`flex items-center space-x-2 py-1.5 px-3 rounded-full border text-xs font-mono transition-all duration-300 ${
            isAudioEnabled 
              ? 'bg-cyan-950/50 border-cyan-400/60 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.25)]' 
              : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
          }`}
          aria-label="Alternar Sonidos"
        >
          {isAudioEnabled ? (
            <>
              <Volume2 className="w-4 h-4 animate-bounce" />
              <span>SND: ON</span>
            </>
          ) : (
            <>
              <VolumeX className="w-4 h-4" />
              <span>SND: MUTE</span>
            </>
          )}
        </button>
      </div>

      {/* Floating alert message */}
      {feedbackMsg && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900/95 border-2 border-orange-500 text-slate-100 rounded-lg py-3 px-5 shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center space-x-3 text-sm font-semibold max-w-[90%] md:max-w-md animate-bounce">
          <div className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-ping"></div>
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* PHASE 1: PRE-FLIGHT CHECKLIST COCKPIT */}
      {flightPhase === 'preflight' && (
        <div className="w-full max-w-md mx-auto px-4 my-auto flex flex-col justify-center items-center z-10 py-8">
          
          {/* Main Title Badge */}
          <div className="text-center mb-6">
            <span className="bg-orange-500/10 text-orange-400 border border-orange-500/30 text-[11px] tracking-[0.25em] font-mono uppercase px-3 py-1 rounded">
              SISTEMA DE COMANDO AÉREO
            </span>
            <h1 className="text-3xl font-extrabold text-white mt-3 font-mono tracking-tight drop-shadow-md">
              INICIAR ACCESO DE CABINA
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-1">
              SE REQUIERE REVISIÓN PREVIA AL DESPEGUE PARA ACCEDER A LA INVITACIÓN
            </p>
          </div>

          {/* Futuristic Tactical HUD Cockpit Console Container */}
          <div className="w-full bg-slate-950/80 border border-cyan-500/30 rounded-2xl p-6 shadow-[0_0_25px_rgba(6,182,212,0.15)] relative overflow-hidden backdrop-blur-md">
            
            {/* Corner crosshairs */}
            <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-cyan-400"></div>
            <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-cyan-400"></div>
            <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-cyan-400"></div>
            <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-cyan-400"></div>

            {/* Glowing Scanlines overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0)_95%,rgba(34,211,238,0.05)_95%)] bg-[size:100%_20px] pointer-events-none animate-[scanline_12s_linear_infinite]"></div>

            {/* Simulated HUD Compass Radar circle */}
            <div className="flex justify-center mb-6 relative">
              <div className="w-32 h-32 rounded-full border-2 border-dashed border-cyan-700/50 flex items-center justify-center relative animate-spin-slow">
                <div className="w-24 h-24 rounded-full border border-cyan-500/20 flex items-center justify-center">
                  <Compass className="w-8 h-8 text-cyan-400 animate-pulse" />
                </div>
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <span className="text-[10px] font-mono text-cyan-500 font-bold block animate-pulse">RADAR DIRECTO</span>
                <span className="text-xs font-mono font-bold text-white">READY</span>
              </div>
            </div>

            {/* Checklist Grid */}
            <div className="space-y-3.5 mb-6">
              <div className="flex justify-between items-center text-xs font-mono bg-slate-900/60 p-2.5 rounded border border-cyan-950">
                <span className="text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  COMBUSTIBLE DE AVIONES DE REACCIÓN
                </span>
                <span className="text-emerald-400 font-bold font-mono">100% CARGADO</span>
              </div>

              <div className="flex justify-between items-center text-xs font-mono bg-slate-900/60 p-2.5 rounded border border-cyan-950">
                <span className="text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  PRESIÓN E HIDRÁULICA
                </span>
                <span className="text-emerald-400 font-bold font-mono">ESTABLE (OK)</span>
              </div>

              <div className="flex justify-between items-center text-xs font-mono bg-slate-900/60 p-2.5 rounded border border-cyan-950">
                <span className="text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  PILOTO DE CAZA PRINCIPAL
                </span>
                <span className="text-cyan-400 font-bold font-mono">CAP. MATEO (EDAD 6)</span>
              </div>

              {/* Toggle switch for engine */}
              <button
                onClick={toggleEnginesOn}
                id="ignition_switch"
                className={`w-full flex justify-between items-center text-xs font-mono p-3 rounded-lg border-2 text-left transition-all duration-300 ${
                  checklist.enginesOn 
                    ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300 shadow-[inset_0_0_10px_rgba(16,185,129,0.2)]' 
                    : 'bg-red-950/20 border-red-500/40 text-red-300 animated-pulse hover:bg-slate-900'
                }`}
              >
                <span className="flex items-center gap-2 font-bold select-none">
                  <span className={`w-3 h-3 rounded-full ${checklist.enginesOn ? 'bg-emerald-400 animate-ping' : 'bg-red-500 animate-pulse'}`}></span>
                  {checklist.enginesOn ? '✓ MOTORES DE TURBINA ENCENDIDOS' : '⚠ MOTORES DE REACCIÓN APAGADOS'}
                </span>
                <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${checklist.enginesOn ? 'bg-emerald-500 text-slate-950' : 'bg-red-500 text-slate-950'}`}>
                  {checklist.enginesOn ? 'IGNITION' : 'ENCENDER'}
                </span>
              </button>
            </div>

            {/* Help Prompt */}
            {!checklist.enginesOn && (
              <div className="text-center p-2 text-[11px] font-mono text-orange-400 flex items-center justify-center gap-1.5 animate-pulse mb-3">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>ACTIVE INTERRUPTOR DE MOTORES PARA HACER EL DESPEGUE</span>
              </div>
            )}

            {/* Action Takeoff slide slider button style */}
            <button
              onClick={triggerTakeoff}
              id="takeoff_btn"
              disabled={!checklist.enginesOn}
              className={`w-full py-4 rounded-xl font-bold font-mono tracking-widest text-center transition-all duration-300 transform active:scale-95 flex items-center justify-center gap-2 relative group overflow-hidden ${
                checklist.enginesOn
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] cursor-pointer'
                  : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
              }`}
            >
              {checklist.enginesOn && (
                <span className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:animate-[wiggle_1.5s_infinite]"></span>
              )}
              <Plane className={`w-5 h-5 transform -rotate-45 ${checklist.enginesOn ? 'animate-bounce' : ''}`} />
              <span>DESPEGAR AVIONES DE CAZA</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Mute advisory */}
          <p className="text-[10px] font-mono text-slate-500 text-center mt-4">
            Recomendado: Enciende el <span className="text-cyan-400">SND: ON</span> arriba para experimentar los sonidos de postcombustión de turbinas.
          </p>
        </div>
      )}

      {/* PHASE 2: ACTIVE TAKEOFF COUNTDOWN INTERSTITIAL */}
      {flightPhase === 'takeoff' && (
        <div className="w-full max-w-lg mx-auto px-4 my-auto flex flex-col justify-center items-center z-10 py-12 text-center animate-pulse">
          <div className="relative mb-6">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-cyan-500 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.5)]">
              {typeof countdownNum === 'number' ? (
                <span className="text-7xl font-mono font-black text-cyan-400 tracking-tighter">
                  {countdownNum}
                </span>
              ) : (
                <span className="text-2xl font-mono font-black text-orange-400 leading-tight px-3 py-1 animate-ping">
                  {countdownNum}
                </span>
              )}
            </div>
            
            {/* Spinning decorative ring */}
            <div className="absolute inset-0 border-t-4 border-b-4 border-orange-500 rounded-full animate-spin"></div>
          </div>

          <h2 className="text-2xl font-extrabold tracking-widest text-cyan-400 font-mono animate-bounce uppercase">
            Activando Propulsión de Combate
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-2 max-w-sm">
            Mateo está alcanzando altitud supersónica para su sexto cumpleaños. Sujeten sus cinturones de piloto.
          </p>

          <div className="w-64 bg-slate-900 border border-slate-800 h-3 rounded-full mt-8 overflow-hidden relative">
            <div className="bg-gradient-to-r from-cyan-500 to-orange-500 h-full animate-[progress_3s_linear_infinite] rounded-full"></div>
          </div>
        </div>
      )}

      {/* PHASE 3: MAIN EVENT RADAR HUD & INVITATION BENTO */}
      {flightPhase === 'active' && (
        <div className="w-full max-w-6xl mx-auto px-4 py-6 z-10 flex flex-col space-y-6">

          {/* Supersonic Header Area */}
          <header className="relative w-full rounded-2xl bg-slate-950/60 p-6 md:p-8 border border-cyan-500/30 flex flex-col md:flex-row justify-between items-center gap-6 backdrop-blur-md overflow-hidden shadow-[0_0_15px_rgba(6,182,212,0.1)]">
            
            {/* Ambient sliding fighter jet decorative backdrop */}
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent pointer-events-none transform -translate-y-1/2"></div>
            
            <div className="absolute left-1/4 top-1/4 pointer-events-none opacity-10 animate-[float_8s_infinite]">
              <Plane className="w-16 h-16 text-cyan-500 transform rotate-12" />
            </div>

            {/* Custom SVG Boy-Pilot Avatar representing Mateo custom made */}
            <div className="flex flex-col sm:flex-row items-center gap-5 z-10">
              <div className="relative">
                {/* Custom Vector Cartoon Illustration of Captain Mateo or Uploaded Photo */}
                <div className="w-28 h-28 md:w-32 md:h-32 bg-slate-900 rounded-2xl border-2 border-orange-500 flex items-center justify-center shadow-[0_0_15px_rgba(249,115,22,0.3)] overflow-hidden relative group">
                  {captainPhoto ? (
                    <div className="w-full h-full relative">
                      <img 
                        src={captainPhoto} 
                        alt="Capitán Mateo" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      
                      {/* Interactive Pilot Goggles and Helmet Overlay */}
                      {overlayHelmet && (
                        <div className="absolute inset-0 pointer-events-none">
                          <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                            {/* Helmet Top/Rim on face */}
                            <path d="M10 28C10 8 90 8 90 28V36H10V28Z" fill="#1b4d3e" fillOpacity="0.85" />
                            <path d="M10 26C10 10 90 10 90 26" stroke="#f97316" strokeWidth="2.5" />
                            
                            {/* Fighter Goggles over eyes */}
                            <rect x="18" y="26" width="28" height="18" rx="4" fill="#38bdf8" fillOpacity="0.5" stroke="#111827" strokeWidth="2" />
                            <rect x="54" y="26" width="28" height="18" rx="4" fill="#38bdf8" fillOpacity="0.5" stroke="#111827" strokeWidth="2" />
                            <line x1="46" y1="35" x2="54" y2="35" stroke="#111827" strokeWidth="2.5" />
                            
                            {/* Goggle shines */}
                            <line x1="21" y1="29" x2="31" y2="39" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                            <line x1="57" y1="29" x2="67" y2="39" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                            
                            {/* Cockpit HUD guidelines */}
                            <path d="M8 80L18 80" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.7" />
                            <path d="M92 80L82 80" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.7" />
                            <line x1="8" y1="76" x2="8" y2="83" stroke="#06b6d4" strokeWidth="1" strokeOpacity="0.7" />
                            <line x1="92" y1="76" x2="92" y2="83" stroke="#06b6d4" strokeWidth="1" strokeOpacity="0.7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ) : (
                    <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Sky / Base Hangar Background */}
                      <rect width="100" height="100" fill="#0c1a30" />
                      <circle cx="50" cy="50" r="38" stroke="#1d4ed8" strokeWidth="1" strokeDasharray="3 3" />
                      
                      {/* Hangar elements */}
                      <line x1="10" y1="85" x2="90" y2="85" stroke="#334155" strokeWidth="2" />
                      <line x1="20" y1="20" x2="30" y2="85" stroke="#1e293b" />
                      <line x1="80" y1="20" x2="70" y2="85" stroke="#1e293b" />

                      {/* Boy's face & Hair */}
                      {/* Hair Back */}
                      <path d="M28 45C28 25 72 25 72 45C72 48 70 51 68 53V58H32V53C30 51 28 48 28 45Z" fill="#1c1917" />
                      
                      {/* Ears */}
                      <circle cx="31" cy="52" r="5" fill="#fbcfe8" />
                      <circle cx="31" cy="52" r="2.5" fill="#f472b6" />
                      <circle cx="69" cy="52" r="5" fill="#fbcfe8" />
                      <circle cx="69" cy="52" r="2.5" fill="#f472b6" />

                      {/* Neck */}
                      <rect x="44" y="58" width="12" height="10" fill="#fbcfe8" />

                      {/* Face (Chubby rosy cheeks) */}
                      <circle cx="50" cy="50" r="19" fill="#fbcfe8" />
                      
                      {/* Rosy Cheeks */}
                      <circle cx="36" cy="54" r="3.5" fill="#f472b6" opacity="0.6" />
                      <circle cx="64" cy="54" r="3.5" fill="#f472b6" opacity="0.6" />

                      {/* Wavy hair (overlapping front) */}
                      <path d="M29 42C33 30 50 32 50 38C50 32 67 30 71 42C67 28 33 28 29 42Z" fill="#1c1917" />
                      <path d="M38 31C42 27 48 29 48 31C42 26 31 34 38 31Z" fill="#1c1917" />

                      {/* Happy Closed Mouth Smile */}
                      <path d="M44 55C44 58 56 58 56 55" stroke="#1c1917" strokeWidth="2" strokeLinecap="round" />

                      {/* Eyes (dark brown/black big enthusiastic eyes) */}
                      <circle cx="42" cy="48" r="3" fill="#1c1917" />
                      <circle cx="58" cy="48" r="3" fill="#1c1917" />
                      {/* Eye Highlights */}
                      <circle cx="41.2" cy="46.8" r="1" fill="#ffffff" />
                      <circle cx="57.2" cy="46.8" r="1" fill="#ffffff" />

                      {/* Pilot Helmet (Green/Olive color with Orange highlights) */}
                      <path d="M31 40C31 22 69 22 69 40V49H31V40Z" fill="#1b4d3e" opacity="0.9" />
                      <path d="M31 38C31 24 69 24 69 38" stroke="#f97316" strokeWidth="3" />
                      {/* Fighter Goggles raised on forehead */}
                      <rect x="36" y="28" width="13" height="8" rx="2" fill="#38bdf8" stroke="#111827" strokeWidth="1.5" />
                      <rect x="51" y="28" width="13" height="8" rx="2" fill="#38bdf8" stroke="#111827" strokeWidth="1.5" />
                      <line x1="48" y1="32" x2="52" y2="32" stroke="#111827" strokeWidth="2" />
                      {/* Goggle glass shines */}
                      <line x1="38" y1="30" x2="42" y2="34" stroke="#ffffff" strokeWidth="1" />
                      <line x1="53" y1="30" x2="57" y2="34" stroke="#ffffff" strokeWidth="1" />

                      {/* Flight Suit / Jacket Collars */}
                      <path d="M32 68L50 82L68 68V85H32V68Z" fill="#1b4d3e" />
                      <path d="M30 68L44 80" stroke="#f97316" strokeWidth="2.5" />
                      <path d="M70 68L56 80" stroke="#f97316" strokeWidth="2.5" />
                      {/* Yellow/Orange Undershirt with Mateo badge */}
                      <path d="M44 68H56L50 78L44 68Z" fill="#f97316" />
                      <circle cx="50" cy="73" r="1.5" fill="#facc15" />
                    </svg>
                  )}

                  {/* Operational overlay line */}
                  <div className="absolute top-1 left-2 text-[8px] font-mono font-bold text-cyan-400 pointer-events-none bg-slate-950/60 px-1 rounded border border-cyan-500/30">
                    ACTIVO
                  </div>
                </div>
                
                {/* Pulse decorative indicator */}
                <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-slate-950 py-0.5 px-2 rounded-full border border-slate-950 text-[10px] font-mono font-black shadow-md flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full"></span>
                  CAPITÁN
                </div>
              </div>

              {/* Pilot Info block */}
              <div className="text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start space-x-2">
                  <span className="bg-orange-500 text-slate-950 text-[10px] font-mono font-extrabold px-2 py-0.5 rounded tracking-wider uppercase">
                    CUMPLIENDO 6 AÑOS
                  </span>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white mt-1">
                  MATEO GARFIAS
                </h1>
                <p className="text-xs text-slate-400 font-mono flex items-center justify-center sm:justify-start gap-1">
                  <Plane className="w-3.5 h-3.5 text-cyan-400 transform -rotate-45" />
                  <span>CÓDIGO DE TRUPULACIÓN: F-18 HANGAR MATEO-06</span>
                </p>
                <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-2 max-w-lg">
                  <button
                    onClick={() => {
                      if (isAudioEnabled) sfx.playJetFlyby();
                      setFeedbackMsg('✈️ ¡Supersónico activado! F-18 cruzando el cielo.');
                      setTimeout(() => setFeedbackMsg(''), 3000);
                    }}
                    className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                  >
                    <Plane className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Sonar motores</span>
                  </button>

                  <button
                    onClick={() => document.getElementById('captain-photo-input')?.click()}
                    className="bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-400 border border-cyan-500/30 rounded-lg px-2.5 py-1 text-xs font-mono font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                    title="Cargar foto real de Mateo"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{captainPhoto ? 'Cambiar Foto' : 'Cargar Foto de Mateo'}</span>
                  </button>
                  <input
                    type="file"
                    id="captain-photo-input"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />

                  {captainPhoto && (
                    <>
                      <button
                        onClick={toggleHelmet}
                        className={`border rounded-lg px-2.5 py-1 text-xs font-mono font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer ${
                          overlayHelmet 
                            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)]' 
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                        title="Alternar casco y Google táctico"
                      >
                        <span>{overlayHelmet ? 'Quitar Casco' : 'Poner Casco'}</span>
                      </button>

                      <button
                        onClick={resetCaptainPhoto}
                        className="bg-red-950/40 hover:bg-red-900/50 text-red-400 border border-red-500/30 rounded-lg px-2.5 py-1 text-xs font-mono font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                        title="Volver a caricatura caricaturizada"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Restablecer</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Jet Fighter Group graphic */}
            <div className="flex flex-col items-center bg-slate-900/50 rounded-xl p-3 border border-cyan-500/20 max-w-[280px]">
              <span className="text-[10px] font-mono text-cyan-400 font-extrabold tracking-widest text-center uppercase block mb-1">
                OPERACIÓN CUMPLEAÑOS MATEO
              </span>
              
              <div className="flex items-center space-x-4 mt-1 relative py-1.5 px-4">
                {/* Trio of custom stylized fighter plane outlines */}
                <Plane className="w-5 h-5 text-cyan-500 transform -rotate-45 hover:text-cyan-400 transition-colors" />
                <Plane className="w-8 h-8 text-orange-500 transform -rotate-45 -translate-y-1 hover:scale-110 duration-200" />
                <Plane className="w-5 h-5 text-cyan-500 transform -rotate-45 hover:text-cyan-400 transition-colors" />
                
                {/* Tiny cloud line graphics */}
                <span className="absolute bottom-1 left-2 w-4 h-0.5 bg-cyan-500/30"></span>
                <span className="absolute top-1 right-2 w-6 h-0.5 bg-orange-500/20"></span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 text-center block mt-1">
                ¡Listos para el aterrizaje de diversión!
              </span>
            </div>

          </header>

          {/* BENTO GRID: INTERACTIVE SECTIONS */}
          <main className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            
            {/* CARD 1: ITINERARIO DE LA MISIÓN (Event details) - occupies 7 cols on md */}
            <section className="col-span-1 md:col-span-7 space-y-6">
              
              {/* Event primary details card */}
              <div className="bg-slate-950/70 border-2 border-cyan-500/20 rounded-2xl p-6 backdrop-blur-md relative overflow-hidden shadow-lg group hover:border-cyan-500/40 transition-all duration-300">
                <div className="absolute top-0 right-0 bg-cyan-500/10 text-cyan-400 border-l border-b border-cyan-500/30 text-[9px] font-mono tracking-widest px-2.5 py-1 rounded-bl-lg uppercase">
                  ITINERARIO SECTOR CZ-6
                </div>

                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-cyan-950/60 border border-cyan-400/30 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold font-mono text-white">ORDEN DE OPERACIÓN</h2>
                    <p className="text-xs text-slate-400 font-mono">DATOS DE VUELO AUTORIZADOS</p>
                  </div>
                </div>

                {/* Grid layout for details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Date section */}
                  <div className="bg-slate-900/60 border border-cyan-950/80 p-4 rounded-xl flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-orange-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] font-mono text-slate-500 uppercase block">FECHA DE DESPEGUE</span>
                      <span className="text-sm font-bold font-mono text-white">SÁBADO 20 DE JUNIO</span>
                      <span className="text-xs font-mono text-cyan-400 block mt-0.5">Junio, 2026</span>
                    </div>
                  </div>

                  {/* Time Section */}
                  <div className="bg-slate-900/60 border border-cyan-950/80 p-4 rounded-xl flex items-start gap-3">
                    <Clock className="w-5 h-5 text-orange-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] font-mono text-slate-500 uppercase block">HORA DE ACOPLAMIENTO</span>
                      <span className="text-sm font-bold font-mono text-white">14:00 HRS</span>
                      <span className="text-xs font-mono text-cyan-400 block mt-0.5">Hora de México (Tarde)</span>
                    </div>
                  </div>

                  {/* Coordinates & Location Section - spanning full columns */}
                  <div className="col-span-1 sm:col-span-2 bg-slate-900/60 border border-cyan-950/80 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-orange-400 mt-1 shrink-0 animate-bounce" />
                      <div>
                        <span className="text-[10px] font-mono text-slate-500 uppercase block">BASE DE REUNIÓN / COORDENADAS</span>
                        <span className="text-sm font-bold font-mono text-white block">Laurel 8, El Manto</span>
                        <span className="text-xs text-slate-400 font-mono block">Iztapalapa, CDMX, México</span>
                      </div>
                    </div>
                    
                    {/* Action buttons for location */}
                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                      <a
                        href="https://maps.google.com/?q=Laurel+8,+El+manto,+Iztapalapa"
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                          if (isAudioEnabled) sfx.playBeep(1100, 0.08);
                        }}
                        className="flex-1 md:flex-none py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded-lg text-xs font-bold font-mono text-center transition-colors shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Navigation className="w-3.5 h-3.5 transform rotate-45" />
                        <span>Ver en Mapa</span>
                      </a>
                      
                      <button
                        onClick={copyAddressToClipboard}
                        className="flex-1 md:flex-none py-2 px-3 bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-lg text-xs font-bold font-mono transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Datos</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Combat Plan Notice (Special message to recruits) */}
                <div className="mt-5 bg-orange-500/5 border border-orange-500/20 rounded-xl p-4 flex items-start gap-3">
                  <div className="p-1 rounded-full bg-orange-500/10 text-orange-400 mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold font-mono text-orange-400 uppercase">INSTRUCCIONES DE REGISTRO EN BASE</h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      "Soldados y pilotos aliados: Se ordena presentarse a la base militar Laurel 8 con ropa cómoda y listos para misiones aéreas especiales. El oficial principal Mateo otorgará raciones de dulces, piñata y pastel militar de lanzamiento táctico."
                    </p>
                  </div>
                </div>
              </div>

              {/* CARD: DETAILED COMBAT MAP (Virtual Radar Screen) */}
              <div className="bg-slate-950/70 border border-cyan-500/20 rounded-2xl p-6 backdrop-blur-md flex flex-col md:flex-row gap-6 hover:border-cyan-500/40 transition-all duration-300">
                <div className="flex-1">
                  <div className="flex items-center space-x-3.5 mb-3">
                    <Compass className="w-5 h-5 text-cyan-400 animate-spin-slow" />
                    <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wider">RADAR MILITAR DE TRÁFICO</h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed font-mono">
                    La señal del radar muestra la <span className="text-orange-400 font-bold">Base Laurel 8</span> en verde intermitente. Escaneando aeronaves aliadas del escuadrón. Haga clic en el botón de mapa superior para iniciar el piloto automático y la navegación guiada.
                  </p>
                  
                  {/* Flight stats indicators */}
                  <div className="grid grid-cols-2 gap-2 mt-4 text-[10px] font-mono">
                    <div className="bg-slate-900 border border-cyan-950/40 p-2 rounded">
                      <span className="text-slate-500 uppercase block">ALTITUD OBJETIVO</span>
                      <span className="text-cyan-400 font-bold">SÚPER 6 SECTORES</span>
                    </div>
                    <div className="bg-slate-900 border border-cyan-950/40 p-2 rounded">
                      <span className="text-slate-500 uppercase block">CLIMA DE VUELO</span>
                      <span className="text-emerald-400 font-bold">SOL / DESPEJADO ☀</span>
                    </div>
                  </div>
                </div>

                {/* Circular pulsing SVG simulated radar screen */}
                <div className="flex justify-center items-center select-none shrink-0 mx-auto md:mx-0">
                  <div className="w-36 h-36 border border-cyan-500/30 rounded-full relative overflow-hidden bg-slate-950 flex items-center justify-center">
                    
                    {/* Rotating sweeps */}
                    <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_50%,rgba(6,182,212,0.15)_100%)] rounded-full animate-spin"></div>
                    
                    {/* Center rings */}
                    <div className="absolute w-28 h-28 border border-dashed border-cyan-500/10 rounded-full"></div>
                    <div className="absolute w-16 h-16 border border-cyan-500/10 rounded-full"></div>
                    
                    {/* Crosshairs */}
                    <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-cyan-500/10 transform -translate-x-1/2"></div>
                    <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-cyan-500/10 transform -translate-y-1/2"></div>
                    
                    {/* Pulsing Target blip (Iztapalapa Location Base Laurel 8) */}
                    <div className="absolute top-1/3 left-1/3 w-2.5 h-2.5 bg-orange-500 rounded-full animate-ping"></div>
                    <div 
                      onClick={() => {
                        if (isAudioEnabled) sfx.playBeep(2000, 0.4, 'triangle');
                        setFeedbackMsg('🎯 DIANA: Coordenadas Laurel 8 Confirmadas!');
                        setTimeout(() => setFeedbackMsg(''), 2500);
                      }}
                      className="absolute top-1/3 left-1/3 w-2.5 h-2.5 bg-orange-500 rounded-full border border-white cursor-pointer group shadow-[0_0_10px_rgba(249,115,22,0.8)]"
                      title="Mat’s Base"
                    >
                      {/* Hover text blip */}
                      <span className="hidden group-hover:block absolute -top-5 left-1/2 -translate-x-1/2 bg-slate-900 border border-cyan-400 text-[8px] px-1 font-mono text-white rounded whitespace-nowrap">BASE 6</span>
                    </div>

                    {/* Drifting plane radar marker */}
                    <div className="absolute bottom-1/4 right-1/4 animate-pulse">
                      <Plane className="w-3 h-3 text-cyan-400 transform rotate-180" />
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD: MINI-GAME BENTO (ESQUIVA LAS NUBES) - Extremely fun tactile play */}
              <div className="bg-slate-950/70 border border-cyan-500/20 rounded-2xl p-6 backdrop-blur-md hover:border-cyan-500/40 transition-all duration-300 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-yellow-500/10 text-yellow-500 border-l border-b border-yellow-500/30 text-[9px] font-mono tracking-widest px-2.5 py-1 rounded-bl-lg uppercase">
                  ENTRENAMIENTO RECREATIVO
                </div>

                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center space-x-3">
                    <Award className="w-5 h-5 text-yellow-500" />
                    <div>
                      <h3 className="text-md font-bold font-mono text-white uppercase">MINI-JUEGO: ESQUIVAR TURBULENCIAS</h3>
                      <p className="text-[10px] text-slate-400 font-mono">PILOTA TU SUPERSÓNICO F-18 HASTA LA ACCIÓN</p>
                    </div>
                  </div>

                  {unlockedMedal && (
                    <div className="flex items-center space-x-1 py-1 px-2.5 bg-yellow-500/10 border border-yellow-400/30 rounded text-yellow-400 text-xs font-mono font-bold animate-pulse">
                      <Trophy className="w-3.5 h-3.5" />
                      <span>¡MEDALLA MATEO-06!</span>
                    </div>
                  )}
                </div>

                {/* Mini game screen layout */}
                {gameState === 'idle' && (
                  <div className="bg-slate-900/90 rounded-xl p-6 border border-cyan-950 text-center flex flex-col items-center justify-center space-y-3 min-h-[180px]">
                    <div className="w-12 h-12 rounded-full bg-cyan-950/50 flex items-center justify-center border border-cyan-500/40">
                      <Plane className="w-6 h-6 text-cyan-400 animate-bounce" />
                    </div>
                    <h4 className="text-sm font-bold font-mono text-white">MISIÓN: SOBREVIVE A LAS NUBES</h4>
                    <p className="text-xs text-slate-300 max-w-sm leading-relaxed font-mono">
                      Esquiva las nubes tormentosas moviendo el caza F-18 arriba y abajo. ¡Logra <span className="text-yellow-400 font-black">6 PUNTOS</span> para ganar y desbloquear la medalla oficial de Mateo!
                    </p>
                    <button
                      onClick={startGame}
                      className="py-2 px-5 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold font-mono text-xs rounded-lg transition-transform active:scale-95 shadow-md flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>INICIAR VUELO ENTRENAMIENTO</span>
                    </button>
                  </div>
                )}

                {gameState === 'playing' && (
                  <div className="relative">
                    {/* Active Flight Stage container */}
                    <div className="bg-gradient-to-r from-slate-950 to-slate-900 rounded-xl h-[180px] border border-cyan-500/30 relative overflow-hidden select-none">
                      
                      {/* Grid background passing simulation */}
                      <div className="absolute inset-x-0 top-0 bottom-0 bg-[linear-gradient(rgba(34,211,238,0.02)_1px,transparent_1px)] [background-size:100%_15px] pointer-events-none animate-[scanline_10s_linear_infinite]"></div>
                      
                      {/* Score Indicator */}
                      <div className="absolute top-2 right-2 bg-slate-950/80 border border-slate-800 text-cyan-400 py-1 px-2.5 rounded text-xs font-mono font-bold tracking-widest z-10">
                        MARCADOR: {score} / 6
                      </div>

                      {/* Player Jet plane SVG */}
                      <div 
                        className="absolute left-[15%] w-8 h-8 -translate-x-1/2 -translate-y-1/2 transition-all duration-100 flex items-center justify-center text-cyan-400 filter drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]"
                        style={{ top: `${playerY}%` }}
                      >
                        <Plane className="w-7 h-7 transform rotate-90" />
                        {/* Thrust flame trail */}
                        <div className="absolute right-full w-4 h-1 bg-gradient-to-r from-transparent to-orange-500 rounded-full animate-pulse mr-1"></div>
                      </div>

                      {/* Dynamic obstacles drawing */}
                      {obstacles.map(obs => (
                        <div
                          key={obs.id}
                          className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-100"
                          style={{
                            left: `${obs.x}%`,
                            top: `${obs.y}%`,
                          }}
                        >
                          {obs.type === 'cloud' ? (
                            <div className="bg-slate-300 border-2 border-slate-400 rounded-full px-2 py-0.5 text-[10px] text-slate-800 font-bold shadow-md selection:bg-transparent">
                              ☁ Turbulencia
                            </div>
                          ) : (
                            <div className="bg-orange-500/35 text-orange-200 border border-orange-400 text-[8px] font-mono px-1 rounded uppercase">
                              ⚡ Tormenta
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Flight dashboard keyboard instructions & buttons for mobile */}
                    <div className="flex justify-between items-center mt-3 gap-4">
                      <span className="text-[10px] font-mono text-slate-400 hidden sm:block">
                        Teclado: Usa <span className="bg-slate-900 py-0.5 px-1.5 border border-slate-700 rounded text-slate-200 font-bold">W</span> / <span className="bg-slate-900 py-0.5 px-1.5 border border-slate-700 rounded text-slate-200 font-bold">S</span> o Flechas
                      </span>
                      
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => movePlayer('up')}
                          className="flex-1 sm:flex-none py-2.5 px-5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-black rounded-lg text-sm text-center active:bg-cyan-950 active:border-cyan-500/50 select-none cursor-pointer"
                        >
                          ▲ SUBIR CAZA
                        </button>
                        <button
                          onClick={() => movePlayer('down')}
                          className="flex-1 sm:flex-none py-2.5 px-5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-black rounded-lg text-sm text-center active:bg-cyan-950 active:border-cyan-500/50 select-none cursor-pointer"
                        >
                          ▼ BAJAR CAZA
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {gameState === 'gameover' && (
                  <div className="bg-slate-900/95 rounded-xl p-5 border border-red-950/40 text-center flex flex-col items-center justify-center space-y-3 min-h-[180px]">
                    <div className="w-10 h-10 rounded-full bg-red-950/50 border border-red-500/50 flex items-center justify-center">
                      <XCircle className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold font-mono text-red-400 uppercase">MATEO COMPROMETIDO (FIN DEL JUEGO)</h4>
                      <p className="text-xs font-mono text-slate-300 mt-1">Esquivaste suficientes nubes pero caíste en turbulencia.</p>
                      <span className="text-sm font-black font-mono text-cyan-400 mt-1 block">PUNTUACIÓN OBTENIDA: {score}</span>
                      {isNewHighScore && (
                        <span className="text-yellow-400 text-xs font-bold font-mono blink block">★ ¡NUEVO RÉCORD DE TRIPULANTE! ★</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={startGame}
                        className="py-1.5 px-4 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold font-mono text-xs rounded transition-transform active:scale-95 cursor-pointer"
                      >
                        REINTENTAR VUELO
                      </button>
                      <button
                        onClick={() => setGameState('idle')}
                        className="py-1.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold font-mono text-xs rounded cursor-pointer"
                      >
                        SALIR
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* CARD 2: RSVP CO-PILOT REGISTER & countdown - occupies 5 cols on md */}
            <aside className="col-span-1 md:col-span-5 space-y-6">

              {/* Bento: Live Launch Clock countdown */}
              <div className="bg-slate-950/70 border border-orange-500/30 rounded-2xl p-5 backdrop-blur-md relative overflow-hidden shadow-md">
                
                {/* Background color gradient glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-orange-500/5 rounded-full blur-2xl pointer-events-none"></div>

                <div className="flex items-center space-x-2.5 mb-3.5">
                  <Clock className="w-4.5 h-4.5 text-orange-400 animate-pulse" />
                  <h3 className="text-xs font-bold font-mono uppercase text-white tracking-widest">
                    CUENTA REGRESIVA PARA EL DESPEGUE
                  </h3>
                </div>

                {timeLeft.isLaunched ? (
                  <div className="text-center py-2.5 bg-emerald-950/20 rounded border border-emerald-500/30">
                    <span className="text-emerald-400 font-mono font-bold text-sm block">✈️ ¡MISIÓN EN CURSO! ✈️</span>
                    <span className="text-xs text-slate-300 font-mono">Presentarse inmediatamente en Laurel 8</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    
                    <div className="bg-slate-900 border border-cyan-950/50 p-2.5 rounded-lg">
                      <span className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight">{timeLeft.days}</span>
                      <span className="text-[9px] font-mono text-slate-500 uppercase block mt-1">Días</span>
                    </div>

                    <div className="bg-slate-900 border border-cyan-950/50 p-2.5 rounded-lg">
                      <span className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight">{timeLeft.hours}</span>
                      <span className="text-[9px] font-mono text-slate-500 uppercase block mt-1">Hrs</span>
                    </div>

                    <div className="bg-slate-900 border border-cyan-950/50 p-2.5 rounded-lg">
                      <span className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight">{timeLeft.minutes}</span>
                      <span className="text-[9px] font-mono text-slate-500 uppercase block mt-1">Min</span>
                    </div>

                    <div className="bg-slate-900 border border-cyan-950/50 p-2.5 rounded-lg">
                      <span className="text-xl sm:text-2xl font-bold font-mono text-orange-400 tracking-tight">{timeLeft.seconds}</span>
                      <span className="text-[9px] font-mono text-slate-500 uppercase block mt-1">Seg</span>
                    </div>

                  </div>
                )}
                
                <span className="text-[9px] font-mono text-slate-400 block text-center mt-3">
                  FECHA OBJETIVO: 20 JUNIO 2026, 14:00 HRS
                </span>
              </div>

              {/* Bento: RSVP Form Registry */}
              <div className="bg-slate-950/70 border-2 border-orange-500/20 rounded-2xl p-6 backdrop-blur-md relative overflow-hidden shadow-lg hover:border-orange-500/35 transition-all duration-300">
                
                <div className="absolute top-2 right-2 flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono font-bold text-slate-400">
                  <Users className="w-3 h-3" />
                  <span>REGISTRO</span>
                </div>

                <div className="flex items-center space-x-3 mb-5">
                  <div className="w-10 h-10 rounded-lg bg-orange-950/60 border border-orange-500/30 flex items-center justify-center">
                    <UserCheck className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <h3 className="text-md font-bold font-mono text-white uppercase">SISTEMA RECLUTA RSVP</h3>
                    <p className="text-[10px] text-slate-400 font-mono">REGISTRE SU EMBARCACIÓN / CONFIRME ASISTENCIA</p>
                  </div>
                </div>

                {/* RSVP Form body */}
                <form onSubmit={handleRsvpSubmit} className="space-y-4">
                  
                  {/* Name field */}
                  <div>
                    <label htmlFor="recruit_name" className="text-[10px] font-mono text-slate-400 block mb-1">
                      NOMBRE DE PILOTO INVITADO / FAMILIA
                    </label>
                    <input
                      type="text"
                      id="recruit_name"
                      required
                      placeholder="Ej. Tío Carlos, Primo Luis..."
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-slate-900/80 border border-cyan-950 text-white rounded-lg py-2.5 px-3.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-cyan-400 focus:border-cyan-400 placeholder:text-slate-600 transition-colors"
                    />
                  </div>

                  {/* Status checklist radio style */}
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 block mb-1">
                      ESTADO OPERACIONAL (Día del Evento)
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, status: 'confirmed' }))}
                        className={`py-2 px-3 rounded-lg text-xs font-bold font-mono text-center flex items-center justify-center gap-1.5 transition-all outline-none cursor-pointer ${
                          formData.status === 'confirmed'
                            ? 'bg-emerald-950/30 border-2 border-emerald-500 text-emerald-400 font-black shadow-[inset_0_0_8px_rgba(16,185,129,0.15)]'
                            : 'bg-slate-900 border border-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>¡LISTOS DESPEGAR!</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, status: 'declined' }))}
                        className={`py-2 px-3 rounded-lg text-xs font-bold font-mono text-center flex items-center justify-center gap-1.5 transition-all outline-none cursor-pointer ${
                          formData.status === 'declined'
                            ? 'bg-red-950/30 border-2 border-red-500 text-red-400 font-black shadow-[inset_0_0_8px_rgba(239,68,68,0.15)]'
                            : 'bg-slate-900 border border-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>DE RESERVA (NO IR)</span>
                      </button>

                    </div>
                  </div>



                  {/* extra copilots with icons representation */}
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 block mb-1">
                      COPILOTOS / ACOMPAÑANTES ADICIONALES: <span className="text-orange-400 font-bold">{formData.copilots}</span>
                    </label>
                    <div className="flex items-center space-x-3.5">
                      <input
                        type="range"
                        min="0"
                        max="5"
                        value={formData.copilots}
                        onChange={(e) => setFormData(prev => ({ ...prev, copilots: parseInt(e.target.value) }))}
                        className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                      
                      {/* Visual representations of mini jets */}
                      <div className="flex gap-1 shrink-0 bg-slate-900 p-1 rounded border border-slate-800">
                        {formData.copilots === 0 ? (
                          <span className="text-[10px] font-mono text-slate-600 px-1">Solo</span>
                        ) : (
                          Array.from({ length: formData.copilots }).map((_, i) => (
                            <Plane key={i} className="w-3.5 h-3.5 text-orange-400 transform -rotate-45" />
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    id="submit_rsvp_form"
                    className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 hover:from-orange-400 hover:to-amber-400 font-black font-mono tracking-widest text-xs rounded-xl transform active:scale-95 transition-all duration-300 shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>{isLoading ? 'GUARDANDO DATOS...' : '✓ CONFIRMAR OPERACIÓN'}</span>
                  </button>

                </form>

              </div>

              {/* Bento: Roster list Crew database presentation */}
              {(() => {
                const fullRoster = [
                  ...FOUNDER_CREW,
                  ...crewRoster.filter(c => !['1', '2', '3'].includes(c.id))
                ];
                
                const confirmedPilots = fullRoster.filter(c => c.status === 'confirmed');
                const totalConfirmedCopilots = confirmedPilots.reduce((acc, curr) => acc + curr.copilots, 0);
                const totalConfirmedForce = confirmedPilots.length + totalConfirmedCopilots;

                const reservePilots = fullRoster.filter(c => c.status === 'declined');

                const filteredRoster = fullRoster.filter(crew => {
                  if (crewFilter === 'confirmed') return crew.status === 'confirmed';
                  if (crewFilter === 'declined') return crew.status === 'declined';
                  return true;
                });

                return (
                  <div className="bg-slate-950/70 border border-cyan-500/20 rounded-2xl p-5 backdrop-blur-md relative shadow-md">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold font-mono text-white uppercase tracking-wider block">
                        ROSTER DE TRIPULANTES ({fullRoster.length})
                      </span>
                      <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.5 rounded animate-pulse">DB EN TIEMPO REAL</span>
                    </div>

                    {/* Stats indicators */}
                    <div className="grid grid-cols-3 gap-1.5 mb-3 text-center">
                      <div className="bg-slate-900/40 border border-emerald-500/20 rounded p-1.5">
                        <p className="text-[8px] font-mono text-slate-400 uppercase leading-none">Confirmados</p>
                        <p className="text-sm font-black font-mono text-emerald-400 mt-1">{confirmedPilots.length}</p>
                      </div>
                      <div className="bg-slate-900/40 border border-orange-500/25 rounded p-1.5">
                        <p className="text-[8px] font-mono text-slate-400 uppercase leading-none">Copilotos</p>
                        <p className="text-sm font-black font-mono text-orange-400 mt-1">{totalConfirmedCopilots}</p>
                      </div>
                      <div className="bg-slate-900/40 border border-cyan-500/20 rounded p-1.5">
                        <p className="text-[8px] font-mono text-slate-400 uppercase leading-none">Fuerza Total</p>
                        <p className="text-sm font-black font-mono text-cyan-400 mt-1">{totalConfirmedForce}</p>
                      </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-1 mb-3 bg-slate-900 p-1 rounded-lg border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setCrewFilter('all')}
                        className={`flex-1 py-1 text-[9px] font-mono rounded font-bold transition-all cursor-pointer ${
                          crewFilter === 'all'
                            ? 'bg-cyan-500 text-slate-950 shadow'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        TODOS ({fullRoster.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCrewFilter('confirmed')}
                        className={`flex-1 py-1 text-[9px] font-mono rounded font-bold transition-all cursor-pointer ${
                          crewFilter === 'confirmed'
                            ? 'bg-emerald-500 text-slate-950 shadow'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        LISTOS ({confirmedPilots.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCrewFilter('declined')}
                        className={`flex-1 py-1 text-[9px] font-mono rounded font-bold transition-all cursor-pointer ${
                          crewFilter === 'declined'
                            ? 'bg-red-500 text-slate-950 shadow'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        RESERVA ({reservePilots.length})
                      </button>
                    </div>

                    <div className="bg-slate-900/60 rounded-xl overflow-hidden max-h-[220px] overflow-y-auto border border-cyan-950/30 font-mono text-xs divide-y divide-cyan-950/40">
                      {filteredRoster.length === 0 ? (
                        <div className="text-center p-6 text-slate-500">
                          Ningún piloto registrado en esta categoría.
                        </div>
                      ) : (
                        filteredRoster.map(crew => (
                          <div key={crew.id} className="p-3 bg-slate-950/40 flex justify-between items-center gap-3 hover:bg-slate-900/50 transition-colors">
                            <div className="min-w-0">
                              <div className="flex items-center space-x-1.5">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${crew.status === 'confirmed' ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                                <span className="font-bold text-white text-xs truncate block select-all">{crew.name}</span>
                              </div>
                              {crew.copilots > 0 && (
                                <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-1 pl-3.5">
                                  <span className="text-orange-400">+{crew.copilots} Co-pilotos</span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center space-x-1.5 shrink-0">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                crew.status === 'confirmed' 
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                  : 'bg-red-500/10 text-red-500 border border-red-500/20'
                              }`}>
                                {crew.status === 'confirmed' ? 'LISTO' : 'RESERVA'}
                              </span>
                              
                              {/* Family cannot be removed, others can */}
                              {!['1', '2', '3'].includes(crew.id) && (
                                <button
                                  onClick={() => removeCrewMember(crew.id)}
                                  className="p-1 hover:bg-red-500/10 rounded text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                                  title="Remover de lista"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <p className="text-[9px] font-mono text-slate-500 text-center mt-2">
                      *Los cambios se guardan de forma permanente y segura en la base de datos central.
                    </p>
                  </div>
                );
              })()}

            </aside>

          </main>

          {/* Centered Invitation sharing & Footer */}
          <footer className="mt-8 text-center py-6 border-t border-cyan-500/10 max-w-sm mx-auto">
            <p className="text-[10px] font-mono text-slate-400">
              LANZAMIENTO TÁCTICO MATEO-06 © CUMPLEAÑOS F-18 CHILDS FLIGHT
            </p>
            <div className="flex items-center justify-center space-x-2 mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span>
              <p className="text-[9px] text-slate-500 font-mono">
                Desarrollado para Mateo Garfias, Junio 2026
              </p>
            </div>
            
            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  setFeedbackMsg('🔗 ¡Enlace de invitación copiado para compartir!');
                  if (isAudioEnabled) sfx.playBeep(1200, 0.05);
                  setTimeout(() => setFeedbackMsg(''), 2500);
                }}
                className="py-1.5 px-3 bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 text-xs font-mono font-bold rounded-lg flex items-center gap-1 justify-center active:scale-95 transition-all cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Compartir con Pilotos Amigos</span>
              </button>
            </div>
          </footer>

        </div>
      )}

      {/* Retro/Futuristic glow line aesthetics for footer */}
      <div className="w-full bg-[radial-gradient(ellipse_at_bottom,rgba(6,182,212,0.15)_0%,transparent_70%)] h-12 pointer-events-none sticky bottom-0"></div>

    </div>
  );
}
