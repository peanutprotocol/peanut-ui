import type { ReactNode } from 'react'
import { Card } from '@/components/0_Bruddle/Card'
import { PROSE_WIDTH } from './constants'

interface CalloutProps {
    type?: 'info' | 'tip' | 'warning'
    children: ReactNode
}

const STYLES: Record<string, { bg: string; border: string; label: string }> = {
    info: { bg: 'bg-primary-3/20', border: 'border-primary-3', label: 'Info' },
    tip: { bg: 'bg-green-200', border: 'border-green-400', label: 'Tip' },
    warning: { bg: 'bg-yellow-200', border: 'border-yellow-400', label: 'Important' },
}

/** Highlighted callout box for tips, warnings, or important info. */
export function Callout({ type = 'info', children }: CalloutProps) {
    const style = STYLES[type] ?? STYLES.info

    return (
        <div className={`mx-auto ${PROSE_WIDTH} px-6 md:px-4`}>
            <Card className={`${style.bg} border-l-4 ${style.border} my-8 p-5`}>
                <p className="mb-1 text-xs font-bold tracking-wide text-n-1/40 uppercase">{style.label}</p>
                <div className="text-sm leading-relaxed text-grey-1">{children}</div>
            </Card>
        </div>
    )
}
