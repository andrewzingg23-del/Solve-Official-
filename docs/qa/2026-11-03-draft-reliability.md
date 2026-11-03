# Draft reliability — staging evidence

Application revision: `57230ebc38dc2e7f7d707d684406c5732e05edd5`.
Vercel deployment `dpl_2xMiSdXG5SJC5hsxQSEQ7KDk4CUV` reported READY with that exact SHA; preview: https://solve-7hwjudm97-sovigrn.vercel.app. Main and production were not promoted. Later checkpoint changes affect the browser harness and documentation only.

## What changed

Generation now checks the kernel policy ALLOW decision before inference, including governed/limited authority rather than UI grant flags. Saved output reopens without provider credentials. Unrelated conflicts and unconfirmed save conflicts no longer imply success. Goals/titles are bounded. Truncated output, escaped attribute overflow and response-body timeouts are handled explicitly. Create/revise share recoverable attribute validation; a failed revision preserves its predecessor. The original uncommitted checkout was left untouched.

## Local proof

- Focused action/provider/artifact tests: 34/34.
- Full suite: 545 tests; 544 passed, 1 existing skip, 0 failures.
- Production build and TypeScript passed, 46/46 static pages.
- Lint: 0 errors, 9 existing warnings.
- Real DraftPreview Chromium regression passed at 1280/390 widths with revised source, scripts, forms, top navigation and resource isolation.

The action tests run the real migrated kernel. Framework/Auth and provider transport are explicit fixtures, not model quality evidence. Preserving the shared KernelError identity fixed a weakness in the inherited bundling fixture; conflicts were then reproduced before the fix. The initial focused run reproduced 12 failing test results (including the parent summary), not twelve distinct product defects.

## Live single-attempt generation sample

Model setting checked read-only: `nvidia/nemotron-3.5-super-vl:free`. No model/env configuration was changed; no paid model was activated. Each run used a new guest context and exactly one generation click, MAX_DRAFT_ATTEMPTS=1.

| Run | Width | Project | Result | Browser observed time | Provider diagnostic |
|---|---|---|---|---|---|
| 1 | 1280 | f8eb0e62-16ed-40ae-a77e-497ad35d19f9 | Complete 8,003-character page; 1,013 rendered text characters | 75,945 ms | finish=stop; outputTokens=5745; reasoningChars=8891; 46,573 ms |
| 2 | 390 | f6ba7795-9df7-4fe3-b48e-dfe3b4d5853e | Recoverable timeout, no successful draft shown | 52,307 ms | outcome=timeout; 50,003 ms |
| 3 | 390 | d393c98d-a888-4705-a642-032b18e1f128 | Recoverable timeout, no successful draft shown | 52,285 ms | outcome=timeout; 50,001 ms |

First-attempt generation success: **1/3**. This small sample is not a stable reliability estimate and does not meet the dependable consumer release standard. Browser timings include action/read/render/polling overhead; they are not pure model latency. Timeout internals cannot be reconstructed from an aborted response body. Reasoning overhead was observed on the successful response; it is not proof of the cause of both timeouts.

All three runs passed entry, project creation, opening Documents, three distinct duplicate-check project creates and separate-context isolation (HTTP 404, no private iframe). Failed generation runs were retained and the harness exited nonzero. No retry was used to improve the reported rate.

Run 1's stricter revision assertion falsely failed because CSS uppercase changed innerText `v2` to `V2`. This was a test error, not proof of lost data. It is not retroactively marked as a complete journey pass. The final harness checks the same card's textContent version label, PATCH success and edited source after reload, uses normal textarea fill, requires substantive iframe text and supports VIEWPORT_WIDTH. Actual assertion failure and diagnosis remain recorded.

## Controlled revision proof — no model calls

Two additional projects used a small, known HTML document entered through the visible Add a document UI, then edited and saved through ArtifactEditor. Both confirmed PATCH 200, expectedVersion=1, edited source in the request, the same artifact at version 2 after reload, and the marker in both preview srcdoc and editor text.

- Desktop: World `6e378181-a829-4e16-a341-1212ce9889f0`, artifact `bc5f9ef4-2ea2-411f-aceb-8ef2dc369dc8`.
- Phone 390×844: World `c39c3285-2e1e-45d5-88d6-e9a54a6c0e68`, artifact `e98c353e-1a3b-4f6c-8e50-7561850d3d08`.

These are controlled documents, not AI-generated success samples. The mobile preview, source editor and save controls were inspected in Chromium. No cross-device or cross-browser continuity claim is made. The test contexts were closed after verification. Fourteen new test projects were created in staging in total; no existing project was overwritten or deleted.

## Costs, access and release status

The free-model configuration was retained. Input tokens and infrastructure/billing cost were not measured, so no complete cost-per-outcome claim is made. Runtime diagnostics were obtained from Vercel's supported recent log window; a wider query returned a plan-retention error and was corrected.

Automatic review rejected creation of a temporary Vercel share link due to potential disclosure. No share link was created; ordinary public preview access worked and required no protection change. No authentication secret was retrieved. No production merge, production data change, migration or paid activation occurred.

## Next acceptance gate

Keep PR #41 a draft. Benchmark a request/model path that can reliably complete within the existing bounded function budget, using supported model parameters or a qualified free alternative, and rerun independent single-attempt generation plus same-artifact revision/reopen. Changing providers or limiting reasoning is a hypothesis, not a verified improvement. Paid activation requires explicit founder authorization. Do not weaken the timeout, authority or output-validation boundaries to inflate the success rate.
