'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Icon } from '@/components/Global/Icons/Icon'
import {
    canDeliverReceiptAttachment,
    deliverReceiptAttachment,
    fetchReceiptAttachment,
    type ReceiptAttachment,
} from './receipt-attachment'

type AttachmentState = {
    url: string
    status: 'loading' | 'ready' | 'error' | 'update'
    file?: ReceiptAttachment
}

export function ReceiptAttachmentRow({ url }: { url: string }) {
    const t = useAppTranslations('transaction')
    const tCommon = useTranslations('common')
    const [state, setState] = useState<AttachmentState>({ url, status: 'loading' })
    const [attempt, setAttempt] = useState(0)
    const [busy, setBusy] = useState(false)
    const deliveryController = useRef<AbortController | null>(null)
    const urlRef = useRef(url)
    urlRef.current = url
    const current = state.url === url ? state : { url, status: 'loading' as const }

    useLayoutEffect(() => {
        setBusy(false)
        return () => {
            deliveryController.current?.abort()
            deliveryController.current = null
        }
    }, [url])

    useEffect(() => {
        const controller = new AbortController()
        if (!canDeliverReceiptAttachment()) {
            setState({ url, status: 'update' })
            return
        }
        setState({ url, status: 'loading' })
        void fetchReceiptAttachment(url, controller.signal).then(
            (file) => {
                if (!controller.signal.aborted) setState({ url, status: 'ready', file })
            },
            () => {
                if (!controller.signal.aborted) setState({ url, status: 'error' })
            }
        )
        return () => controller.abort()
    }, [url, attempt])

    const download = async () => {
        if (!current.file || deliveryController.current) return
        const controller = new AbortController()
        deliveryController.current = controller
        setBusy(true)
        try {
            await deliverReceiptAttachment(current.file, controller.signal)
            if (!controller.signal.aborted && urlRef.current === url) setState({ ...current, status: 'ready' })
        } catch {
            if (!controller.signal.aborted && urlRef.current === url) setState({ ...current, status: 'error' })
        } finally {
            if (deliveryController.current === controller) {
                deliveryController.current = null
                if (!controller.signal.aborted) setBusy(false)
            }
        }
    }

    return (
        <DataRow
            label={t('rows.attachment')}
            loading={current.status === 'loading'}
            value={
                current.status === 'ready' ? (
                    <LinkButton onClick={() => void download()} disabled={busy}>
                        {t('rows.download')}
                        <Icon name="download" size={14} className="shrink-0" />
                    </LinkButton>
                ) : (
                    <span className="flex flex-col items-end gap-4 text-body-s">
                        <span role="alert">
                            {t(
                                current.status === 'update'
                                    ? 'actions.attachmentUpdateRequired'
                                    : 'actions.attachmentUnavailable'
                            )}
                        </span>
                        {current.status === 'error' && (
                            <LinkButton
                                disabled={busy}
                                onClick={() => (current.file ? void download() : setAttempt((value) => value + 1))}
                            >
                                {tCommon('tryAgain')}
                            </LinkButton>
                        )}
                    </span>
                )
            }
        />
    )
}
