// RECONSTRUCTED FILE — not recovered from the original build.
//
// Type-only import (`import { Memory, MemoryTransaction } from "./src/lib/memoryTypes"`
// in server.ts/server_memory.ts), erased from the bundle before the sourcemap was
// captured. The `category` union below is recovered with high confidence from the
// literal `enum` list in the Gemini structured-output schema in server_memory.ts
// (the memory-consolidation prompt), not inferred/guessed.

export interface Memory {
  id: string;
  category: "identity" | "preference" | "goal" | "project" | "relationship" | "emotional" | "behavior";
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryTransaction {
  action: "ADD" | "UPDATE" | "REMOVE";
  id?: string;
  category: Memory["category"];
  text: string;
}
