/** Public test-only contract. Implementation MUST mount the real route/screen/callbacks. */
export type AuthFixture = { userId: string | null } | null
export interface CardOverviewFixture {
    status: { hasApplication: boolean; railStatus: string }
    balance: null
    balanceUnavailable: boolean
    cards: Array<{
        id: string
        rainCardId: string
        last4: string
        expiryMonth: number
        expiryYear: number
        status: string
        network: string
        issuedAt: string
        hasWithdrawApproval: boolean
        hasStoredWithdrawApproval: boolean
    }>
    pendingVerification?: { kind: 'card_addon'; generation: string; entryScope: string }
}
export interface RecordedRequest {
    method: string
    path: string
    body: unknown
    headers: Record<string, string>
    kind: 'overview' | 'profile' | 'resume' | 'apply' | 'create-card' | 'issuance' | 'other'
    signalSupplied: boolean
    aborted: boolean
}
export interface DeferredResume {
    /** Resolve the actual pending network operation, even after cancellation, to challenge stale-result guards. */
    reply(status: number, body: unknown): Promise<void>
    reject(error: Error): Promise<void>
}
export interface SdkSession {
    id: string
    token: string
    mounted: boolean
}
export interface MountedCardContinuation {
    /** Root from the actual mounted CardPage and YourCardScreen. Never a replacement test view. */
    root: HTMLElement
    requests: RecordedRequest[]
    /** Observations of real forbidden production callbacks, not fake handler implementations. */
    forbiddenCalls: Array<{ kind: 'apply' | 'create-card' | 'issuance'; args: unknown[] }>
    sdk: {
        sessions: SdkSession[]
        /** Invoke the actual refresh callback supplied by the production dedicated SDK wrapper. */
        refresh(sessionId: string): Promise<unknown>
        /** Emit the corresponding SDK event to the real production callback. */
        complete(sessionId: string): Promise<void>
        close(sessionId: string): Promise<void>
    }
    /** Queue one controllable HTTP response; all matching requests are still recorded separately. */
    deferNextResume(): DeferredResume
    /** Real DOM event through the renderer's supported user-event API. */
    tap(element: HTMLElement): Promise<void>
    /** Change only the auth fixture input; let production effects handle the transition. */
    setSession(session: AuthFixture): Promise<void>
    /** Update network fixture and deliver it through the real overview query/refetch mechanism. */
    publishOverview(overview: CardOverviewFixture): Promise<void>
    /** Drive real route departure/unmount through the router test facility. */
    navigateAway(): Promise<void>
    /** Flush actual rendering/effects and already-resolved fake I/O; never resolve a deferred response. */
    settle(): Promise<void>
    /** Existing enabled read-only management control from the real issued card; mapping must be documented. */
    existingCardControl(): HTMLElement
    /** DOM presence of the real management view reached by the control; no fixture-derived booleans. */
    existingCardManagementView(): HTMLElement | null
    dispose(): Promise<void>
}
export interface MountOptions {
    session: AuthFixture
    overview: CardOverviewFixture
}
export type MountCardContinuation = (options: MountOptions) => Promise<MountedCardContinuation>
