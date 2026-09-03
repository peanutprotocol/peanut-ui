/**
 * Shared contract for the two Sumsub SDK drivers. `SumsubKycWrapper` picks
 * between them by platform, so the web modal and the native launcher must stay
 * interchangeable from a call site's point of view.
 */
export interface SumsubSdkProps {
    visible: boolean
    accessToken: string | null
    onClose: () => void
    onComplete: () => void
    /**
     * Fired when a level is submitted but the SDK stays open (multi-level
     * Level-1 submit). Single-level submits fire `onComplete` instead — without
     * this hook a multi-level session emits no submit signal at all, because
     * the APPROVED close never runs `onComplete`. The native SDK normally
     * dismisses after the LAST level and reports that one `onComplete`, but it
     * also fires this when a multi-level session is abandoned after an earlier
     * level: that exit is a close, not a completion, and the level the user did
     * finish still has to reach the funnel.
     */
    onSubmitted?: () => void
    onError?: (error: unknown) => void
    onRefreshToken: () => Promise<string>
    /** multi-level workflow (e.g. LATAM) — don't close SDK on Level 1 submission */
    isMultiLevel?: boolean
}
