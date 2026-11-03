# Draft save reliability

Goal: authorized creation produces a confirmed, reopenable result or a recoverable error, never a false save.

Continue on isolated branch codex/draft-save-reliability from verified preview commit 56afea1. Original uncommitted checkout remains untouched. Use real migrated-kernel action tests; stub only framework/Auth and provider transport.

- Reproduce and pin: viewer inference, oversized submitted goals, unrelated conflicts, existing output without provider key, truncated output, escaped attribute overflow and body-read timeout.
- Reuse current World grants for pre-inference write access; retain kernel enforcement on persistence and account binding. Validate goal length before inference. Move provider key requirement after authorized existing-output lookup.
- Recognize duplicate-save conflict only when an authorized read confirms saved output. Keep other conflicts recoverable failures. Validate escaped document attributes for both create and revise before kernel writes; no migration.
- Integrate existing truncation/escaped-output/body-timeout fixes and verify regression tests fail before changing code.
- Run focused/full checks and desktop/mobile preview regression; push a review branch/stacked PR; inspect the exact staging deployment and run the existing browser journey where permitted.

No paid-model activation, secrets export, production merge or database schema change. Browser evidence must distinguish real provider output from transport fixtures and record failed attempts.
