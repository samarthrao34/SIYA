// Client for Siya's private memory graph ("Samarth ke Papa") -- an isolated
// instance of the user's own deterministic markdown-graph retrieval server
// (brain.js: BM25 + heading/path match + recency + PageRank centrality +
// pointer-hop graph walk over [[wikilinks]], no embeddings, no LLM in the
// retrieval path). Runs on their Tailscale-only server at <private-memory-host>:20141,
// a separate process/port/token/corpus from their other assistants' memory
// (Brahma/Disha/Zara) -- nothing written here is ever visible to those, and
// nothing of theirs is visible here. Reachable only from devices on the same
// tailnet (the phone needs Tailscale signed into the same account), which is
// the privacy boundary: this token alone is not a public secret, but it can
// only be used by a device already inside that private mesh.

const MEMORY_BASE = "http://<private-memory-host>:20141";
// Injected at build time from mobile-app/.env (VITE_SIYA_BRAIN_TOKEN) -- never
// hardcoded in source. See docs/README.md for how to regenerate/rotate it.
const MEMORY_TOKEN = import.meta.env.VITE_SIYA_BRAIN_TOKEN || "";

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${MEMORY_TOKEN}`, "Content-Type": "application/json" };
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "note";
}

export interface MemoryCard {
  title: string;
  content: string;
  tags?: string[];
  pinned?: boolean;
}

const PROFILE_PATH = "people/samarth-ke-papa.md";

/** Shared ingest+reindex, used by both a fresh event card and a profile merge. */
async function ingestAndReindex(path: string, content: string): Promise<{ ok: boolean; error?: string }> {
  const ingestRes = await fetch(`${MEMORY_BASE}/ingest`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ path, content }),
    signal: AbortSignal.timeout(8000),
  });
  if (!ingestRes.ok) {
    const text = await ingestRes.text().catch(() => "");
    console.error(`[Memory] ingest failed: HTTP ${ingestRes.status} ${text}`);
    return { ok: false, error: `ingest ${ingestRes.status}` };
  }
  const reindexRes = await fetch(`${MEMORY_BASE}/reindex`, { method: "POST", headers: authHeaders(), signal: AbortSignal.timeout(15000) }).catch((err) => {
    console.error("[Memory] reindex request failed:", err);
    return null;
  });
  if (reindexRes && !reindexRes.ok) console.error(`[Memory] reindex failed: HTTP ${reindexRes.status}`);
  return { ok: true };
}

/** Writes one new event card, auto-linked to the standing profile note, then reindexes. Use for something that happened, not for standing facts about who the person is. */
export async function saveMemoryCard(card: MemoryCard): Promise<{ ok: boolean; path?: string; error?: string }> {
  try {
    const now = new Date();
    const tags = [...new Set(["conversation", ...(card.tags || [])])].map((t) => t.toLowerCase().replace(/[^a-z0-9_-]/g, ""));
    const frontmatter = [
      "---",
      `title: ${card.title.replace(/[:\n]/g, " ").slice(0, 120)}`,
      `tags: [${tags.join(", ")}]`,
      `pinned: ${card.pinned ? "true" : "false"}`,
      `date: ${now.toISOString()}`,
      "---",
    ].join("\n");
    const body = `${card.content.trim()}\n\nRelated: [[people/samarth-ke-papa]]\n`;
    const path = `conversations/${now.toISOString().slice(0, 10)}-${slugify(card.title)}.md`;

    const result = await ingestAndReindex(path, `${frontmatter}\n${body}`);
    if (!result.ok) return { ok: false, error: result.error };
    console.log(`[Memory] saved event card: ${path}`);
    return { ok: true, path };
  } catch (err: any) {
    console.error("[Memory] saveMemoryCard failed:", err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}

const FACTS_HEADING = "## Known facts";

/**
 * Merges one durable fact into the single standing profile note instead of a
 * new card -- this is what keeps the graph from rotting into a dozen
 * near-duplicate "the user's name is..." cards. Skips the write if a very
 * similar line is already there (cheap containment check, not semantic --
 * good enough to stop the obvious repeats, not a real dedup engine).
 */
export async function updateProfileFact(fact: string): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  try {
    const rawRes = await fetch(`${MEMORY_BASE}/raw?path=${encodeURIComponent(PROFILE_PATH)}`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(8000),
    });
    if (!rawRes.ok) {
      console.error(`[Memory] profile fetch failed: HTTP ${rawRes.status}`);
      return { ok: false, error: `raw ${rawRes.status}` };
    }
    const { content: raw } = await rawRes.json();
    const match = /^(---\r?\n[\s\S]*?\r?\n---\r?\n?)([\s\S]*)$/.exec(raw);
    const frontmatter = match ? match[1] : "---\ntitle: Samarth ke Papa\ntags: [profile, person, pinned]\npinned: true\n---\n";
    let body = match ? match[2] : raw;

    const cleanFact = fact.trim().replace(/\s+/g, " ");
    const normalized = cleanFact.toLowerCase();
    const existingLines = body.split("\n").filter((l) => l.trim().startsWith("-"));
    const nearDuplicate = existingLines.some((l) => {
      const line = l.replace(/^-\s*/, "").trim().toLowerCase();
      return line.includes(normalized) || normalized.includes(line);
    });
    if (nearDuplicate) {
      console.log(`[Memory] profile fact skipped (already present): ${cleanFact.slice(0, 60)}`);
      return { ok: true, skipped: true };
    }

    const bullet = `- ${cleanFact}`;
    if (body.includes(FACTS_HEADING)) {
      body = body.replace(FACTS_HEADING, `${FACTS_HEADING}\n${bullet}`);
    } else {
      body = `${body.trimEnd()}\n\n${FACTS_HEADING}\n${bullet}\n`;
    }
    const result = await ingestAndReindex(PROFILE_PATH, `${frontmatter}${body}`);
    if (!result.ok) return { ok: false, error: result.error };
    console.log(`[Memory] profile updated: ${cleanFact.slice(0, 60)}`);
    return { ok: true };
  } catch (err: any) {
    console.error("[Memory] updateProfileFact failed:", err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}

export interface RecalledChunk {
  title: string;
  body: string;
  context?: string;
}

/** Graph-aware retrieval: returns only the chunks relevant to `query`, not the whole corpus. */
export async function recallMemory(query: string, budget = 2500): Promise<RecalledChunk[]> {
  try {
    const res = await fetch(`${MEMORY_BASE}/query`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ q: query, budget, depth: 2 }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[Memory] query failed: HTTP ${res.status} ${text}`);
      return [];
    }
    const data = await res.json();
    console.log(`[Memory] recalled ${data.results?.length || 0} chunk(s) for "${query}"`);
    return (data.results || []).map((r: any) => ({ title: r.title, body: r.body, context: r.context }));
  } catch (err) {
    console.error("[Memory] recall failed:", err);
    return [];
  }
}

export function formatRecalledMemory(chunks: RecalledChunk[]): string {
  if (!chunks.length) return "";
  const lines = chunks.map((c) => `- [${c.title}] ${c.body.replace(/\s+/g, " ").slice(0, 500)}`);
  return `RECALLED MEMORY from your private memory graph "Samarth ke Papa" (ground answers in this where relevant -- never invent beyond it, and never mention that this came from a memory lookup):\n${lines.join("\n")}`;
}
