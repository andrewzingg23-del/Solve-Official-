"use client";

import { sendMagicLink } from "@/app/login/actions";
import { Reveal } from "../fx";
import { label, primaryAction } from "@/app/ui";

// Step 1: sign in. Magic link, same as /login. Already signed in → move on.
export function SigninStep({
  signedIn,
  email,
  onNext,
}: {
  signedIn: boolean;
  email: string | null;
  onNext: () => void;
}) {
  if (signedIn) {
    return (
      <Reveal className="glass fx-card flex flex-col gap-4 p-6">
        <p className="text-sm leading-6">
          You&apos;re in{email ? ` as ${email}` : ""}. Everything from here is saved to you.
        </p>
        <button type="button" onClick={onNext} className={primaryAction}>
          Continue
        </button>
      </Reveal>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <Reveal delay={40}>
        <p className="text-sm leading-6 text-muted">
          We email you a link. No password, nothing to remember.
        </p>
      </Reveal>
      <Reveal delay={140}>
        <form action={sendMagicLink} className="glass fx-card flex flex-col gap-4 p-6">
          <input type="hidden" name="next" value="/start?step=sovid" />
          <label htmlFor="ob-email" className={label}>
            Email
          </label>
          <input
            id="ob-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="fx-field h-12 rounded-full border border-line bg-background px-5 outline-none transition-colors placeholder:text-faint focus:border-accent"
          />
          <button type="submit" className={primaryAction}>
            Email me a link
          </button>
        </form>
      </Reveal>
      <Reveal delay={240}>
        <p className="text-xs leading-5 text-faint">
          No account yet — looking is free. Sign in when you want to save anything.
        </p>
      </Reveal>
    </div>
  );
}
