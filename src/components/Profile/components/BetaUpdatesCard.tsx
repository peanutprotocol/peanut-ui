'use client'

import Card from '@/components/Global/Card'
import { Toggle } from '@/components/0_Bruddle/Toggle'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useFeatureFlags } from '@/hooks/useFeatureFlag'
import { useOtaChannel } from '@/hooks/useOtaChannel'
import { BETA_OTA_CHANNEL } from '@/utils/capgo-updater'
import { copyTextToClipboard } from '@/utils/clipboard.utils'
import { useTranslations } from 'next-intl'

/**
 * Internal-testing switch, revealed by five taps on the version line. Joining
 * points the device at the `staging` Capgo channel, which every merge to `dev`
 * publishes to; leaving drops it back to the store bundle.
 *
 * The tap gesture hides the control; the PostHog cohort keeps customers from
 * joining once self-assignment is open on the channel. Neither is a security
 * boundary — `setChannel` talks to Capgo directly — they keep `staging` off the
 * devices of people who did not mean to be there.
 *
 * A device already ON the channel keeps the card whatever the cohort says: the
 * off switch is the only way back to the store bundle, and hiding it when
 * someone is offboarded (or the flag fails to load) would strand them on beta
 * code forever.
 */
export const BETA_OTA_FLAG = 'beta-ota-channel'

/**
 * What the About screen's five-tap reveal can promise: the card only renders
 * on a native build, and outside the cohort only for a device already on beta.
 */
export function useBetaUpdatesAccess(): { supported: boolean; visible: boolean } {
    const isEnabled = useFeatureFlags()
    const { supported, isBeta } = useOtaChannel()
    const mayJoin = isEnabled(BETA_OTA_FLAG, { nonProdBypass: true })
    return { supported, visible: supported && (mayJoin || isBeta) }
}

export const BetaUpdatesCard = () => {
    const t = useTranslations('profile.about.beta')
    const toast = useToast()
    const isEnabled = useFeatureFlags()
    const { supported, status, isBeta, busy, setBeta } = useOtaChannel()

    // nonProdBypass: previews and local builds are already non-production by
    // definition, and QA needs the switch there without a cohort edit.
    const mayJoin = isEnabled(BETA_OTA_FLAG, { nonProdBypass: true })
    if (!supported || (!mayJoin && !isBeta)) return null

    const copyDeviceId = async (deviceId: string) => {
        if (await copyTextToClipboard(deviceId)) toast.info(t('deviceCopied'))
        else toast.error(t('deviceCopyFailed'))
    }

    const onToggle = async (beta: boolean) => {
        const result = await setBeta(beta)
        switch (result) {
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
            case 'left-still-beta':
                toast.error(t('leftStillBeta'))
                break
            case 'left-override':
                toast.error(t('leftOverride'))
                break
            case 'left-unconfirmed':
                toast.error(t('leftUnconfirmed'))
                break
            // Only reached when reset() did not reload — a device already on the
            // store bundle. Otherwise the app is gone before this runs.
            case 'left':
                toast.success(t('left'))
                break
            default: {
                // Every outcome owes the tester a sentence. This PR added three
                // of them; a fourth added silently would toast nothing at all.
                const unhandled: never = result
                console.warn('[capgo] unhandled channel switch result:', unhandled)
            }
        }
    }

    return (
        <Card position="single" className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h2 className="text-label-l text-black">{t('heading')}</h2>
                    <p className="text-body-xs text-foreground-secondary">
                        {t('description', { channel: BETA_OTA_CHANNEL })}
                    </p>
                </div>
                <Toggle
                    checked={isBeta}
                    disabled={busy || (!mayJoin && !isBeta)}
                    onChange={onToggle}
                    aria-label={t('heading')}
                />
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
                                onClick={() => void copyDeviceId(status.deviceId!)}
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
