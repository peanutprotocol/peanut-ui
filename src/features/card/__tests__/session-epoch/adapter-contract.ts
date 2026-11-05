/** Frozen public-boundary contract. Implement outside this spec directory. */
export type Identity = { owner: string; scope: string; generation: string };
export type Phase = 'start' | 'refresh';
export type Receipt = { phase: Phase; identity: Identity };
export interface DeferredResponse {
  /** Resolve the actual mocked transport promise even when its signal is aborted. */
  deliver(token: string): Promise<void>;
}
export interface MountedVerification {
  /** Click the real rendered pending-verification action and flush React work. */
  tapPendingVerification(): Promise<void>;
  /** Invoke the callback captured from the actual SDK open configuration. */
  requestSdkRefresh(): Promise<void>;
  /** Next start/refresh transport operation must remain pending until deliver(). */
  deferNext(phase: Phase): DeferredResponse;
  /** Exercise the actual auth-clear production entrypoint; keep rendered account unchanged. */
  clearAuthenticationKeepingRenderedAccount(): Promise<void>;
  /** Restore actual authentication and account state without clicking any action. */
  signIn(identity: Identity): Promise<void>;
  /** Change production account/auth state, allowing its subscriptions/effects to run. */
  changeAuthenticatedAccount(identity: Identity): Promise<void>;
  /** Flush settled transport continuations, React updates and scheduled SDK deliveries. */
  flush(): Promise<void>;
  /** Raw observations; the adapter must never filter stale calls or tokens. */
  observations(): {
    requests: Receipt[];
    sdkOpenTokens: string[];
    sdkRefreshTokens: string[];
    issuanceCalls: number;
    applicationCalls: number;
    pendingActionVisible: boolean;
    blockingOverlayVisible: boolean;
  };
  dispose(): Promise<void>;
}
export interface VerificationAdapter {
  mountIssuedCard(identity: Identity): Promise<MountedVerification>;
}
