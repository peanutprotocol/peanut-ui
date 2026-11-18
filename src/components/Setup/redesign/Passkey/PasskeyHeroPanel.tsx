'use client'

import { useTranslations } from 'next-intl'
import { Icon } from '@/components/Global/Icons/Icon'
import { PasskeyInlineError } from './PasskeyInlineError'
import { SETUP_LEAD_CLASS } from '@/components/Setup/redesign/shell/shell.consts'

const POINTS = [
    { key: 'p1', icon: 'lock' },
    { key: 'p2', icon: 'eye-slash' },
] as const

/** The hero panel: the lead, then the two security points, or one inline error in their place (mock b2). */
export function PasskeyHeroPanel({ message }: { message: string | null }) {
    const t = useTranslations('setupRedesign.passkey.s1')
    return (
        <>
            <p className={`${SETUP_LEAD_CLASS} text-pretty`}>{t('lead')}</p>
            {message ? (
                <PasskeyInlineError message={message} className="mt-4 signup-sm:mt-3" />
            ) : (
                <ul data-testid="passkey-points" className="mt-4 flex flex-col gap-3 signup-sm:mt-3">
                    {POINTS.map((point) => (
                        <li key={point.key} className="flex items-start gap-2 text-body-s text-foreground-primary">
                            <span className="flex h-5 w-4 shrink-0 items-center justify-center">
                                <Icon name={point.icon} size={16} />
                            </span>
                            {t(point.key)}
                        </li>
                    ))}
                </ul>
            )}
        </>
    )
}
