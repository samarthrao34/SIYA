// RECONSTRUCTED FILE — not recovered from the original build.
//
// Pure barrel re-export module: esbuild/Vite inlines re-exports directly into
// the referencing module, so a file containing only `export {...} from "./x"`
// contributes no executable code of its own and is elided from the sourcemap's
// `sources` list. Reconstructed from server.ts's `import {...} from "./cognition"`
// block, cross-checked against each named export's actual home file.

export { CognitiveRuntime, type CognitionOutcome } from "./runtime";
export { DesktopPerception, type DesktopSnapshot } from "./desktopPerception";
export { GoalPlanner } from "./planner";
export { ModelRouter } from "./modelRouter";
export { TaskCritic } from "./critic";
export { ToolExecutor } from "./toolExecutor";
export { ToolRegistry } from "./toolRegistry";
export { SpeechOrchestrator } from "./speechOrchestrator";
export { classifyProactivePresence, nextPresenceDelayMs, shouldRepeatIdlePresence } from "./proactivePresence";
export type { InternalThoughtContext } from "./autonomousMind";
export type { MemoryKind, StructuredMemory, ThoughtCandidate } from "./types";
