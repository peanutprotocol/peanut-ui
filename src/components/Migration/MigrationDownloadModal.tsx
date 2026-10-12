'use client'
import { useTranslations } from 'next-intl'
import { AskShell } from '@/features/attention/AskShell'
import DownloadQR from '@/components/Migration/DownloadQR'
import { MIGRATION_SURFACES, STORE_NAME } from '@/constants/migration.consts'
import { openStore, storeForDevice, storeIcon } from '@/utils/migration.utils'
import { useDeviceType } from '@/hooks/useGetDeviceType'
import type { AskSurfaceProps } from '@/features/attention/types'

/**
 * Post-login "The Peanut app is here" prompt (TASK-20826), shown on the web
 * app while the pwa-sunset flag is on. Whether it shows is the attention
 * manager's call (the `install-app` ask); the web app stays available, so the
 * prompt has no deadline and "Maybe later" snoozes it through the manager.
 */
export default function MigrationDownloadModal({ onSnoozed, presentation }: AskSurfaceProps) {
    const t = useTranslations('migration')
    const { deviceType } = useDeviceType()
    const store = storeForDevice(deviceType)

    // a defer action: the tertiary link on every device (ruled 2026-09-25,
    // hugo — reverses the 2026-09-10 ghost/secondary split)
    const remindLaterCta = {
        text: t('downloadPrompt.maybeLater'),
        onClick: () => onSnoozed(),
    }

    return (
        <AskShell
            presentation={presentation}
            visible
            onClose={() => onSnoozed()}
            tone="peanut"
            icon="mobile-install"
            title={t('downloadPrompt.earlyTitle')}
            description={t('downloadPrompt.earlyDescription')}
            body={!store ? <DownloadQR surface={MIGRATION_SURFACES.DOWNLOAD_MODAL} /> : undefined}
            ctaClassName="md:flex-col gap-4"
            tertiaryCta={remindLaterCta}
            ctas={
                !store
                    ? undefined
                    : [
                          {
                              text: STORE_NAME[store],
                              variant: 'primary',
                              shadowSize: '4',
                              icon: storeIcon(store),
                              onClick: () => openStore(store, MIGRATION_SURFACES.DOWNLOAD_MODAL),
                          },
                      ]
            }
        />
    )
}
