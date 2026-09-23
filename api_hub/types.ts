// RECONSTRUCTED FILE — not recovered from the original build.
//
// Type-only module, erased from the bundle by esbuild/Vite before the sourcemap
// was captured. Shapes below were inferred from usage across api_hub/*.ts (all
// of which ARE original, recovered verbatim from server.cjs.map).

// ---------------------------------------------------------------------------
// Providers (public-apis catalogue)
// ---------------------------------------------------------------------------

export type ApiAuthType = "unknown" | "none" | "oauth" | "apiKey" | "custom";
export type TernarySupport = "yes" | "no" | "unknown";

export type ApiProviderStatus =
  | "READY_NO_AUTH"
  | "NEEDS_API_KEY"
  | "NEEDS_OAUTH"
  | "UNKNOWN"
  | "UNSUPPORTED"
  | "BROKEN";

export interface ApiProviderHealth {
  state: "unchecked" | "healthy" | "degraded" | "broken";
  checkedAt: string | null;
  statusCode: number | null;
  latencyMs: number | null;
  consecutiveFailures: number;
  error: string | null;
}

export interface ApiProvider {
  id: string;
  name: string;
  description: string;
  category: string;
  documentationUrl: string;
  auth: ApiAuthType;
  authRaw: string;
  https: TernarySupport;
  cors: TernarySupport;
  status: ApiProviderStatus;
  cataloguePresent: boolean;
  source: string;
  firstSeenAt: string;
  updatedAt: string;
  health: ApiProviderHealth;
}

export interface ParsedCatalogue {
  providers: Array<
    Omit<ApiProvider, "firstSeenAt" | "updatedAt" | "health">
  >;
  duplicates: number;
  rejected: number;
}

export interface ApiCatalogueMetadata {
  source: string;
  syncedAt: string | null;
  sourceEtag: string | null;
  sourceLastModified: string | null;
  imported: number;
  duplicates: number;
  rejected: number;
}

export interface ApiCatalogueSummary {
  source: string;
  syncedAt: string | null;
  providerCount: number;
  categories: number;
  statuses: Record<ApiProviderStatus, number>;
  health: Record<ApiProviderHealth["state"], number>;
}

export interface ApiRegistryFile {
  version: 1;
  metadata: ApiCatalogueMetadata;
  providers: ApiProvider[];
}

export interface ApiSearchResult {
  provider: ApiProvider;
  score: number;
  matchedTerms: string[];
}

// ---------------------------------------------------------------------------
// Declarative adapters
// ---------------------------------------------------------------------------

export interface DeclarativeApiAdapterParameter {
  name: string;
  in: "path" | "query" | "header" | "body";
  required?: boolean;
  default?: unknown;
}

export interface DeclarativeApiAdapter {
  id: string;
  providerId: string;
  capability: string;
  method: "GET" | "POST";
  urlTemplate: string;
  credentialEnv?: string;
  credentialHeader?: string;
  credentialPrefix?: string;
  parameters: DeclarativeApiAdapterParameter[];
  output: Record<string, string>;
  verified: boolean;
  verifiedAt?: string | null;
  verificationNotes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiAdapterExecutionResult {
  adapterId: string;
  providerId: string;
  capability: string;
  sourceUrl: string;
  sourceStatus: number;
  timestamp: string;
  data: Record<string, unknown>;
}
