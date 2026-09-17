import type { ReactNode } from 'react'
import { Notification } from '@/components/0_Bruddle/Notification'
import { getTranslations } from '@/i18n'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'
import { PROSE_WIDTH } from '../constants'

type CalloutType = 'info' | 'tip' | 'warning'

interface CalloutProps {
    type?: CalloutType
    /** Injected by createMdxComponents — never authored in MDX. */
    locale?: Locale
    children: ReactNode
}

const PRIORITIES = {
    info: 'info',
    tip: 'success',
    warning: 'attention',
} as const

/**
 * Highlighted callout for tips, warnings, or important info — the DS
 * Notification banner. It used to be a hand-rolled tinted box with its own
 * purple/green/yellow fills and a left rail; the tone belongs to the component.
 */
export function Callout({ type = 'info', locale = DEFAULT_LOCALE, children }: CalloutProps) {
    const t = getTranslations(locale)
    const labels: Record<CalloutType, string> = {
        info: t.calloutInfo,
        tip: t.calloutTip,
        warning: t.calloutImportant,
    }

    return (
        <div className={`mx-auto my-8 ${PROSE_WIDTH} px-6 md:px-4`}>
            <Notification priority={PRIORITIES[type] ?? 'info'} title={labels[type] ?? labels.info}>
                {children}
            </Notification>
        </div>
    )
}
