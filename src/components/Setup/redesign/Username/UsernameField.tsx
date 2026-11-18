'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icon } from '@/components/Global/Icons/Icon'
import { useSetupShell } from '@/components/Setup/redesign/shell/SetupShellContext'
import { USERNAME_MAX } from '@/features/setup/username-suggestions'
import { twMerge } from '@/utils/tw'
import { ERROR_KINDS, type UsernameKind } from './username-state'

const SCRAMBLE = 'abcdefghijklmnopqrstuvwxyz'
const SCRAMBLE_FRAME_MS = 40

// Buttons inside the field must not take its focus (a tap on the die would blur and refill the field).
const keepFocus = (event: React.PointerEvent | React.MouseEvent) => event.preventDefault()

/** Random letters of the old name's length while the die looks for a free name (none under reduced motion). */
function useScramble(active: boolean, from: string) {
    const { reducedMotion } = useSetupShell()
    const [text, setText] = useState(from)
    useEffect(() => {
        setText(from)
        if (!active || reducedMotion) return
        const frame = setInterval(() => {
            setText(Array.from(from, () => SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)]).join(''))
        }, SCRAMBLE_FRAME_MS)
        return () => clearInterval(frame)
    }, [active, from, reducedMotion])
    return text
}

/**
 * The 02 field row: "@", the input, the clear button while typing or the error icon on an error, and the die.
 * The input's own text is transparent; a mirror draws it, so letters past the 12th can turn red and a roll can
 * scramble them (mock 02-username screen.css .mirror).
 */
export function UsernameField({
    value,
    kind,
    placeholder,
    rollFrom,
    rolls,
    inputRef,
    describedBy,
    onInput,
    onFocus,
    onBlur,
    onClear,
    onRoll,
    onSubmit,
}: {
    value: string
    kind: UsernameKind
    placeholder: string
    rollFrom: string
    rolls: number
    inputRef: RefObject<HTMLInputElement>
    describedBy: string
    onInput: (value: string) => void
    onFocus: () => void
    onBlur: () => void
    onClear: () => void
    onRoll: () => void
    /** Enter or the keyboard's Go key: the screen's primary button, which decides whether it is on. */
    onSubmit: () => void
}) {
    const t = useTranslations('setupRedesign.username')
    const { reducedMotion } = useSetupShell()
    const rolling = kind === 'rolling'
    const scrambled = useScramble(rolling, rollFrom)
    const isError = ERROR_KINDS.includes(kind)
    const typing = kind === 'short' || kind === 'checking'
    // Only the too-long state paints the letters past the 12th red (contract C § 3.1 row 5); an invalid name is red
    // as a whole through the field border and help line, not by its length (review R2-09).
    const head = kind === 'too-long' ? value.slice(0, USERNAME_MAX) : value
    const over = kind === 'too-long' ? value.slice(USERNAME_MAX) : ''
    // The input scrolls to its caret when the name is wider than the field; the mirror that draws the letters must
    // scroll with it, or the last letters hide under the error icon (review R2-09, 320 es-AR).
    const mirrorRef = useRef<HTMLSpanElement>(null)
    const syncMirror = () => {
        if (mirrorRef.current && inputRef.current) mirrorRef.current.scrollLeft = inputRef.current.scrollLeft
    }
    useLayoutEffect(syncMirror)

    return (
        <div
            className={twMerge(
                'relative mt-4 flex h-12 items-center gap-0.5 rounded-sm border border-border-default bg-background-default pr-0.5 pl-4 text-body-m-semibold text-foreground-primary transition-colors duration-instant signup-sm:mt-3',
                // an error keeps its red border while focused and draws no focus ring
                isError
                    ? 'border-border-error'
                    : 'focus-within:border-transparent focus-within:outline-[3px] focus-within:outline-action-focus focus-within:outline-solid'
            )}
        >
            <span className="shrink-0 text-foreground-secondary">{'@'}</span>
            <span className="relative h-full min-w-0 flex-1">
                <span
                    ref={mirrorRef}
                    aria-hidden="true"
                    className={twMerge(
                        'pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre',
                        rolling && !reducedMotion && 'text-foreground-secondary'
                    )}
                    data-testid="username-mirror"
                >
                    {rolling ? (
                        scrambled
                    ) : (
                        <>
                            {head}
                            {over && (
                                <motion.span
                                    key={over.length}
                                    data-testid="setup-redesign-username-overflow"
                                    className="inline-block bg-background-surface-error text-foreground-error underline decoration-2 underline-offset-4"
                                    animate={reducedMotion ? undefined : { x: [0, -3, 3, -3, 3, 0] }}
                                    transition={{ duration: 0.26, ease: 'linear' }}
                                >
                                    {over}
                                </motion.span>
                            )}
                        </>
                    )}
                </span>
                <input
                    data-testid="username-input"
                    ref={inputRef}
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={20}
                    aria-label={t('fieldAria')}
                    aria-invalid={isError || undefined}
                    aria-describedby={describedBy}
                    placeholder={rolling ? '' : placeholder}
                    value={rolling ? '' : value}
                    readOnly={rolling}
                    onChange={(event) => onInput(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
                        event.preventDefault()
                        onSubmit()
                    }}
                    enterKeyHint="go"
                    onScroll={syncMirror}
                    onSelect={syncMirror}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    className="absolute inset-0 h-full w-full bg-transparent p-0 text-transparent caret-action-focus outline-none placeholder:font-medium placeholder:text-foreground-secondary"
                />
            </span>
            {typing && (
                <button
                    type="button"
                    aria-label={t('clear')}
                    onPointerDown={keepFocus}
                    onMouseDown={keepFocus}
                    onClick={onClear}
                    className="flex size-11 shrink-0 items-center justify-center text-foreground-primary"
                >
                    <Icon name="cancel" size={20} />
                </button>
            )}
            {isError && (
                <span
                    className="flex w-8 shrink-0 items-center justify-center text-foreground-error"
                    aria-hidden="true"
                >
                    <Icon name="error" size={20} />
                </span>
            )}
            <button
                type="button"
                aria-label={t('dice')}
                disabled={rolling}
                onPointerDown={keepFocus}
                onMouseDown={keepFocus}
                onClick={onRoll}
                className="flex size-11 shrink-0 items-center justify-center text-foreground-secondary transition-opacity duration-instant active:opacity-60"
            >
                <motion.span
                    key={rolls}
                    className="flex"
                    animate={rolls && !reducedMotion ? { rotate: [0, 360] } : undefined}
                    transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                >
                    <Icon name="dice" size={20} />
                </motion.span>
            </button>
        </div>
    )
}
