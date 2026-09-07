'use client'
import { useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'
import AppQrCode from '@/components/Migration/AppQrCode'
import AppStorePair from '@/components/Migration/AppStorePair'
import DownloadQR from '@/components/Migration/DownloadQR'
import type { MigrationSurface } from '@/constants/migration.consts'
import type { StoreHandoff } from '@/utils/migration.utils'

/**
 * The same packaged QR + hint + store pair `DownloadQR` renders, but built from
 * the components that take a hand-off, so the code a laptop shows encodes where
 * the phone should land after install and the store buttons carry it too.
 *
 * Only rendered when a caller passes one: with no hand-off the modal keeps
 * `DownloadQR` verbatim, so every existing caller (home banner, guest flow, the
 * dev surface registry) is byte-identical to today.
 */
function HandoffDownloadQR({ surface, handoff }: { surface: MigrationSurface; handoff: StoreHandoff }) {
    const t = useTranslations('migration')
    return (
        <div className="flex w-full flex-col items-center gap-3 py-2">
            <AppQrCode surface={surface} handoff={handoff} />
            <span className="text-body-xs text-foreground-secondary">{t('qr.scanHint')}</span>
            <AppStorePair surface={surface} handoff={handoff} layout="column" />
        </div>
    )
}

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
     * Where the scanning phone should land once the app opens — fold 4's
     * `dest=/send`, the /shhhhh door's `dest=/card`. Omitted by the surfaces
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
            content={
                handoff ? <HandoffDownloadQR surface={surface} handoff={handoff} /> : <DownloadQR surface={surface} />
            }
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
