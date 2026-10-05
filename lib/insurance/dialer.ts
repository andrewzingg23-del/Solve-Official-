// The agent's dialer: what happens after every call. Each outcome sets the next steps, so no lead is
// forgotten and no promise is dropped. The rules keep the law in them: calls and texts only between
// 8am and 9pm in the lead's own time zone (TCPA quiet hours), texts only with the lead's written
// consent, and do-not-call ends all contact for good.

export type Disposition = "no_answer" | "voicemail" | "callback" | "appointment" | "sold" | "not_interested" | "do_not_call";
export type ActionKind = "call" | "text" | "email" | "task" | "stop";
export type Action = { at: string; kind: ActionKind; what: string };
export type LeadState = { attempts: number; timeZone: string; textConsent: boolean };

export const DISPOSITIONS: { id: Disposition; label: string }[] = [
  { id: "no_answer", label: "No answer" },
  { id: "voicemail", label: "Left voicemail" },
  { id: "callback", label: "Call back" },
  { id: "appointment", label: "Appointment set" },
  { id: "sold", label: "Sold" },
  { id: "not_interested", label: "Not interested" },
  { id: "do_not_call", label: "Do not call" },
];

export const MAX_ATTEMPTS = 3;
export const CALLING_HOURS = { from: 8, to: 21 } as const; // local to the lead

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// Minutes the time zone is ahead of UTC at that moment.
function offsetMinutes(timeZone: string, at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - at.getTime()) / 60_000);
}

export function localHour(timeZone: string, at: Date): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", hour: "2-digit" }).format(at));
}

export const callableNow = (timeZone: string, at: Date) => {
  const h = localHour(timeZone, at);
  return h >= CALLING_HOURS.from && h < CALLING_HOURS.to;
};

// The moment `daysAhead` days from `at`, at a local hour in the lead's time zone.
export function atLocal(timeZone: string, at: Date, daysAhead: number, hour: number): Date {
  const shifted = new Date(at.getTime() + offsetMinutes(timeZone, at) * 60_000 + daysAhead * DAY);
  const wall = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), hour, 0, 0);
  return new Date(wall - offsetMinutes(timeZone, new Date(wall)) * 60_000);
}

// Moves a moment into calling hours: the same moment if allowed, else 8am the next allowed morning.
export function inCallingHours(timeZone: string, at: Date): Date {
  const h = localHour(timeZone, at);
  if (h >= CALLING_HOURS.from && h < CALLING_HOURS.to) return at;
  return atLocal(timeZone, at, h >= CALLING_HOURS.to ? 1 : 0, CALLING_HOURS.from);
}

// What the dialer schedules after a call ends.
export function nextSteps(d: Disposition, lead: LeadState, now: Date, when?: { callbackAt?: Date; appointmentAt?: Date }): Action[] {
  const tz = lead.timeZone;
  const reach = (at: Date) => inCallingHours(tz, at).toISOString();
  const out: Action[] = [];
  const text = (at: Date, what: string) => {
    if (lead.textConsent) out.push({ at: reach(at), kind: "text", what });
  };
  switch (d) {
    case "no_answer":
    case "voicemail": {
      const attempt = lead.attempts + 1;
      if (attempt < MAX_ATTEMPTS) {
        const retry = attempt === 1 ? new Date(now.getTime() + 2 * HOUR) : atLocal(tz, now, 1, 18);
        out.push({ at: reach(retry), kind: "call", what: `Call again (attempt ${attempt + 1} of ${MAX_ATTEMPTS})` });
        text(now, "Sorry I missed you. When's a good time to talk about your coverage?");
      } else {
        out.push({ at: atLocal(tz, now, 7, 10).toISOString(), kind: "email", what: "Move to the follow-up list: a check-in email in a week, no more calls" });
      }
      break;
    }
    case "callback": {
      const at = when?.callbackAt ?? atLocal(tz, now, 1, 10);
      out.push({ at: reach(at), kind: "call", what: "Call back, as promised" });
      break;
    }
    case "appointment": {
      const at = when?.appointmentAt ?? atLocal(tz, now, 1, 18);
      text(now, "Confirmed: your coverage review. Reply C to confirm or R to reschedule.");
      text(new Date(at.getTime() - DAY), "Reminder: your coverage review is tomorrow.");
      text(new Date(at.getTime() - HOUR), "See you in an hour for your coverage review.");
      out.push({ at: new Date(at.getTime() - HOUR).toISOString(), kind: "task", what: "Prepare quotes for the appointment" });
      out.push({ at: at.toISOString(), kind: "call", what: "The appointment" });
      break;
    }
    case "sold": {
      out.push({ at: now.toISOString(), kind: "task", what: "Submit the application today" });
      text(now, "Welcome. Your application is in; I'll call when the policy is approved.");
      out.push({ at: reach(atLocal(tz, now, 14, 11)), kind: "call", what: "Policy delivery call" });
      out.push({ at: reach(atLocal(tz, now, 365, 11)), kind: "call", what: "Annual review" });
      break;
    }
    case "not_interested":
      out.push({ at: atLocal(tz, now, 90, 10).toISOString(), kind: "email", what: "A check-in email in 90 days; no calls" });
      break;
    case "do_not_call":
      out.push({ at: now.toISOString(), kind: "stop", what: "Added to do-not-call: every call, text and email stops for good" });
      break;
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}
