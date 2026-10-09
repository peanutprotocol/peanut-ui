import { useEffect, useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useAuth } from '@/context/authContext'
import { isCapacitor } from '@/utils/capacitor'
import {
    StatementDownloadError,
    downloadFailure,
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
    /** runs after the file is saved */
    onSaved: () => void
}

/**
 * Downloads the statement file for the chosen period and format. On the web
 * one tap fetches and saves. Native takes two: the first tap prepares the
 * file, the second opens the share sheet on a fresh tap, which keeps the
 * user's consent (`isPrepared` turns the button into Save).
 *
 * Failures are split here, at the source: a period that is too long is fixed
 * by the period field (`periodTooLong`, a field error); everything else is a
 * flow failure (`error`).
 */
export function useStatementDownload({ format, from, to, fromIso, toIso, preset, onSaved }: StatementDownloadOptions) {
    const locale = useLocale()
    const { user } = useAuth()
    const [prepared, setPrepared] = useState<StatementFile | null>(null)
    const [failure, setFailure] = useState<StatementDownloadFailure | null>(null)
    const [isDownloading, setIsDownloading] = useState(false)
    const busy = useRef(false)
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

    const download = async () => {
        if (busy.current) return
        busy.current = true
        setIsDownloading(true)
        setFailure(null)
        const current = identity
        const isCurrent = () => mounted.current && identityRef.current === current
        // one shape for all four events, so a funnel can be built on it
        const event = {
            format,
            platform: isCapacitor() ? 'native' : 'web',
            ...periodAnalytics({ preset, from, to }),
        }
        try {
            let file = prepared
            if (!file) {
                posthog.capture(ANALYTICS_EVENTS.ACTIVITY_EXPORT_STARTED, event)
                file = await prepareStatement({ format, locale, fromIso, toIso })
                if (!isCurrent()) return
                if (isCapacitor()) {
                    // the second tap opens the native share sheet with active user consent
                    setPrepared(file)
                    return
                }
            }
            // only the native share sheet can be cancelled; the file stays ready for another tap
            if ((await saveStatement(file)) === 'cancelled') return
            posthog.capture(ANALYTICS_EVENTS.ACTIVITY_EXPORT_SAVED, event)
            if (!isCurrent()) return
            setPrepared(null)
            onSaved()
        } catch (cause) {
            const reason = cause instanceof Error ? cause.message : 'EXPORT_FAILED'
            // `refusal` is the API's check name (e.g. reward-credit-missing): which
            // ledger gap stopped the file, without any record id
            const refusal = cause instanceof StatementDownloadError ? cause.refusal : undefined
            posthog.capture(ANALYTICS_EVENTS.ACTIVITY_EXPORT_FAILED, { ...event, reason, refusal })
            if (!isCurrent()) return
            setFailure(downloadFailure(reason))
        } finally {
            busy.current = false
            if (mounted.current) setIsDownloading(false)
        }
    }

    return {
        download,
        isDownloading,
        /** native only: the file is ready and the next tap saves it */
        isPrepared: prepared !== null,
        periodTooLong: failure === 'tooLarge',
        error: failure === 'tooLarge' ? null : failure,
    }
}
