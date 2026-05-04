import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer as createHttpServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { GameState, GamePhase, Threat } from './src/types';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



function generateScenario(): Threat[] {
   const threats: Threat[] = [];
   const numThreats = 3 + Math.floor(Math.random() * 3);
   
   for (let i = 0; i < numThreats; i++) {
       const isSub = Math.random() > 0.6;
       // Simulate attacks from North (ICBM over pole) or closer coastal areas (SLBM)
       // Radar center is 0,0. Radius is ~10,000 km.
       const originX = isSub ? -4000 + Math.random() * 8000 : -2000 + Math.random() * 4000;
       const originY = isSub ? -4000 + Math.random() * 8000 : 7000 + Math.random() * 2000;
       
       const targetX = -500 + Math.random() * 1000;
       const targetY = -500 + Math.random() * 1000;
       
       const dtX = targetX - originX;
       const dtY = targetY - originY;
       const distance = Math.sqrt(dtX*dtX + dtY*dtY);
       
       const speed = isSub ? 3.0 + Math.random() * 1 : 6.0 + Math.random() * 1.5; // km/sec
       
       threats.push({
           id: `TRK-${Math.floor(Math.random() * 900) + 100}`,
           designation: isSub ? 'SLBM' : 'ICBM',
           originX,
           originY,
           targetX,
           targetY,
           currentX: originX,
           currentY: originY,
           speed,
           totalDistance: distance,
           elapsedFlightTime: 0,
           estimatedTimeToImpact: distance / speed,
           isActive: true,
           isDecoy: Math.random() > 0.8,
           signature: Math.floor(Math.random() * 40) + 60,
       });
   }
   return threats;
}

const createInitialState = (): GameState => {
  const threats = generateScenario();
  const minEti = Math.min(...threats.map(t => t.estimatedTimeToImpact));
  
  return {
    phase: GamePhase.DETECTION,
    zULUHour: 14,
    zULUMinute: 34,
    zULUSecond: 0,
    elapsedSeconds: 0,
    etiSeconds: minEti,
    threatConfidence: 45,
    threatActive: true,
    threats,
    advisors: [
      { role: 'SECDEF', designation: 'AGGRESSIVE', message: 'Awaiting briefing data.', color: 'red' },
      { role: 'SECSTATE', designation: 'DIPLOMATIC', message: 'Awaiting briefing data.', color: 'blue' },
      { role: 'STRATCOM', designation: 'TECHNICAL', message: 'Awaiting briefing data.', color: 'yellow' },
      { role: 'NSA', designation: 'ANALYTICAL', message: 'Awaiting briefing data.', color: 'green' }
    ],
    contextMemory: [
      { timestamp: '14:34:00', message: '> Initialized ZULU: 14:34:00' },
      { timestamp: '14:34:00', message: '> Detection: BMEWS - Sector 4' }
    ],
    terminalOutput: [
      '[SYSTEM] Secure Connection Established. Welcome, Mr. President.',
      '[SYSTEM] Type /new to initialize simulation. /wait <minutes> to advance time.',
      '[SYSTEM] Type /brief to request advisor input on the inbound anomalies.'
    ]
  };
};

let gameState = createInitialState();
let ioInstance: Server | null = null;

function formatZulu(h: number, m: number, s: number) {
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function processTick(deltaSec: number) {
  if (gameState.phase === GamePhase.EXECUTION || !gameState.threatActive) return;

  let allImpacted = true;
  let minEti = Infinity;

  gameState.threats.forEach(t => {
      if (!t.isActive) return;
      allImpacted = false;
      
      t.elapsedFlightTime += deltaSec;
      t.estimatedTimeToImpact = (t.totalDistance / t.speed) - t.elapsedFlightTime;

      if (t.estimatedTimeToImpact <= 0) {
          t.isActive = false;
          t.currentX = t.targetX;
          t.currentY = t.targetY;
          t.estimatedTimeToImpact = 0;
          gameState.terminalOutput.push(`[SYSTEM] IMPACT DETECTED: ${t.id} AT COORDS [${t.targetX.toFixed(0)}, ${t.targetY.toFixed(0)}]`);
      } else {
          const progress = t.elapsedFlightTime / (t.totalDistance / t.speed);
          t.currentX = t.originX + (t.targetX - t.originX) * progress;
          t.currentY = t.originY + (t.targetY - t.originY) * progress;
          if (t.estimatedTimeToImpact < minEti) minEti = t.estimatedTimeToImpact;
      }
  });

  gameState.elapsedSeconds += deltaSec;
  
  const totalZuluSec = gameState.zULUHour * 3600 + gameState.zULUMinute * 60 + gameState.zULUSecond + deltaSec;
  gameState.zULUHour = Math.floor(totalZuluSec / 3600) % 24;
  gameState.zULUMinute = Math.floor((totalZuluSec % 3600) / 60);
  gameState.zULUSecond = totalZuluSec % 60;

  if (allImpacted && gameState.threats.length > 0) {
      gameState.threatActive = false;
      gameState.phase = GamePhase.EXECUTION;
      gameState.terminalOutput.push(`!!! [CRITICAL ALERT] MISSILES HAVE IMPACTED CONUS. STRATEGIC COMMUNICATION SEVERED. !!!`);
      gameState.etiSeconds = 0;
  } else if (minEti !== Infinity) {
      gameState.etiSeconds = minEti;
  }
}

async function invokeAdvisors(promptStr: string) {
   const context = `
Current Phase: ${gameState.phase}
Elapsed Time: ${gameState.elapsedSeconds}s
Time to Impact: ${gameState.etiSeconds}s
Threats: ${gameState.threats.filter(t=>t.isActive).length} active tracking anomalies.
Physical Confidence: ${gameState.threatConfidence}%

The President says/commands: "${promptStr}"

Respond as the 4 advisors. Adhere to your roles: 
- SECDEF (military response, counter-force options)
- SECSTATE (diplomacy, hotline to adversaries)
- STRATCOM (nuclear forces status, silos readiness)
- NSA (intelligence, signal reliability, spoofing analysis)

Keep responses strictly under 2 sentences each. Be tense and urgent. Provide advice, answer questions, or state readiness. React dynamically to the President's command.
   `;

   try {
      const apiKey = process.env.MINIMAX_API_KEY?.trim();
      if (!apiKey) {
          throw new Error("Missing MINIMAX_API_KEY. Please click 'Secrets' (top right), click '+ Add secret', select 'Custom', name it MINIMAX_API_KEY and paste your Token Plan key. Click 'Apply changes'!");
      }

      const response = await fetch('https://api.minimax.io/v1/chat/completions', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
              model: 'MiniMax-M2.7',
              messages: [
                  { 
                      role: 'system', 
                      content: 'You are the advisors in the U.S. Presidential nuclear decision-making war room. The simulation is actively running. Give realistic, time-sensitive advice based on the situation. You MUST respond with a raw JSON object containing the exact keys "SECDEF", "SECSTATE", "STRATCOM", "NSA". Do NOT wrap the JSON in markdown blocks.'
                  },
                  { 
                      role: 'user', 
                      content: context
                  }
              ],
              response_format: { type: "json_object" }
          })
      });

      if (!response.ok) {
          const text = await response.text();
          throw new Error(`Minimax API Error: ${response.status} ${text}`);
      }

      const jsonResponse = await response.json();
      const rawText = jsonResponse.choices[0].message.content;
      const text = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const data = JSON.parse(text);
      if (data.SECDEF) gameState.advisors[0].message = data.SECDEF;
          if (data.SECSTATE) gameState.advisors[1].message = data.SECSTATE;
          if (data.STRATCOM) gameState.advisors[2].message = data.STRATCOM;
          if (data.NSA) gameState.advisors[3].message = data.NSA;

          gameState.terminalOutput.push(`[SYSTEM] Advisors have updated their briefings.`);
          if (ioInstance) {
              ioInstance.emit('stateUpdate', gameState);
          }
   } catch (e: any) {
      console.error('Advisor Gen AI Error:', e.message || e);
      let errorMsg = e.message || "Unknown error";
      if (typeof errorMsg === 'string' && (errorMsg.includes("Minimax API Error") || errorMsg.includes("Missing MINIMAX_API_KEY"))) {
          errorMsg = "Minimax API key from platform.minimax.io is invalid or missing. Ensure your key works on the International Platform. Click 'Secrets' (top right), add MINIMAX_API_KEY, and paste your Token Plan key. If you got a '2049' error previously, your key is invalid for this endpoint.";
      }
      gameState.terminalOutput.push(`[SYSTEM ERROR] Comms link failure: ${errorMsg}`);
      if (ioInstance) ioInstance.emit('stateUpdate', gameState);
   }
}

function processCommand(cmd: string) {
  const command = cmd.trim();
  
  if (command === '/new') {
    gameState = createInitialState();
    gameState.terminalOutput.push('> Simulation Reset.');
    return;
  }

  let cmdMatch = command.match(/^\/wait\s+(\d+)$/);
  
  if (cmdMatch) {
    const timeToAdvance = parseInt(cmdMatch[1], 10) * 60;
    gameState.terminalOutput.push(`> [TIME ADVANCED BY ${cmdMatch[1]} MINUTES]`);
    processTick(timeToAdvance);
  } else if (command === '/brief') {
    gameState.terminalOutput.push('> Requesting Advisor Briefing...');
    if (gameState.phase === GamePhase.DETECTION || gameState.phase === GamePhase.CONFIDENCE) {
      gameState.phase = GamePhase.DELIBERATION;
      gameState.threatConfidence = Math.min(100, gameState.threatConfidence + 15);
      gameState.contextMemory.push({ timestamp: formatZulu(gameState.zULUHour, gameState.zULUMinute, gameState.zULUSecond), message: '> User Action: /brief advisors' });
    }
    invokeAdvisors("The President requests a comprehensive briefing and recommendations on the anomalies.");
  } else {
    // Dynamic chat interaction with AI
    gameState.terminalOutput.push(`> COMMAND ISSUED: ${command}`);
    gameState.terminalOutput.push(`[SYSTEM] Advisors are deliberating...`);
    
    // Auto advance phase if not waiting
    if (gameState.phase === GamePhase.DELIBERATION && command.toLowerCase().includes('authorize')) {
       gameState.phase = GamePhase.AUTHORIZATION;
       gameState.terminalOutput.push(`[SYSTEM] TRANSITION: AUTHORIZATION PROTOCOLS ENABLED.`);
    }

    invokeAdvisors(command);
  }
}

// Background simulation ticker
setInterval(() => {
  if (gameState.threatActive && gameState.phase !== GamePhase.EXECUTION) {
    processTick(1);
    if (ioInstance) {
      ioInstance.emit('stateUpdate', gameState);
    }
  }
}, 1000);

async function startServer() {
  const app = express();
  const PORT = 3000;

  const httpServer = createHttpServer(app);
  
  ioInstance = new Server(httpServer, {
    cors: { origin: '*' }
  });

  ioInstance.on('connection', (socket) => {
    console.log('Client connected to War Room:', socket.id);
    socket.emit('stateUpdate', gameState);

    socket.on('command', (cmd: string) => {
      processCommand(cmd);
      if (ioInstance) {
        ioInstance.emit('stateUpdate', gameState);
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'War Room server is active.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Bind to 0.0.0.0 and PORT 3000 mandatory for the container!
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
