'use client'
import { useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'
import DownloadQR from '@/components/Migration/DownloadQR'
import type { MigrationSurface } from '@/constants/migration.consts'
import type { StoreHandoff } from '@/utils/migration.utils'

// desktop download surface: any download CTA on a laptop opens this QR
// instead of a dead store link.
export default function ScanToDownloadModal({
    visible,
    onClose,
    surface,
    handoff,
}: {
    visible: boolean
    onClose: () => void
    surface: MigrationSurface
    /**
     * Where the scanning phone should land once the app opens, such as
     * the /shhhhh door's `dest=/card`. Omitted by the surfaces
     * that just want the download.
     */
    handoff?: StoreHandoff
}) {
    const t = useTranslations('migration')
    const tCommon = useTranslations('common')
    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            icon="qr-code"
            title={t('qr.title')}
            content={<DownloadQR surface={surface} handoff={handoff} />}
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
