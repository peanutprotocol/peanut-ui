import { Notification } from '@/components/0_Bruddle/Notification'

// dogfood: a DesignNote IS the DS Notification banner — the doc site renders
// the real component instead of a hand-rolled copy of its vocabulary
const PRIORITY = { warning: 'attention', info: 'info' } as const

export function DesignNote({ type, children }: { type: 'warning' | 'info'; children: React.ReactNode }) {
    return <Notification priority={PRIORITY[type]}>{children}</Notification>
}
