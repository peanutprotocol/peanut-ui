'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { Icon } from '@/components/Global/Icons/Icon'
import Loading from '@/components/Global/Loading'
import { useSetupShell } from '@/components/Setup/redesign/shell/SetupShellContext'
import { USERNAME_MAX } from '@/features/setup/username-suggestions'
import { twMerge } from '@/utils/tw'
import { SETUP_SUPPORT_FALLBACK_URL, useSetupSupportClick } from '@/components/Setup/useSetupSupportClick'
import type { UsernameKind } from './username-state'

const Spinner = ({ size }: { size: 'size-3' | 'size-3.5' }) => (
    <span aria-hidden="true" className="inline-flex">
        <Loading className={size} />
    </span>
)

/**
 * One help row under the field that always keeps its height: the message on the left, the `n/12` count on the
 * right with the check's spinner beside it. Mock 02-username show(): one line per state, no hint line.
 */
export function UsernameHelpRow({
    id,
    kind,
    value,
    onSupport,
}: {
    id: string
    kind: UsernameKind
    value: string
    onSupport: () => void
}) {
    const t = useTranslations('setupRedesign.username')
    const { reducedMotion } = useSetupShell()
    const supportLink = useSetupSupportClick({ key: 'usernameCheck' }, onSupport)
    const available = (
        <>
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-background-icon-bubble-green text-foreground-inverse">
                <Icon name="check" size={12} strokeWidth={3} />
            </span>
            <span className="text-foreground-primary">{t('available')}</span>
        </>
    )
    const typed = !['default', 'rolled', 'rolling', 'empty', 'check-failed'].includes(kind)
    const over = value.length > USERNAME_MAX

    let message: ReactNode = null
    let isError = false
    switch (kind) {
        case 'rolled':
        case 'available':
        case 'demo':
            message = available
            break
        case 'rolling':
            message = (
                <>
                    <Spinner size="size-3.5" />
                    {t('rolling')}
                </>
            )
            break
        case 'empty':
        case 'short':
        case 'checking':
            message = t('rule')
            break
        case 'taken':
            message = t('taken', { name: value })
            isError = true
            break
        case 'invalid-start':
            message = t('invalidStart')
            isError = true
            break
        case 'invalid-chars':
            message = t('invalidChars')
            isError = true
            break
        case 'too-long':
            message = t('tooLong', { n: value.length - USERNAME_MAX })
            isError = true
            break
        case 'reserved':
            message = t('reserved')
            isError = true
            break
        case 'check-failed':
            message = (
                <span className="text-wrap">
                    {t.rich('checkFailed', {
                        link: (chunks) => (
                            <a
                                href={SETUP_SUPPORT_FALLBACK_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={supportLink.onClick}
                                className="relative whitespace-nowrap underline after:absolute after:inset-x-0 after:-inset-y-3.5"
                            >
                                {chunks}
                            </a>
                        ),
                    })}
                </span>
            )
            isError = true
            break
    }
    const messageKey = `${kind}:${kind === 'too-long' || kind === 'taken' ? value : ''}`

    return (
        <div
            id={id}
            aria-live="polite"
            data-testid="username-help"
            className={twMerge(
                'mt-2 flex min-h-5 items-center justify-between gap-2 text-body-xs text-foreground-secondary',
                isError && 'text-foreground-error'
            )}
        >
            <motion.span
                key={messageKey}
                className="flex min-w-0 flex-auto items-center gap-1 text-pretty"
                initial={reducedMotion || !message ? false : { opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.1, ease: 'easeOut' }}
            >
                {message}
            </motion.span>
            {typed && (
                <span
                    data-testid="username-count"
                    className={twMerge(
                        'inline-flex shrink-0 items-center gap-1 text-foreground-secondary tabular-nums',
                        over && 'text-foreground-error'
                    )}
                >
                    {kind === 'checking' && <Spinner size="size-3" />}
                    {value.length}/{USERNAME_MAX}
                </span>
            )}
        </div>
    )
}
