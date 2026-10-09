// RECONSTRUCTED FILE — not recovered from the original build.
//
// This file was type-only (`import type {...} from "./types"`) everywhere it was
// used, so esbuild/Vite erased it entirely before the sourcemap was generated —
// there is no trace of its original source. Every shape below was inferred by
// reading how each type is constructed and consumed across cognition/*.ts
// (all of which ARE original, recovered verbatim from server.cjs.map). Field
// names and required/optional-ness should be accurate; anything genuinely
// uncertain is marked with a TODO.

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface CognitiveEventInput {
  type: string;
  source: string;
  timestamp?: string;
  importance?: number;
  confidence?: number;
  projectId?: string | null;
  dedupeKey?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

export interface CognitiveEvent {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  importance: number;
  confidence: number;
  projectId?: string | null;
  dedupeKey?: string;
  correlationId?: string;
  metadata: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Attention
// ---------------------------------------------------------------------------

export interface AttentionFactors {
  relevance: number;
  novelty: number;
  urgency: number;
  risk: number;
  userImpact: number;
  taskRelevance: number;
  confidence: number;
  repetitionPenalty: number;
  interruptionCost: number;
}

export interface AttentionAssessment {
  eventId: string;
  score: number;
  factors: AttentionFactors;
  semanticKey: string;
  explanation: string[];
}

// ---------------------------------------------------------------------------
// Situation model
// ---------------------------------------------------------------------------

export type CognitiveState =
  | "IDLE"
  | "OBSERVING"
  | "LISTENING"
  | "SPEAKING"
  | "THINKING"
  | "ACTING"
  | "PLANNING"
  | "VERIFYING"
  | "LEARNING"
  | "INTERRUPTED"
  | "PAUSED";

export type RiskLevel = 0 | 1 | 2 | 3 | 4;

export interface SituationEventSummary {
  id: string;
  type: string;
  timestamp: string;
  importance: number;
  source: string;
}

export interface SituationSnapshot {
  state: CognitiveState;
  currentActivity: string | null;
  activeApp: string | null;
  activeWindow: string | null;
  currentProject: string | null;
  conversationTopic: string | null;
  currentGoalId: string | null;
  currentTaskId: string | null;
  userActivity: "active" | "idle" | "away";
  userSpeaking: boolean;
  siyaSpeaking: boolean;
  siyaWasInterrupted: boolean;
  silenceStartedAt: string | null;
  silenceSeconds: number;
  openApplications: string[];
  relevantFiles: string[];
  recentImportantEvents: SituationEventSummary[];
  recentFailures: SituationEventSummary[];
  recentSuccesses: SituationEventSummary[];
  pendingRisk: {
    eventId: string;
    description: string;
    level: RiskLevel;
    confirmationId?: string;
  } | null;
  autonomyPaused: boolean;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export type GoalTaskStatus = "pending" | "running" | "blocked" | "completed" | "failed" | "cancelled";
export type GoalStatus = "pending" | "active" | "blocked" | "completed" | "failed" | "cancelled";

export interface GoalTask {
  id: string;
  title: string;
  status: GoalTaskStatus;
  priority: number;
  dependsOn: string[];
  attempts: number;
  maxRetries: number;
  timeoutMs: number;
  progress: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  id: string;
  objective: string;
  constraints: string[];
  successCriteria: string[];
  priority: number;
  status: GoalStatus;
  projectId: string | null;
  tasks: GoalTask[];
  blockers: string[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Initiative
// ---------------------------------------------------------------------------

export type InitiativeAction = "IGNORE" | "OBSERVE" | "REMEMBER" | "WAIT" | "WARN" | "ASK" | "SPEAK";

export interface InitiativeDecision {
  eventId: string;
  action: InitiativeAction;
  attentionScore: number;
  reason: {
    reason: string;
    urgency: number;
    novelty: number;
    confidence: number;
    interruptionAllowed: boolean;
    suggestedTone: string;
  };
  shouldGenerateSpeech: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export type PermissionName =
  | "microphone"
  | "screen_awareness"
  | "filesystem_read"
  | "filesystem_write"
  | "desktop_control"
  | "browser"
  | "network"
  | "automation"
  | "code_execution"
  | "system_control";

export interface ToolDescriptor {
  name: string;
  purpose: string;
  permission: PermissionName;
  riskLevel: RiskLevel;
  timeoutMs: number;
  maxRetries: number;
}

export interface ToolExecutionContext {
  projectRoot?: string;
  confirmed?: boolean;
  correlationId?: string;
}

export type ToolExecutionStatus =
  | "denied"
  | "confirmation_required"
  | "cancelled"
  | "succeeded"
  | "failed"
  | "timed_out";

export interface ToolExecutionResult {
  success: boolean;
  status: ToolExecutionStatus;
  tool: string;
  result: unknown;
  error: string | null;
  riskLevel: RiskLevel;
  durationMs: number;
  attempts: number;
  confirmationId?: string;
}

export interface CriticVerdict {
  passed: boolean;
  retryRecommended: boolean;
  reason: string;
  missing: string[];
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

// "skill" and "working" confirmed present via legacyCategoryForKind()'s switch
// cases in server/index.ts (case "skill"/"working" only type-checks if MemoryKind
// includes them), though no call site in the recovered files constructs one.
export type MemoryKind = "preference" | "project" | "episodic" | "semantic" | "correction" | "skill" | "working";

export interface StructuredMemory {
  id: string;
  kind: MemoryKind;
  content: string;
  projectId: string | null;
  entities: string[];
  tags: string[];
  confidence: number;
  confirmations: number;
  importance: number;
  source: string;
  sourceId?: string;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
  accessCount: number;
  expiresAt: string | null;
  supersedesId?: string;
  active: boolean;
}

export interface MemoryQuery {
  text?: string;
  entities?: string[];
  minConfidence?: number;
  kinds?: MemoryKind[];
  projectId?: string | null;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

export interface LearnedSkillStep {
  id: string;
  action: string;
  tool?: string;
  arguments?: Record<string, unknown>;
}

export interface LearnedSkill {
  id: string;
  name: string;
  description: string;
  preconditions: string[];
  steps: LearnedSkillStep[];
  expectedOutcome: string;
  projectId: string | null;
  confidence: number;
  uses: number;
  successes: number;
  failures: number;
  successRate: number;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

export type ModelCapability = "fast" | "reasoning" | "coding" | "vision" | "research" | "embedding" | "speech";

export interface ModelCallResult {
  text: string;
  model: string;
  capability: ModelCapability;
  durationMs: number;
  cached: boolean;
  attempts: number;
}

// ---------------------------------------------------------------------------
// Conversation continuation / autonomous mind
// ---------------------------------------------------------------------------

export type ConversationThreadStatus = "ACTIVE" | "OPEN_ENDED" | "INTERRUPTED" | "WAITING_FOR_USER";

export interface ConversationThread {
  id: string;
  topic: string;
  status: ConversationThreadStatus;
  importance: number;
  unresolvedPoints: string[];
  openQuestions: string[];
  lastUserStatement: string | null;
  lastSiyaStatement: string | null;
  interruptedThoughts: string[];
  possibleFollowups: string[];
  lastUserAt: number | null;
  lastSiyaAt: number | null;
  activeUntil: number;
  autonomousTurnsSinceUser: number;
}

export type SocialSilenceType =
  | "USER_AWAY"
  | "WORKING_SILENCE"
  | "NATURAL_END"
  | "AWKWARD_UNRESOLVED_SILENCE"
  | "CONVERSATIONAL_PAUSE"
  | "THINKING_SILENCE";

// TODO: "social" is a guess for the fallback/default branch in autonomousMind.ts's
// eventTypeFor()/reasonForOrigin() — the original name for that origin could not
// be recovered (every other branch is confirmed by an explicit string match).
export type ThoughtOrigin = "curiosity" | "memory" | "unfinished_thread" | "goal" | "reflection" | "social";

export interface ThoughtCandidate {
  id: string;
  createdAt: number;
  origin: ThoughtOrigin;
  content: string;
  relevance: number;
  novelty: number;
  urgency: number;
  socialValue: number;
  confidence: number;
  relatedTopic?: string;
  relatedMemoryIds?: string[];
  expiresAt: number;
  suggestedAction?: "DROP" | "REMEMBER" | "WAIT" | "SPEAK" | "ASK" | "SUGGEST" | "ACT" | "REVISIT_LATER";
}

export interface CognitionCounters {
  cognitiveTicks: number;
  deepCognitiveMoments: number;
  internalThoughtsGenerated: number;
  internalThoughtsDropped: number;
  autonomousSpeechAttempts: number;
  autonomousSpeechCompleted: number;
  autonomousSpeechInterrupted: number;
  repetitionSuppressed: number;
}

export interface SocialOpportunity {
  score: number;
  reason: string;
  userAvailability: number;
  topicRelevance: number;
  novelty: number;
  interruptionCost: number;
  continuationValue: number;
}
