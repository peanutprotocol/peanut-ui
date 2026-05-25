'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Icon } from '@/components/Global/Icons/Icon'
import { useRainCooldown } from '@/context/RainCooldownContext'

function formatRemaining(ms: number): string {
    const totalSec = Math.max(0, Math.ceil(ms / 1000))
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Persistent floating pill that counts down the Rain withdrawal-signature
 * cooldown. Shown the entire time `cooldownEndsAt` is set in the context.
 *
 * Positioned above the Toast slot (Toast lives at bottom-[80px]) so transient
 * toasts don't mask the timer. Z-index is higher than Toast (99999) so even
 * if positions overlap during a rare layout shift, the timer wins.
 */
const RainCooldownFloatingTimer = () => {
    const { cooldownEndsAt } = useRainCooldown()
    const [now, setNow] = useState(() => Date.now())

    // Reset `now` immediately on every cooldown transition so the first paint
    // can't show a stale remainingMs (the component is permanently mounted, so
    // the lazy useState init runs only once at app boot).
    useEffect(() => {
        if (cooldownEndsAt === null) return
        setNow(Date.now())
        const id = window.setInterval(() => setNow(Date.now()), 1000)
        return () => window.clearInterval(id)
    }, [cooldownEndsAt])

    const visible = cooldownEndsAt !== null && cooldownEndsAt > now
    const remainingMs = visible ? cooldownEndsAt - now : 0

    return (
        <div className="pointer-events-none fixed bottom-[140px] right-4 z-[100000] flex flex-col gap-2">
            <AnimatePresence>
                {visible && (
                    <motion.div
                        key="rain-cooldown-pill"
                        initial={{ opacity: 0, scale: 0.8, y: 40 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 40 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        className="shadow-4 pointer-events-auto flex items-center gap-2 rounded-sm border-2 border-yellow-1 bg-white px-3 py-2"
                        role="status"
                        aria-live="polite"
                        aria-label={`Card cool-down ${formatRemaining(remainingMs)} remaining`}
                    >
                        <Icon name="clock" className="h-4 w-4 text-n-1" />
                        <span className="text-sm font-bold tabular-nums text-n-1">
                            Card cool-down · {formatRemaining(remainingMs)}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default RainCooldownFloatingTimer
