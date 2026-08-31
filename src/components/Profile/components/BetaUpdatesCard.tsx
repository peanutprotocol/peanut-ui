'use client'

import Card from '@/components/Global/Card'
import { Toggle } from '@/components/0_Bruddle/Toggle'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useFeatureFlags } from '@/hooks/useFeatureFlag'
import { useOtaChannel } from '@/hooks/useOtaChannel'
import { BETA_OTA_CHANNEL } from '@/utils/capgo-updater'
import { copyTextToClipboardWithFallback } from '@/utils/general.utils'
import { useTranslations } from 'next-intl'

/**
 * Internal-testing switch, revealed by five taps on the version line. Joining
 * points the device at the `staging` Capgo channel, which every merge to `dev`
 * publishes to; leaving drops it back to the store bundle.
 *
 * The tap gesture hides the control; the PostHog flag decides who may use it.
 * `staging` carries unreleased code against production money, so eligibility is
 * a cohort someone maintains — not a gesture any customer can stumble into once
 * self-assignment is enabled on the channel.
 */
export const BETA_OTA_FLAG = 'beta-ota-channel'

export const BetaUpdatesCard = () => {
    const t = useTranslations('profile.about.beta')
    const toast = useToast()
    const isEnabled = useFeatureFlags()
    const { supported, status, isBeta, busy, setBeta } = useOtaChannel()

    // nonProdBypass: previews and local builds are already non-production by
    // definition, and QA needs the switch there without a cohort edit.
    if (!supported || !isEnabled(BETA_OTA_FLAG, { nonProdBypass: true })) return null

    const onToggle = async (beta: boolean) => {
        switch (await setBeta(beta)) {
            case 'staged':
                toast.success(t('staged'))
                break
            case 'joined':
                toast.success(t('joined'))
                break
            case 'join-no-bundle':
                toast.warning(t('joinedWithoutBundle'))
                break
            case 'closed':
                toast.error(t('closed', { channel: BETA_OTA_CHANNEL }))
                break
            case 'failed':
                toast.error(t('failed'))
                break
            // 'left' reloads the app onto the store bundle — no toast survives it.
        }
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
