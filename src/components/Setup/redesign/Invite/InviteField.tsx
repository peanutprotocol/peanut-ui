'use client'

import { motion, useAnimationControls } from 'framer-motion'
import { useEffect } from 'react'
import { UserAvatar } from '@/components/Avatar/UserAvatar'
import { Icon } from '@/components/Global/Icons/Icon'
import Loading from '@/components/Global/Loading'
import type { InviteStatus } from '@/features/setup/useInviteStep'
import { personFrom } from '@/lib/person/person'
import { twMerge } from '@/utils/tw'

const MISS: readonly InviteStatus[] = ['not-found', 'self', 'check-failed']

/**
 * The inviter field (mock 04 `.inv-field`): a fixed "@", the value, and one trailing slot per state: clear while
 * typing, a spinner while checking, the found person's avatar, the bare error icon on a miss. A miss shakes the
 * field once (4 px twice, 300 ms) each time `missBeat` changes; the found avatar pops in on `foundBeat`.
 */
export function InviteField({
    value,
    status,
    foundHandle,
    label,
    placeholder,
    clearLabel,
    errorId,
    missBeat,
    foundBeat,
    reducedMotion,
    onChange,
    onClear,
    onSubmit,
}: {
    value: string
    status: InviteStatus
    foundHandle: string
    label: string
    placeholder: string
    clearLabel: string
    errorId: string
    missBeat: number
    foundBeat: number
    reducedMotion: boolean
    onChange: (value: string) => void
    onClear: () => void
    /** Enter or the keyboard's Go key: the screen's primary button, which decides whether it is on. */
    onSubmit: () => void
}) {
    const invalid = MISS.includes(status)
    const found = personFrom({ username: foundHandle })
    // animated through controls, not a key: a remount would drop the keyboard focus
    const shake = useAnimationControls()
    useEffect(() => {
        if (missBeat && !reducedMotion) void shake.start({ x: [0, 4, -4, 4, -4, 0], transition: { duration: 0.3 } })
    }, [missBeat, reducedMotion, shake])
    return (
        <motion.div
            animate={shake}
            className={twMerge(
                'mt-3.5 flex h-12 items-center gap-1 rounded-sm border border-border-default bg-background-default pr-1 pl-4 signup-sm:mt-1',
                'focus-within:border-transparent focus-within:outline-[3px] focus-within:outline-action-focus focus-within:outline-solid',
                invalid && 'border-border-error'
            )}
            data-invite-field={status}
        >
            <span aria-hidden="true" className="text-body-m-semibold text-foreground-secondary">
                {'@'}
            </span>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
                    e.preventDefault()
                    onSubmit()
                }}
                enterKeyHint="go"
                aria-label={label}
                aria-invalid={invalid || undefined}
                aria-describedby={invalid ? errorId : undefined}
                placeholder={placeholder}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                translate="no"
                className="notranslate h-full min-w-0 flex-1 border-0 bg-transparent text-body-m-semibold text-foreground-primary outline-none placeholder:text-foreground-secondary"
            />
            {status === 'typing' && (
                <button
                    type="button"
                    aria-label={clearLabel}
                    onClick={onClear}
                    className="flex size-11 flex-none items-center justify-center rounded-full text-foreground-primary focus-visible:outline-[3px] focus-visible:outline-action-focus active:opacity-60"
                >
                    <Icon name="cancel" size={20} />
                </button>
            )}
            {status === 'checking' && (
                <span aria-hidden="true" className="flex h-11 w-10 flex-none items-center justify-center">
                    <Loading />
                </span>
            )}
            {status === 'found' && found && (
                <motion.span
                    key={`pop-${foundBeat}`}
                    className="mr-2 flex-none"
                    data-testid="setup-redesign-invite-found-avatar"
                    initial={false}
                    animate={reducedMotion ? undefined : { scaleX: [1.35, 0.92, 1], scaleY: [0.8, 1.08, 1] }}
                    transition={{ duration: 0.24, delay: 0.38, ease: 'easeOut' }}
                >
                    <UserAvatar person={found} decorative />
                </motion.span>
            )}
            {invalid && (
                <span aria-hidden="true" className="flex w-10 flex-none items-center justify-center">
                    <Icon name="error" size={20} className="text-foreground-error" />
                </span>
            )}
        </motion.div>
    )
}
