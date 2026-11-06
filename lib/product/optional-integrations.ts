// Provider discovery is not authorization. These entries are displayed during optional onboarding.
// A service may be selected without being connected, and a connected account still needs scoped grants.
export type OptionalIntegration = {
  id: string;
  name: string;
  category: "AI" | "Work" | "Social" | "Media" | "Business" | "Devices";
  description: string;
  setup: "guided_mcp" | "adapter_required" | "public_embed";
  setupHref?: string;
};

export const OPTIONAL_INTEGRATIONS: readonly OptionalIntegration[] = [
  { id: "chatgpt", name: "ChatGPT", category: "AI", description: "Use SOV from compatible custom MCP apps.", setup: "guided_mcp", setupHref: "/bot?section=connections" },
  { id: "claude", name: "Claude", category: "AI", description: "Connect a compatible assistant through SOV's existing MCP endpoint.", setup: "guided_mcp", setupHref: "/bot?section=connections" },
  { id: "openai-api", name: "OpenAI API", category: "AI", description: "Model inference needs an authorized provider key and a metered adapter.", setup: "adapter_required" },
  { id: "anthropic-api", name: "Anthropic API", category: "AI", description: "Model inference requires an authorized provider configuration.", setup: "adapter_required" },
  { id: "github", name: "GitHub", category: "Work", description: "Repositories, issues and development workflows.", setup: "adapter_required" },
  { id: "drive", name: "Google Drive", category: "Work", description: "File selection and approved document access.", setup: "adapter_required" },
  { id: "microsoft", name: "Microsoft 365", category: "Work", description: "Documents, email and calendar where permitted.", setup: "adapter_required" },
  { id: "notion", name: "Notion", category: "Work", description: "Pages, databases and project knowledge.", setup: "adapter_required" },
  { id: "figma", name: "Figma", category: "Work", description: "Design files and supported design operations.", setup: "adapter_required" },
  { id: "slack", name: "Slack", category: "Work", description: "Approved conversations and project updates.", setup: "adapter_required" },
  { id: "zoom", name: "Zoom", category: "Work", description: "Supported meetings and collaboration actions.", setup: "adapter_required" },
  { id: "dropbox", name: "Dropbox", category: "Work", description: "User-selected files and folders.", setup: "adapter_required" },
  { id: "instagram", name: "Instagram", category: "Social", description: "Public presence and supported creator tools.", setup: "adapter_required" },
  { id: "tiktok", name: "TikTok", category: "Social", description: "Supported published content and creator operations.", setup: "adapter_required" },
  { id: "x", name: "X", category: "Social", description: "Supported public content and approved actions.", setup: "adapter_required" },
  { id: "discord", name: "Discord", category: "Social", description: "Community channels and supported interactions.", setup: "adapter_required" },
  { id: "linkedin", name: "LinkedIn", category: "Social", description: "Professional public identity and supported APIs.", setup: "adapter_required" },
  { id: "youtube", name: "YouTube", category: "Media", description: "Public video embeds; account actions require a separate connector.", setup: "public_embed" },
  { id: "spotify", name: "Spotify", category: "Media", description: "Supported embedded media; private data requires authorization.", setup: "public_embed" },
  { id: "adobe", name: "Adobe", category: "Media", description: "Creative workflows and compatible provider tools.", setup: "adapter_required" },
  { id: "shopify", name: "Shopify", category: "Business", description: "Commerce and order workflows when authorized.", setup: "adapter_required" },
  { id: "stripe", name: "Stripe", category: "Business", description: "Payments and merchant operations require dedicated review.", setup: "adapter_required" },
  { id: "hubspot", name: "HubSpot", category: "Business", description: "CRM and customer workflows.", setup: "adapter_required" },
  { id: "maps", name: "Maps and places", category: "Devices", description: "Location-aware capabilities require scoped user consent.", setup: "adapter_required" },
  { id: "smart-home", name: "Connected home", category: "Devices", description: "Physical-device operations require verified adapters and explicit approval.", setup: "adapter_required" },
] as const;

export const OPTIONAL_INTEGRATION_CATEGORIES = ["AI", "Work", "Social", "Media", "Business", "Devices"] as const;

export function connectionStateLabel(integration: OptionalIntegration): string {
  if (integration.setup === "guided_mcp") return "Guided setup available";
  if (integration.setup === "public_embed") return "Public embeds supported";
  return "Connector requires configuration";
}
