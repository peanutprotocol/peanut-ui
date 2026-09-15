'use client'
import { ScreenMark } from '@/components/0_Bruddle/ScreenMark'
import { type FC, useCallback, useEffect, useRef, useState } from 'react'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { useTranslations } from 'next-intl'
import { parseAsStringEnum, useQueryState } from 'nuqs'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import NavHeader from '@/components/Global/NavHeader'
import { Button } from '@/components/0_Bruddle/Button'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Notification } from '@/components/0_Bruddle/Notification'
import { Icon } from '@/components/Global/Icons/Icon'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import CardPinSetupFlow from '@/components/Card/CardPinSetupFlow'
import { rainApi, RainCardRateLimitError } from '@/services/rain'

type Mode = 'view' | 'set'

interface Props {
    cardId: string
    onPrev?: () => void
}

const AUTO_MASK_MS = 30_000

const CardPinScreen: FC<Props> = ({ cardId, onPrev }) => {
    const t = useTranslations('card.pin')
    const [mode, setMode] = useQueryState('mode', parseAsStringEnum<Mode>(['view', 'set']))
    const [pin, setPin] = useState<string | null>(null)
    const [pinUnset, setPinUnset] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const hide = useCallback(() => {
        setPin(null)
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
        }
    }, [])

    const reveal = async () => {
        setLoading(true)
        setError(null)
        posthog.capture(ANALYTICS_EVENTS.CARD_PIN_VIEW_ATTEMPTED)
        try {
            const value = await rainApi.getCardPin(cardId)
            if (value === null) {
                // Rain reports the card has no PIN yet. Switch the screen into
                // "not set" mode rather than displaying an empty code.
                setPinUnset(true)
                setPin(null)
                return
            }
            setPinUnset(false)
            setPin(value)
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            timeoutRef.current = setTimeout(hide, AUTO_MASK_MS)
        } catch (e) {
            if (e instanceof RainCardRateLimitError) {
                setError(e.message)
                posthog.capture(ANALYTICS_EVENTS.CARD_PIN_RATE_LIMITED, { action: 'view' })
            } else {
                setError(e instanceof Error ? e.message : t('loadFailed'))
            }
        } finally {
            setLoading(false)
        }
    }

    // Same auto-mask hooks as the reveal flow — tab-switch/blur wipes the PIN.
    useEffect(() => {
        if (!pin) return
        const onHide = () => setPin(null)
        window.addEventListener('blur', onHide)
        window.addEventListener('pagehide', onHide)
        return () => {
            window.removeEventListener('blur', onHide)
            window.removeEventListener('pagehide', onHide)
        }
    }, [pin])

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
        }
    }, [])

    if (mode === 'set') {
        return (
            <PageStack gap="6">
                <NavHeader
                    title={t('setNavTitle')}
                    onPrev={() => {
                        setPinUnset(false)
                        void setMode(null)
                    }}
                />
                <CardPinSetupFlow
                    cardId={cardId}
                    onDone={() => {
                        setPinUnset(false)
                        void setMode(null)
                    }}
                />
            </PageStack>
        )
    }

    if (pinUnset) {
        return (
            <PageStack gap="6">
                <NavHeader title={t('navTitle')} onPrev={onPrev} />
                <EmptyState
                    icon="credit-card"
                    iconColor="brand"
                    title={t('noPinTitle')}
                    description={t('noPinBody')}
                    cta={
                        <Button variant="purple" className="mt-4 w-full" onClick={() => void setMode('set')}>
                            {t('setPin')}
                        </Button>
                    }
                />
            </PageStack>
        )
    }

    return (
        <PageStack gap="6">
            <NavHeader title={t('navTitle')} onPrev={onPrev} />
            <ScreenMark icon="credit-card" color="brand" />
            <div className="flex flex-col gap-6">
                <p className="text-body-s text-foreground-secondary">{t('hiddenNote')}</p>
                <div className="flex items-center gap-3">
                    {/* the fixed 56px slot keeps masked, loading, and revealed rows aligned. */}
                    {/* ph-no-capture: PostHog skips this subtree in session
                     * replays so the revealed PIN digits never land in
                     * recordings. The skeleton + masked '****' state are
                     * also covered, which is fine — they're not sensitive. */}
                    <div className="ph-no-capture flex h-14 items-center">
                        {loading ? (
                            <div className="h-14 w-32 animate-pulse rounded bg-foreground-primary/10" />
                        ) : (
                            <span className="text-heading-xl">{pin ?? '****'}</span>
                        )}
                    </div>
                    <Button
                        type="button"
                        variant="transparent"
                        size="small"
                        shape="square"
                        icon={pin ? 'eye-slash' : 'eye'}
                        iconSize={20}
                        onClick={pin ? hide : reveal}
                        disabled={loading}
                        aria-label={pin ? t('hidePin') : t('showPin')}
                        className="w-10 shrink-0"
                    />
                </div>
                {error && <Notification priority="error">{error}</Notification>}
                <ListItem
                    title={t('changePin')}
                    leading={<Icon name="more-horizontal" size={24} />}
                    chevron
                    onClick={() => {
                        hide()
                        void setMode('set')
                    }}
                    position="single"
                />
            </div>
        </PageStack>
    )
}

export default CardPinScreen
