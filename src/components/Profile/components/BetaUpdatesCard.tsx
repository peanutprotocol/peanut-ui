'use client'

import Card from '@/components/Global/Card'
import { Toggle } from '@/components/0_Bruddle/Toggle'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useOtaChannel } from '@/hooks/useOtaChannel'
import { BETA_OTA_CHANNEL } from '@/utils/capgo-updater'
import { copyTextToClipboardWithFallback } from '@/utils/general.utils'
import { useTranslations } from 'next-intl'

/**
 * Internal-testing switch, revealed by five taps on the version line. Joining
 * points the device at the `staging` Capgo channel, which every merge to `dev`
 * publishes to; leaving drops it back to the store bundle.
 */
export const BetaUpdatesCard = () => {
    const t = useTranslations('profile.about.beta')
    const toast = useToast()
    const { supported, status, isBeta, busy, setBeta } = useOtaChannel()

    if (!supported) return null

    const onToggle = async (beta: boolean) => {
        const result = await setBeta(beta)
        if (result === 'closed') toast.error(t('closed', { channel: BETA_OTA_CHANNEL }))
        else if (result === 'failed') toast.error(t('failed'))
        else if (beta) toast.success(t('joined'))
        // Leaving reloads the app onto the store bundle, so there is no toast to see.
    }

    return (
        <Card position="single" className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h2 className="text-body-s font-bold text-black">{t('heading')}</h2>
                    <p className="text-body-xs text-foreground-secondary">
                        {t('description', { channel: BETA_OTA_CHANNEL })}
                    </p>
                </div>
                <Toggle checked={isBeta} disabled={busy} onChange={onToggle} aria-label={t('heading')} />
            </div>

            <dl className="space-y-1 text-body-xs text-foreground-secondary">
                <div className="flex justify-between gap-4">
                    <dt>{t('channelLabel')}</dt>
                    <dd>{status?.channel ?? t('defaultChannel')}</dd>
                </div>
                <div className="flex justify-between gap-4">
                    <dt>{t('bundleLabel')}</dt>
                    <dd>{status?.bundleVersion ?? '—'}</dd>
                </div>
                {status?.deviceId && (
                    <div className="flex justify-between gap-4">
                        <dt>{t('deviceLabel')}</dt>
                        <dd>
                            <button
                                type="button"
                                className="text-left break-all underline"
                                onClick={() =>
                                    copyTextToClipboardWithFallback(status.deviceId!).then(() =>
                                        toast.info(t('deviceCopied'))
                                    )
                                }
                            >
                                {status.deviceId}
                            </button>
                        </dd>
                    </div>
                )}
            </dl>
        </Card>
    )
}
