import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState, GamePhase } from './types';

export default function App() {
  const [terminalInput, setTerminalInput] = useState('');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Connect to the synchronized War Room server back-end
    const socket = io();
    socketRef.current = socket;

    socket.on('stateUpdate', (state: GameState) => {
      setGameState(state);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    // Keep terminal pinned to bottom when new logs appear
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState?.terminalOutput]);

  const handleCommand = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && terminalInput.trim() !== '') {
      socketRef.current?.emit('command', terminalInput);
      setTerminalInput('');
    }
  };

  const formatTime = (h: number, m: number, s: number) => {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatDuration = (totalSec: number, isEti = false) => {
    const isNegative = totalSec < 0;
    const absSec = Math.abs(totalSec);
    const h = Math.floor(absSec / 3600);
    const m = Math.floor((absSec % 3600) / 60);
    const s = absSec % 60;
    const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return isEti && !isNegative && totalSec !== 0 ? `-${timeStr}` : timeStr;
  };

  if (!gameState) {
    return <div className="bg-[#050505] w-full h-screen text-[#444] flex items-center justify-center font-mono">INITIALIZING WAR ROOM SECURE LINK...</div>;
  }

  const phaseIndex = Object.values(GamePhase).indexOf(gameState.phase);

  return (
    <div className="bg-[#050505] text-[#d1d5db] font-sans w-full h-screen overflow-hidden flex flex-col select-none">
      {/* Header Section */}
      <header className="h-16 border-b border-[#333] bg-[#0a0a0a] flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
          <h1 className="text-xl font-bold tracking-widest text-white uppercase">
            Strategic Command Center <span className="text-[#666] font-normal mx-2">|</span> <span className="text-red-500">DEFCON 2</span>
          </h1>
        </div>
        <div className="flex gap-8 text-xs font-mono">
          <div className="flex flex-col items-end">
            <span className="text-[#666] uppercase">Zulu Time</span>
            <span className="text-lg text-[#f2a126]">{formatTime(gameState.zULUHour, gameState.zULUMinute, gameState.zULUSecond)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[#666] uppercase">Elapsed Time</span>
            <span className="text-lg text-[#f2a126]">{formatDuration(gameState.elapsedSeconds)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[#666] uppercase">Impact ETI</span>
            <span className={`text-lg ${gameState.etiSeconds <= 0 ? 'text-red-500 font-bold' : 'text-red-500 underline'}`}>
              {formatDuration(gameState.etiSeconds, true)}
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Advisors */}
        <aside className="w-72 border-r border-[#333] bg-[#080808] flex flex-col p-4 gap-4 overflow-y-auto custom-scrollbar">
          <div className="text-[10px] uppercase tracking-tighter text-[#666] mb-1">Advisor Briefing Loop</div>
          
          {gameState.advisors.map((adv, idx) => {
            const colors: Record<string, string> = {
              'red': 'border-red-500 text-red-400 bg-red-900/50',
              'blue': 'border-blue-500 text-blue-400 bg-blue-900/50',
              'yellow': 'border-yellow-500 text-yellow-400 bg-yellow-900/50',
              'green': 'border-green-500 text-green-400 bg-green-900/50',
            };
            const colStyle = colors[adv.color] || colors['red'];
            const [borderCol, textCol, bgCol] = colStyle.split(' ');
            
            return (
              <div key={idx} className={`bg-[#111] border-l-2 p-3 ${borderCol}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-white">{adv.role}</span>
                  <span className={`text-[9px] px-1 ${bgCol} ${textCol}`}>{adv.designation}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-[#999]">"{adv.message}"</p>
              </div>
            );
          })}

          <div className="mt-auto border-t border-[#222] pt-4 shrink-0">
            <div className="text-[10px] text-[#444] mb-2 uppercase">System Context Memory</div>
            <div className="h-32 overflow-y-auto text-[9px] font-mono text-[#555] space-y-1 custom-scrollbar">
              {gameState.contextMemory.map((log, i) => (
                <div key={i}>{log.message}</div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Viewport: Map & Tactical */}
        <main className="flex-1 bg-black relative flex flex-col">
          <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-[radial-gradient(circle_at_center,_#111_0%,_#000_70%)]">
            <div className="absolute inset-0 opacity-10" style={{ backgroundSize: '40px 40px', backgroundImage: 'linear-gradient(to right, #333 1px, transparent 1px), linear-gradient(to bottom, #333 1px, transparent 1px)' }}></div>
            
            {/* Functional Radar Map */}
            <div className="relative w-[500px] h-[500px] border border-[#222] rounded-full flex items-center justify-center overflow-hidden">
              <svg viewBox="-10000 -10000 20000 20000" className="w-full h-full absolute inset-0 text-white">
                {/* Radar Rings */}
                <circle cx="0" cy="0" r="10000" className="stroke-[#1a1a1a] stroke-[20px] fill-transparent" />
                <circle cx="0" cy="0" r="7500" className="stroke-[#141414] stroke-[20px] fill-transparent" />
                <circle cx="0" cy="0" r="5000" className="stroke-[#111] stroke-[20px] fill-transparent" />
                <circle cx="0" cy="0" r="2500" className="stroke-[#111] stroke-[20px] fill-transparent" />
                
                {/* Crosshairs */}
                <line x1="-10000" y1="0" x2="10000" y2="0" className="stroke-[#222] stroke-[20px] opacity-50" />
                <line x1="0" y1="-10000" x2="0" y2="10000" className="stroke-[#222] stroke-[20px] opacity-50" />
                
                {/* Active scan line */}
                <g>
                  <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="4s" repeatCount="indefinite" />
                  <polygon points="0,0 10000,-2000 10000,0" className="fill-green-500/20" />
                  <line x1="0" y1="0" x2="10000" y2="0" className="stroke-green-500/80 stroke-[80px]" />
                </g>
                
                {/* Target (DC) */}
                <circle cx="0" cy="0" r="150" className="stroke-blue-500 stroke-[30px] fill-transparent" />

                {/* Threats */}
                {gameState.threats.map(t => {
                  if (!t.isActive) return null;
                  return (
                    <g key={t.id} transform={`translate(${t.currentX}, ${-t.currentY})`}>
                      {/* Course line */}
                      <line 
                        x1="0" y1="0" 
                        x2={(t.targetX - t.currentX)} 
                        y2={-(t.targetY - t.currentY)} 
                        className="stroke-red-900/40 stroke-[20px] stroke-dasharray-[50,50]" 
                      />
                      {/* Threat Blip */}
                      {t.isDecoy && gameState.phase >= GamePhase.DELIBERATION ? (
                         <rect x="-100" y="-100" width="200" height="200" className="fill-transparent stroke-yellow-500 stroke-[30px]" />
                      ) : (
                         <polygon points="0,-150 150,150 -150,150" className="fill-red-600 shadow-[0_0_20px_red] animate-pulse" />
                      )}
                      
                      {/* Label */}
                      <text x="200" y="-200" className={`text-[400px] font-mono fill-red-500 ${t.isDecoy && gameState.phase >= GamePhase.DELIBERATION ? 'fill-yellow-500 opacity-60' : ''}`}>
                        {t.id}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Phase Indicator Overlay */}
            <div className="absolute top-8 left-8 flex gap-2">
              {Object.values(GamePhase).map((phase, i) => {
                const isActive = phaseIndex === i;
                const isPast = phaseIndex > i;
                let bgClasses = 'bg-[#1a1a1a] border-[#333] text-[#444]';
                
                if (isActive) {
                  bgClasses = 'bg-[#1a1a1a] border-blue-500 text-blue-400';
                } else if (isPast) {
                  bgClasses = 'bg-[#1a1a1a] border-[#333] text-green-500 opacity-50';
                }
                
                return (
                  <div key={phase} className={`px-2 py-1 border text-[10px] uppercase transition-colors ${bgClasses}`}>
                    {phase}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Console / Command Input */}
          <section className="h-48 border-t border-[#333] bg-[#0a0a0a] flex flex-col shrink-0">
            <div className="flex-1 p-4 font-mono text-[12px] text-[#aaa] space-y-1 overflow-y-auto custom-scrollbar">
              {gameState.terminalOutput.map((line, i) => (
                <div key={i} className={line.includes('ALERT') ? 'text-red-500 font-bold' : line.includes('COMMAND') ? 'text-[#ccc]' : ''}>
                  {line}
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>
            <div className="h-12 border-t border-[#333] bg-black flex items-center px-4 shrink-0 focus-within:ring-1 focus-within:ring-[#333]">
              <span className="text-blue-500 font-bold mr-3">COMMAND &gt;</span>
              <input 
                type="text"
                autoFocus
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                className="flex-1 bg-transparent text-[#ccc] font-mono outline-none border-none placeholder-[#444]"
                placeholder="Enter command or directive..."
                onKeyDown={handleCommand}
              />
              <div className="flex gap-4 ml-4">
                <div className="text-[10px] text-[#444] uppercase hidden sm:block">/wait &lt;mins&gt;</div>
                <div className="text-[10px] text-[#444] uppercase hidden sm:block">/brief</div>
                <div className="text-[10px] text-[#444] uppercase hidden sm:block">/new</div>
              </div>
            </div>
          </section>
        </main>

        {/* Right Sidebar: Tactical Data */}
        <aside className="w-64 border-l border-[#333] bg-[#080808] flex flex-col p-4 gap-6 overflow-y-auto custom-scrollbar">
          <div>
            <div className="text-[10px] uppercase text-[#666] mb-3">Tactical Confidence</div>
            <div className="h-1.5 w-full bg-[#1a1a1a] rounded-full overflow-hidden mb-1">
              <div className="h-full bg-yellow-500 transition-all duration-1000" style={{ width: `${gameState.threatConfidence}%` }}></div>
            </div>
            <div className="flex justify-between font-mono text-[10px]">
              <span className="text-yellow-500">{gameState.threatConfidence}% PHYSICAL CERTAINTY</span>
              <span className="text-[#444]">TARGET: CONUS</span>
            </div>
          </div>

          <div className="flex-1">
            <div className="text-[10px] uppercase text-[#666] mb-3">Asset Readiness</div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#999]">US AIR FORCE (SAC)</span>
                <span className="text-[10px] text-green-500">AIRBORNE</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#999]">SLBM (NAVY)</span>
                <span className="text-[10px] text-yellow-500">READY/SUB</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#999]">ICBM (SILO)</span>
                <span className="text-[10px] text-red-500">ARMED</span>
              </div>
            </div>
          </div>

          {gameState.phase === GamePhase.AUTHORIZATION || gameState.phase === GamePhase.EXECUTION ? (
            <div className="bg-red-900/10 border border-red-500/30 p-4 shrink-0 animate-pulse">
              <div className="text-[10px] uppercase text-red-500 font-bold mb-2 tracking-widest">Nuclear Protocol</div>
              <div className="text-[9px] text-[#666] leading-relaxed">
                AUTHENTICATION REQUIRED<br/>
                SEALED AUTHENTICATOR SYSTEM (SAS) CHALLENGE RESPONSE INITIATED.
              </div>
              <div className="mt-4 flex gap-1">
                <div className="w-full h-8 bg-black border border-red-900 flex items-center justify-center font-mono text-red-500 text-xs tracking-widest">
                  ALPHA-4-WHISKEY
                </div>
              </div>
            </div>
          ) : (
             <div className="bg-[#111] border border-[#222] p-4 shrink-0">
               <div className="text-[10px] uppercase text-[#444] font-bold mb-2 tracking-widest">Nuclear Protocol</div>
               <div className="text-[9px] text-[#555] leading-relaxed">
                 AWAITING DELIBERATION OUTCOME.<br/>
                 SAS SECURED.
               </div>
             </div>
          )}
          
          <div className="text-center text-[10px] text-[#333] mt-auto font-mono italic shrink-0">
            V.1.04-WARROOM
          </div>
        </aside>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #333;
          border-radius: 20px;
        }
      `}} />
    </div>
  );
}
