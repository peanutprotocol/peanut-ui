'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import posthog from 'posthog-js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { KYC_INTENTS } from '@/constants/query.consts'
import { useSaveKycIntents } from '@/hooks/useSaveKycIntents'
import { kycIntentsApi, type KycIntentKey, type KycIntentSet } from '@/services/kyc-intents'
import { defaultIntentSet, isQrOnly, unlockRows } from './unlock-checklist.utils'

/** The ID the user will show: one issued by the residence country, or one issued by another country. */
export type IdDocumentAnswer = 'local' | 'foreign'

/** Where the question was asked: the unlock checklist, or the unlock sheet of one tapped method. */
type UnlockEntry = 'checklist' | 'method'

// the document answer, never the country: the issuing country of a foreign ID
// is a nationality signal, which is more than the privacy policy lists for analytics
const analyticsProps = (entry: UnlockEntry, residence: string, document: IdDocumentAnswer, set: KycIntentSet) => ({
    entry,
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
 *
 * @param feature The method unlock sheet (item 8c) passes the feature its tap
 *   chose. The set is then that feature and QR, which comes with every check,
 *   each only while the answer leaves it open.
 */
export function useUnlockChecklist(residence: string, onVerify: () => void, feature?: KycIntentKey) {
    const entry: UnlockEntry = feature ? 'method' : 'checklist'
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

    const preselected = useMemo(
        () => defaultIntentSet(feature ? rows.filter((row) => row.key === 'qr' || row.key === feature) : rows),
        [rows, feature]
    )
    const [ticked, setTicked] = useState<KycIntentSet>(() => defaultIntentSet([]))
    useEffect(() => {
        setTicked(preselected)
    }, [preselected])
    const toggle = (key: KycIntentKey) => setTicked((current) => ({ ...current, [key]: !current[key] }))
    // the method sheet has no toggles: its set is the answer's own, never a render behind it
    const intents = feature ? preselected : ticked

    // the first answer is the view; later answers are the same screen
    const viewed = useRef(false)
    useEffect(() => {
        if (viewed.current || !config.data) return
        viewed.current = true
        posthog.capture(
            ANALYTICS_EVENTS.ONBOARDING_UNLOCK_VIEWED,
            analyticsProps(entry, residence, document, preselected)
        )
    }, [config.data, preselected, entry, residence, document])

    // a checklist that left the screen during the save must not start the check
    const onScreen = useRef(true)
    useEffect(() => {
        onScreen.current = true
        return () => {
            onScreen.current = false
        }
    }, [])

    const saveIntents = useSaveKycIntents()
    const save = useMutation({
        // Takes the set the tapped button showed and resolves to it: the
        // setup rows and the resume gate (item 9a) read it from the cached
        // user, which the save writes before the check starts.
        mutationFn: async (set: KycIntentSet) => {
            await saveIntents(set)
            return set
        },
        onSuccess: (stored) => {
            posthog.capture(
                ANALYTICS_EVENTS.ONBOARDING_UNLOCK_CONTINUED,
                analyticsProps(entry, residence, document, stored)
            )
            if (onScreen.current) onVerify()
        },
    })
    const skip = () =>
        posthog.capture(ANALYTICS_EVENTS.ONBOARDING_UNLOCK_SKIPPED, analyticsProps(entry, residence, document, intents))

    // The choices hold still while the save is in flight: the screen must not
    // show an ID answer or a set the API did not store.
    const whileEditable =
        <Value>(change: (value: Value) => void) =>
        (value: Value) => {
            if (!save.isPending) change(value)
        }

    return {
        document,
        setDocument: whileEditable(setDocument),
        foreignIdCountry,
        setForeignIdCountry: whileEditable(setForeignIdCountry),
        rows,
        intents,
        toggle: whileEditable(toggle),
        /** The answer's rows are in: until then a missing row says nothing. */
        isReady: !!config.data,
        isLoading: config.isLoading,
        isError: config.isError,
        refetch: config.refetch,
        qrOnly: isQrOnly(rows),
        canContinue: !!config.data && Object.values(intents).some(Boolean),
        save,
        skip,
    }
}
