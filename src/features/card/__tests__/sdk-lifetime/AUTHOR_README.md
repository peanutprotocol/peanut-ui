# Frozen independent acceptance assertions

Source read: supplied public SDK lifetime contract and earlier public adapter contract/fixtures only. No product source, diffs, implementation discussion or test output read. Tests were not executed. Assertions are frozen for independent adapter implementation; do not change expectations to fit observed behavior.

The adapter must mount the real issued-card route and dedicated SDK component and retain the exact callbacks handed to external SDK initialization. Use controlled HTTP/auth and external SDK fake only. Document actual DOM control, resume request fields, completion event name, teardown operation, callback retention, and native plugin routing. All outgoing traffic must be intercepted and recorded; never contact a provider. Normalized receipt identity must derive from captured wire request/auth evidence, not fixture expectations.

Each initial/open/refresh fixture response must use a distinct token. The positive control requires real successful refresh and completion. Stale tests verify no new resume request, no forbidden operations, no new SDK initialization, unchanged real replacement surface, and successful replacement refresh/completion afterward. The queue is a retained-function scheduling seam only; it must not defer lookup of the latest callback. Teardown exceptions must originate in the fake SDK teardown called by production, with production responsible for cleanup.

The exported registration function intentionally needs a separate real adapter runner. Web is mandatory. Register native only if actual invocation-specific plugin callback routing can be represented; otherwise record native as unverified, never substitute a fake controller. Failures caused by public-contract ambiguity should be reported to the owner; do not invent product behavior or silently skip matrix cases.

## Assumptions

- The public contract's explicit completion behavior retires/closes the visible SDK surface.
- A server fixture may continue advertising the same pending generation after retirement, enabling deliberate same-generation reopening.
- Publishing a changed captured scope/generation retires the old launch as required by captured identity rules; the real continuation remains reachable for reopening.
- Refresh performs one resume request; exact wire route/fields and response schema belong to the independent adapter, not this specification.
- Same-generation A and B are distinguished by actual SDK initialization invocation and unique fixture token, never a test-only guard.

## Not handled

- Adapter implementation/execution, actual source validation, real devices and provider delivery.
- Distinct implementation model or process isolation cannot be verified by this author; parent must document available guarantees.
- Polling continuity details were not supplied beyond preserving existing rules, so no new cadence/visibility contract is invented.
- No assertions prescribe whether retired refresh rejects or resolves without replacement token, nor whether an already-started request resolves an old token; the supplied contract only forbids replacement-session access and effects.
