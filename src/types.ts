export enum GamePhase {
  DETECTION = 'DETECTION',
  CONFIDENCE = 'CONFIDENCE',
  DELIBERATION = 'DELIBERATION',
  AUTHORIZATION = 'AUTHORIZATION',
  EXECUTION = 'EXECUTION',
}

export interface Advisor {
  role: 'SECDEF' | 'SECSTATE' | 'STRATCOM' | 'NSA';
  designation: string;
  message: string;
  color: string;
}

export interface SystemLog {
  timestamp: string;
  message: string;
}

export interface Threat {
  id: string;
  designation: string;
  originX: number; // km from radar center
  originY: number; // km from radar center
  targetX: number;
  targetY: number;
  currentX: number;
  currentY: number;
  speed: number; // km/s
  totalDistance: number;
  elapsedFlightTime: number; // seconds
  estimatedTimeToImpact: number; // seconds
  isActive: boolean;
  isDecoy: boolean;
  signature: number; // 0-100 radar cross section confidence
}

export interface GameState {
  phase: GamePhase;
  zULUHour: number;
  zULUMinute: number;
  zULUSecond: number;
  elapsedSeconds: number;
  etiSeconds: number;
  threatConfidence: number;
  advisors: Advisor[];
  contextMemory: SystemLog[];
  terminalOutput: string[];
  threats: Threat[];
  threatActive: boolean;
}
