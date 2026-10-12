/**
 * Shared contract for the two Sumsub SDK drivers. `SumsubKycWrapper` picks
 * between them by platform, so the web modal and the native launcher must stay
 * interchangeable from a call site's point of view.
 */
export type SumsubSubmissionSource = 'sdk_submitted' | 'sdk_teardown'

export interface SumsubSdkProps {
    sessionKey?: string
    visible: boolean
    accessToken: string | null
    /** Initial, editable email default; never fixed identity information. */
    email?: string
    onClose: () => void
    onComplete: () => void
    /** Reports a submitted level or a cancelled native launch that reached submission. */
    onSubmitted?: (source?: SumsubSubmissionSource) => void
    onError?: (error: unknown) => void
    onRefreshToken: () => Promise<string>
    /** multi-level workflow (e.g. LATAM) — don't close SDK on Level 1 submission */
    isMultiLevel?: boolean
}

/**
 * Which confirmation the web modal's help ActionModal shows: `trouble` offers
 * support, `stop-verification` confirms abandoning the session.
 */
export type SumsubHelpModalVariant = 'stop-verification' | 'trouble'
