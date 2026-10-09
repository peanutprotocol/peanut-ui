'use client'
import { useLocale, useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import DownloadQR from '@/components/Migration/DownloadQR'
import StoreButtons from '@/components/Migration/StoreButtons'
import { useDeviceType } from '@/hooks/useGetDeviceType'
import type { MigrationSurface } from '@/constants/migration.consts'
import { localizeMarketingPath, type AppLocale } from '@/i18n/app/config'
import { storeForDevice, type StoreHandoff } from '@/utils/migration.utils'

export default function ScanToDownloadModal({
    visible,
    onClose,
    surface,
    handoff,
    showLogIn = false,
}: {
    visible: boolean
    onClose: () => void
    surface: MigrationSurface
    /** Optional guest context, such as /shhhhh's campaign and /card destination. */
    handoff?: StoreHandoff
    /** Logged-out web visitors get "Log in" instead of the support link: signup is app-only, login is not. */
    showLogIn?: boolean
}) {
    const t = useTranslations('migration')
    const locale = useLocale() as AppLocale
    const { deviceType } = useDeviceType()
    // a phone gets its store button; a desktop has no store, so it scans the QR
    const store = storeForDevice(deviceType)
    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            tone="peanut"
            icon={store ? 'mobile-install' : 'qr-code'}
            title={t('qr.title')}
            content={
                <div className="flex flex-col items-center gap-4">
                    {store ? <StoreButtons surface={surface} /> : <DownloadQR surface={surface} handoff={handoff} />}
                    {showLogIn ? (
                        <LinkButton href="/setup?step=login">{t('qr.logIn')}</LinkButton>
                    ) : (
                        <LinkButton href={localizeMarketingPath('/en/help', locale)}>
                            {t('sunset.supportLink')}
                        </LinkButton>
                    )}
                </div>
            }
        />
    )
}
