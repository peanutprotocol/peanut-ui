'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { useSetupShell } from '@/components/Setup/redesign/shell/SetupShellContext'

// Taller than one chip row means the chips wrapped: drop the last chip rather than reach the button.
const ONE_ROW_PX = 40

const keepFocus = (event: React.PointerEvent | React.MouseEvent) => event.preventDefault()

/**
 * "Available:" and up to two checked free names under a taken name, on one line. The row keeps its height when
 * empty so the panel never jumps (mock 02-username .extra / .alts).
 */
export function UsernameAlternatives({
    names,
    onPick,
}: {
    names: string[]
    onPick: (name: string, index: number) => void
}) {
    const t = useTranslations('setupRedesign.username')
    const { reducedMotion } = useSetupShell()
    const rowRef = useRef<HTMLDivElement>(null)
    const [shown, setShown] = useState(names.length)
    const namesKey = names.join(' ')

    useLayoutEffect(() => setShown(names.length), [namesKey, names.length])
    useLayoutEffect(() => {
        const row = rowRef.current
        if (row && shown > 1 && row.offsetHeight > ONE_ROW_PX) setShown((count) => count - 1)
    }, [shown, namesKey])

    return (
        <div className="min-h-11">
            {names.length > 0 && (
                <div
                    ref={rowRef}
                    data-testid="username-alternatives"
                    className="mt-2 flex flex-wrap items-center gap-2 text-body-xs text-foreground-secondary signup-sm:gap-1"
                >
                    <span>{t('takenLead')}</span>
                    {names.slice(0, shown).map((name, index) => (
                        <motion.span
                            key={name}
                            className="flex"
                            initial={reducedMotion ? false : { scale: 0.3, rotate: 8, opacity: 0 }}
                            animate={{ scale: 1, rotate: 0, opacity: 1 }}
                            transition={{ duration: 0.3, delay: index * 0.06, ease: [0.34, 1.56, 0.64, 1] }}
                        >
                            <Button
                                variant="secondary"
                                size="compact"
                                shadowSize="2"
                                onPointerDown={keepFocus}
                                onMouseDown={keepFocus}
                                onClick={() => onPick(name, index)}
                                className="mx-0 px-2 text-body-m-semibold whitespace-nowrap"
                            >
                                {`@${name}`}
                            </Button>
                        </motion.span>
                    ))}
                </div>
            )}
        </div>
    )
}
