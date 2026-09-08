# BhoomiSetu implementation review

Reviewed 9 September 2026. Baseline: commit `81e4cb90157e6607b119e93974f96ece8d6cda9c`.

## Verdict

Keep and harden the existing prototype. It has a coherent digitization workflow, real browser OCR, deterministic structured-record hashing, an off-chain wallet-signature path, and an actual Polygon transaction path. It is not yet a durable, authenticated land registry. The most valuable next substantial implementation is authenticated MongoDB persistence, not Merkle trees or a new smart contract.

The remaining build time was not specified. This pass prioritizes bounded reliability fixes and preserves the current UI, stack, and wallet interaction pattern. It does not replace MongoDB with a different database or silently store personal records in browser storage.

## What is solid and worth keeping

- **Workflow:** upload, human review, validation, and proof are distinct stages. Search and record inspection are already useful. Human correction is an appropriate safeguard for imperfect scans.
- **OCR:** Tesseract.js performs actual recognition in the browser. English/Kannada selection, contrast enhancement, original-image comparison, and manual entry are practical prototype choices. Scans are not sent to a remote OCR API; initial worker/language downloads still need connectivity.
- **Fingerprint:** Web Crypto SHA-256 over a deterministic v1 payload is correctly implemented. It avoids hashing unstable JSON property order. The payload and historical normalization were preserved and independently checked against Node's SHA-256 implementation.
- **Privacy boundary:** the Polygon path sends the fingerprint, not full land records. The wallet signature also includes the record ID and a readable purpose statement.
- **Real blockchain path:** a zero-value self-transaction carrying the fingerprint can serve as an anchor once confirmed. Transaction lookup compares the on-chain input with the expected fingerprint. No custom contract is necessary for this limited claim.
- **Gasless option:** `personal_sign` is genuinely off-chain and does not require test POL. It is explicitly distinct from Polygon anchoring.
- **Runtime:** existing Vinext/React/Tailwind/Sites structure was retained. No new runtime dependency or stack migration was introduced.

## Findings and changes made

| Priority | Baseline problem | Result of this pass |
| --- | --- | --- |
| Critical | New records and proofs disappear on reload; no MongoDB/API implementation exists in this checkout | Still an explicit blocker. Added a prominent session-only warning, reload warning after record changes, and JSON export of record fields and proof references. Export is not a database or in-app restore feature. |
| High | Seed records appeared anchored with fabricated hashes/transaction references; totals were inflated | Removed fabricated proofs; seed records are unanchored and identified as synthetic. Counts now reflect the actual collection. |
| High | Verification could remain green after editing the record | Form edits clear the result and stale displayed hash. Verification/approval/wallet operations lock competing edits and navigation while running. |
| High | Pending transactions were not attached to registry records; verification button was disabled while pending | Store transaction reference and pending state immediately in the session. Reopen and retry lookup. Later confirmation updates the registry. Reverted receipts do not count as anchors. |
| High | Field checks were mostly truthiness despite a “6 checks passed” claim | Reject whitespace-only fields, non-finite/nonpositive areas, unsupported precision, malformed identifiers, invalid calendar dates and future dates. Normalize duplicate comparisons. Labels now say basic checks, not authoritative validation. |
| High | OCR could finish into a different/reopened workflow | Abort controller and flow version prevent stale results. Worker recognition has a 90-second per-pass limit; stop-and-enter-manually is available. Close/unmount terminates available workers. |
| High | Image enhancement never downscaled large images | Bound the OCR canvas's longest side to 2,400 pixels, including the unenhanced comparison. Release image resources and replaced preview URLs. Decoding the original image can still allocate substantial memory before resizing. |
| Medium | Failed second OCR pass discarded a successful first pass | Preserve the first extraction when comparison fails. |
| Medium | Artificial per-field and sample confidence suggested measured accuracy | Sample is labelled prefilled/synthetic. Extracted fields all require review; only overall engine confidence is displayed as a percentage. Edited fields return to manual review. |
| Medium | Reopened records could display another record's scan/confidence | Reset workflow metadata before opening. Explicitly show that source images are not retained. |
| Medium | Empty review/proof queues could dereference undefined | Empty queues now display an explanatory message. |
| Medium | Approval IDs were derived from a count and could collide; approval errors were unhandled | New IDs use UUIDs; approval catches hashing failures and uses an operation lock. Approved records retain their hash immediately. |
| Medium | Unbounded individual RPC requests could leave progress stuck | Eight-second request timeout and roughly 45-second receipt-poll budget, with up to one final request's latency. Unknown receipt state remains pending rather than falsely confirmed. |
| Medium | Wallet response shape and post-switch chain were assumed | Check account, active Amoy chain, transaction hash and signature format. Original switch/add/request sequence and generic failure message are retained. |
| Medium | Open dialog did not use native modal behavior; record rows lacked a keyboard control | Native `showModal` supplies modality/focus behavior. Escape closes/cancels OCR when no proof operation is active; record IDs are keyboard-operable buttons. |
| Medium | No regression suite | Added tests for validation, normalization, legacy hashing, English/Kannada labelled extraction, date parsing, cancelled OCR and mocked Polygon RPC behavior. Added typecheck/test scripts. |

Source was formatted for maintainability; the larger page diff is largely formatting, not a replacement application. Domain parsing/hashing and OCR/RPC lifecycle helpers were extracted into `lib/` so they can be tested separately.

## What remains missing or uncertain

1. **MongoDB and API are absent.** There are no durable record endpoints, database credentials, server-side validation, atomic duplicate constraint, or document storage in this checkout. Do not describe the project as MongoDB-integrated yet. The hosted Sites runtime does not support raw TCP database connections; a trusted HTTP-backed service boundary is needed for a MongoDB backend in this deployment arrangement. Never expose a MongoDB URI in client code.
2. **No app-owned authentication or reviewer authorization.** A wallet address is not an authenticated revenue official. Verifying a signature against an address stored alongside it does not protect against an attacker replacing both. There is no trusted signer policy or authoritative audit trail.
3. **Hash scope is limited.** v1 hashes six normalized structured fields, not source image bytes, OCR text, provenance, or all metadata. Case/outer spaces are normalized; area rounds to two decimals. New approval rejects extra area precision to prevent silently approving an unrepresented precision level. Original documents need separate hashes/storage in a versioned v2 design, not a silent v1 change.
4. **On-chain scope is limited.** The current self-transaction stores a fingerprint, not the record ID, document, permission policy or ownership history. One observed successful receipt is not a configured finality policy. RPC availability and trust remain dependencies.
5. **Wallet limitations remain.** The browser must expose `window.ethereum`; an embedded browser may not. Public testnet anchoring still needs test POL. Gasless signatures still need a wallet. No testnet transaction or signature was created during this review. The original broad switch-chain catch and generic failure message were retained in line with the earlier user request; diagnosing wallet failures remains less specific than ideal. A wallet prompt that never settles can keep the operation locked until the wallet is dismissed or the page is reloaded.
6. **OCR is template-sensitive, not a general document understanding system.** Regex extraction has not been benchmarked on real legacy records. Unusual layouts, handwriting, Kannada labels sharing a line, names with punctuation, numeric parcel formats and mixed units can need manual entry. PDF, batch, deskew, multipage documents and historical unit conversion are not implemented. Two-digit years now remain blank rather than guessing a century. The image decode and worker-initialization phases still depend on browser resources; an initializing worker can only be terminated once the library returns its handle.
7. **Validation is deliberately narrow.** The identifier grammar and date range (1800 through today) are prototype assumptions, not jurisdiction-specific rules. Acre precision is explicitly two decimals. Multiple valid interests on one parcel will be conservatively flagged; there is no ownership-history adjudication or conflict-resolution workflow. Confirm actual source values rather than modifying a parcel ID just to bypass a conflict.
8. **Exports are sensitive and limited.** Downloaded JSON includes owner/parcel data and proof references; it excludes original images and is not encrypted. There is no import/restore screen, signing-key backup, or authoritative database backup. Use synthetic records for the demo.
9. **Original PDF report may be stale.** The existing report artifacts were preserved and not regenerated. Avoid using their assertions as evidence of features that this review found absent.

## Verification evidence and limits

- `npm test`: 44 passing regression tests.
- `npm run typecheck`: TypeScript validation.
- Targeted `oxlint` on the modified application/helpers: clean.
- Production build and local route smoke check are performed as part of delivery.
- Full-repository lint already reports issues in bundled `components/ui` and `hooks/use-mobile.ts` (including accessibility and React compiler diagnostics). Those unrelated vendor files were not changed merely to make the global lint command green.
- Tests use mocked Polygon responses, not a live funded wallet. OCR parser fixtures are text, not an accuracy benchmark of scanned images. Cancellation testing covers a pre-aborted request; live worker/time-out/browser interaction behavior still needs rehearsal.
- No browser click-through, mobile visual QA, funded transaction, external MongoDB integration test, load test, or security audit was performed. A successful build does not substitute for those checks.

## Highest-value direction from here

**If the demo is imminent:** freeze features. Use a synthetic typed image, show extraction/manual review and the intentional duplicate warning, then open an already validated sample to demonstrate the chosen proof route. Rehearse on the exact browser and wallet. Do not claim blockchain completion if the transaction is pending or if only a wallet signature was created. Download the session export before refreshing.

**If there is time for one substantial change:** implement authenticated create/list/read/update endpoints backed by MongoDB, storing the approved immutable snapshot and proof reference together. Server validation and normalized duplicate constraints must accompany storage. Verify create → reload → retrieve → prove, then rejected/failed requests. Select the actual backend hosting and secure credential configuration before implementation; do not replace MongoDB with D1 without agreement.

**After persistence:** attach retained source documents and their hashes, add a reviewer policy and append-only audit history, and benchmark OCR on a small representative labelled set. Add independent wallet-signature recovery without requiring MetaMask. Improve wallet errors once the preferred original behavior can change.

**Cut from the immediate demo:** Merkle batching, custom ownership contracts, gas sponsorship, automated legal ownership claims, multipage/handwritten OCR and GIS. They do not solve the current refresh-loss, identity or extraction-quality gaps.

## Final rehearsal checklist

1. Load the registry: four synthetic records, no invented anchors or counts.
2. Open the sample: explicit synthetic label and an actual parcel-conflict warning. Do not alter facts to force approval.
3. Upload a typed JPEG/PNG: inspect all fields, especially units/date; stop OCR manually and repeat to check that old results do not return.
4. Try blank names, invalid dates, negative/infinite/three-decimal area and whitespace-varied duplicate identifiers: approval must stay blocked.
5. Close/reopen records: no previous record's scan or OCR confidence should appear.
6. Approve a nonconflicting synthetic record once; rapid clicks must not create duplicates.
7. Decline a wallet request: no proof success should be claimed. Confirm a gasless signature and then verify it in a supported wallet browser.
8. On a funded Amoy test wallet, confirm anchoring and inspect the real explorer transaction; test a pending receipt and retry lookup.
9. Verify, edit a meaningful owner character, and verify again: the old green result must clear and the new result must show a mismatch. Case-only/outer-space edits intentionally normalize.
10. Export and inspect the record's fingerprint, signature/transaction reference and status. Reload only after acknowledging that no database has retained this session.
