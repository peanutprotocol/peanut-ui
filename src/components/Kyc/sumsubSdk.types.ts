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
    onError?: (error: unknown) => void
    onRefreshToken: () => Promise<string>
    /** multi-level workflow (e.g. LATAM) — don't close SDK on Level 1 submission */
    isMultiLevel?: boolean
}
