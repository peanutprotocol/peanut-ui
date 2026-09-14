'use client'
import { useLocale, useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import DownloadQR from '@/components/Migration/DownloadQR'
import type { MigrationSurface } from '@/constants/migration.consts'
import { localizeMarketingPath, type AppLocale } from '@/i18n/app/config'
import type { StoreHandoff } from '@/utils/migration.utils'

export default function ScanToDownloadModal({
    visible,
    onClose,
    surface,
    handoff,
}: {
    visible: boolean
    onClose: () => void
    surface: MigrationSurface
    /** Optional guest context, such as /shhhhh's campaign and /card destination. */
    handoff?: StoreHandoff
}) {
    const t = useTranslations('migration')
    const locale = useLocale() as AppLocale
    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            icon="qr-code"
            title={t('qr.title')}
            content={
                <div className="flex flex-col items-center gap-4">
                    <DownloadQR surface={surface} handoff={handoff} />
                    <LinkButton href={localizeMarketingPath('/en/help', locale)}>{t('sunset.supportLink')}</LinkButton>
                </div>
            }
        />
    )
}
