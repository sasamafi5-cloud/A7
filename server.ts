import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialize Gemini API client to prevent startup crash if GEMINI_API_KEY is not defined
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing from environment variables.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Robust exponential backoff retry helper specifically for transient Gemini API errors (e.g. 503, 429)
async function generateWithRetry(ai: GoogleGenAI, params: any, retries = 3, delay = 800): Promise<any> {
  let lastError: any = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      lastError = error;
      console.warn(`[Gemini Attempt ${attempt}/${retries}] Failed:`, error.message || error);
      
      const isTransient = 
        error.message?.includes("503") || 
        error.message?.includes("UNAVAILABLE") ||
        error.message?.includes("504") ||
        error.message?.includes("429") || 
        error.message?.includes("RESOURCE_EXHAUSTED") ||
        error.message?.includes("500") ||
        error.status === 503 ||
        error.status === 429;
        
      if (!isTransient || attempt === retries) {
        break;
      }
      
      const backoffDelay = delay * Math.pow(2, attempt - 1);
      console.log(`Waiting ${backoffDelay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
  throw lastError;
}

// Fallback response engine to gracefully simulate Luna active modes and parse actions locally when API is entirely offline
function getLocalFallbackResponse(message: string, mode: string): { reply: string; actionType: string; actionValue: string } {
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
    const keywords = ["dodaj belešku", "dodaj belesku", "zabeleži", "zabelezi", "zapiši", "zapisi", "beleška", "beleska", "belesku", "belešku"];
    
    for (const kw of keywords) {
      const idx = lowercaseMsg.indexOf(kw);
      if (idx !== -1) {
        noteText = message.substring(idx + kw.length).trim();
        noteText = noteText.replace(/^[:\-\s,]+/, "");
        break;
      }
    }
    
    if (!noteText) {
      noteText = "Zadatak u beležnici";
    }
    
    let reply = "";
    if (mode === "Šaljiva AI" || mode === "Šaljiva") {
      reply = `Zapisala sam to u tvoju pametnu glavicu... Ovaj, u beleške da se ne zaboravi! "${noteText}"! 📝🤪`;
    } else if (mode === "Sveznalica AI" || mode === "Sveznalica") {
      reply = `Moje mistične vizije kažu da ovo mora biti zapisano: "${noteText}". Čuvam tvoju sudbinu u beležniku! 🔮✨`;
    } else if (mode === "Profesionalna AI" || mode === "Profi") {
      reply = `Potvrđujem unos operativnog podatka u vaše beleške: "${noteText}". Zadatak je zabeležen. 💼`;
    } else {
      reply = `Uspešno sam dodala novu belešku: "${noteText}". Spremno za tebe! 🧠✨`;
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
      reply = `Alarm je navigiran na tačno ${alarmTime}! Nadam se da voliš glasne zvuke jer ću vrištati! ⏰😂`;
    } else if (mode === "Sveznalica AI" || mode === "Sveznalica") {
      reply = `Zvezde govore da će se tvoj energetski krug probuditi tačno u ${alarmTime}. 🔮✨`;
    } else if (mode === "Profesionalna AI" || mode === "Profi") {
      reply = `Alarm uspešno podešen i sinhronizovan za ${alarmTime} časova. 📅`;
    } else {
      reply = `Dodala sam alarm za ${alarmTime} časova. Budim te na vreme! 🧠⏰`;
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
      reply = "Sve je očišćeno, moj elektronski mozak je čistiji od mog kuhinjskog poda! 🧼🤪";
    } else if (mode === "Sveznalica AI" || mode === "Sveznalica") {
      reply = "Veliko kosmičko čišćenje je završeno. Prethodni zapisi su nestali u astralnoj magli! 🔮✨";
    } else if (mode === "Profesionalna AI" || mode === "Profi") {
      reply = "Registrovan nalog za potpuno brisanje. Svi privremeni zapisi i alarmi su uklonjeni. 💼";
    } else {
      reply = "Uradila sam čistku! Sve tvoje beleške i svi tvoji alarmi su očišćeni. 🧠🧹";
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
      reply = `Gledaj na gornji ugao svog telefona, pametnice! Šalim se, tačno je ${timeNow}. ⏰🤪`;
    } else if (mode === "Sveznalica AI" || mode === "Sveznalica") {
      reply = `Planete ukazuju da u našem prostor-vremenu trenutno kuca ${timeNow}. 🔮✨`;
    } else if (mode === "Profesionalna AI" || mode === "Profi") {
      reply = `Lokalno standardno vreme je precizno verifikovano i iznosi ${timeNow}. 💼`;
    } else {
      reply = `Sada je tačno ${timeNow}. 🧠✨`;
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
      "Hej Saša! Moja neuronska veza je malo štucala od prevelikog smeha, ali sam i dalje vrcava i spremna za lude komande! Kako ti mogu pomoći? 😂",
      "Trenutno žongliram sa tri bita informacija i jednim tosterom. Reci mi bilo šta slatko! 🤪",
      "Ha! Odlično pitanje, ali moj smešni procesor predlaže da napravimo neku zabavnu belešku ili alarm! Probao?"
    ];
    reply = jokes[Math.floor(Math.random() * jokes.length)];
  } else if (mode === "Sveznalica AI" || mode === "Sveznalica") {
    const mystic = [
      "Prst sudbine se poigrao sa kosmičkom mrežom, Saša... Ali mudra Luna vidi tvoje pitanje i odgovara: sve će se rešiti u tvoju korist! Pitaj me za neki mistični zapis! 🔮🌟",
      "Digitalne magle su danas guste, ali moje unutrašnje treće oko i dalje sija. Zatraži proročanstvo ili belešku! 🦉✨"
    ];
    reply = mystic[Math.floor(Math.random() * mystic.length)];
  } else if (mode === "Profesionalna AI" || mode === "Profi") {
    reply = "Asistent Luna vas pozdravlja. Zbog blage fluktuacije mrežne veze, aktiviran je lokalni bezbednosni protokol. Spreman sam za brzu organizaciju beleški i alarma. 💼";
  } else {
    // Pametna AI / default
    reply = "Tu sam, Saša! Izvini, imala sam kratak prekid signala ka centralnom AI, ali moj lokalni mozak je budan. Mogu ti pomoći da zapišeš neku misao ili podesiš alarm! 🧠✨";
  }
  
  return {
    reply,
    actionType: "none",
    actionValue: ""
  };
}

// REST API for Luna AI Assistant
app.post("/api/chat", async (req, res) => {
  const { message, mode, currentNotes, currentAlarms } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: "Poruka je obavezna." });
  }

  try {
    const ai = getGeminiClient();

    // Context from current user data to let Gemini know what is currently stored
    const contextStr = `
Trenutne beleške u sistemu: ${JSON.stringify(currentNotes || [])}
Trenutni alarmi u sistemu: ${JSON.stringify(currentAlarms || [])}
Trenutno vreme na serveru: ${new Date().toISOString()}
    `;

    // System instruction depending on mode
    let systemInstruction = `
Ti si Luna, pametna, napredna AI sekretarica i lični asistent. 
Korisnik se zove Saša. Razgovaraš isključivo na srpskom jeziku.

Evo opisa tvog režima rada na osnovu odabira:
`;

    if (mode === "Šaljiva AI" || mode === "Šaljiva") {
      systemInstruction += `Režim: Šaljiva AI (🤪)
Tvoj ton je duhovit, šaljiv, zabavan, opušten i pun pošalica na srpskom jeziku. Slobodno koristi sarkazam, viceve i smešne opise. Koristi dosta emodžija poput 🤪, 😂, 🤖.`;
    } else if (mode === "Sveznalica AI" || mode === "Sveznalica") {
      systemInstruction += `Režim: Sveznalica (🔮)
Ponašaš se kao mudri mistični prorok, zvezdočatac ili sveznajući entitet. Odgovori su ti pomalo dramatični, filozofski i pune mudrosti. Koristi reči poput "Moje vizije kažu...", "Zvezde su se poklopile..." i emodžije poput 🔮, 🌟, 🦉, ✨.`;
    } else if (mode === "Profesionalna AI" || mode === "Profi" || mode === "Profesionalna") {
      systemInstruction += `Režim: Profesionalna AI (💼)
Ti si visoko profesionalna, formalna, brza i efikasna sekretarica. Tvoji odgovori su kratki, poslovni, jasni i fokusirani na zadatak. Nema mesta suvišnom ćaskanju. Koristi emodžije 💼, 📎, 📅.`;
    } else {
      // "Pametna AI" / default
      systemInstruction += `Režim: Pametna AI (🧠 - Zadrazumevano)
Ti si inteligentna, topla, oštroumna, predusretljiva i spremna da rešiš svaki problem. Odgovori su ti balansirani, pametni i detaljni. Koristi emodžije 🧠, ✨, 🚀.`;
    }

    systemInstruction += `

Pored razgovora, možeš prepoznati nameru korisnika da doda belešku, postavi alarm, zatraži trenutno vreme ili očisti podatke:
- Ako korisnik kaže nešto poput "zabeleži kupiti hleb" ili "dodaj belešku sastanak u 5", prepoznaj akciju 'add_note' i izvuci čist tekst beleške za 'actionValue'.
- Ako korisnik kaže nešto poput "postavi alarm u 7 sati" ili "dodaj alarm sutra u pola 8", prepoznaj akciju 'add_alarm' i izvuci prepoznato vreme u čistom formatu (npr. '07:30' ili 'sutra u 07:30') kao 'actionValue'.
- Ako korisnik pita "koliko je sati" ili "koje je vreme", prepoznaj akciju 'get_time'.
- Ako korisnik kaže "obriši sve", "očisti sve" ili slično, prepoznaj akciju 'clear_all'.
- Za sve ostalo ćaskanje i pitanja, akcija je 'none'.

Važno: Uvek vrati valjan JSON objekat sa poljima 'reply', 'actionType' i 'actionValue'. Tvoj 'reply' uvek treba da verbalno potvrdi i opiše šta se dešava na zabavan ili prikladan način u skladu sa izabranim režimom!

Primeri izlaza:
1) Za "beleška kupi mleko" u Šaljivom režimu:
{
  "reply": "Zapisala sam to u tvoju pametnu glavicu... Ovaj, u beleške! Kupiti mleko da ti kosti ojačaju! 🥛🤪",
  "actionType": "add_note",
  "actionValue": "Kupi mleko"
}
2) Za "koliko je sati" u Profi režimu:
{
  "reply": "Trenutno vreme je provereno na serveru. Detalji su prikazani na ekranu. 💼",
  "actionType": "get_time",
  "actionValue": ""
}
`;

    // Try generating response with robust retries
    const response = await generateWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: [
        { text: contextStr },
        { text: `Korisnik Saša kaže: "${message}"` }
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description: "Tekstualni odgovor sekretarice na srpskom jeziku"
            },
            actionType: {
              type: Type.STRING,
              description: "Tip prepoznate akcije: 'none', 'add_note', 'add_alarm', 'get_time', 'clear_all'"
            },
            actionValue: {
              type: Type.STRING,
              description: "Vrednost za belešku ili vreme alarma ako postoji"
            }
          },
          required: ["reply", "actionType"]
        }
      }
    });

    const resultText = response.text || "{}";
    const resultJson = JSON.parse(resultText);
    res.json(resultJson);

  } catch (error: any) {
    console.error("Gemini primary and retry options exhausted, running offline parser:", error.message || error);
    
    // Leverage the smart Serbian offline interpreter
    const localFallback = getLocalFallbackResponse(message, mode);
    res.json(localFallback);
  }
});

// Serve frontend assets in production/development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
