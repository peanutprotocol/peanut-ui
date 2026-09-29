import { Callout } from '@/components/0_Bruddle/Callout'

// dogfood: a DesignNote IS the DS Callout banner — the doc site renders
// the real component instead of a hand-rolled copy of its vocabulary
const PRIORITY = { warning: 'attention', info: 'info' } as const

export function DesignNote({ type, children }: { type: 'warning' | 'info'; children: React.ReactNode }) {
    return <Callout priority={PRIORITY[type]}>{children}</Callout>
}
