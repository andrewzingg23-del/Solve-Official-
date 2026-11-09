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
  return <main className="solve-page solve-confirm">
    <h1>This link isn&apos;t available.</h1>
    <p>It may have been withdrawn, or the address may be incomplete. Ask the person who sent it for a new one.</p>
  </main>;
}

export default async function ConfirmPage({ params }: PageProps<"/confirm/[token]">) {
  const { token } = await params;
  if (!isPlausibleToken(token)) return <Unavailable />;
  const user = await getUser();
  if (!user) return <Unavailable />;

  let request: Awaited<ReturnType<Awaited<ReturnType<typeof getKernel>>["readConfirmationRequest"]>>;
  try {
    request = await (await getKernel()).readConfirmationRequest(hashConfirmationToken(token));
  } catch {
    return <Unavailable />;
  }

  const askedBy = request.asked_by?.trim() || "Someone";
  const fields = fieldsFromType(null, request.thing?.data ?? {}).filter(field => field.present);

  return <main className="solve-page solve-confirm">
    <header className="solve-page-heading">
      <span className="solve-kicker">Asked to confirm</span>
      <h1>{askedBy} asked you to confirm something.</h1>
      {request.question ? <p className="solve-confirm-question">“{request.question}”</p> : null}
    </header>

    <section className="solve-panel" aria-labelledby="confirm-thing">
      <span className="solve-kicker" id="confirm-thing">What it is</span>
      <h2 className="mt-3">{request.thing?.title ?? "Untitled"}</h2>
      {request.thing?.summary ? <p className="mt-2">{request.thing.summary}</p> : null}
      {fields.length
        ? <dl className="solve-field-list mt-3">{fields.map(field => <div key={field.name} className="solve-field">
            <dt>{field.label}</dt><dd>{String(field.value)}</dd>
          </div>)}</dl>
        : null}
      <p className="solve-muted mt-3">Asked of: {request.asked_of || "you"}</p>
    </section>

    <section className="solve-panel mt-6" aria-labelledby="confirm-answer">
      <span className="solve-kicker" id="confirm-answer">Your answer</span>
      {request.answered
        ? <p className="mt-3" role="status">{request.answered_by_you ? "You answered" : "This was already answered"}: <strong>{request.decision}</strong>{request.answered_at ? ` on ${request.answered_at.slice(0, 10)}` : ""}. An answer can&apos;t be changed.</p>
        : request.expired
          ? <p className="mt-3" role="status">This request has expired. Ask {askedBy} for a new link.</p>
          : <AnswerForm token={token} askedBy={askedBy} />}
    </section>
  </main>;
}
