/**
 * Shared contract for the two Sumsub SDK drivers. `SumsubKycWrapper` picks
 * between them by platform, so the web modal and the native launcher must stay
 * interchangeable from a call site's point of view.
 */
export interface SumsubSdkProps {
    visible: boolean
    accessToken: string | null
    /**
     * Manual close. `submitted: true` marks a close AFTER the user finished
     * submitting (multi-level level-2 done, SDK sitting on "documents
     * submitted") — the flow hooks use it to consume the deferred
     * ACTION_REQUIRED instead of replaying it as a bogus rejection. An
     * abandon passes nothing.
     */
    onClose: (opts?: { submitted?: boolean }) => void
    onComplete: () => void
    /**
     * Fired when a level is submitted but the SDK stays open (multi-level
     * Level-1 submit). Single-level submits fire `onComplete` instead — without
     * this hook a multi-level session emits no submit signal at all, because
     * the APPROVED close never runs `onComplete`. Web SDK only: the native SDK
     * dismisses after the LAST level, so its one `onComplete` already covers it.
     */
    onSubmitted?: () => void
    onError?: (error: unknown) => void
    onRefreshToken: () => Promise<string>
    /** multi-level workflow (e.g. LATAM) — don't close SDK on Level 1 submission */
    isMultiLevel?: boolean
}
