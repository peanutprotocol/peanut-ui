'use client'
import { type FC, useCallback, useEffect, useRef, useState } from 'react'
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
                setError(e instanceof Error ? e.message : 'Failed to load PIN')
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
                    title="Set pin"
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
                <NavHeader title="Your card pin" onPrev={onPrev} />
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-xl font-extrabold">No pin set yet</h1>
                        <p className="text-grey-1">
                            You need to set a pin before using your card for in-store purchases.
                        </p>
                    </div>
                    <Button variant="purple" shadowSize="4" className="w-full" onClick={() => void setMode('set')}>
                        Set pin
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-[inherit] flex-col gap-6">
            <NavHeader title="Your card pin" onPrev={onPrev} />
            <div className="flex flex-col gap-6">
                <p className="text-sm text-grey-1">Your pin is hidden for security reasons.</p>
                <div className="flex items-center gap-3">
                    <span className="text-6xl font-extrabold">{pin ?? '****'}</span>
                    <button
                        type="button"
                        onClick={pin ? hide : reveal}
                        disabled={loading}
                        aria-label={pin ? 'Hide pin' : 'Show pin'}
                        className="p-1"
                    >
                        {/* Icon reflects current state: slashed eye while hidden, open eye while visible. */}
                        <Icon name={pin ? 'eye' : 'eye-slash'} size={24} />
                    </button>
                </div>
                {loading && <p className="text-sm text-grey-1">Loading…</p>}
                {error && <p className="text-sm text-red">{error}</p>}
                <ProfileMenuItem
                    icon="more-horizontal"
                    label="Change pin"
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
