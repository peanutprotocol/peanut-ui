'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import posthog from 'posthog-js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { KYC_INTENTS } from '@/constants/query.consts'
import { kycIntentsApi, type KycIntentKey, type KycIntentSet } from '@/services/kyc-intents'
import { defaultIntentSet, isQrOnly, unlockRows } from './unlock-checklist.utils'

/** The ID the user will show: one issued by the residence country, or one issued by another country. */
export type IdDocumentAnswer = 'local' | 'foreign'

// the document answer, never the country: the issuing country of a foreign ID
// is a nationality signal, which is more than the privacy policy lists for analytics
const analyticsProps = (residence: string, document: IdDocumentAnswer, set: KycIntentSet) => ({
    residence,
    document,
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
    const [foreignIdCountry, setForeignIdCountry] = useState<string>()
    // the country whose ID the rows are computed for; unset until the issuing country of a foreign ID is picked
    const idCountry = document === 'local' ? residence : foreignIdCountry

    const config = useQuery({
        queryKey: [KYC_INTENTS, residence, idCountry],
        queryFn: () => kycIntentsApi.getConfig(residence, document === 'foreign' ? idCountry : undefined),
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
            analyticsProps(residence, document, defaultIntentSet(rows))
        )
    }, [config.data, rows, residence, document])

    // a checklist that left the screen during the save must not start the check
    const onScreen = useRef(true)
    useEffect(() => {
        onScreen.current = true
        return () => {
            onScreen.current = false
        }
    }, [])

    const save = useMutation({
        // Takes the set the tapped button showed and resolves to it: the
        // toggles stay live during the request, and the event must report
        // what the API stored.
        mutationFn: async (set: KycIntentSet) => {
            await kycIntentsApi.set(set)
            return set
        },
        onSuccess: (stored) => {
            posthog.capture(ANALYTICS_EVENTS.ONBOARDING_UNLOCK_CONTINUED, analyticsProps(residence, document, stored))
            if (onScreen.current) onVerify()
        },
    })
    const skip = () =>
        posthog.capture(ANALYTICS_EVENTS.ONBOARDING_UNLOCK_SKIPPED, analyticsProps(residence, document, intents))

    return {
        document,
        setDocument,
        foreignIdCountry,
        setForeignIdCountry,
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
