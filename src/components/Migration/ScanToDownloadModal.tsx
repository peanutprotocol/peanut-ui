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
}: {
    visible: boolean
    onClose: () => void
    surface: MigrationSurface
}) {
    const t = useTranslations('migration')
    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            icon="qr-code"
            title={t('qr.title')}
            content={<DownloadQR surface={surface} />}
            ctas={[{ text: t('qr.done'), variant: 'purple', shadowSize: '4', onClick: onClose }]}
        />
    )
}
