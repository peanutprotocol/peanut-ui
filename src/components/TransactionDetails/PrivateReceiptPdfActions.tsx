'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { useToast } from '@/components/0_Bruddle/Toast'
import { downloadBlob } from '@/components/Card/share-asset/captureShareAsset'
import { Icon } from '@/components/Global/Icons/Icon'
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

export function PrivateReceiptPdfActions({
    entryId,
    kind,
    shareVariant = 'purple',
}: {
    entryId: string
    kind: string
    shareVariant?: 'purple' | 'stroke'
}) {
    const t = useAppTranslations('transaction')
    const toast = useToast()
    const locale = useLocale()
    const [pdf, setPdf] = useState<ReceiptPdfFile | null>(null)
    const [error, setError] = useState(false)
    const [busy, setBusy] = useState<'share' | 'download' | null>(null)
    const pdfPath: `/${string}` = `/receipt/${encodeURIComponent(entryId)}/pdf?kind=${encodeURIComponent(kind)}&locale=${encodeURIComponent(locale)}`

    useEffect(() => {
        let cancelled = false
        setPdf(null)
        setError(false)
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
    }, [entryId, pdfPath])

    const share = async () => {
        setBusy('share')
        try {
            let receipt = pdf
            if (!receipt) {
                setError(false)
                try {
                    receipt = await fetchReceiptPdf(pdfPath, entryId)
                    setPdf(receipt)
                } catch (cause) {
                    setError(true)
                    Sentry.captureException(cause, { tags: { feature: 'receipt-pdf', action: 'share-retry' } })
                    toast.error(t('actions.receiptPdfUnavailable'))
                    return
                }
            }
            const file = new File([receipt.blob], receipt.filename, { type: 'application/pdf' })
            if (navigator.share && navigator.canShare?.({ files: [file] })) {
                await navigator.share({ files: [file], title: t('officialReceipt.pdf.title') })
            } else {
                downloadBlob(receipt.blob, receipt.filename)
                toast.info(t('actions.pdfDownloadedInstead'))
            }
        } catch (cause) {
            if (cause instanceof Error && cause.name === 'AbortError') return
            Sentry.captureException(cause, { tags: { feature: 'receipt-pdf', action: 'share' } })
            toast.error(t('actions.receiptPdfUnavailable'))
        } finally {
            setBusy(null)
        }
    }

    const download = async () => {
        setBusy('download')
        try {
            let receipt = pdf
            if (!receipt) {
                setError(false)
                try {
                    receipt = await fetchReceiptPdf(pdfPath, entryId)
                    setPdf(receipt)
                } catch (cause) {
                    setError(true)
                    Sentry.captureException(cause, { tags: { feature: 'receipt-pdf', action: 'download-retry' } })
                    toast.error(t('actions.receiptPdfUnavailable'))
                    return
                }
            }
            const file = new File([receipt.blob], receipt.filename, { type: 'application/pdf' })
            if (isCapacitor() && navigator.share && navigator.canShare?.({ files: [file] })) {
                await navigator.share({ files: [file], title: t('officialReceipt.pdf.title') })
            } else {
                downloadBlob(receipt.blob, receipt.filename)
            }
        } catch (cause) {
            if (cause instanceof Error && cause.name === 'AbortError') return
            Sentry.captureException(cause, { tags: { feature: 'receipt-pdf', action: 'download' } })
            toast.error(t('actions.receiptPdfUnavailable'))
        } finally {
            setBusy(null)
        }
    }

    // Keep actions disabled while the initial prefetch is unresolved, then
    // make them clickable after a failure so either action can retry.
    const unavailable = !pdf && !error
    const title = error ? t('actions.receiptPdfUnavailable') : undefined

    return (
        <div className="flex flex-col gap-2 pr-1 print:hidden" title={title}>
            <Button
                variant={shareVariant}
                shadowSize="4"
                className="w-full"
                loading={busy === 'share'}
                disabled={unavailable || busy !== null}
                onClick={share}
                icon={<Icon name="share" size={20} />}
            >
                {t('actions.shareReceipt')}
            </Button>
            <Button
                variant="stroke"
                shadowSize="4"
                className="w-full"
                loading={busy === 'download'}
                disabled={unavailable || busy !== null}
                onClick={download}
                icon={<Icon name="download" size={20} />}
            >
                {t('actions.downloadPdf')}
            </Button>
        </div>
    )
}
