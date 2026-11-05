/** Test-only seam. Implement using the real route, hooks and SDK wrapper. */
export type Identity = {owner: string; scope: string; generation: string};
export type Platform = 'web' | 'native';
export type Callback = 'refresh' | 'submitted' | 'complete';
export interface Launch {
  /** Unique SDK initialization invocation, NOT generation or a wrapper's reused ref. */
  id: string;
  token: string;
  identity: Identity;
}
export interface Receipt {
  kind: 'resume' | 'apply' | 'create-card' | 'issuance' | 'provider' | 'other';
  method: string;
  path: string;
  body: unknown;
  /** For resume only: decode captured identity from actual request/auth fixture. */
  identity?: Identity;
  /** Token actually returned by the controlled HTTP response, not inferred from UI. */
  responseToken?: string;
}
export interface Delivery { status: 'fulfilled' | 'rejected'; value?: unknown }
export interface DeferredReply {
  /** Deliver response even if request's AbortSignal has already been aborted. */
  resolveToken(token: string): Promise<void>;
}
export interface Harness {
  receipts: Receipt[];
  launches: Launch[];
  /** Observe actual forbidden callbacks as well as requests (never synthesize them). */
  forbiddenCalls: unknown[];
  /** Actual real UI SDK surface; null when route/SDK is absent. */
  visibleSdkRoot(): HTMLElement | null;
  /** Drive real continuation DOM control; return only the newly captured init. */
  openThroughUi(): Promise<Launch>;
  /** Actual SDK callback function captured AT init, retained after destroy/unmount.
   * Invoke that exact function, including its captured args, never look up latest callback.
   * Catch rejection only to report Delivery; do not suppress side effects or filter calls.
   * Native must retain plugin invocation-specific routing, if actually available. */
  deliver(launch: Launch, event: Callback): Promise<Delivery>;
  /** Queue execution of the captured callback without invoking it until returned thunk. */
  queue(launch: Launch, event: Callback): () => Promise<Delivery>;
  /** Exercise actual SDK close event handler retained for this invocation. */
  close(launch: Launch): Promise<void>;
  /** Make external SDK fake's actual teardown operation throw for this invocation. */
  throwOnTeardown(launch: Launch): void;
  /** Only fixture input changes; production effects must do retirement. */
  setAuth(owner: string | null): Promise<void>;
  publishPending(identity: Identity): Promise<void>;
  /** Real router departure and return, not a fake visibility toggle. */
  leaveRoute(): Promise<void>;
  returnToRoute(): Promise<void>;
  deferNextResume(): DeferredReply;
  /** Flush effects + resolved I/O, never unresolved deferred I/O. */
  settle(): Promise<void>;
  dispose(): Promise<void>;
}
export interface Adapter {
  platform: Platform;
  /** Record actual mapping/provenance in accompanying adapter evidence. No providers. */
  mount(identity: Identity): Promise<Harness>;
}
