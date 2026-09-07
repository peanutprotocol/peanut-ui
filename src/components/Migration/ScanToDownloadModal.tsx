'use client'
import { useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'
import DownloadQR from '@/components/Migration/DownloadQR'
import type { MigrationSurface } from '@/constants/migration.consts'

// desktop download surface: any download CTA on a laptop opens this QR
// instead of a dead store link.
export default function ScanToDownloadModal({
    visible,
    onClose,
    surface,
    payload,
}: {
    visible: boolean
    onClose: () => void
    surface: MigrationSurface
    /** deferred-link querystring, so the scanning phone lands on the caller's dest */
    payload?: string
}) {
    const t = useTranslations('migration')
    const tCommon = useTranslations('common')
    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            icon="qr-code"
            title={t('qr.title')}
            content={<DownloadQR surface={surface} payload={payload} />}
            ctas={[
                {
                    text: tCommon('close'),
                    shadowSize: '4',
                    onClick: onClose,
                },
            ]}
        />
    )
}
