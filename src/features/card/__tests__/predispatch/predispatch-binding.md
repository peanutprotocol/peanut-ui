# Additional frozen pre-dispatch acceptance contract

Source is the supplied public safety requirement only. Existing spec files are preserved. The suite uses explicit deferred barriers, not sleeps, and covers token and cookie-only sessions with native and web transport boundaries.

## Required binding

Set `PEANUT_PREDISPATCH_ADAPTER` to an absolute Jest-loadable adapter path. Mount the real issued-card CTA and invoke the actual authenticated paperwork entry/request path. Use the actual auth-clear action, actual account store actions, actual auth-readiness wait and actual transport dispatch. Only fake scheduling/auth dependencies and external network/provider operations. Do not implement a replacement controller, capture an adapter epoch, compare identity in the adapter, filter receipts or suppress dispatch there.

Install a controllable deferred cookie-clear dependency before calling production auth-clear. Advance the real clear action until its production invalidation has occurred, leaving native cookie clearing unresolved. In the web case retain the same deterministic auth-clear barrier through the platform/auth dependency used by production; document how that barrier maps. A missing executable platform path is blocked coverage, never a silent skip or simulated guard.

The stale CTA case specifically preserves the event handler rendered under A. Do not rerender, unmount, invoke React act that flushes a replacement view, or await scheduler drainage between invalidation and the tap. Drive the real retained DOM/native handler. The adapter must demonstrate the handler was installed before invalidation and was the handler invoked. Scheduling control may hold rendering, but it may not hold production invalidation. After the tap, flush pending updates while cookie clear remains unresolved, then release cookie clear and flush again.

For paperwork, install the readiness barrier before invoking the real entry action; verify that the actual request path reached that barrier before returning from `enterPaperworkAndWaitUntilParked`. The API call must be started under A, not constructed anew after readiness releases. Release readiness successfully, even after invalidation, to challenge the production dispatch guard. Account B is `synthetic-owner-b`, with opaque scope `b` repeated 64 times and nonempty generation `generation-b`. Change via production account/auth state, not adapter-only state. Cookie-only fixtures must genuinely have no bearer token while retaining authenticated cookie state; do not substitute a token-authenticated fixture with a different label.

Record calls at the actual native HTTP and web fetch dispatch boundaries, covering the selected platform's real route. Record all resume requests, provider operations and opening dispatches without filtering. Fixture/bootstrap requests unrelated to these named operations may be excluded by endpoint/type, never by identity or timing. Hold external response promises if needed so an unchanged-session positive control has exactly one opening/resume dispatch and no retry artifacts. Draining must include all relevant continuations; lifecycle cleanup follows assertions. Expected cancellation rejections must be observed rather than swallowed indiscriminately.

## Assumptions

- The requirement supplies a synchronous invalidation point before asynchronous native cookie clear completes; tests must reach that real point.
- A current authenticated entry produces exactly one opening dispatch and a current CTA produces exactly one resume request.
- Auth-readiness can be controlled at its dependency boundary without replacing request dispatch logic.
- Author/implementer model separation is supplied by the assignment, not independently attested here; filesystem isolation is not enforced.

## Not handled

- Server/provider effects of operations dispatched before invalidation are explicitly outside this guarantee. The tests assert prevention only when invalidation precedes dispatch.
- No production source, diff, implementation results or existing tests were inspected. No adapter was implemented and no tests were run.
- Concrete production entrypoint names, transport names and scheduling test helpers require implementation binding and verification.
