// Who vouches for a save, in plain words. The kernel's evidence basis says how far a save can be
// trusted; people read it as whose word it is. Shared by the connector and app/save-point.tsx, so
// it has no server-only imports.
import type { EvidenceBasis } from "@/lib/kernel/client";

// "On your word", "On Ana's word", "Seen by you", "Verified".
export function vouch(basis: EvidenceBasis, who = "you"): string {
  const whose = who === "you" ? "your" : `${who}'s`;
  switch (basis) {
    case "self_reported":
      return `On ${whose} word`;
    case "witnessed":
      return `Seen by ${who}`;
    case "artifact":
      return "With the record attached";
    case "system_observed":
      return "Seen by solve";
    case "externally_verified":
      return "Verified";
    default:
      return "Saved";
  }
}

// A save's number is its place in the record: the kernel event's sequence number.
export const saveNumber = (n: number) => `No. ${n}`;
