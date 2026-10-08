// ARGUS v5 — holographic panel interaction module.
// Brief authored for gpt-6-astra; OpenAI API had zero credits (429
// insufficient_quota, key valid), so the brief was executed directly.
// The loop stays staged at /tmp/argus-v5-brief.md + /tmp/argus_v5_gen.py.

export const HOLO_INFLUENCE_RADIUS = 140; // px — pointer proximity field
export const HOLO_MAX_TILT_DEG = 8; // panels tilt toward the pointer, max
export const HOLO_FOCUS_SCALE = 1.32; // focused panel magnification
export const HOLO_PULSE_DECAY_MS = 320; // core pulse exponential time constant
export const HOLO_TICK_MS = 380; // stagger between vet-gate checks
export const HOLO_RELEASE_MS = 2600; // auto-release after sequence completes

export const HOLO_CSS = `
.holo-panel {
  --holo-glow: 0;
  position: absolute;
  left: 0;
  top: 0;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(10,20,34,0.72), rgba(6,12,22,0.55));
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
  backdrop-filter: blur(14px) saturate(1.2);
  box-shadow:
    0 0 calc(24px + var(--holo-glow) * 34px) rgba(34,211,238, calc(0.12 + var(--holo-glow) * 0.26)),
    inset 0 0 18px rgba(34,211,238,0.05);
  cursor: pointer;
  transition: box-shadow 160ms ease-out;
  transform-style: preserve-3d;
}
.holo-panel::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(135deg,
    rgba(var(--holo-edge, 34,211,238), calc(0.28 + var(--holo-glow) * 0.5)),
    rgba(var(--holo-edge, 34,211,238), 0.08) 40%,
    rgba(var(--holo-edge, 34,211,238), calc(0.16 + var(--holo-glow) * 0.3)));
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  pointer-events: none;
}
.holo-panel::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: repeating-linear-gradient(0deg, transparent 0 3px, rgba(180,240,255,0.05) 3px 4px);
  pointer-events: none;
  animation: holo-scan 7s linear infinite;
}
@keyframes holo-scan {
  from { background-position: 0 0; }
  to { background-position: 0 56px; }
}
.holo-panel .holo-corners {
  position: absolute;
  inset: 5px;
  border-radius: 6px;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(var(--holo-edge, 34,211,238),0.7), rgba(var(--holo-edge, 34,211,238),0.7)),
    linear-gradient(rgba(var(--holo-edge, 34,211,238),0.7), rgba(var(--holo-edge, 34,211,238),0.7)),
    linear-gradient(rgba(var(--holo-edge, 34,211,238),0.7), rgba(var(--holo-edge, 34,211,238),0.7)),
    linear-gradient(rgba(var(--holo-edge, 34,211,238),0.7), rgba(var(--holo-edge, 34,211,238),0.7)),
    linear-gradient(rgba(var(--holo-edge, 34,211,238),0.7), rgba(var(--holo-edge, 34,211,238),0.7)),
    linear-gradient(rgba(var(--holo-edge, 34,211,238),0.7), rgba(var(--holo-edge, 34,211,238),0.7)),
    linear-gradient(rgba(var(--holo-edge, 34,211,238),0.7), rgba(var(--holo-edge, 34,211,238),0.7)),
    linear-gradient(rgba(var(--holo-edge, 34,211,238),0.7), rgba(var(--holo-edge, 34,211,238),0.7));
  background-size: 10px 1px, 1px 10px, 10px 1px, 1px 10px, 10px 1px, 1px 10px, 10px 1px, 1px 10px;
  background-position: 0 0, 0 0, 100% 0, 100% 0, 0 100%, 0 100%, 100% 100%, 100% 100%;
  background-repeat: no-repeat;
  opacity: calc(0.35 + var(--holo-glow) * 0.65);
}
.holo-panel.holo-focus {
  --holo-glow: 1;
  background: linear-gradient(135deg, rgba(14,28,46,0.85), rgba(8,16,30,0.68));
  box-shadow:
    0 0 58px rgba(34,211,238,0.32),
    inset 0 0 26px rgba(34,211,238,0.10);
}
.holo-panel.holo-focus::before {
  background: linear-gradient(135deg,
    rgba(34,211,238,1.0),
    rgba(34,211,238,0.25) 40%,
    rgba(34,211,238,0.6));
}
@media (prefers-reduced-motion: reduce) {
  .holo-panel::after { animation: none; }
  .holo-panel { transition: none; }
}
/* vet-gate checklist: rendered always, revealed only on focus (no React state) */
.holo-checks, .holo-note { display: none; }
.holo-panel.holo-focus .holo-checks { display: block; }
.holo-panel.holo-focus .holo-note { display: block; }
`;

// --- proximity + tilt -------------------------------------------------------

export interface PanelPose {
  glow: number; // 0..1
  tiltX: number; // degrees, panel faces toward pointer vertically
  tiltY: number; // degrees, panel faces toward pointer horizontally
}

export function computePanelPose(
  cx: number,
  cy: number,
  pointer: { x: number; y: number } | null,
  R: number = HOLO_INFLUENCE_RADIUS
): PanelPose {
  if (!pointer) return { glow: 0, tiltX: 0, tiltY: 0 };
  const dx = pointer.x - cx;
  const dy = pointer.y - cy;
  const d = Math.min(1, Math.hypot(dx, dy) / R);
  const glow = Math.pow(1 - d, 1.6);
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  return {
    glow,
    tiltX: -HOLO_MAX_TILT_DEG * clamp(dy / R) || 0, // || 0 normalizes -0
    tiltY: HOLO_MAX_TILT_DEG * clamp(dx / R) || 0,
  };
}

// --- focus state machine (vet-gate sequence) ---------------------------------

export type CheckId = "liquidity" | "holders" | "contract";
export type CheckStatus = "wait" | "active" | "done";

export interface CheckState {
  id: CheckId;
  label: string;
  status: CheckStatus;
}

export interface FocusState {
  focused: number | null;
  checks: CheckState[];
}

const CHECK_DEFS: Array<{ id: CheckId; label: string }> = [
  { id: "liquidity", label: "LIQUIDITY" },
  { id: "holders", label: "HOLDERS" },
  { id: "contract", label: "CONTRACT" },
];

export function createFocusMachine(callbacks: {
  onPulse: () => void;
  onChange?: (s: FocusState) => void;
}) {
  let focused: number | null = null;
  let elapsed = 0;
  let fired = -1; // last check index transitioned to active/done

  const snapshot = (): FocusState => ({
    focused,
    checks: CHECK_DEFS.map((c, i) => ({
      ...c,
      status: (focused === null
        ? "wait"
        : i < fired
          ? "done"
          : i === fired
            ? elapsed >= (i + 1) * HOLO_TICK_MS
              ? "done"
              : "active"
            : "wait") as CheckStatus,
    })),
  });

  const emit = () => callbacks.onChange?.(snapshot());

  function focus(i: number | null) {
    if (i === focused) {
      // tapping the focused panel releases it
      focused = null;
      elapsed = 0;
      fired = -1;
      emit();
      return;
    }
    focused = i;
    elapsed = 0;
    fired = -1;
    if (i !== null) callbacks.onPulse();
    emit();
  }

  // dtMs-driven: the host rAF loop calls this; no timers, pauses with the loop.
  function tick(dtMs: number) {
    if (focused === null) return;
    elapsed += dtMs;
    const stage = Math.floor(elapsed / HOLO_TICK_MS); // 0..3 → checks active/done
    if (stage !== fired) {
      fired = Math.min(stage, 3);
      emit();
    }
    if (elapsed >= 3 * HOLO_TICK_MS + (HOLO_RELEASE_MS - 3 * HOLO_TICK_MS)) {
      focus(null);
    }
  }

  // Reduced-motion path: no loop ticks, so resolve the sequence instantly.
  function resolveInstant() {
    if (focused === null) return;
    fired = 3;
    elapsed = 3 * HOLO_TICK_MS;
    emit();
  }

  return { focus, tick, resolveInstant, state: snapshot };
}

// --- core pulse --------------------------------------------------------------

export function createPulse() {
  const ref = { value: 0 };
  return {
    ref,
    trigger() {
      ref.value = 1;
    },
    decay(dtMs: number) {
      if (ref.value <= 0) return;
      ref.value *= Math.exp(-dtMs / HOLO_PULSE_DECAY_MS);
      if (ref.value < 0.01) ref.value = 0;
    },
  };
}
