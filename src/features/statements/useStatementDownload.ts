import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLocale } from 'next-intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useAuth } from '@/context/authContext'
import { isCapacitor } from '@/utils/capacitor'
import {
    StatementDownloadError,
    downloadFailure,
    downloadStatement,
    prepareStatement,
    saveStatement,
    type StatementDownloadFailure,
    type StatementFile,
    type StatementFormat,
} from './statementDownload.utils'
import { periodAnalytics, type StatementPeriodPreset } from './statementPeriod.utils'

interface StatementDownloadOptions {
    format: StatementFormat
    /** the URL period, as local days, for the analytics shape */
    from: string | null
    to: string | null
    /** the API bounds for the same period */
    fromIso?: string
    toIso?: string
    preset?: StatementPeriodPreset
    /** runs after the file is saved, with that file; `inDocuments` when it went to the Documents folder */
    onSaved: (file: StatementFile, inDocuments: boolean) => void
}

/** Which button's work is running. */
type StatementAction = 'generate' | 'share' | 'download'

const subscribeNever = () => () => {}

/**
 * Downloads the statement file for the chosen period and format. On the web
 * one tap (`generate`) fetches and saves. The app takes two: `generate`
 * fetches the file, then `share` opens the share sheet and `download` saves
 * it to the device, each on a fresh tap, which keeps the user's consent. The
 * file stays ready for both until the period or format changes.
 *
 * Failures are split here, at the source: a period that is too long is fixed
 * by the period field (`periodTooLong`, a field error); everything else is a
 * flow failure (`error`).
 */
export function useStatementDownload({ format, from, to, fromIso, toIso, preset, onSaved }: StatementDownloadOptions) {
    const locale = useLocale()
    const { user } = useAuth()
    // the prerendered page is the web one; the app's buttons land right after hydration
    const isNative = useSyncExternalStore(subscribeNever, isCapacitor, () => false)
    const [prepared, setPrepared] = useState<StatementFile | null>(null)
    const [failure, setFailure] = useState<StatementDownloadFailure | null>(null)
    const [busy, setBusy] = useState<StatementAction | null>(null)
    const busyRef = useRef(false)
    const mounted = useRef(false)
    useEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
        }
    }, [])

    // a prepared file or a failure belongs to the request that produced it
    const identity = `${user?.user.userId}:${format}:${locale}:${fromIso}:${toIso}`
    const identityRef = useRef(identity)
    identityRef.current = identity
    useEffect(() => {
        setPrepared(null)
        setFailure(null)
    }, [identity])

    const run = async (
        action: StatementAction,
        deliver: (file: StatementFile) => Promise<'documents' | 'saved' | 'cancelled'>
    ) => {
        if (busyRef.current) return
        busyRef.current = true
        setBusy(action)
        setFailure(null)
        const current = identity
        const isCurrent = () => mounted.current && identityRef.current === current
        // one shape for all four events, so a funnel can be built on it
        const event = {
            format,
            ...periodAnalytics({ preset, from, to }),
        }
        try {
            let file = prepared
            if (!file) {
                posthog.capture(ANALYTICS_EVENTS.ACTIVITY_EXPORT_STARTED, event)
                file = await prepareStatement({ format, locale, fromIso, toIso })
                if (!isCurrent()) return
                if (isCapacitor()) {
                    // Share and Download open on a later tap, with active user consent
                    setPrepared(file)
                    return
                }
            }
            // only a share sheet can be cancelled, which saves nothing
            const saved = await deliver(file)
            if (saved === 'cancelled') return
            posthog.capture(ANALYTICS_EVENTS.ACTIVITY_EXPORT_SAVED, event)
            if (!isCurrent()) return
            onSaved(file, saved === 'documents')
        } catch (cause) {
            const reason = cause instanceof Error ? cause.message : 'EXPORT_FAILED'
            // `refusal` is the API's check name (e.g. reward-credit-missing): which
            // ledger gap stopped the file, without any record id
            const refusal = cause instanceof StatementDownloadError ? cause.refusal : undefined
            posthog.capture(ANALYTICS_EVENTS.ACTIVITY_EXPORT_FAILED, { ...event, reason, refusal })
            if (!isCurrent()) return
            setFailure(downloadFailure(reason))
        } finally {
            busyRef.current = false
            if (mounted.current) setBusy(null)
        }
    }

    return {
        /** web: fetches and saves the file. App: fetches it for `share` and `download`. */
        generate: () => run('generate', saveStatement),
        /** app only, once the file is ready: the system share sheet */
        share: () => run('share', saveStatement),
        /** app only, once the file is ready: the Documents folder on Android, the share sheet on iOS */
        download: () => run('download', downloadStatement),
        busy,
        /** the app fetches first, then offers Share and Download */
        isNative,
        /** app only: the file is ready for Share and Download */
        isPrepared: prepared !== null,
        periodTooLong: failure === 'tooLarge',
        error: failure === 'tooLarge' ? null : failure,
    }
}
