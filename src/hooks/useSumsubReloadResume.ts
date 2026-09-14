import { useEffect, useRef } from 'react'
import { useQueryState, parseAsJson } from 'nuqs'
import { type KYCRegionIntent } from '@/app/actions/types/sumsub.types'

const REGION_INTENTS: readonly KYCRegionIntent[] = ['LATAM', 'ROW', 'EU', 'NA', 'STANDARD']

export type KycResumeState = {
    intent?: KYCRegionIntent
    levelName?: string
    crossRegion?: boolean
    targetCountry?: string
}

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

const kycResumeParser = parseAsJson<KycResumeState>(parseKycResumeState)

/**
 * stores an open Sumsub flow in the URL while installed PWAs remain reachable.
 * android can evict the app after the camera or gallery opens. A cold return
 * can then replay the same applicant intent instead of dropping the flow.
 */
export function useSumsubReloadResume(
    openState: KycResumeState | null,
    onResume: (state: KycResumeState) => Promise<boolean>
) {
    const [persisted, setPersisted] = useQueryState('kyc', kycResumeParser)

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

    const serialized = openState ? JSON.stringify(openState) : null

    const syncSkipRef = useRef(true)
    useEffect(() => {
        if (syncSkipRef.current) {
            syncSkipRef.current = false
            return
        }
        void setPersisted(serialized ? (JSON.parse(serialized) as KycResumeState) : null)
    }, [serialized, setPersisted])
}
