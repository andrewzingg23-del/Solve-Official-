import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import type { Persona } from "@/lib/bot/persona";
import { readConnections, readMemories, type Connection, type Memory } from "@/lib/bot/memory";
import { getPersonalBot } from "@/lib/product/identity-server";
import { AiWork } from "./work-panel";
import { accessFrom, botGrantsIn } from "@/lib/bot/worlds";
import { listCreativeWorlds } from "@/lib/world/creative";
import { KernelError, type Kernel } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { Icon } from "@/app/product/icons";
import { Connections, Knowledge } from "./connections";
import { BotImport } from "./import-panel";
import { AgentContract } from "./contract";
import { RebuiltPersona } from "./rebuilt-persona";
import { ProjectAccess, type ProjectAccessWorld } from "./rebuilt-permissions";
import { RetryAi } from "./rebuilt-retry";
import "./rebuilt-ai.css";
import { PassportPanel, type PassportView } from "./passport-panel";
import { PassportError, passportUrl, projectsFrom } from "@/lib/passport/client";
import { withPassport } from "@/lib/passport/link";

export const metadata: Metadata = { title: "Your AI — solve" };

const SECTIONS = [
  { value: "work", label: "Work" },
  { value: "persona", label: "Appearance & personality" },
  { value: "connections", label: "Connections" },
  { value: "knowledge", label: "Knowledge" },
] as const;
type Section = (typeof SECTIONS)[number]["value"];

type Loaded =
  | { kind: "signed-out" }
  | { kind: "identity" }
  | { kind: "unavailable" }
  | {
      kind: "ready";
      persona: Persona;
      version: number;
      savedAt: string | null;
      exists: boolean;
      ownerId: string;
      botAgentId: string | null;
      connections: Connection[] | null;
      memories: Memory[] | null;
      worlds: ProjectAccessWorld[] | null;
      passport: PassportView;
    };

// The passport panel: whether solve is linked, and the ventures the passport holds.
async function readPassport(kernel: Kernel, ownerId: string): Promise<PassportView> {
  try {
    const projects = await withPassport(kernel, ownerId, async (call) => projectsFrom(await call("list_projects")));
    return projects === null ? { kind: "unlinked" } : { kind: "linked", projects };
  } catch (error) {
    if (error instanceof PassportError && error.code === "reconnect") return { kind: "reconnect" };
    return { kind: "linked", projects: null };
  }
}

// A failed permission read must not look like a project with no access.
async function readProjectAccess(kernel: Kernel, agentId: string): Promise<ProjectAccessWorld[]> {
  const [worlds, grants] = await Promise.all([listCreativeWorlds(kernel), kernel.myGrants()]);
  return Promise.all(worlds.map(async (world) => ({
    ...world,
    access: accessFrom(await botGrantsIn(kernel, world.scope, agentId)),
    canManage: grants.some((grant) => grant.scope === world.scope && grant.capability === "*"),
    url: `/world/${world.worldId}`,
  })));
}

async function load(section: Section): Promise<Loaded> {
  try {
    if (!(await getUser())) return { kind: "signed-out" };
    const kernel = await getKernel();
    const bot = await getPersonalBot();
    let connections: Connection[] | null = null;
    let memories: Memory[] | null = null;
    let worlds: ProjectAccessWorld[] | null = null;
    if (bot.avatar && section === "connections") {
      const [links, projects] = await Promise.allSettled([
        readConnections(kernel, bot.ownerId),
        readProjectAccess(kernel, bot.avatar.agent_id),
      ]);
      connections = links.status === "fulfilled" ? links.value : null;
      worlds = projects.status === "fulfilled" ? projects.value : null;
    }
    let passport: PassportView = { kind: "unlinked" };
    if (bot.avatar && section === "knowledge") {
      [memories, passport] = await Promise.all([readMemories(kernel, bot.ownerId).catch(() => null), readPassport(kernel, bot.ownerId)]);
    }
    return {
      kind: "ready",
      persona: bot.persona,
      version: bot.history.length,
      savedAt: bot.saved?.at ?? null,
      exists: Boolean(bot.avatar),
      ownerId: bot.ownerId,
      botAgentId: bot.avatar?.agent_id ?? null,
      connections,
      memories,
      worlds,
      passport,
    };
  } catch (error) {
    if (error instanceof KernelError && error.name === "unauthenticated") return { kind: "identity" };
    return { kind: "unavailable" };
  }
}

async function connectorUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(?::|$)/.test(host);
  const proto = h.get("x-forwarded-proto") ?? (local ? "http" : "https");
  return `${proto}://${host}/mcp`;
}

export default async function BotPage({ searchParams }: { searchParams?: Promise<{ section?: string | string[]; world_error?: string | string[]; passport?: string | string[] }> }) {
  const params = searchParams ? await searchParams : {};
  const section: Section = params.section === "connections" || params.section === "knowledge" || params.section === "persona" ? params.section : "work";
  const state = await load(section);
  const retry = `/bot?section=${section}`;

  return (
    <main className="solve-page solve-ai-page">
      <header className="solve-page-heading">
        <span className="solve-kicker">Your personal AI</span>
        <h1>Your AI</h1>
        <p>Move your projects forward, keep useful knowledge and choose how your AI works with you.</p>
      </header>

      <nav className="solve-section-nav" aria-label="Your AI sections">
        {SECTIONS.map((item) => (
          <Link key={item.value} href={`/bot?section=${item.value}`} aria-current={section === item.value ? "page" : undefined}>
            {item.label}
          </Link>
        ))}
      </nav>

      {typeof params.world_error === "string" ? (
        <Notice title="Check your projects before trying again" body="The project could not be opened from this page. Review your saved projects, or start a new one from Projects." href="/" action="Open Projects" />
      ) : null}

      {state.kind === "identity" ? (
        <Notice title="Finish your account setup" body="You are signed in, but your account identity is not ready. Open Profile to finish setup before saving your AI or granting access." href="/account" action="Open Profile" retry={retry} />
      ) : state.kind === "unavailable" ? (
        <Notice title="Your AI could not be loaded" body="Your saved persona is unavailable right now. Retry to load it, or open Profile to check your account." href="/account" action="Open Profile" retry={retry} />
      ) : section === "work" ? (
        <AiWork />
      ) : section === "persona" ? (
        <RebuiltPersona
          signedIn={state.kind === "ready"}
          initial={state.kind === "ready" ? state.persona : undefined}
          version={state.kind === "ready" ? state.version : 0}
          savedAt={state.kind === "ready" ? state.savedAt : null}
          exists={state.kind === "ready" && state.exists}
          ownerId={state.kind === "ready" ? state.ownerId : undefined}
        />
      ) : state.kind === "signed-out" ? (
        <section className="solve-empty">
          <Icon name={section === "connections" ? "lock" : "document"} width={30} height={30} />
          <h2>{section === "connections" ? "Authorize your connections" : "Keep your knowledge with your account"}</h2>
          <p>{section === "connections"
            ? "Sign in and save your AI before connecting an assistant. Each connection asks for permission to read, or to read and add."
            : "Private notes and reviewed imports require a signed-in account. Your local persona can be reviewed and saved from Profile."}</p>
          <Link className="solve-button" href="/login?next=%2Faccount">Sign in</Link>
          <Link className="solve-text-link" href="/account">Review your local profile <Icon name="arrow" width={15} /></Link>
        </section>
      ) : !state.exists ? (
        <Notice title="Save your persona first" body="Give your AI a name or change a detail in Persona, then save it to your account. Connections and private knowledge become available after that first save." href="/bot?section=persona" action="Customize your persona" />
      ) : section === "connections" ? (
        <div className="solve-ai-stack">
          {state.connections ? (
            <Connections ownerId={state.ownerId} botName={state.persona.name} connectorUrl={await connectorUrl()} connections={state.connections} />
          ) : (
            <Notice title="Connections could not be loaded" body="The current authorizations are unavailable. Retry to see who has access and revoke a connection." retry={retry} />
          )}
          {state.worlds && state.botAgentId ? (
            <ProjectAccess botName={state.persona.name} botAgentId={state.botAgentId} worlds={state.worlds} />
          ) : (
            <Notice title="Project permissions could not be loaded" body="We could not verify your AI’s current project access. Retry before changing permissions." retry={retry} />
          )}
          {state.connections && state.worlds ? (
            <details className="solve-ai-details">
              <summary>View your AI’s full permission contract</summary>
              <AgentContract botName={state.persona.name} connections={state.connections} worlds={state.worlds} />
            </details>
          ) : null}
        </div>
      ) : (
        <div className="solve-ai-stack">
          {state.memories ? (
            <>
              <Knowledge botName={state.persona.name} memories={state.memories} ownerId={state.ownerId} />
              <details className="solve-ai-details">
                <summary>Import a ChatGPT export</summary>
                <div className="solve-ai-import-note">
                  <p>Import is manual. Upload the conversations.json file from a ChatGPT data export, then review the preview before confirming.</p>
                  <p>Files must be at most 25 MB. An import keeps up to 100 conversations as shortened memories of at most 2,000 characters each. It does not keep attachments or full transcripts, and new chats are not synced.</p>
                  <p>Imported knowledge stays private to your account and assistants you authorize. It is not automatically shared with project members.</p>
                </div>
                <BotImport botName={state.persona.name} />
              </details>
            </>
          ) : (
            <Notice title="Private knowledge could not be loaded" body="Your saved memories are unavailable right now. Retry to review them before adding or erasing knowledge." retry={retry} />
          )}
          <details className="solve-ai-details"><summary>Optional Passport integration</summary><PassportPanel view={state.passport} passportUrl={passportUrl()} outcome={typeof params.passport === "string" ? params.passport : undefined} /></details>
        </div>
      )}
    </main>
  );
}

function Notice({ title, body, href, action, retry }: { title: string; body: string; href?: string; action?: string; retry?: string }) {
  return (
    <section className="solve-panel solve-ai-notice" role="status">
      <h2>{title}</h2>
      <p>{body}</p>
      <div className="solve-ai-actions">
        {retry ? <RetryAi /> : null}
        {href && action ? <Link href={href} className="solve-text-link">{action} <Icon name="arrow" width={15} /></Link> : null}
      </div>
    </section>
  );
}
