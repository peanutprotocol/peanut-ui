'use client'

import { useLocale } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { isCapacitor } from '@/utils/capacitor'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { openReceiptPdfUrl, receiptPdfPath } from './receipt-pdf-link.utils'

/**
 * Download affordance for the server-rendered PDF receipt
 * (GET /receipt/[entryId]/pdf). One DOM shape everywhere so SSR/prerender and
 * hydration agree: a plain anchor. On web the relative href downloads from the
 * current origin; in Capacitor there are no local API routes (static export),
 * so the click is intercepted and the production URL opens in the system
 * browser sheet via the existing external-open pattern.
 *
 * The locale rides the URL, not a cookie: the PDF bytes vary by locale and
 * final receipts are CDN-cached by URL, and the native path opens an external
 * browser that has no app cookies at all.
 */
export function DownloadReceiptPdfLink({ entryId, kind }: { entryId: string; kind: string }) {
    const t = useAppTranslations('transaction')
    const locale = useLocale()
    const pdfPath = receiptPdfPath(entryId, kind, locale)

    return (
        // primary: download is the public receipt's one primary
        <Button
            variant="primary"
            href={pdfPath}
            download
            external
            shadowSize="4"
            onClick={(e) => {
                if (isCapacitor()) {
                    e.preventDefault()
                    openReceiptPdfUrl(pdfPath)
                }
            }}
            className="justify-center print:hidden"
        >
            <Icon name="download" size={20} />
            {t('actions.downloadPdf')}
        </Button>
    )
}
