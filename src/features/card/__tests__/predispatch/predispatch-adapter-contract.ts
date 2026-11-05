export type SessionKind = 'token' | 'cookie-only';
export type TransportKind = 'native' | 'web';
export interface DispatchObservations {
  resumeRequests: number;
  providerOperations: number;
  openingDispatches: number;
}
export interface PredispatchHarness {
  /** Drive production auth-clear up to its real invalidation, parking native cookie clear.
   * Must resolve while cookie clear is pending; must not flush/rerender the stale CTA.
   */
  beginAuthClearHoldingCookieClear(): Promise<void>;
  releaseCookieClear(): Promise<void>;
  /** Click the already-rendered real CTA, without rerendering first. */
  tapRenderedCardCta(): Promise<void>;
  /** Park the actual auth-readiness dependency before invoking the entry boundary. */
  holdAuthReadiness(): Promise<void>;
  /** Invoke the actual authenticated paperwork entry; return when parked on readiness,
   * not when the whole entry operation completes. Observe expected rejections.
   */
  enterPaperworkAndWaitUntilParked(): Promise<void>;
  releaseAuthReadiness(): Promise<void>;
  /** Update actual auth/account stores through production public actions. */
  changeToAccountB(): Promise<void>;
  flush(): Promise<void>;
  observations(): DispatchObservations;
  dispose(): Promise<void>;
}
export interface PredispatchAdapter {
  mount(options: {
    session: SessionKind;
    transport: TransportKind;
    account: 'synthetic-owner-a';
    scope: string;
    generation: 'generation-a';
  }): Promise<PredispatchHarness>;
}
