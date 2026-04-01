export interface ProviderCatalogEntry {
  slug: string;
  name: string;
  authMethods: Array<"oauth" | "api_key" | "local">;
}

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    slug: "openai",
    name: "OpenAI",
    authMethods: ["api_key"]
  },
  {
    slug: "anthropic",
    name: "Anthropic",
    authMethods: ["api_key"]
  },
  {
    slug: "google",
    name: "Google",
    authMethods: ["oauth", "api_key"]
  }
];
