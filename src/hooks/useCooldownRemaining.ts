import { useEffect, useState } from 'react'

function formatRemaining(ms: number): string {
    const totalSec = Math.max(0, Math.ceil(ms / 1000))
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Time left until `endsAt` as `m:ss`, re-rendered every second. Null when there
 * is no end time. The cooldown pill and the cooldown error both read this, so
 * the two surfaces always show the same number.
 */
export function useCooldownRemaining(endsAt: number | null): string | null {
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        if (endsAt === null) return
        setNow(Date.now())
        const id = window.setInterval(() => setNow(Date.now()), 1000)
        return () => window.clearInterval(id)
    }, [endsAt])
    return endsAt === null ? null : formatRemaining(endsAt - now)
}
