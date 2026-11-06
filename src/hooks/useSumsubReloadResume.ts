import { useEffect, useRef } from 'react'
import { useQueryState, parseAsJson } from 'nuqs'
import { type KYCRegionIntent } from '@/app/actions/types/sumsub.types'
import { DEPOSIT_CORRIDORS } from '@/features/deposit-accounts/params'
import type { DepositCorridor } from '@/features/deposit-accounts/types'

const REGION_INTENTS: readonly KYCRegionIntent[] = ['LATAM', 'ROW', 'EU', 'NA', 'STANDARD']

export type KycResumeState = {
    intent?: KYCRegionIntent
    levelName?: string
    crossRegion?: boolean
    targetCountry?: string
    corridor?: DepositCorridor
}

const parseKycResumeState = (value: unknown): KycResumeState | null => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
    const { intent, levelName, crossRegion, targetCountry, corridor } = value as Record<string, unknown>
    const asString = (v: unknown) => (typeof v === 'string' ? v : undefined)
    const asIntent = (v: unknown) =>
        REGION_INTENTS.includes(v as KYCRegionIntent) ? (v as KYCRegionIntent) : undefined
    return {
        intent: asIntent(intent),
        levelName: asString(levelName),
        crossRegion: typeof crossRegion === 'boolean' ? crossRegion : undefined,
        targetCountry: asString(targetCountry),
        corridor: DEPOSIT_CORRIDORS.includes(corridor as DepositCorridor) ? (corridor as DepositCorridor) : undefined,
    }
}

const kycResumeParser = parseAsJson<KycResumeState>(parseKycResumeState)

// several flows can be mounted on one page (Home hosts more than one): only the first replays a persisted state
const resuming = new Set<string>()

/**
 * The param stays until the replay settles, so a reload mid-replay can still resume. A replay that navigates
 * away calls `consume` first: clearing the param after it is a navigation back to this page, and Next keeps
 * only the latest navigation.
 */
export type ResumeReplay = { consume: () => Promise<void> }

/**
 * stores an open Sumsub flow in the URL while installed PWAs remain reachable.
 * android can evict the app after the camera or gallery opens. A cold return
 * can then replay the same applicant intent instead of dropping the flow.
 */
export function useSumsubReloadResume(
    openState: KycResumeState | null,
    onResume: (state: KycResumeState, replay: ResumeReplay) => Promise<boolean>,
    enabled = true
) {
    const [persisted, setPersisted] = useQueryState('kyc', kycResumeParser)

    const didResumeRef = useRef(false)
    useEffect(() => {
        if (didResumeRef.current) return
        didResumeRef.current = true
        if (!enabled || !persisted || openState) return
        const key = JSON.stringify(persisted)
        if (resuming.has(key)) return
        resuming.add(key)
        void (async () => {
            let consumed = false
            const consume = async () => {
                consumed = true
                await setPersisted(null)
            }
            const reopened = await onResume(persisted, { consume }).catch(() => false)
            resuming.delete(key)
            if (!reopened && !consumed) void setPersisted(null)
        })()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const serialized = openState ? JSON.stringify(openState) : null

    const syncSkipRef = useRef(true)
    useEffect(() => {
        if (syncSkipRef.current) {
            syncSkipRef.current = false
            return
        }
        if (!enabled) return
        void setPersisted(serialized ? (JSON.parse(serialized) as KycResumeState) : null)
    }, [serialized, setPersisted, enabled])
}
