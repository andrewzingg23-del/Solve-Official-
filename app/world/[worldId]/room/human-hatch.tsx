// The human hatch, client side: a visible way to reach a person. It uses the
// deployment's support address when one is set and says so honestly when none
// is — nothing is ever sent nowhere, and no fake human is offered.
"use client";

// Set SUPPORT_EMAIL on the deployment (mirrored to NEXT_PUBLIC_SUPPORT_EMAIL
// for the browser; a plain server env var is invisible to client code).
const EMAIL =
  (process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? process.env.SUPPORT_EMAIL ?? "").trim();

export function HumanHatch() {
  return (
    <div className="flex items-center px-1">
      {EMAIL ? (
        <a
          href={`mailto:${EMAIL}`}
          className="inline-flex min-h-11 items-center text-xs text-accent underline-offset-2 hover:underline"
        >
          Talk to a person
        </a>
      ) : (
        <p className="text-xs leading-5 text-muted">
          Talk to a person — human help isn&apos;t set up yet, nothing was sent.
        </p>
      )}
    </div>
  );
}
