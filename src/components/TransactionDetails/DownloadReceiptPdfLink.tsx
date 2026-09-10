'use client'

import { useLocale } from 'next-intl'
import { Icon } from '@/components/Global/Icons/Icon'
import { isCapacitor, openExternalUrl } from '@/utils/capacitor'
import { shareableUrl } from '@/utils/url.utils'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'

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
    const pdfPath: `/${string}` = `/receipt/${encodeURIComponent(entryId)}/pdf?kind=${encodeURIComponent(kind)}&locale=${encodeURIComponent(locale)}`

    return (
        <a
            href={pdfPath}
            download
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
                if (isCapacitor()) {
                    e.preventDefault()
                    void openExternalUrl(shareableUrl(pdfPath))
                }
            }}
            className="flex w-full items-center justify-center gap-2 text-body-s text-foreground-secondary underline transition-colors duration-fast hover:text-foreground-primary print:hidden"
        >
            <Icon name="download" size={16} className="text-foreground-secondary" />
            {t('actions.downloadPdf')}
        </a>
    )
}
