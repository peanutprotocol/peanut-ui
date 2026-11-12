'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import NavHeader from '@/components/Global/NavHeader'
import { ProviderFinePrint } from '@/components/Provider/ProviderFinePrint'
import { PROVIDERS } from '@/constants/providers.consts'
import { useAuth } from '@/context/authContext'
import { useHostedVerification } from '@/hooks/useHostedVerification'
import type { NextAction } from '@/types/capabilities'
import type { ProviderId } from '@/types/provider.types'
import { readStoredValue, removeStoredValue, writeStoredValue } from '@/utils/safe-storage'

// setTimeout runs a longer delay at once
const MAX_TIMER_MS = 2_147_483_647
// the provider's decision lands while the user waits here, or on its page: read for it
const READ_EVERY_MS = 10_000

/**
 * The Pix provider's own identity check, where it takes no shared verification: it happens on the
 * provider's page (`action.url`). Two states, on this screen's own knowledge (Aleks, 2026-11-12):
 * before the page was opened, the line asks to verify with the provider and the primary button
 * opens its page; once it was opened from here, the line says the app waits for the provider's
 * answer and moves on by itself, and the button only reopens the page. While the link is live, in
 * both states, the capabilities are read again on every focus and visibility return and every
 * 10 s, one read at a time (the hook reads once more on the return it saw). The route then waits
 * on the provider's decision (the waiting screen) or still names this step. A link past
 * `expiresAt` offers a new one, which that read mints. A page that did not open, or a read that
 * failed, says so in the line under the title, and the button tries again.
 *
 * The launch is kept in this tab's session storage, per account and link, because a browser that
 * blocks the detached tab sends this same tab to the provider's page: Back then mounts the screen
 * anew, and it comes back waiting. The mark goes when the step is left (the decision came, or the
 * user went back) and when the launch failed; a new link is a new attempt.
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
    const { user, fetchUser } = useAuth()
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
    const launchKey = user?.user.userId ? `pix-hosted-launched:${user.user.userId}:${action.key}` : null
    // the link this tab sent the user to, if any
    const [launchedUrl, setLaunchedUrl] = useState(() =>
        launchKey ? readStoredValue(launchKey, 'sessionStorage') : null
    )
    useEffect(() => {
        if (!launchKey) return
        if (launchedUrl) writeStoredValue(launchKey, launchedUrl, 'sessionStorage')
        return () => removeStoredValue(launchKey, 'sessionStorage')
    }, [launchKey, launchedUrl])
    // a page that did not open was not launched
    useEffect(() => {
        if (hosted.error) setLaunchedUrl(null)
    }, [hosted.error])
    const open = () => {
        setLaunchedUrl(action.url ?? null)
        // straight out of the tap: the web tab is reserved inside the gesture
        void hosted.start()
    }
    const [isReading, setIsReading] = useState(false)
    const [readFailed, setReadFailed] = useState(false)
    // one read at a time: a focus and a visibility return arrive together
    const readingRef = useRef(false)
    const readAgain = useCallback(async () => {
        if (readingRef.current) return
        readingRef.current = true
        setIsReading(true)
        setReadFailed(false)
        try {
            await fetchUser({ throwOnError: true })
        } catch {
            setReadFailed(true)
        } finally {
            readingRef.current = false
            setIsReading(false)
        }
    }, [fetchUser])
    // the page was opened from here and the link is live
    const waiting = !!launchedUrl && launchedUrl === action.url && !expired
    // while the link is live the answer can land any moment, opened from here or not
    useEffect(() => {
        if (expired) return
        const onReturn = () => {
            if (document.visibilityState === 'visible') void readAgain()
        }
        window.addEventListener('focus', onReturn)
        document.addEventListener('visibilitychange', onReturn)
        const poll = setInterval(() => void readAgain(), READ_EVERY_MS)
        return () => {
            clearInterval(poll)
            window.removeEventListener('focus', onReturn)
            document.removeEventListener('visibilitychange', onReturn)
        }
    }, [expired, readAgain])
    // the hand-off could not open the page, or the read failed: the line says so, the button retries
    const failed = readFailed || (!expired && !!hosted.error)
    // a route that names no provider this build knows reads as our payment partner, never "Verify with ."
    const brand = providerId ? PROVIDERS[providerId].brand : ''
    const line = t(
        failed
            ? 'hosted.failed'
            : expired
              ? 'hosted.expired'
              : waiting
                ? providerId
                    ? 'hosted.back'
                    : 'hosted.backPartner'
                : providerId
                  ? 'hosted.body'
                  : 'hosted.bodyPartner',
        { brand }
    )

    return (
        <PageStack>
            <NavHeader title={title} onPrev={onBack} />
            <PageStack.Center>
                <div className="flex flex-col items-center gap-4 text-center">
                    {/* the Pix mark: the provider's check is a Pix set-up step, not a verification of ours */}
                    <IconBubble {...CONCEPT_ICONS.pix} size="l" />
                    <TitleBlock
                        align="center"
                        title={t('title')}
                        // the design system's error line (role="alert") when it failed
                        description={failed ? <FieldError>{line}</FieldError> : line}
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
                    ) : waiting ? (
                        <Button
                            variant="secondary"
                            className="w-full"
                            loading={hosted.isStarting}
                            disabled={hosted.isStarting}
                            onClick={open}
                        >
                            {t(providerId ? 'hosted.openAgain' : 'hosted.openAgainPartner', { brand })}
                        </Button>
                    ) : (
                        <Button
                            variant="primary"
                            className="w-full"
                            loading={hosted.isStarting}
                            disabled={hosted.isStarting}
                            onClick={open}
                        >
                            {t('verifyCta')}
                        </Button>
                    )}
                    {providerId && <ProviderFinePrint providerId={providerId} label="accountProvider" />}
                </div>
            </PageStack.Center>
        </PageStack>
    )
}
