'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import posthog from 'posthog-js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { KYC_INTENTS } from '@/constants/query.consts'
import { kycIntentsApi, type KycIntentKey, type KycIntentSet } from '@/services/kyc-intents'
import { defaultIntentSet, isQrOnly, unlockRows } from './unlock-checklist.utils'

/** The ID the user will show: one issued by the residence country, or a passport from another. */
export type IdDocumentAnswer = 'local' | 'passport'

// country code only: the document answer never carries a document number
const analyticsProps = (residence: string, idCountry: string | undefined, set: KycIntentSet) => ({
    residence,
    document_country: idCountry,
    intent_qr: set.qr,
    intent_local: set.local,
    intent_card: set.card,
    intent_bank: set.bank,
})

/**
 * State of the unlock checklist (TASK-23329): which ID the user will show,
 * the rows that answer gets from GET /config/kyc-intents, and the ticked set.
 * A new answer re-queries and preselects every open row again, so the rows
 * never promise a feature the document rule refuses.
 */
export function useUnlockChecklist(residence: string, onVerify: () => void) {
    const [document, setDocument] = useState<IdDocumentAnswer>('local')
    const [passportCountry, setPassportCountry] = useState<string>()
    // the country whose ID the rows are computed for; unset until a passport country is picked
    const idCountry = document === 'local' ? residence : passportCountry

    const config = useQuery({
        queryKey: [KYC_INTENTS, residence, idCountry],
        queryFn: () => kycIntentsApi.getConfig(residence, document === 'passport' ? idCountry : undefined),
        enabled: !!idCountry,
        staleTime: 5 * 60 * 1000,
    })
    const rows = useMemo(() => (config.data ? unlockRows(config.data) : []), [config.data])

    const [intents, setIntents] = useState<KycIntentSet>(() => defaultIntentSet([]))
    useEffect(() => {
        setIntents(defaultIntentSet(rows))
    }, [rows])
    const toggle = (key: KycIntentKey) => setIntents((current) => ({ ...current, [key]: !current[key] }))

    // the first answer is the view; later answers are the same screen
    const viewed = useRef(false)
    useEffect(() => {
        if (viewed.current || !config.data) return
        viewed.current = true
        posthog.capture(
            ANALYTICS_EVENTS.ONBOARDING_UNLOCK_VIEWED,
            analyticsProps(residence, idCountry, defaultIntentSet(rows))
        )
    }, [config.data, rows, residence, idCountry])

    const save = useMutation({
        mutationFn: () => kycIntentsApi.set(intents),
        onSuccess: () => {
            posthog.capture(ANALYTICS_EVENTS.ONBOARDING_UNLOCK_CONTINUED, analyticsProps(residence, idCountry, intents))
            onVerify()
        },
    })
    const skip = () =>
        posthog.capture(ANALYTICS_EVENTS.ONBOARDING_UNLOCK_SKIPPED, analyticsProps(residence, idCountry, intents))

    return {
        document,
        setDocument,
        passportCountry,
        setPassportCountry,
        rows,
        intents,
        toggle,
        isLoading: config.isLoading,
        isError: config.isError,
        refetch: config.refetch,
        qrOnly: isQrOnly(rows),
        canContinue: !!config.data && Object.values(intents).some(Boolean),
        save,
        skip,
    }
}
