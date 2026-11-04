"use client";

import Link from "next/link";
import { BotImport } from "@/app/bot/import-panel";
import { Reveal } from "../fx";

// A source is connected to the person's account only after they approve it.
// No imported memory is silently copied into shared Worlds or sent to a model.
export function ContextStep({ signedIn, botReady }: { signedIn: boolean; botReady: boolean }) {
  return (
    <Reveal className="flex flex-col gap-5">
      <p className="text-sm leading-6 text-muted">
        Your AI can change. Your context stays with you in SOLVE. Bring over what
        matters so you do not have to start over when you switch models.
      </p>

      <div className="rounded-xl border border-line bg-surface/70 p-4">
        <h2 className="text-base font-medium">Connect your existing knowledge</h2>
        <p className="mt-2 text-xs leading-5 text-muted">
          Your SOV Passport holds facts, projects, and permissions. Connect it
          when you want your AI to use that context. Approval happens on your
          passport, and you can revoke the connection later.
        </p>
        {signedIn ? (
          <Link href="/bot?section=knowledge" target="_blank" rel="noopener noreferrer"
            className="mt-3 inline-block text-sm text-accent underline">
            Connect or review your SOV Passport
          </Link>
        ) : (
          <p className="mt-2 text-xs text-muted">
            Save an account and AI to connect your passport or import private history.
            You can continue onboarding as a guest.
          </p>
        )}
      </div>

      {signedIn && botReady ? (
        <BotImport botName="your AI" />
      ) : (
        <div className="rounded-xl border border-line bg-surface/70 p-4">
          <h2 className="text-sm font-medium">Bring over selected conversations</h2>
          <p className="mt-2 text-xs leading-5 text-muted">
            Upload a ChatGPT data export once your AI is saved to your account.
            Preview and choose the conversations worth keeping. Nothing is imported
            just by visiting this step.
          </p>
          <Link href="/bot?section=persona" target="_blank" rel="noopener noreferrer"
            className="mt-2 inline-block text-sm text-accent underline">
            {signedIn ? "Save your AI to enable imports" : "Review account and AI setup"}
          </Link>
        </div>
      )}

      <div className="rounded-xl border border-line bg-surface/70 p-4">
        <h2 className="text-sm font-medium">Connect other AI tools</h2>
        <p className="mt-2 text-xs leading-5 text-muted">
          Claude and ChatGPT can be authorized through SOLVE's existing MCP
          connection flow where supported. This does not automatically import
          their private chat history. Muse and future providers can use the same
          context contract as integrations become available.
        </p>
        <Link href="/bot?section=connections" target="_blank" rel="noopener noreferrer"
          className="mt-2 inline-block text-sm text-accent underline">
          Review connections and permissions
        </Link>
      </div>

      <p className="text-xs leading-5 text-muted">
        Your private context stays private to your account and explicitly
        authorized assistants. Shared Worlds use only their own documents,
        decisions, and messages unless you separately choose to share something.
      </p>
    </Reveal>
  );
}
