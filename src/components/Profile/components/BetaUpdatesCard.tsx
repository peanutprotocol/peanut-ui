'use client'

import Card from '@/components/Global/Card'
import { Toggle } from '@/components/0_Bruddle/Toggle'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
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
 * Joining is gated on the `beta-ota-channel` cohort. The tap gesture only
 * controls discoverability, and Capgo's self-assignment setting is global —
 * it cannot tell an internal tester from a customer — so without the cohort
 * the two together let anyone who finds the gesture onto the `dev` firehose
 * whenever self-assignment is open.
 *
 * The cohort gates the JOIN, never the card. An earlier version gated the
 * whole reveal, so the flag going missing hid the switch from everyone and
 * looked exactly like being outside the cohort — invisible for months. A
 * blocked device now says so on screen and names the fix.
 *
 * The card therefore renders on every native build, and the off switch stays
 * live whatever the cohort says: it is the only way back to the store bundle,
 * and a device offboarded mid-beta would otherwise be stranded on beta code.
 */
export const BETA_OTA_FLAG = 'beta-ota-channel'

/**
 * What the About screen's five-tap reveal can promise: the card only renders
 * on a native build.
 */
export function useBetaUpdatesAccess(): { supported: boolean } {
    const { supported } = useOtaChannel()
    return { supported }
}

/** Outside the cohort, only a device already on beta may work the switch — off. */
function useCanJoinBeta(): boolean {
    // nonProdBypass: staging and preview builds are internal by construction,
    // so the cohort only has to exist for the production store binary.
    return useFeatureFlags()(BETA_OTA_FLAG, { nonProdBypass: true })
}

export const BetaUpdatesCard = () => {
    const t = useTranslations('profile.about.beta')
    const toast = useToast()
    const { supported, status, isBeta, busy, setBeta } = useOtaChannel()
    const canJoin = useCanJoinBeta()

    if (!supported) return null

    const blockedFromJoining = !canJoin && !isBeta

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
                    disabled={busy || blockedFromJoining}
                    onChange={onToggle}
                    aria-label={t('heading')}
                />
            </div>

            {blockedFromJoining && <p className="text-body-xs text-foreground-secondary">{t('notEligible')}</p>}

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
