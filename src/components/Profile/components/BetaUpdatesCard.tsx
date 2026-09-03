'use client'

import Card from '@/components/Global/Card'
import { Toggle } from '@/components/0_Bruddle/Toggle'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useOtaChannel } from '@/hooks/useOtaChannel'
import { BETA_OTA_CHANNEL } from '@/utils/capgo-updater'
import { copyTextToClipboard } from '@/utils/clipboard.utils'
import { useTranslations } from 'next-intl'

/**
 * Internal-testing switch, revealed by five taps on the version line. Joining
 * points the device at the `staging` Capgo channel, which every merge to `dev`
 * publishes to; leaving drops it back to the store bundle.
 *
 * The five-tap gesture is the only thing that keeps `staging` off the devices
 * of people who did not mean to be there — there is no cohort and no server
 * check. It is not a security boundary: `setChannel` talks to Capgo directly,
 * and Capgo refuses the join unless the channel allows self-assignment, which
 * is where the real access control lives.
 *
 * The card renders on every native build, so the off switch is always
 * reachable: it is the only way back to the store bundle, and hiding it would
 * strand a device on beta code.
 */

/**
 * What the About screen's five-tap reveal can promise: the card only renders
 * on a native build.
 */
export function useBetaUpdatesAccess(): { supported: boolean } {
    const { supported } = useOtaChannel()
    return { supported }
}

export const BetaUpdatesCard = () => {
    const t = useTranslations('profile.about.beta')
    const toast = useToast()
    const { supported, status, isBeta, busy, setBeta } = useOtaChannel()

    if (!supported) return null

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
                            <LinkButton
                                className="text-left break-all"
                                onClick={() => void copyDeviceId(status.deviceId!)}
                            >
                                {status.deviceId}
                            </LinkButton>
                        </dd>
                    </div>
                )}
            </dl>
        </Card>
    )
}
