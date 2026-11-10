import { GuestGate } from "@/app/ui/guest-gate";
import type { Metadata } from "next";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { hashConfirmationToken, isPlausibleToken } from "@/lib/product/confirmation-token";
import { fieldsFromType } from "@/lib/product/thing";
import { AnswerForm } from "./answer";

export const metadata: Metadata = { title: "Confirm · SOLVE", robots: { index: false, follow: false } };

// What a person sees when someone sends them a confirmation link. They may never have heard of
// SOLVE and have no account; the proxy gives them an identity on arrival, so their answer is
// attributable to them. Holding the link reveals this one thing and nothing else — the kernel
// guarantees that, and an unknown, malformed or withdrawn link looks identical here.
function Unavailable() {
  return <div className="s-stack" style={{ "--gap": "16px" } as React.CSSProperties}>
    <h1>This link isn&apos;t available.</h1>
    <p className="s-muted">It may have been withdrawn, or the address may be incomplete. Ask the person who sent it for a new one.</p>
  </div>;
}

export default async function ConfirmPage({ params }: PageProps<"/confirm/[token]">) {
  const { token } = await params;
  if (!isPlausibleToken(token)) return <Unavailable />;
  const user = await getUser();
  if (!user) return <GuestGate />;

  let request: Awaited<ReturnType<Awaited<ReturnType<typeof getKernel>>["readConfirmationRequest"]>>;
  try {
    request = await (await getKernel()).readConfirmationRequest(hashConfirmationToken(token));
  } catch {
    return <Unavailable />;
  }

  const askedBy = request.asked_by?.trim() || "Someone";
  const fields = fieldsFromType(null, request.thing?.data ?? {}).filter(field => field.present);

  return <div className="s-stack" style={{ "--gap": "28px" } as React.CSSProperties}>
    <header className="s-stack" style={{ "--gap": "14px" } as React.CSSProperties}>
      <span className="s-label">Asked to confirm</span>
      <h1>{askedBy} asked you to confirm something.</h1>
      {request.question ? <p style={{ fontSize: 19 }}>“{request.question}”</p> : null}
    </header>

    <section className="s-surface s-stack" aria-labelledby="confirm-thing">
      <span className="s-label" id="confirm-thing">What it is</span>
      <h2>{request.thing?.title ?? "Untitled"}</h2>
      {request.thing?.summary && request.thing.summary !== request.thing.title ? <p>{request.thing.summary}</p> : null}
      {fields.length
        ? <dl className="s-stack" style={{ "--gap": "10px" } as React.CSSProperties}>{fields.map(field => <div key={field.name}>
            <dt className="s-muted s-small">{field.label}</dt><dd>{String(field.value)}</dd>
          </div>)}</dl>
        : null}
      <p className="s-muted s-small">Asked of: {request.asked_of || "you"}</p>
    </section>

    <section className="s-stack" aria-labelledby="confirm-answer">
      <span className="s-label" id="confirm-answer">Your answer</span>
      {request.answered
        ? <p role="status">{request.answered_by_you ? "You answered" : "This was already answered"}: <strong>{request.decision}</strong>{request.answered_at ? ` on ${request.answered_at.slice(0, 10)}` : ""}. An answer can&apos;t be changed.</p>
        : request.expired
          ? <p role="status">This request has expired. Ask {askedBy} for a new link.</p>
          : <AnswerForm token={token} askedBy={askedBy} />}
    </section>
  </div>;
}
