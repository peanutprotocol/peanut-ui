'use client'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import ActionModal from '@/components/Global/ActionModal'
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
                    {/* main lacks the DS LinkButton (dev-only); plain underlined link until the DS lands on main */}
                    <Link
                        href={localizeMarketingPath('/en/help', locale)}
                        className="text-sm text-grey-1 underline hover:text-n-1"
                    >
                        {t('sunset.supportLink')}
                    </Link>
                </div>
            }
        />
    )
}
