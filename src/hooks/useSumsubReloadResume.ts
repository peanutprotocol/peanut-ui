import { useEffect, useRef } from 'react'
import { useQueryState, parseAsJson } from 'nuqs'
import { type KYCRegionIntent } from '@/app/actions/types/sumsub.types'

const REGION_INTENTS: readonly KYCRegionIntent[] = ['LATAM', 'ROW', 'EU', 'NA', 'STANDARD']

/**
 * The arguments of the initiate call that opened the SDK. Persisted with the
 * flag and replayed verbatim on resume.
 *
 * Replaying matters because the LATAM surfaces (qr-pay, withdraw/manteca,
 * MantecaAddMoney, MantecaFlowManager) build the flow as
 * `useMultiPhaseKycFlow({})` and pass the intent at call time instead. A resume
 * that re-initiates with hook defaults there mints a token for the wrong
 * verification level — and because that still opens the SDK, the flag is not
 * cleared and the user lands silently in the wrong flow.
 */
export type KycResumeState = {
    intent?: KYCRegionIntent
    levelName?: string
    crossRegion?: boolean
    targetCountry?: string
}

/**
 * The URL is user-editable, so every field is checked rather than cast. An
 * unrecognised shape parses to null, which reads as "no resume in progress".
 */
const parseKycResumeState = (value: unknown): KycResumeState | null => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
    const { intent, levelName, crossRegion, targetCountry } = value as Record<string, unknown>
    const asString = (v: unknown) => (typeof v === 'string' ? v : undefined)
    const asIntent = (v: unknown) =>
        REGION_INTENTS.includes(v as KYCRegionIntent) ? (v as KYCRegionIntent) : undefined
    return {
        intent: asIntent(intent),
        levelName: asString(levelName),
        crossRegion: typeof crossRegion === 'boolean' ? crossRegion : undefined,
        targetCountry: asString(targetCountry),
    }
}

// Module scope on purpose: a parser rebuilt every render churns the nuqs setter
// identity, which would re-run the sync effect below on every render.
const kycResumeParser = parseAsJson<KycResumeState>(parseKycResumeState)

/**
 * Persist "the Sumsub SDK is open, with these arguments" to the URL (`?kyc=…`)
 * so it survives a PWA reload. Android evicts backgrounded standalone PWAs from
 * memory — opening the camera/gallery mid-KYC (the exact thing the flow pushes
 * users toward) is the common trigger. On return the page cold-reloads and the
 * SDK's open-state (useState) resets to closed, dropping the user out of
 * Sumsub. With the state in the URL, a reload can re-acquire a token for the
 * same applicant and reopen the SDK on the same flow.
 *
 * The URL is the store rather than localStorage because Android relaunches the
 * PWA on its last route: that scopes the resume to the surface the user
 * actually left, instead of firing on whatever page mounts first.
 *
 * @param openState the initiate arguments while the SDK is open, else null.
 *   Callers with nothing to replay pass an empty object.
 * @param onResume called once on mount when the state was persisted but the SDK
 *   is closed (i.e. a reload interrupted the flow). MUST resolve to whether the
 *   SDK actually reopened — a falsy/failed result clears the state so a resume
 *   that can't reopen (init error, or a flow the replay can't reconstruct)
 *   doesn't get retried on every future reload.
 */
export function useSumsubReloadResume(
    openState: KycResumeState | null,
    onResume: (state: KycResumeState) => Promise<boolean>
) {
    const [persisted, setPersisted] = useQueryState('kyc', kycResumeParser)

    // resume once on mount
    const didResumeRef = useRef(false)
    useEffect(() => {
        if (didResumeRef.current) return
        didResumeRef.current = true
        if (!persisted || openState) return
        void (async () => {
            const reopened = await onResume(persisted).catch(() => false)
            if (!reopened) void setPersisted(null)
        })()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Compare the open state by value, not identity: callers build it inline, so
    // an identity-keyed effect would rewrite the URL on every render.
    const serialized = openState ? JSON.stringify(openState) : null

    // keep the URL in sync with the SDK's open state. skip the first run so the
    // mount-time resume above reads the persisted state before we touch it.
    // clearing to null removes the param from the URL.
    const syncSkipRef = useRef(true)
    useEffect(() => {
        if (syncSkipRef.current) {
            syncSkipRef.current = false
            return
        }
        void setPersisted(serialized ? (JSON.parse(serialized) as KycResumeState) : null)
    }, [serialized, setPersisted])
}
