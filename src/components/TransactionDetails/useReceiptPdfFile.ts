'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect, useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import { useToast } from '@/components/0_Bruddle/Toast'
import { downloadBlob } from '@/components/Card/share-asset/captureShareAsset'
import { authReady, getAuthHeaders } from '@/utils/auth-token'
import { isCapacitor } from '@/utils/capacitor'
import { shareableUrl } from '@/utils/url.utils'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'

type ReceiptPdfFile = { blob: Blob; filename: string }

function filenameFromDisposition(disposition: string | undefined, entryId: string): string {
    const match = /filename="?([^";]+)"?/i.exec(disposition ?? '')
    return match?.[1] ?? `peanut-receipt-${entryId}.pdf`
}

async function fetchReceiptPdf(path: `/${string}`, entryId: string): Promise<ReceiptPdfFile> {
    await authReady()
    const headers = getAuthHeaders()
    if (!headers.Authorization) throw new Error('Authentication required')

    if (isCapacitor()) {
        const { CapacitorHttp } = await import('@capacitor/core')
        const response = await CapacitorHttp.request({
            url: shareableUrl(path),
            method: 'GET',
            headers,
            responseType: 'arraybuffer',
            connectTimeout: 15_000,
            readTimeout: 30_000,
        })
        if (response.status < 200 || response.status >= 300 || typeof response.data !== 'string') {
            throw new Error(`Failed to load receipt PDF (${response.status})`)
        }
        const binary = atob(response.data)
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
        return {
            blob: new Blob([bytes], { type: 'application/pdf' }),
            filename: filenameFromDisposition(
                response.headers['content-disposition'] ?? response.headers['Content-Disposition'],
                entryId
            ),
        }
    }

    const response = await fetch(path, { headers, cache: 'no-store' })
    if (!response.ok) throw new Error(`Failed to load receipt PDF (${response.status})`)
    return {
        blob: await response.blob(),
        filename: filenameFromDisposition(response.headers.get('content-disposition') ?? undefined, entryId),
    }
}

/**
 * the authenticated pdf-file behavior that lived inside
 * PrivateReceiptPdfActions (#3159), as a hook so the receipt's primary share
 * button and the more-actions drawer rows reuse one fetch/share/download
 * path. auth, native CapacitorHttp handling, prefetch and retry-on-failure
 * semantics are unchanged — including the guarantee that a cached file is
 * shared synchronously from the click, which native share sheets require.
 */
export function useReceiptPdfFile({
    entryId,
    kind,
    prefetch = false,
}: {
    entryId: string
    kind: string
    /** fetch eagerly on mount — the private-receipt behavior since #3159 */
    prefetch?: boolean
}) {
    const t = useAppTranslations('transaction')
    const toast = useToast()
    const locale = useLocale()
    const [pdf, setPdf] = useState<ReceiptPdfFile | null>(null)
    const [error, setError] = useState(false)
    const [busy, setBusy] = useState<'share' | 'download' | null>(null)
    const pdfPath: `/${string}` = `/receipt/${encodeURIComponent(entryId)}/pdf?kind=${encodeURIComponent(kind)}&locale=${encodeURIComponent(locale)}`
    // the identity a cached or in-flight file belongs to; a receipt/locale
    // switch must never share the previous transaction's document
    const pathRef = useRef(pdfPath)
    pathRef.current = pdfPath
    // state alone cannot guard same-tick double taps (it only lands on the
    // next render); the ref makes repeated selection while pending a no-op
    const busyRef = useRef(false)

    useEffect(() => {
        // always drop a stale file on identity change — with or without
        // prefetch; the on-demand path must refetch for the new receipt
        setPdf(null)
        setError(false)
        if (!prefetch) return
        let cancelled = false
        void fetchReceiptPdf(pdfPath, entryId)
            .then((file) => {
                if (!cancelled) setPdf(file)
            })
            .catch((cause) => {
                if (cancelled) return
                setError(true)
                Sentry.captureException(cause, { tags: { feature: 'receipt-pdf', action: 'prefetch' } })
            })
        return () => {
            cancelled = true
        }
    }, [entryId, pdfPath, prefetch])

    const runFileAction = async (
        action: 'share' | 'download',
        deliver: (file: File, receipt: ReceiptPdfFile) => Promise<void>
    ) => {
        if (busyRef.current) return
        busyRef.current = true
        setBusy(action)
        const requestPath = pdfPath
        try {
            // cached file first, synchronously — the share sheet must open
            // inside the click's user activation when the prefetch landed
            let receipt = pdf
            if (!receipt) {
                setError(false)
                try {
                    receipt = await fetchReceiptPdf(requestPath, entryId)
                } catch (cause) {
                    setError(true)
                    Sentry.captureException(cause, { tags: { feature: 'receipt-pdf', action: `${action}-retry` } })
                    toast.error(t('actions.receiptPdfUnavailable'))
                    return
                }
                // the receipt changed while fetching: this file belongs to
                // the previous identity — do not cache it, do not deliver it
                if (pathRef.current !== requestPath) return
                setPdf(receipt)
            }
            const file = new File([receipt.blob], receipt.filename, { type: 'application/pdf' })
            await deliver(file, receipt)
        } catch (cause) {
            if (cause instanceof Error && cause.name === 'AbortError') return
            Sentry.captureException(cause, { tags: { feature: 'receipt-pdf', action } })
            toast.error(t('actions.receiptPdfUnavailable'))
        } finally {
            busyRef.current = false
            setBusy(null)
        }
    }

    const share = () =>
        runFileAction('share', async (file, receipt) => {
            if (navigator.share && navigator.canShare?.({ files: [file] })) {
                await navigator.share({ files: [file], title: t('officialReceipt.pdf.title') })
            } else {
                downloadBlob(receipt.blob, receipt.filename)
                toast.info(t('actions.pdfDownloadedInstead'))
            }
        })

    const download = () =>
        runFileAction('download', async (file, receipt) => {
            if (isCapacitor() && navigator.share && navigator.canShare?.({ files: [file] })) {
                await navigator.share({ files: [file], title: t('officialReceipt.pdf.title') })
            } else {
                downloadBlob(receipt.blob, receipt.filename)
            }
        })

    // with prefetch on, actions stay disabled while the initial fetch is
    // unresolved, then become clickable after a failure so either can retry
    const unavailable = prefetch && !pdf && !error

    return { share, download, busy, unavailable, error }
}
