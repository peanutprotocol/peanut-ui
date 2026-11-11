'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import NavHeader from '@/components/Global/NavHeader'
import { ProviderFinePrint } from '@/components/Provider/ProviderFinePrint'
import { useAuth } from '@/context/authContext'
import { useHostedVerification } from '@/hooks/useHostedVerification'
import type { NextAction } from '@/types/capabilities'
import type { ProviderId } from '@/types/provider.types'

// setTimeout runs a longer delay at once
const MAX_TIMER_MS = 2_147_483_647

/**
 * The Pix provider's own identity check, where it takes no shared verification: it happens on the
 * provider's page (`action.url`). Back from that page, or on "I'm done", the app reads the
 * capabilities again: the route then waits on the provider's decision (the waiting screen) or still
 * names this step. A link past `expiresAt` offers a new one, which that read mints.
 * A page that did not open, or a read that failed, says so in the line under the
 * title, and the same button tries again.
 */
export function PixHostedVerification({
    title,
    onBack,
    action,
    providerId,
}: {
    title: string
    onBack: () => void
    action: NextAction
    providerId: ProviderId | null
}) {
    const t = useTranslations('pix.setup')
    const tCommon = useTranslations('common')
    const { fetchUser } = useAuth()
    const expiresAt = action.expiresAt ? Date.parse(action.expiresAt) : NaN
    const [now, setNow] = useState(() => Date.now())
    const expired = !action.url || (Number.isFinite(expiresAt) && expiresAt <= now)
    // a link that runs out while the screen is open turns it to "Get a new link"
    useEffect(() => {
        if (expired || !Number.isFinite(expiresAt)) return
        const timer = setTimeout(() => setNow(Date.now()), Math.min(MAX_TIMER_MS, expiresAt - Date.now() + 1))
        return () => clearTimeout(timer)
    }, [expired, expiresAt])
    const hosted = useHostedVerification('hosted-identity', { url: expired ? undefined : action.url })
    const [isReading, setIsReading] = useState(false)
    const [readFailed, setReadFailed] = useState(false)
    const readAgain = async () => {
        setIsReading(true)
        setReadFailed(false)
        try {
            await fetchUser({ throwOnError: true })
        } catch {
            setReadFailed(true)
        } finally {
            setIsReading(false)
        }
    }
    // the hand-off could not open the page, or the read failed: the line says so, the button retries
    const failed = readFailed || (!expired && !!hosted.error)

    return (
        <PageStack>
            <NavHeader title={title} onPrev={onBack} />
            <PageStack.Center>
                <div className="flex flex-col items-center gap-4 text-center">
                    <IconBubble {...CONCEPT_ICONS.verification} size="l" />
                    <TitleBlock
                        align="center"
                        title={t('title')}
                        description={
                            <span
                                role={failed ? 'alert' : undefined}
                                className={failed ? 'text-foreground-error' : undefined}
                            >
                                {t(failed ? 'hosted.failed' : expired ? 'hosted.expired' : 'hosted.body')}
                            </span>
                        }
                    />
                </div>
                <div className="flex flex-col gap-4" data-testid="pix-hosted-verification">
                    {expired ? (
                        <Button
                            variant="primary"
                            className="w-full"
                            loading={isReading}
                            disabled={isReading}
                            onClick={() => void readAgain()}
                        >
                            {t('hosted.newLink')}
                        </Button>
                    ) : (
                        <>
                            <Button
                                variant="primary"
                                className="w-full"
                                loading={hosted.isStarting}
                                disabled={hosted.isStarting}
                                // straight out of the tap: the web tab is reserved inside the gesture
                                onClick={() => void hosted.start()}
                            >
                                {t('verifyCta')}
                            </Button>
                            <LinkButton className="self-center" disabled={isReading} onClick={() => void readAgain()}>
                                {tCommon('done')}
                            </LinkButton>
                        </>
                    )}
                    {providerId && <ProviderFinePrint providerId={providerId} label="accountProvider" />}
                </div>
            </PageStack.Center>
        </PageStack>
    )
}
