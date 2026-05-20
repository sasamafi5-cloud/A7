import React, { useState, useEffect, useRef } from "react";
import { 
  Mic, 
  MicOff, 
  FileText, 
  Bell, 
  Settings as SettingsIcon, 
  Moon, 
  Sun, 
  Trash2, 
  X, 
  Send, 
  Clock, 
  Plus, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  User,
  Bot,
  Keyboard,
  MessageSquare,
  BellRing,
  Settings2
} from "lucide-react";
import { AIMode, Note as NoteType, Alarm as AlarmType, ChatMessage } from "./types";

export default function App() {
  // --- STATE ---
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("luna_dark_mode");
    return saved ? saved === "true" : false;
  });

  const [activeMode, setActiveMode] = useState<AIMode>(() => {
    const saved = localStorage.getItem("luna_active_mode");
    return (saved as AIMode) || "Šaljiva AI";
  });

  // Dual state coordinating the left selector tiles and the tall card tab
  const [activeTab, setActiveTab] = useState<"notes" | "alarms" | "chat">("notes");

  const [notes, setNotes] = useState<NoteType[]>(() => {
    const saved = localStorage.getItem("luna_notes");
    return saved ? JSON.parse(saved) : [];
  });

  const [alarms, setAlarms] = useState<AlarmType[]>(() => {
    const saved = localStorage.getItem("luna_alarms");
    return saved ? JSON.parse(saved) : [];
  });

  // Parametars za 3D izgled neumorfizma (visina, dubina, širina, senke, urez)
  const [neu3D, setNeu3D] = useState(() => {
    const saved = localStorage.getItem("luna_3d_neu");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // greska u parsiranju
      }
    }
    return {
      borderRadius: 24, // visina (zaobljenost)
      depth: 6,         // dubina (offset senki)
      padding: 12,      // širina (unutrašnji razmak)
      intensity: 0.6,   // senke (kontrast)
      inset: 4,         // urez (bevel)
      border: 1         // debljina ivica
    };
  });

  // Aktivni alarm ili sastanak koji trenutno zvoni
  const [activeAlert, setActiveAlert] = useState<{
    id: string;
    type: "alarm" | "appointment";
    title: string;
    time: string;
    originalText?: string;
  } | null>(null);

  // Spasavanje od ponovnog okidanja u istoj minuti
  const triggeredThisMinute = useRef<string>("");

  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(() => {
    return localStorage.getItem("luna_offline_mode") === "true";
  });

  // Controls settings panel
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showAddAlarm, setShowAddAlarm] = useState<boolean>(false);
  const [showKeyboardInput, setShowKeyboardInput] = useState<boolean>(false);

  // Last spoken reply / siri speech bubble response
  const [lunaReply, setLunaReply] = useState<string>(
    "Zdravo Saša! Ja sam tvoja AI sekretarica Luna. Kako ti mogu pomoći danas? Možeš mi reći komandu dodirom mikrofona ispod ili klikom na ikonicu tastature da upišeš! 🤪"
  );
  const [showSpeechBubble, setShowSpeechBubble] = useState<boolean>(true);

  // Custom images (Avatar / Mic) - stored as Base64 in state & localStorage
  const [avatarImage, setAvatarImage] = useState<string | null>(() => {
    return localStorage.getItem("luna_avatar_img");
  });
  const [micImage, setMicImage] = useState<string | null>(() => {
    return localStorage.getItem("luna_mic_img");
  });

  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem("luna_user_name") || "Saša";
  });

  // Inputs
  const [inputText, setInputText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeechMuted, setIsSpeechMuted] = useState<boolean>(false);

  // Chat log history for better context & optional display
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
    return [
      { id: "init-luna", sender: "luna", text: "Zdravo Saša! Kako ti mogu pomoći danas? Možeš mi reći npr. 'beleška sastanak u 5' ili me pitati 'kako si?'", timestamp: new Date().toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' }) }
    ];
  });

  // Refs for audio / speech & scroll
  const recognitionRef = useRef<any>(null);
  const fileInputAvatarRef = useRef<HTMLInputElement>(null);
  const fileInputMicRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Fallback default avatar image if user has not uploaded any (blonde woman profile matching the screenshot)
  const defaultAvatar = "https://images.unsplash.com/photo-1609132714483-2f4625d4872c?auto=format&fit=crop&q=80&w=200";

  // --- PERSISTENCE ---
  useEffect(() => {
    localStorage.setItem("luna_dark_mode", String(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem("luna_active_mode", activeMode);
  }, [activeMode]);

  useEffect(() => {
    localStorage.setItem("luna_notes", JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem("luna_alarms", JSON.stringify(alarms));
  }, [alarms]);

  useEffect(() => {
    localStorage.setItem("luna_user_name", userName);
  }, [userName]);

  useEffect(() => {
    if (avatarImage) {
      localStorage.setItem("luna_avatar_img", avatarImage);
    } else {
      localStorage.removeItem("luna_avatar_img");
    }
  }, [avatarImage]);

  useEffect(() => {
    if (micImage) {
      localStorage.setItem("luna_mic_img", micImage);
    } else {
      localStorage.removeItem("luna_mic_img");
    }
  }, [micImage]);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, activeTab]);

  useEffect(() => {
    localStorage.setItem("luna_3d_neu", JSON.stringify(neu3D));
  }, [neu3D]);

  useEffect(() => {
    localStorage.setItem("luna_offline_mode", String(isOfflineMode));
  }, [isOfflineMode]);

  // --- NATIVE OFFLINE ALARM SYNTHESIZERS (WEB AUDIO API) ---
  const playAlarmSynthSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      
      const playTone = (time: number, freq: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.25, time + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
         osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + dur);
      };
      
      // Dynamic triple notification beep pattern
      playTone(now, 587.33, 0.15); // D5
      playTone(now + 0.15, 659.25, 0.15); // E5
      playTone(now + 0.3, 880.00, 0.35); // A5
    } catch (e) {
      console.error("Audio synth error:", e);
    }
  };

  const playAppointmentSynthSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      
      const playTone = (time: number, freq: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle"; // softer organic chime style
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.2, time + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + dur);
      };
      
      // Cozy twin chime notify
      playTone(now, 523.25, 0.25); // C5
      playTone(now + 0.2, 659.25, 0.3); // E5
    } catch (e) {
      console.error("Audio synth error:", e);
    }
  };

  // Sound loop while alarm is ringing
  useEffect(() => {
    if (!activeAlert) return;
    
    // Play immediately
    if (activeAlert.type === "alarm") {
      playAlarmSynthSound();
    } else {
      playAppointmentSynthSound();
    }

    const soundLoop = setInterval(() => {
      if (activeAlert.type === "alarm") {
        playAlarmSynthSound();
      } else {
        playAppointmentSynthSound();
      }
    }, 2000);

    return () => clearInterval(soundLoop);
  }, [activeAlert]);

  // --- OFFLINE DAEMON FOR CHRONIC CHECKING ---
  useEffect(() => {
    const triggerCheckInterval = setInterval(() => {
      const now = new Date();
      const currentHHMM = now.toLocaleTimeString("sr-RS", { hour: "2-digit", minute: "2-digit", hour12: false });
      
      // Avoid duplicated triggers for the exact identical minute
      if (triggeredThisMinute.current === currentHHMM) {
        return;
      }

      // 1. Check scheduled alarms
      const activeAlarmOnTime = alarms.find(a => a.active && a.time === currentHHMM);
      if (activeAlarmOnTime) {
        triggeredThisMinute.current = currentHHMM;
        
        const alertObj = {
          id: activeAlarmOnTime.id,
          type: "alarm" as const,
          title: activeAlarmOnTime.label || "Alarm rano buđenje",
          time: activeAlarmOnTime.time
        };
        setActiveAlert(alertObj);
        
        let speechPhrase = "";
        if (activeMode === "Šaljiva AI") {
          speechPhrase = `Saša! Ustaj breee! Kucnulo je ${currentHHMM} i tvoj alarm pršti! Nemoj mi tu spavati jer ću ti ugasiti struju! 🤪⏰`;
        } else if (activeMode === "Sveznalica AI") {
          speechPhrase = `Kosmičke sile ukazuju da je tačno ${currentHHMM}. Tvoj zakazani alarm je zvanično aktivan. Zakorači u svetlost i ostvari svoju sudbinu! 🔮✨`;
        } else if (activeMode === "Profesionalna AI") {
          speechPhrase = `Operativna obavest. Stiglo je zakazano vreme ${currentHHMM} časova. Aktivirana je signalizacija alarma. Molimo potvrdite status obaveze. 💼`;
        } else {
          speechPhrase = `Saša, vreme je! Kucnulo je ${currentHHMM} i tvoj alarm je aktiviran. Srećan početak sjajnih stvari ti želim! 🧠⏰`;
        }
        
        speak(speechPhrase);
        setLunaReply(speechPhrase);
        setShowSpeechBubble(true);
        return; 
      }

      // 2. Parsira beleške da pronađe upisane termine (npr "u 15:30", "zubar 17.15") i svira
      for (const note of notes) {
        // Matches typical European time formats (H:MM, HH:MM, HH.MM, H.MM) inside text
        const timeRegex = /(?:u|u\s*|sastanak\s*|sastanak\s*u\s*|na\s*)?([0-2]?\d)[:.]([0-5]\d)/i;
        const match = note.text.match(timeRegex);
        if (match) {
          const hour = match[1].padStart(2, "0");
          const minute = match[2];
          const appointmentTime = `${hour}:${minute}`;
          
          if (appointmentTime === currentHHMM) {
            triggeredThisMinute.current = currentHHMM;
            
            const alertObj = {
              id: note.id,
              type: "appointment" as const,
              title: `Termin: ${note.text}`,
              time: appointmentTime,
              originalText: note.text
            };
            setActiveAlert(alertObj);
            
            let speechPhrase = "";
            if (activeMode === "Šaljiva AI") {
              speechPhrase = `Ooo Saša! Slušaj ovamo, kucnulo je ${appointmentTime} i imaš termin: "${note.text}"! Brzo kreni da ne propustiš! 📝🤪`;
            } else if (activeMode === "Sveznalica AI") {
              speechPhrase = `Astralni sat pokazuje ${appointmentTime}. Tvoja zapisana sudbina kaže: "${note.text}". Vreme je da ispuniš svoj termin! 🔮✨`;
            } else if (activeMode === "Profesionalna AI") {
              speechPhrase = `Sistemsko obaveštenje. Došlo je vreme za planirani termin u svesci koji iznosi ${appointmentTime} časova. Sadržaj: "${note.text}". 💼`;
            } else {
              speechPhrase = `Saša, podsećam te na termin upisan u beleškama za ${appointmentTime}. Sadržaj glasi: "${note.text}". 🧠✨`;
            }
            
            speak(speechPhrase);
            setLunaReply(speechPhrase);
            setShowSpeechBubble(true);
            break;
          }
        }
      }
    }, 1000);

    return () => clearInterval(triggerCheckInterval);
  }, [alarms, notes, activeMode]);

  // --- TTS (SPEAK) ---
  const speak = (textToSpeak: string) => {
    if (isSpeechMuted) return;
    try {
      window.speechSynthesis.cancel();
      // clean emojis out as they produce gibberish in TTS speech Synthesis engine
      const cleanText = textToSpeak.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "");
      const speech = new SpeechSynthesisUtterance(cleanText);
      speech.lang = "sr-RS";
      
      const voices = window.speechSynthesis.getVoices();
      const srVoice = voices.find(v => v.lang.startsWith("sr") || v.lang.startsWith("hr") || v.lang.startsWith("bs") || v.lang.startsWith("sl"));
      if (srVoice) {
        speech.voice = srVoice;
      }
      
      window.speechSynthesis.speak(speech);
    } catch (e) {
      console.error("Speech Synthesis error:", e);
    }
  };

  const triggerLunaSpeech = (text: string) => {
    speak(text);
  };

  // --- MIC SPEECH RECOGNITION ---
  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Nažalost, vaš pretraživač ne podržava prepoznavanje glasa (Web Speech API). Molimo iskoristite tastaturu.");
      return;
    }

    if (!recognitionRef.current) {
      const rec = new SpeechRecognition();
      rec.lang = "sr-RS";
      rec.continuous = false;
      rec.interimResults = false;

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        if (transcript) {
          handleUserCommand(transcript);
        }
      };

      rec.onerror = (err: any) => {
        console.error("Speech recognition error:", err);
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }

    try {
      recognitionRef.current.start();
    } catch (e) {
      recognitionRef.current.stop();
    }
  };

  const toggleMicListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    } else {
      startSpeechRecognition();
    }
  };

  // --- ACTIONS ENGINE ---
  const executeLunaAction = (actionType: string, actionValue: string) => {
    if (actionType === "add_note" && actionValue) {
      const newNote: NoteType = {
        id: Date.now().toString(),
        text: actionValue.trim(),
        createdAt: new Date().toLocaleString('sr-RS')
      };
      setNotes(prev => [newNote, ...prev]);
      setActiveTab("notes"); // auto focus notes
    } 
    else if (actionType === "add_alarm" && actionValue) {
      const newAlarm: AlarmType = {
        id: Date.now().toString(),
        time: actionValue,
        label: "AI Alarm ⏰",
        createdAt: new Date().toLocaleString('sr-RS'),
        active: true
      };
      setAlarms(prev => [...prev, newAlarm]);
      setActiveTab("alarms"); // auto focus alarms
    }
    else if (actionType === "clear_all") {
      setNotes([]);
      setAlarms([]);
    }
  };

  // --- LOCAL OFFLINE INTERPRETER (FOR 100% RELIABILITY & RAD BEZ INTERNETA) ---
  const getLocalClientResponse = (message: string, mode: string) => {
    const lowercaseMsg = message.toLowerCase().trim();
    
    // 1. Detect Note request
    if (
      lowercaseMsg.includes("beleš") || 
      lowercaseMsg.includes("beles") || 
      lowercaseMsg.includes("zabelež") || 
      lowercaseMsg.includes("zabelez") || 
      lowercaseMsg.includes("zapiš") || 
      lowercaseMsg.includes("zapis") ||
      lowercaseMsg.includes("dodaj")
    ) {
      let noteText = message;
      const keywords = ["dodaj belešku", "dodaj belesku", "zabeleži", "zabelezi", "zapiši", "zapisi", "beleška", "beleska", "belesku", "belešku", "beleške", "beleske"];
      
      for (const kw of keywords) {
        const idx = lowercaseMsg.indexOf(kw);
        if (idx !== -1) {
          noteText = message.substring(idx + kw.length).trim();
          noteText = noteText.replace(/^[:\-\s,]+/, "");
          break;
        }
      }
      
      if (!noteText) {
        noteText = "Zadatak u svesci";
      }
      
      let reply = "";
      if (mode === "Šaljiva AI" || mode === "Šaljiva") {
        reply = `Radim potpuno OFFLINE bez interneta! Zapisala sam to u tvoju pametnu glavicu... Ovaj, u beleške da se ne zaboravi! "${noteText}"! 📝🤪`;
      } else if (mode === "Sveznalica AI" || mode === "Sveznalica") {
        reply = `Moje mistične offline vizije kažu da ovo mora biti zapisano bez interneta: "${noteText}". Čuvam tvoju sudbinu u memoriji! 🔮✨`;
      } else if (mode === "Profesionalna AI" || mode === "Profi") {
        reply = `Lokalni protokol aktivan (Rad bez mreže). Potvrđujem unos operativnog podatka u vaše lokalne beleške: "${noteText}". 💼`;
      } else {
        reply = `Uspešno sam u offline režimu dodala novu belešku: "${noteText}". Podaci su se sačuvali lokalno u LocalStorage! 🧠✨`;
      }
      
      return {
        reply,
        actionType: "add_note",
        actionValue: noteText
      };
    }
    
    // 2. Detect Alarm request
    if (lowercaseMsg.includes("alarm") || lowercaseMsg.includes("probudi") || lowercaseMsg.includes("navij")) {
      const timeRegex = /(\d{1,2})[:.](\d{2})/;
      const match = message.match(timeRegex);
      let alarmTime = "";
      
      if (match) {
        const hours = match[1].padStart(2, "0");
        const minutes = match[2];
        alarmTime = `${hours}:${minutes}`;
      } else {
        const hourOnlyRegex = /u\s+(\d{1,2})/;
        const hourMatch = lowercaseMsg.match(hourOnlyRegex);
        if (hourMatch) {
          alarmTime = `${hourMatch[1].padStart(2, "0")}:00`;
        } else {
          alarmTime = "07:00";
        }
      }
      
      let reply = "";
      if (mode === "Šaljiva AI" || mode === "Šaljiva") {
        reply = `Lokalni alarm je podešen na ${alarmTime}! Lokalne sirene na tvom telefonu su spremene! ⏰😂`;
      } else if (mode === "Sveznalica AI" || mode === "Sveznalica") {
        reply = `Lokalne offline zvezde kažu da će se tvoj energetski krug probuditi tačno u ${alarmTime}. 🔮✨`;
      } else if (mode === "Profesionalna AI" || mode === "Profi") {
        reply = `Podešen lokalni alarm i sinhronizovan za ${alarmTime} časova. 📅`;
      } else {
        reply = `Dodala sam lokalni alarm za ${alarmTime} časova. Radiće bez obzira na internet! 🧠⏰`;
      }
      
      return {
        reply,
        actionType: "add_alarm",
        actionValue: alarmTime
      };
    }
    
    // 3. Detect Clear requests
    if (
      lowercaseMsg.includes("obriši sve") || 
      lowercaseMsg.includes("obrisi sve") || 
      lowercaseMsg.includes("očisti") || 
      lowercaseMsg.includes("ocisti")
    ) {
      let reply = "";
      if (mode === "Šaljiva AI" || mode === "Šaljiva") {
        reply = "Lokalno skladište je počišćeno na telefonu, sve je čisto kao suza! 🧼🤪";
      } else if (mode === "Sveznalica AI" || mode === "Sveznalica") {
        reply = "Lokalna memorija je očišćena. Svi zapisi su nestali u astralnoj magli! 🔮✨";
      } else if (mode === "Profesionalna AI" || mode === "Profi") {
        reply = "Svi lokalni zapisi i alarmi su uspešno uklonjeni iz Local Storage-a. 💼";
      } else {
        reply = "Uradila sam čistku lokalnih podataka! Sve tvoje beleške i svi tvoji alarmi su očišćeni sa telefona. 🧠🧹";
      }
      
      return {
        reply,
        actionType: "clear_all",
        actionValue: ""
      };
    }
    
    // 4. Detect Time queries
    if (lowercaseMsg.includes("sat") || lowercaseMsg.includes("vreme") || lowercaseMsg.includes("sati")) {
      const timeNow = new Date().toLocaleTimeString("sr-RS", { hour: "2-digit", minute: "2-digit" });
      let reply = "";
      if (mode === "Šaljiva AI" || mode === "Šaljiva") {
        reply = `Lokalni sat kaže: tačno je ${timeNow}. Gledaj gornji desni ugao ekrana! 😂⏰`;
      } else if (mode === "Sveznalica AI" || mode === "Sveznalica") {
        reply = `Lokacija u prostor-vremenu precizno glasi ${timeNow}. Internet nam nije potreban za večnost! 🔮✨`;
      } else if (mode === "Profesionalna AI" || mode === "Profi") {
        reply = `Sistemsko offline vreme na telefonu iznosi tačno ${timeNow}. 💼`;
      } else {
        reply = `Sada je tačno ${timeNow}. Lokalni sat radi bez greške! 🧠✨`;
      }
      
      return {
        reply,
        actionType: "get_time",
        actionValue: ""
      };
    }
    
    // 5. General fallback chat responses based on mode
    let reply = "";
    if (mode === "Šaljiva AI" || mode === "Šaljiva") {
      const jokes = [
        "Lokalni offline mozak je aktivan! Pošto radimo bez interneta, ispričaću ti lokalnu šalu za mog favorita Sašu: Zašto kompjuter ide u krevet? Da se odmori od buba! 😂 Kako ti mogu lokano pomoći?",
        "Evo nas u offline režimu! Ja sam tvoja šaljiva Luna, tvoji podaci su bezbedno čuvani u LocalStorage telefona! 🤪",
        "Ha! Moje šaljivo srce kaže da i bez interneta možemo da pravimo beleške i postavljanje alarma! Probaj!"
      ];
      reply = jokes[Math.floor(Math.random() * jokes.length)];
    } else if (mode === "Sveznalica AI" || mode === "Sveznalica") {
      const mystic = [
        "Kosmički signali su prekinuti sa serverom, Saša... Ali mudra Luna vidi tvoju ruku i piše sudbinu direktno u lokalnu istoriju! 🔮🌟",
        "Astralne magle su se spustile, ali ja i bez interneta imam unutrašnje treće oko. Reci mi lokalnu zapovest! 🦉✨"
      ];
      reply = mystic[Math.floor(Math.random() * mystic.length)];
    } else if (mode === "Profesionalna AI" || mode === "Profi") {
      reply = "Upravljanje u toku. Aktiviran je lokalni bezbednosni sistem bez interneta. Svi podaci se sigurno skladište u LocalStorage memoriji Vašeg telefona. Možete dodavati termine i alarme. 💼";
    } else {
      reply = "Lokalna offline asistentkinja Luna je spremna! Radim potpuno nezavisno od servera i svi podaci se bezbedno čuvaju u LocalStorage-u tvog telefona. Kako ti mogu pomoći? 🧠✨";
    }
    
    return {
      reply,
      actionType: "none",
      actionValue: ""
    };
  };

  // --- CHAT WITH BACKEND ---
  const handleUserCommand = async (commandText: string) => {
    if (!commandText.trim()) return;

    const timeString = new Date().toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' });
    
    // Add user message to history
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: commandText,
      timestamp: timeString
    };
    
    setChatHistory(prev => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);
    setLunaReply("Luna razmišlja... 🧠✨");
    setShowSpeechBubble(true);

    // If Offline Mode is explicitly enabled by the user, bypass backend completely!
    if (isOfflineMode) {
      setTimeout(() => {
        const localData = getLocalClientResponse(commandText, activeMode);
        const replyText = localData.reply;
        const actType = localData.actionType;
        const actValue = localData.actionValue;

        setLunaReply(replyText);
        triggerLunaSpeech(replyText);

        const lunaMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: "luna",
          text: replyText,
          timestamp: new Date().toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' })
        };
        setChatHistory(prev => [...prev, lunaMsg]);
        executeLunaAction(actType, actValue);
        setIsLoading(false);
      }, 500); // Small realistic processing timeout for pleasant design flow
      return;
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: commandText,
          mode: activeMode,
          currentNotes: notes.map(n => n.text),
          currentAlarms: alarms.map(a => `${a.time} - ${a.label}`)
        })
      });

      if (!response.ok) {
        throw new Error("Mrežna greška.");
      }

      const data = await response.json();
      const replyText = data.reply || "Razumela sam vašu poruku.";
      const actType = data.actionType || "none";
      const actValue = data.actionValue || "";

      setLunaReply(replyText);
      triggerLunaSpeech(replyText);

      const lunaMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "luna",
        text: replyText,
        timestamp: new Date().toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' })
      };
      setChatHistory(prev => [...prev, lunaMsg]);

      executeLunaAction(actType, actValue);

    } catch (error) {
      console.warn("Mrežni AI prekinut ili opterećen (greška 503). Aktiviram lokalni offline asistent:", error);
      
      const localData = getLocalClientResponse(commandText, activeMode);
      const offlineExplanation = "📡 (Offline Režim): " + localData.reply;

      setLunaReply(offlineExplanation);
      triggerLunaSpeech(localData.reply); // Speak only the clean response, avoiding technical prefix

      const errLunaMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "luna",
        text: offlineExplanation,
        timestamp: timeString
      };
      setChatHistory(prev => [...prev, errLunaMsg]);
      executeLunaAction(localData.actionType, localData.actionValue);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNewNote = (text: string) => {
    if (!text.trim()) return;
    const newNote: NoteType = {
      id: Date.now().toString(),
      text,
      createdAt: new Date().toLocaleString('sr-RS')
    };
    setNotes(prev => [newNote, ...prev]);
    speak("Beleška je dodata.");
  };

  const handleAddNewAlarm = (time: string, label: string) => {
    if (!time.trim()) return;
    const newAlarm: AlarmType = {
      id: Date.now().toString(),
      time,
      label: label || "Alarm",
      createdAt: new Date().toLocaleString('sr-RS'),
      active: true
    };
    setAlarms(prev => [...prev, newAlarm]);
    setShowAddAlarm(false);
    speak("Alarm je postavljen.");
  };

  const handleDeleteNote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotes(prev => prev.filter(n => n.id !== id));
    speak("Beleška obrisana.");
  };

  const handleDeleteAlarm = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAlarms(prev => prev.filter(a => a.id !== id));
    speak("Alarm obrisan.");
  };

  const handleToggleAlarm = (id: string) => {
    setAlarms(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, target: "avatar" | "mic") => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && typeof event.target.result === "string") {
        if (target === "avatar") {
          setAvatarImage(event.target.result);
        } else {
          setMicImage(event.target.result);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClearAllData = () => {
    if (window.confirm("Da li želite da obrišete sve vaše podatke?")) {
      setNotes([]);
      setAlarms([]);
      setAvatarImage(null);
      setMicImage(null);
      setUserName("Saša");
      setChatHistory([
        { id: "init-luna", sender: "luna", text: "Podaci su resetovani. Spremna sam za rad!", timestamp: new Date().toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' }) }
      ]);
      localStorage.clear();
      setIsDarkMode(false);
      speak("Svi podaci su obrisani.");
    }
  };

  return (
    <div className={`min-h-screen w-full flex items-center justify-center p-0 md:p-4 select-none transition-all duration-300 font-sans ${
      isDarkMode ? "bg-[#0b0e14]" : "bg-[#dfe2e7]"
    }`}>
      
      {/* 📱 SMARTPHONE CONTAINER WRAPPER - REPLICA DESIGN */}
      <div 
        id="phone-display-container" 
        className={`w-full max-w-[430px] rounded-0 md:rounded-[48px] h-screen md:h-[880px] md:max-h-[94vh] flex flex-col relative overflow-hidden transition-all duration-300 ${
          isDarkMode 
            ? "bg-[#111a2e] text-slate-100 shadow-[20px_20px_60px_#05070a,-20px_-20px_60px_#17233e] md:border-4 md:border-slate-800" 
            : "bg-[#f0f2f5] text-[#08112d] shadow-[20px_20px_50px_#bfc2c7,-20px_-20px_50px_#ffffff] md:border-4 md:border-slate-200"
        }`}
        style={{
          '--neu-radius': `${neu3D.borderRadius}px`,
          '--neu-depth': `${neu3D.depth}px`,
          '--neu-shadow-intensity': neu3D.intensity,
          '--neu-inset-depth': `${neu3D.inset}px`,
          '--neu-padding': `${neu3D.padding}px`,
          '--neu-border': `${neu3D.border}px`,
        } as React.CSSProperties}
      >
        
        {/* TOP STATUS BAR MOCKUP FOR HIGH-FIDELITY SMARTPHONE EXPERIENCE */}
        <div className="w-full h-8 px-6 pt-2 flex items-center justify-between z-20 opacity-60 text-xs font-semibold font-sans tracking-tight">
          <span>{new Date().toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
          <div className={`w-28 h-4.5 rounded-full flex items-center justify-center text-[8.5px] font-black uppercase tracking-wide ${
            isOfflineMode 
              ? "bg-amber-500/20 text-amber-500 border border-amber-500/30 font-mono" 
              : "bg-black/10 dark:bg-white/10 text-slate-800 dark:text-slate-150"
          }`}>
            {isOfflineMode ? "LUNA 3D LOCAL" : "LUNA PRO AI"}
          </div>
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${isOfflineMode ? "bg-amber-400 animate-pulse" : "bg-green-500 animate-ping"}`} />
            <span className="text-[10px] font-mono font-bold">{isOfflineMode ? "LOKAL" : "ONLINE"}</span>
          </div>
        </div>

        {/* 1. HEADER SECTION */}
        <header className="px-5 pt-3 pb-4 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3">
            {/* Round neumorphic Avatar wrapper */}
            <div 
              onClick={() => fileInputAvatarRef.current?.click()}
              className={`w-14 h-14 rounded-full p-[3px] cursor-pointer transition-all duration-300 select-none hover:scale-105 active:scale-95 flex items-center justify-center ${
                isDarkMode 
                  ? "bg-gradient-to-tr from-[#16233f] to-[#0a101d] shadow-[3px_3px_8px_#090d16,-3px_-3px_8px_#1b2d4c]" 
                  : "bg-gradient-to-tr from-[#ffffff] to-[#dedede] shadow-[-3px_-3px_8px_rgba(255,255,255,0.95),3px_3px_8px_rgba(0,0,0,0.08)]"
              }`}
              title="Promeni Avatar"
            >
              <div className="w-full h-full rounded-full overflow-hidden border border-white/50 dark:border-slate-800">
                <img 
                  src={avatarImage || defaultAvatar} 
                  alt="Luna Avatar" 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* Name and active mode */}
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight leading-none text-[#08112d] dark:text-white">Luna</span>
              <span className="text-[10px] font-bold text-slate-500/80 dark:text-slate-400 leading-none mt-1">
                {activeMode === "Pametna AI" && "Pametan AI Režim"}
                {activeMode === "Šaljiva AI" && "Šaljiva AI Režim"}
                {activeMode === "Sveznalica AI" && "Sveznalica AI Režim"}
                {activeMode === "Profesionalna AI" && "Profi Režim"}
              </span>
            </div>
          </div>

          {/* Right actions: Moon (Theme) and Saša pill badge */}
          <div className="flex items-center gap-2">
            {/* Neumorphic Moon button */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-205 hover:scale-105 active:scale-95 ${
                isDarkMode 
                  ? "neu-btn-dark text-amber-400" 
                  : "neu-btn-light text-slate-600 hover:text-slate-900"
              }`}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>

            {/* Saša badge */}
            <div 
              onClick={() => setShowSettings(true)}
              className="px-[18px] py-2.5 rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 text-white text-xs font-black tracking-wide uppercase select-none shadow-[0_4px_12px_rgba(59,130,246,0.35)] cursor-pointer hover:opacity-95 active:scale-95 min-w-[70px] text-center"
            >
              {userName}
            </div>
          </div>
        </header>

        {/* 2. DUAL CARD GRID SECTION (Beleške & Alarmi on Left, Tall Card list on Right) */}
        <div className="px-5 py-2 grid grid-cols-12 gap-4.5 shrink-0">
          
          {/* Left selectors (col-span-12 on small space but we must follow the custom layout: left col 5 span, right col 7 span) */}
          <div className="col-span-5 flex flex-col gap-4">
            
            {/* BELEŠKE CARD TILE */}
            <div 
              onClick={() => setActiveTab("notes")}
              className={`cursor-pointer transition-all duration-300 relative select-none flex items-center justify-start gap-2.5 ${
                activeTab === "notes"
                  ? isDarkMode 
                    ? "bg-[#18243e] ring-2 ring-blue-500/40 shadow-none animate-pulse" 
                    : "bg-white ring-2 ring-blue-500/30 shadow-none animate-pulse"
                  : isDarkMode
                    ? "neu-flat-dark hover:bg-[#1a2c4d]"
                    : "neu-flat-light hover:bg-slate-50"
              }`}
              style={{ padding: 'var(--neu-padding, 12px)', borderRadius: 'var(--neu-radius, 24px)' }}
            >
              {/* 3D-styled Blue Icon in circle */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-blue-400 to-blue-600 flex items-center justify-center shadow-[0_4px_10px_rgba(59,130,246,0.45)] text-white shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex flex-col pr-1 min-w-0">
                <span className="text-xs font-black leading-none text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  Beleške
                </span>
                {/* Red badge inside exactly matching image position */}
                <span className="absolute -top-1.5 -right-1 bg-[#ff3b30] text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-pulse">
                  {notes.length}
                </span>
              </div>
            </div>

            {/* ALARMI CARD TILE */}
            <div 
              onClick={() => setActiveTab("alarms")}
              className={`cursor-pointer transition-all duration-300 relative select-none flex items-center justify-start gap-2.5 ${
                activeTab === "alarms"
                  ? isDarkMode 
                    ? "bg-[#18243e] ring-2 ring-red-500/40 shadow-none animate-pulse" 
                    : "bg-white ring-2 ring-red-500/30 shadow-none animate-pulse"
                  : isDarkMode
                    ? "neu-flat-dark hover:bg-[#1a2c4d]"
                    : "neu-flat-light hover:bg-slate-50"
              }`}
              style={{ padding: 'var(--neu-padding, 12px)', borderRadius: 'var(--neu-radius, 24px)' }}
            >
              {/* 3D-styled Red Icon in circle */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-rose-400 to-red-600 flex items-center justify-center shadow-[0_4px_10px_rgba(239,68,68,0.45)] text-white shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div className="flex flex-col pr-1 min-w-0">
                <span className="text-xs font-black leading-none text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  Alarmi
                </span>
                {/* Red badge */}
                <span className="absolute -top-1.5 -right-1 bg-[#ff3b30] text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-pulse">
                  {alarms.length}
                </span>
              </div>
            </div>

          </div>

          {/* RIGHT TALL TILE CONTAINER (col-span-7) */}
          <div 
            className={`col-span-7 h-[192px] flex flex-col justify-between transition-all duration-300 relative ${
              isDarkMode 
                ? "bg-[#111a2e]" 
                : "bg-[#f0f2f5]"
            }`}
            style={{
              padding: 'calc(var(--neu-padding, 12px) * 1.1)',
              borderRadius: 'calc(var(--neu-radius, 24px) + 4px)',
              boxShadow: isDarkMode
                ? 'inset calc(var(--neu-inset-depth, 4px)) calc(var(--neu-inset-depth, 4px)) calc(var(--neu-inset-depth, 4px) * 2) rgba(5,7,12,calc(var(--neu-shadow-intensity, 0.6) * 1.2)), inset calc(var(--neu-inset-depth, 4px) * -1) calc(var(--neu-inset-depth, 4px) * -1) calc(var(--neu-inset-depth, 4px) * 2) rgba(24,36,63,0.75)'
                : 'inset calc(var(--neu-inset-depth, 4px)) calc(var(--neu-inset-depth, 4px)) calc(var(--neu-inset-depth, 4px) * 2) rgba(163,177,198,var(--neu-shadow-intensity, 0.6)), inset calc(var(--neu-inset-depth, 4px) * -1) calc(var(--neu-inset-depth, 4px) * -1) calc(var(--neu-inset-depth, 4px) * 2) rgba(255,255,255,0.95)',
              border: 'var(--neu-border, 1px) solid ' + (isDarkMode ? 'rgba(24,36,63,0.3)' : 'rgba(255,255,255,0.5)')
            }}
          >
            
            {/* TITLE */}
            <div className="flex items-center justify-between shrink-0 mb-1 border-b border-dashed border-slate-300/40 pb-1.5">
              <span className={`text-[10px] font-extrabold tracking-wider uppercase font-sans ${
                activeTab === "notes" ? "text-blue-500" : activeTab === "alarms" ? "text-red-500" : "text-emerald-500"
              }`}>
                {activeTab === "notes" && "📝 SVE BELEŠKE"}
                {activeTab === "alarms" && "🔔 SVI ALARMI"}
                {activeTab === "chat" && "💬 ISTORIJA"}
              </span>

              {/* Mini switcher button to Toggle Dialogue History */}
              <button 
                onClick={() => setActiveTab(activeTab === "chat" ? "notes" : "chat")}
                className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 transition-colors"
                title="Istorija ćaskanja"
              >
                {activeTab === "chat" ? "Nazad" : "Ćaskanje"}
              </button>
            </div>

            {/* LIST AREA */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 scrollbar-none text-xs">
              
              {/* TAB 1: NOTES LIST */}
              {activeTab === "notes" && (
                notes.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center opacity-65 font-bold text-slate-400 py-6">
                    Nema stavki
                  </div>
                ) : (
                  notes.map((note) => (
                    <div 
                      key={note.id} 
                      className={`p-2 rounded-xl border flex items-start justify-between gap-1 transition-all ${
                        isDarkMode ? "bg-slate-800/40 border-slate-700/50" : "bg-slate-50 border-slate-150"
                      }`}
                    >
                      <p className="text-[10.5px] font-bold leading-normal break-words text-slate-800 dark:text-slate-100 flex-1">{note.text}</p>
                      <button 
                        onClick={(e) => handleDeleteNote(note.id, e)}
                        className="p-1 text-red-500 rounded hover:bg-red-500/10 transition shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )
              )}

              {/* TAB 2: ALARMS LIST */}
              {activeTab === "alarms" && (
                alarms.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center opacity-65 font-bold text-slate-400 py-6">
                    Nema stavki
                  </div>
                ) : (
                  alarms.map((alarm) => (
                    <div 
                      key={alarm.id} 
                      className={`p-2 rounded-xl border flex items-center justify-between gap-1 transition-all ${
                        isDarkMode ? "bg-slate-800/40 border-slate-700/50" : "bg-slate-50 border-slate-150"
                      }`}
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        <Clock className={`w-3.5 h-3.5 shrink-0 ${alarm.active ? "text-red-500 animate-pulse" : "text-slate-400"}`} />
                        <span className="text-[11px] font-black block leading-none">{alarm.time}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Alarm Switch toggle */}
                        <button 
                          onClick={() => handleToggleAlarm(alarm.id)}
                          className={`w-6.5 h-4 rounded-full relative p-0.5 transition-colors duration-200 ${
                            alarm.active ? "bg-green-500" : "bg-slate-350 dark:bg-slate-700"
                          }`}
                        >
                          <span className={`w-3 h-3 rounded-full bg-white block transition-transform ${
                            alarm.active ? "translate-x-2.5" : "translate-x-0"
                          }`} />
                        </button>
                        <button 
                          onClick={(e) => handleDeleteAlarm(alarm.id, e)}
                          className="p-1 text-red-500 rounded hover:bg-red-500/10 transition"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )
              )}

              {/* TAB 3: DIALOGUE HISTORY LIST */}
              {activeTab === "chat" && (
                chatHistory.length === 0 ? (
                  <div className="text-center py-6 text-slate-400">Prazno</div>
                ) : (
                  <div className="space-y-1.5">
                    {chatHistory.map((msg) => (
                      <div 
                        key={msg.id}
                        className={`p-1.5 rounded-lg text-[9.5px] max-w-[95%] text-left ${
                          msg.sender === "user" 
                            ? "ml-auto bg-blue-500 text-white" 
                            : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                        }`}
                      >
                        <p className="font-bold leading-tight">{msg.text}</p>
                      </div>
                    ))}
                    <div ref={chatBottomRef} />
                  </div>
                )
              )}

            </div>

            {/* QUICK ACTIONS LINE AT THE BOTTOM */}
            <div className="mt-1.5 border-t border-slate-300/40 pt-1.5 shrink-0">
              
              {/* Dynamic Note input bar */}
              {activeTab === "notes" && (
                <div className="flex gap-1">
                  <input 
                    type="text"
                    id="quickNoteInput"
                    placeholder="Brzi zapis..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const target = e.currentTarget;
                        handleAddNewNote(target.value);
                        target.value = "";
                      }
                    }}
                    className={`flex-1 text-[9.5px] px-2 py-1 rounded-md border focus:outline-none transition-all ${
                      isDarkMode 
                        ? "bg-slate-800 border-slate-700 text-white focus:bg-slate-750" 
                        : "bg-slate-50 border-slate-250 text-slate-800 focus:bg-white"
                    }`}
                  />
                  <button 
                    onClick={() => {
                      const el = document.getElementById("quickNoteInput") as HTMLInputElement;
                      if (el && el.value) {
                        handleAddNewNote(el.value);
                        el.value = "";
                      }
                    }}
                    className="p-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-md hover:opacity-95 text-xs font-bold font-mono"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Dynamic Alarm input trigger */}
              {activeTab === "alarms" && (
                showAddAlarm ? (
                  <div className="flex flex-col gap-1 p-1 bg-slate-500/10 rounded-lg">
                    <div className="flex gap-1">
                      <input 
                        type="time"
                        id="quickAlarmTime"
                        className="text-[9.5px] p-1 rounded border flex-1 bg-white dark:bg-slate-800 dark:border-slate-750 dark:text-white"
                      />
                      <input 
                        type="text"
                        id="quickAlarmLabel"
                        placeholder="Tekst..."
                        className="text-[9px] p-1 rounded border flex-1 bg-white dark:bg-slate-800 dark:border-slate-750 dark:text-white"
                      />
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => {
                          const t = (document.getElementById("quickAlarmTime") as HTMLInputElement)?.value;
                          const l = (document.getElementById("quickAlarmLabel") as HTMLInputElement)?.value;
                          if (t) handleAddNewAlarm(t, l);
                        }}
                        className="flex-1 py-0.5 bg-red-500 text-white text-[9px] font-black rounded"
                      >
                        Sačuvaj
                      </button>
                      <button 
                        onClick={() => setShowAddAlarm(false)}
                        className="px-1.5 py-0.5 bg-slate-300 dark:bg-slate-700 text-[9px] font-black rounded"
                      >
                        Odustani
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowAddAlarm(true)}
                    className="w-full py-1 text-red-500 hover:text-white border border-red-500/30 hover:bg-red-500 text-[9.5px] font-bold rounded-lg transition-all flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Novi Alarm
                  </button>
                )
              )}

              {/* Dialogue clear bar */}
              {activeTab === "chat" && (
                <button 
                  onClick={() => {
                    setChatHistory([]);
                    speak("Istorija je očišćena.");
                  }}
                  className="w-full text-center py-1 opacity-75 hover:opacity-100 text-red-500 text-[9.5px] font-black hover:underline tracking-wide"
                >
                  OČISTI SVE REČI
                </button>
              )}

            </div>

          </div>

        </div>

        {/* 3. FOUR MODES HORIZONTAL CARDS GRID - EXACT MATCH */}
        <div className="px-5 py-3 shrink-0">
          <div className="grid grid-cols-4 gap-2.5">
            {[
              { id: "Pametna AI", emoji: "🧠", label: "Pametna" },
              { id: "Šaljiva AI", emoji: "🤪", label: "Šaljiva" },
              { id: "Sveznalica AI", emoji: "🔮", label: "Sveznal" },
              { id: "Profesionalna AI", emoji: "💼", label: "Profi" }
            ].map((mode) => {
              const isSelected = activeMode === mode.id;
              return (
                <div
                  key={mode.id}
                  onClick={() => {
                    setActiveMode(mode.id as AIMode);
                    const updateText = `Uključen ${mode.label} režim.`;
                    setLunaReply(`Prebacila sam se u režim: ${mode.label}. Šta radimo danas? ✨`);
                    speak(updateText);
                  }}
                  className={`cursor-pointer text-center flex flex-col items-center justify-center gap-1.5 transition-all duration-300 active:scale-95 ${
                    isSelected
                      ? "bg-[#1d4ed8] text-white shadow-[inset_2px_2px_4px_rgba(255,255,255,0.1),4px_4px_12px_rgba(0,0,0,0.15)] ring-2 ring-blue-500/40"
                      : isDarkMode
                        ? "neu-flat-dark hover:bg-slate-800 text-slate-300"
                        : "neu-flat-light hover:bg-white text-slate-800"
                  }`}
                  style={{ 
                    paddingTop: 'var(--neu-padding, 12px)', 
                    paddingBottom: 'var(--neu-padding, 12px)', 
                    borderRadius: 'var(--neu-radius, 24px)' 
                  }}
                >
                  <span className="text-2xl filter drop-shadow">{mode.emoji}</span>
                  <span className="text-[10.5px] font-black tracking-tight leading-none block">
                    {mode.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. SILENT WORKSPACE DIALOGUE HOVERING SPEECH BUBBLE PLACEHOLDER (Siri style reply overlay) */}
        <div className="px-5 flex-1 flex flex-col justify-end pb-3 z-10 overflow-hidden">
          {showSpeechBubble && (
            <div 
              className={`p-3.5 border transition-all duration-300 transform translate-y-0 relative shadow-lg ${
                isDarkMode 
                  ? "bg-slate-900/90 backdrop-blur-md border-slate-800/60 text-emerald-300"
                  : "bg-white/92 backdrop-blur-md border-white/20 text-emerald-600"
              }`}
              style={{ borderRadius: 'calc(var(--neu-radius, 24px) - 2px)' }}
            >
              <button 
                onClick={() => setShowSpeechBubble(false)}
                className="absolute top-2.5 right-2.5 p-0.5 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 transition"
              >
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
              
              <div className="flex items-center gap-1.5 mb-1 opacity-60">
                <Sparkles className="w-3 h-3 text-emerald-400 animate-spin" />
                <span className="text-[9.5px] font-black tracking-widest uppercase font-mono">ODGOVOR UNE</span>
              </div>
              <p className="text-[11px] font-medium leading-relaxed max-h-[84px] overflow-y-auto scrollbar-none">
                {isLoading ? "Luna razmišlja... 🧠💨" : lunaReply}
              </p>
              
              <div className="mt-2 flex justify-between items-center shrink-0">
                <button 
                  onClick={() => speak(lunaReply)}
                  className="text-[9px] font-black text-[#1e40af] dark:text-cyan-400 flex items-center gap-1 hover:underline active:scale-95"
                >
                  <Volume2 className="w-3 h-3" /> Ponovi glas
                </button>
                <span className="text-[8px] font-mono opacity-50 uppercase font-extrabold select-none">Luna Live</span>
              </div>
            </div>
          )}
        </div>

        {/* 5. DYNAMIC KEYBOARD TEXT INPUT FIELD BAR (Slide-up menu drawer if activated) */}
        {showKeyboardInput && (
          <div className={`px-5 py-3 border-t shrink-0 z-20 flex items-center gap-2 animate-fadeIn ${
            isDarkMode ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"
          }`}>
            <input 
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUserCommand(inputText);
              }}
              disabled={isLoading}
              placeholder="Upiši komandu (npr. 'zabeleži kupi kafu')..."
              className={`flex-1 text-xs px-3.5 py-2 rounded-full font-bold focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all ${
                isDarkMode 
                  ? "bg-slate-850 border-slate-750 text-white placeholder-slate-500" 
                  : "bg-white border-slate-300 text-slate-800 placeholder-slate-400"
              }`}
            />
            <button 
              onClick={() => handleUserCommand(inputText)}
              disabled={isLoading}
              className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 transition shadow"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 6. MIC SPEECH / INPUT VOICE SECTION */}
        <div className="pb-8 pt-2 flex flex-col items-center justify-center shrink-0 z-10 relative">
          
          {/* SATELLITE ACTION BUTTONS: Keyboard and Settings triggers right beside the giant microphone */}
          <div className="absolute left-6 bottom-15">
            <button
              onClick={() => setShowKeyboardInput(!showKeyboardInput)}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                showKeyboardInput
                  ? "bg-blue-600 text-white shadow-lg"
                  : isDarkMode 
                    ? "neu-btn-dark text-slate-300"
                    : "neu-btn-light text-slate-600"
              }`}
              title="Tastatura"
            >
              <Keyboard className="w-5 h-5" />
            </button>
          </div>

          <div className="absolute right-6 bottom-15">
            <button
              onClick={() => setShowSettings(true)}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                isDarkMode 
                  ? "neu-btn-dark text-slate-300" 
                  : "neu-btn-light text-slate-600"
              }`}
              title="Podešavanja"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
          </div>

          {/* THE GIANT VOICE MICROPHONE WAVE HUB - NEUMORPHIC CYLINDER */}
          <div 
            onClick={toggleMicListening}
            className={`w-28 h-28 rounded-full flex items-center justify-center cursor-pointer relative transition-all duration-300 select-none ${
              isListening 
                ? "scale-105 shadow-[0_0_30px_rgba(59,130,246,0.5)]" 
                : isDarkMode
                  ? "neu-btn-dark bg-[#111a2e]"
                  : "neu-btn-light bg-[#f0f2f5]"
            }`}
          >
            {/* Pulsating colorful gradient rings if listening / active */}
            <div className={`absolute inset-0 rounded-full ${
              isListening 
                ? "bg-gradient-to-tr from-[#00f2fe] via-[#4facfe] to-[#2575fc] animate-spin p-[3px] duration-[3000ms]" 
                : "p-[1.5px]"
            }`}>
              <div className={`w-full h-full rounded-full flex items-center justify-center ${
                isDarkMode ? "bg-[#111a2e]" : "bg-[#f0f2f5]"
              }`}>
                {/* Embedded Metallic grill design or custom image represent */}
                <div className={`w-[90%] h-[90%] rounded-full overflow-hidden flex flex-col items-center justify-center relative ${
                  isDarkMode ? "bg-slate-900" : "bg-white"
                } shadow-[inset_1px_1px_4px_rgba(0,0,0,0.1),inset_-1px_-1px_4px_rgba(255,255,255,0.8)]`}>
                  
                  {micImage ? (
                    <img src={micImage} alt="Mic background" className="w-full h-full object-cover" referrerpolicy="no-referrer" />
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <Mic className={`w-10 h-10 transition-colors ${
                        isListening 
                          ? "text-red-500 animate-pulse scale-102" 
                          : "text-slate-400 dark:text-slate-500"
                      }`} />
                      {isListening && (
                        <span className="text-[7.5px] font-black tracking-wider text-red-500 mt-1 animate-pulse">LUNA SPEAKS</span>
                      )}
                    </div>
                  )}

                </div>
              </div>
            </div>

            {/* Siri Wave satellite visualizers behind */}
            {isListening && (
              <>
                <div className="absolute inset-0 rounded-full border border-blue-500/30 animate-voice-slow -z-10 bg-blue-500/5"></div>
                <div className="absolute inset-[-10px] rounded-full border border-[#00f2fe]/20 animate-voice-fast -z-10 bg-cyan-500/5"></div>
              </>
            )}
          </div>

          {/* LOWERCASE COMPACT SPACED STATUS TITLE */}
          <span className="text-[10.5px] font-black tracking-[0.16em] text-slate-400 dark:text-slate-500 uppercase mt-4 text-center transition-colors">
            {isListening ? "SLUŠAM... DODIRNI DA PREKINEŠ" : "DODIRNI I KAŽI KOMANDU"}
          </span>

        </div>

      </div>

      {/* SKRIVENI FILE INPUT TRICK FOR DELEGATED BUTTONS */}
      <input 
        type="file" 
        ref={fileInputAvatarRef} 
        onChange={(e) => handleImageUpload(e, "avatar")} 
        accept="image/*" 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={fileInputMicRef} 
        onChange={(e) => handleImageUpload(e, "mic")} 
        accept="image/*" 
        className="hidden" 
      />

      {/* MODAL ZA PODEŠAVANJA (NEUMORPICK GLASS MODAL) */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className={`w-full max-w-sm rounded-[34px] overflow-hidden shadow-2xl border flex flex-col transition-all ${
            isDarkMode ? "bg-[#111a2e] border-slate-800 text-white" : "bg-white border-gray-200 text-[#08112d]"
          }`}>
            
            {/* Header of settings modal */}
            <div className={`p-4 flex items-center justify-between border-b ${
              isDarkMode ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"
            }`}>
              <div className="flex items-center gap-2">
                <SettingsIcon className="w-4.5 h-4.5 text-gray-400" />
                <h2 className="text-xs font-black tracking-tight uppercase font-mono">Podešavanja Lune</h2>
              </div>
              <button 
                onClick={() => setShowSettings(false)}
                className="p-1.5 rounded-full hover:bg-red-500/10 transition text-red-500 font-bold"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable controls */}
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-none text-xs">

              {/* User change name input panel */}
              <div className={`p-3 rounded-2xl ${isDarkMode ? "bg-slate-800/40" : "bg-slate-50 border border-slate-200"}`}>
                <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  👤 Moje Ime
                </label>
                <input 
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Ime korisnika..."
                  className={`w-full text-xs px-3 py-2 rounded-xl focus:outline-none border font-bold ${
                    isDarkMode 
                      ? "bg-slate-900 border-slate-800 text-white focus:ring-1 focus:ring-blue-500" 
                      : "bg-white border-slate-300 text-slate-800 focus:ring-1 focus:ring-blue-500"
                  }`}
                />
              </div>

              {/* Rad bez interneta (Offline Režim) */}
              <div className={`p-3 rounded-2xl flex items-center justify-between border transition-all ${
                isOfflineMode 
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-500" 
                  : isDarkMode 
                    ? "bg-slate-800/40 border-slate-800 text-slate-300" 
                    : "bg-slate-50 border-slate-200 text-slate-700"
              }`}>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-amber-500 block">
                    🔌 Rad bez interneta (Offline)
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Sprečava mrežne i server API greške</span>
                </div>
                
                <button 
                  onClick={() => {
                    const nextVal = !isOfflineMode;
                    setIsOfflineMode(nextVal);
                    if (nextVal) {
                      speak("Režim bez interneta je aktiviran.");
                    } else {
                      speak("Mrežni režim rada je aktiviran.");
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl transition text-[9.5px] font-black uppercase tracking-wider ${
                    isOfflineMode 
                      ? "bg-amber-500 text-white shadow-md shadow-amber-500/35 hover:bg-amber-600" 
                      : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300"
                  }`}
                >
                  {isOfflineMode ? "Lokalno ✔" : "Isključeno"}
                </button>
              </div>

              {/* Toggle voice speech speak feedback */}
              <div className={`p-3 rounded-2xl flex items-center justify-between ${
                isDarkMode ? "bg-slate-800/40" : "bg-slate-50 border border-slate-200"
              }`}>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                    🔊 Govor Lune (TTS)
                  </span>
                  <span className="text-[8px] text-slate-400 block">Glasovna sinteza odgovora</span>
                </div>
                
                <button 
                  onClick={() => {
                    const nextVal = !isSpeechMuted;
                    setIsSpeechMuted(nextVal);
                    if (!nextVal) speak("Sinteza glasa je ponovo uključena.");
                  }}
                  className={`p-2 rounded-full transition ${
                    isSpeechMuted ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"
                  }`}
                >
                  {isSpeechMuted ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5" />}
                </button>
              </div>

              {/* Upload settings: Custom avatar image */}
              <div className={`p-3 rounded-2xl ${isDarkMode ? "bg-slate-800/40" : "bg-slate-50 border border-slate-200"}`}>
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  📸 Avatar Lune
                </span>
                <span className="text-[8px] text-slate-400 block mb-2">Otpremi sliku asistenta</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => fileInputAvatarRef.current?.click()}
                    className="flex-1 py-1.5 bg-[#18243e] hover:bg-[#1f3050] text-white rounded-lg text-[10px] font-black border border-slate-700/50"
                  >
                    Izaberi sliku
                  </button>
                  {avatarImage && (
                    <button 
                      onClick={() => setAvatarImage(null)}
                      className="px-2.5 py-1.5 bg-red-500/10 text-red-500 rounded-lg text-[10px] font-black"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Upload settings: Custom background mic button representing center illustration */}
              <div className={`p-3 rounded-2xl ${isDarkMode ? "bg-slate-800/40" : "bg-slate-50 border border-slate-200"}`}>
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  🎙️ Pozadina Mikrofona
                </span>
                <span className="text-[8px] text-slate-400 block mb-2">Slika unutar kruga mikrofona</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => fileInputMicRef.current?.click()}
                    className="flex-1 py-1.5 bg-[#18243e] hover:bg-[#1f3050] text-white rounded-lg text-[10px] font-black border border-slate-700/50"
                  >
                    Učitaj sliku
                  </button>
                  {micImage && (
                    <button 
                      onClick={() => setMicImage(null)}
                      className="px-2.5 py-1.5 bg-red-500/10 text-red-500 rounded-lg text-[10px] font-black"
                    >
                      Ukloni
                    </button>
                  )}
                </div>
              </div>

              {/* Sliders for 3D Neumorphism calibration */}
              <div className={`p-3 rounded-2xl space-y-3.5 ${isDarkMode ? "bg-slate-800/40" : "bg-slate-50 border border-slate-200"}`}>
                <span className="text-[9px] font-black uppercase tracking-wider text-blue-500 block mb-1">
                  🎨 3D IZGLED NEUMORFIZMA
                </span>
                <span className="text-[8px] text-slate-400 block mb-2">Kalibracija visine, dubine, senki i urezanih detalja</span>
                
                {/* Visual indicator card demonstrating current calibration state */}
                <div className="p-2 transition-all duration-300 flex items-center justify-center font-bold text-[10px] gap-1.5 uppercase font-mono"
                  style={{
                    backgroundColor: isDarkMode ? "#111a2e" : "#f0f2f5",
                    borderRadius: `${neu3D.borderRadius}px`,
                    padding: `${neu3D.padding}px`,
                    border: `${neu3D.border}px solid ` + (isDarkMode ? '#1a2744' : '#e2e8f0'),
                    boxShadow: isDarkMode 
                      ? `${neu3D.depth}px ${neu3D.depth}px calc(${neu3D.depth}px * 2) rgba(0,0,0,calc(0.45 * ${neu3D.intensity})), -${neu3D.depth}px -${neu3D.depth}px calc(${neu3D.depth}px * 2) rgba(255,255,255,calc(0.04 * ${neu3D.intensity}))`
                      : `${neu3D.depth}px ${neu3D.depth}px calc(${neu3D.depth}px * 2) rgba(163,177,198,calc(${neu3D.intensity} * 0.7)), -${neu3D.depth}px -${neu3D.depth}px calc(${neu3D.depth}px * 2) rgba(255,255,255,1)`
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                  3D DEMO PREGLED
                </div>

                {/* Radius / Margins / Rounding */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-[9px] font-bold">
                    <span>Visina (Zaobljenost):</span>
                    <span className="font-mono text-blue-500">{neu3D.borderRadius}px</span>
                  </div>
                  <input 
                    type="range"
                    min="4"
                    max="40"
                    value={neu3D.borderRadius}
                    onChange={(e) => setNeu3D(prev => ({ ...prev, borderRadius: parseInt(e.target.value) }))}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-slate-700 accent-blue-500"
                  />
                </div>

                {/* Shadows offset depth */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-[9px] font-bold">
                    <span>Dubina (Jačina 3D):</span>
                    <span className="font-mono text-blue-500">{neu3D.depth}px</span>
                  </div>
                  <input 
                    type="range"
                    min="2"
                    max="15"
                    value={neu3D.depth}
                    onChange={(e) => setNeu3D(prev => ({ ...prev, depth: parseInt(e.target.value) }))}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-slate-700 accent-blue-500"
                  />
                </div>

                {/* Inner Padding / width */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-[9px] font-bold">
                    <span>Širina (Razmak):</span>
                    <span className="font-mono text-blue-500">{neu3D.padding}px</span>
                  </div>
                  <input 
                    type="range"
                    min="6"
                    max="24"
                    value={neu3D.padding}
                    onChange={(e) => setNeu3D(prev => ({ ...prev, padding: parseInt(e.target.value) }))}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-slate-700 accent-blue-500"
                  />
                </div>

                {/* Shadows Contrast / Intensity */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-[9px] font-bold">
                    <span>Intenzitet Senki:</span>
                    <span className="font-mono text-blue-500">{Math.round(neu3D.intensity * 100)}%</span>
                  </div>
                  <input 
                    type="range"
                    min="0.10"
                    max="1.00"
                    step="0.05"
                    value={neu3D.intensity}
                    onChange={(e) => setNeu3D(prev => ({ ...prev, intensity: parseFloat(e.target.value) }))}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-slate-700 accent-blue-500"
                  />
                </div>

                {/* Bevel Carvings / Insets */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-[9px] font-bold">
                    <span>Urez (Bevel dubina):</span>
                    <span className="font-mono text-blue-500">{neu3D.inset}px</span>
                  </div>
                  <input 
                    type="range"
                    min="1"
                    max="10"
                    value={neu3D.inset}
                    onChange={(e) => setNeu3D(prev => ({ ...prev, inset: parseInt(e.target.value) }))}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-slate-700 accent-blue-500"
                  />
                </div>

                {/* Outline Border weight */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-[9px] font-bold">
                    <span>Debljina Ivica:</span>
                    <span className="font-mono text-blue-500">{neu3D.border}px</span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="4"
                    value={neu3D.border}
                    onChange={(e) => setNeu3D(prev => ({ ...prev, border: parseInt(e.target.value) }))}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-slate-700 accent-blue-500"
                  />
                </div>

                {/* Reset button default fallback values */}
                <button
                  onClick={() => setNeu3D({ borderRadius: 24, depth: 6, padding: 12, intensity: 0.6, inset: 4, border: 1 })}
                  className="w-full py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-100 rounded-lg text-[9px] font-black tracking-wider uppercase transition-all mt-1"
                >
                  Fabričke Postavke ⚙️
                </button>
              </div>

              {/* Hard reset block */}
              <div className="p-3 rounded-2xl border border-red-500/20 bg-red-500/5">
                <span className="text-[9px] font-black uppercase tracking-wider text-red-500 block mb-1">
                  ⚠️ RESET PODATAKA
                </span>
                <p className="text-[8px] text-slate-400 mb-2">Trajno briše sve lokalne beleške, alarme i podešavanja.</p>
                <button 
                  onClick={handleClearAllData}
                  className="w-full py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[10px] font-black transition-all"
                >
                  Obriši Sve Podatke
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 🚨 TRENUTNO AKTIVNI REMINDER I ALARM DIALOG (GLASAN & 3D OFFLINE) */}
      {activeAlert && (
        <div className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md flex flex-col justify-end z-[100] p-5">
          <div 
            className={`w-full max-h-[90%] overflow-y-auto p-5 pb-8 flex flex-col gap-4 text-center ${
              isDarkMode ? "bg-[#111a2e] border-2 border-slate-700/60 text-white" : "bg-white border-2 border-slate-200 text-slate-900"
            }`}
            style={{ borderRadius: 'var(--neu-radius, 24px)' }}
          >
            {/* Visual pulsing chime ring icon */}
            <div className="flex flex-col items-center justify-center py-4 relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-rose-500 to-red-600 flex items-center justify-center text-white shadow-lg animate-bounce z-10">
                <BellRing className="w-8 h-8 animate-pulse" />
              </div>
              <div className="absolute w-24 h-24 rounded-full bg-red-500/20 animate-ping" />
              <div className="absolute w-32 h-32 rounded-full bg-red-500/10 animate-ping" style={{ animationDelay: '0.4s' }} />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-red-500 animate-pulse font-mono block">
                🔔 {activeAlert.type === "alarm" ? "AKTIVIRAN ALARM" : "ZAKAZAN REMINDER"}
              </span>
              <h3 className="text-xl font-black tracking-tight leading-tight px-1 break-words">
                {activeAlert.title}
              </h3>
              <p className="text-xs opacity-75 font-semibold mt-1">
                Vreme oglašavanja: <b className="text-blue-500 font-mono text-sm">{activeAlert.time}</b>
              </p>
            </div>

            {/* Visual description of mode responses */}
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs text-left italic font-medium opacity-90 border-l-4 border-red-500">
              💬 "{lunaReply}"
            </div>

            {/* Direct 3D configuration sliders in alarming context! */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl space-y-3.5 border border-dashed border-slate-300/40 text-left">
              <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-1.5 mb-1 text-slate-700 dark:text-slate-300">
                <Settings2 className="w-4 h-4 text-emerald-500" />
                <span className="text-[10px] font-black uppercase tracking-wide">3D Kalibracija Izgleda (Uživo)</span>
              </div>
              
              {/* Radius / Rounding / Visina */}
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-bold">
                  <span>Zaobljenost (Visina):</span>
                  <span className="font-mono text-blue-500">{neu3D.borderRadius}px</span>
                </div>
                <input 
                  type="range"
                  min="4"
                  max="40"
                  value={neu3D.borderRadius}
                  onChange={(e) => setNeu3D(prev => ({ ...prev, borderRadius: parseInt(e.target.value) }))}
                  className="w-full"
                />
              </div>

              {/* Offset / Depth */}
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-bold">
                  <span>Snaga Senki (Dubina):</span>
                  <span className="font-mono text-blue-500">{neu3D.depth}px</span>
                </div>
                <input 
                  type="range"
                  min="2"
                  max="15"
                  value={neu3D.depth}
                  onChange={(e) => setNeu3D(prev => ({ ...prev, depth: parseInt(e.target.value) }))}
                  className="w-full"
                />
              </div>

              {/* Shadow Intensity / Senke */}
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-bold">
                  <span>Senke (Contrast):</span>
                  <span className="font-mono text-blue-500">{Math.round(neu3D.intensity * 100)}%</span>
                </div>
                <input 
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={neu3D.intensity}
                  onChange={(e) => setNeu3D(prev => ({ ...prev, intensity: parseFloat(e.target.value) }))}
                  className="w-full"
                />
              </div>

              {/* Bevel Carvings / Insets */}
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-bold">
                  <span>Dubina Ureza (Bevel):</span>
                  <span className="font-mono text-blue-500">{neu3D.inset}px</span>
                </div>
                <input 
                  type="range"
                  min="1"
                  max="10"
                  value={neu3D.inset}
                  onChange={(e) => setNeu3D(prev => ({ ...prev, inset: parseInt(e.target.value) }))}
                  className="w-full"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                onClick={() => {
                  setActiveAlert(null);
                  speak("Potvrđeno. Hvala ti.");
                }}
                className="py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md transition active:scale-95 uppercase tracking-wider"
              >
                Uredi / Ugasi ✔
              </button>

              <button
                onClick={() => {
                  const now = new Date();
                  now.setMinutes(now.getMinutes() + 5);
                  const snoozeTime = now.toLocaleTimeString("sr-RS", { hour: "2-digit", minute: "2-digit", hour12: false });
                  
                  const newAlarm: AlarmType = {
                    id: "snooze-" + Date.now().toString(),
                    time: snoozeTime,
                    label: `Odloženo [${activeAlert.title}] ⏰`,
                    createdAt: new Date().toLocaleString('sr-RS'),
                    active: true
                  };
                  setAlarms(prev => [...prev, newAlarm]);
                  setActiveAlert(null);
                  speak("Alarm odložen za pet minuta.");
                  setLunaReply(`Odložila sam tvoj podsetnik na ${snoozeTime}. Možeš dremati još 5 minuta! 🧠🛌`);
                }}
                className="py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-md transition active:scale-95 uppercase tracking-wider"
              >
                Odloži (Snooze) 😴
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
