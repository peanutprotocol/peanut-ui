'use client'
import { type FC, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { parseAsStringEnum, useQueryState } from 'nuqs'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import NavHeader from '@/components/Global/NavHeader'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import ProfileMenuItem from '@/components/Profile/components/ProfileMenuItem'
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
            <div className="flex min-h-[inherit] flex-col gap-6">
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
            </div>
        )
    }

    if (pinUnset) {
        return (
            <div className="flex min-h-[inherit] flex-col gap-6">
                <NavHeader title={t('navTitle')} onPrev={onPrev} />
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-xl font-extrabold">{t('noPinTitle')}</h1>
                        <p className="text-grey-1">{t('noPinBody')}</p>
                    </div>
                    <Button variant="purple" shadowSize="4" className="w-full" onClick={() => void setMode('set')}>
                        {t('setPin')}
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-[inherit] flex-col gap-6">
            <NavHeader title={t('navTitle')} onPrev={onPrev} />
            <div className="flex flex-col gap-6">
                <p className="text-sm text-grey-1">{t('hiddenNote')}</p>
                <div className="flex items-center gap-3">
                    {/* Fixed-height slot keeps the row geometry constant across
                     * masked / loading / revealed. text-6xl in this repo's
                     * Tailwind config is font-size 3rem / line-height 3.25rem
                     * (52px), so the wrapper locks to that — `****`, the
                     * skeleton, and the real digits all sit centered in the
                     * same 52px row and the eye button never jumps. */}
                    {/* ph-no-capture: PostHog skips this subtree in session
                     * replays so the revealed PIN digits never land in
                     * recordings. The skeleton + masked '****' state are
                     * also covered, which is fine — they're not sensitive. */}
                    <div className="ph-no-capture flex h-[52px] items-center">
                        {loading ? (
                            <div className="h-[52px] w-32 animate-pulse rounded bg-grey-2" />
                        ) : (
                            <span className="text-6xl font-extrabold leading-none">{pin ?? '****'}</span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={pin ? hide : reveal}
                        disabled={loading}
                        aria-label={pin ? t('hidePin') : t('showPin')}
                        className="p-1"
                    >
                        {/* Icon reflects current state: slashed eye while hidden, open eye while visible. */}
                        <Icon name={pin ? 'eye' : 'eye-slash'} size={24} />
                    </button>
                </div>
                {error && <p className="text-sm text-red">{error}</p>}
                <ProfileMenuItem
                    icon="more-horizontal"
                    label={t('changePin')}
                    onClick={() => {
                        hide()
                        void setMode('set')
                    }}
                    href="/dummy"
                    position="single"
                />
            </div>
        </div>
    )
}

export default CardPinScreen
