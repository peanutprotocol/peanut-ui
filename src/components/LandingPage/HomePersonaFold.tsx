'use client'

import Image from 'next/image'
import { avatarSrc } from '@/components/Avatar/avatar.utils'
import { Band } from '@/components/Marketing/StarLp/Band'
import { SectionTitle } from '@/components/Marketing/StarLp/SectionTitle'
import { twMerge } from '@/utils/tw'
import { HomePersonaCard } from './HomePersonaCard'
import { homePersonas } from './homePersona.utils'
import type { HomePersonaFoldProps } from './homePersona.types'
import { useHomePersonaCycle } from './useHomePersonaCycle'
import styles from './homePersona.module.css'

const FOCUS_RING = 'focus-visible:outline-[3px] focus-visible:outline-action-focus focus-visible:outline-solid'

/**
 * f3, "Sound like you?": one earner card that cycles through the fold's
 * earners, their avatars in a row above it. An avatar shows its earner and
 * stops the cycle. Every card sits in one grid cell, so the fold keeps the
 * tallest card's height while it cycles. The cards are art to screen readers:
 * a hidden line carries the earner on show, announced only after a pick.
 * Reduced motion keeps the first earner and every avatar still.
 */
export function HomePersonaFold({ strings }: HomePersonaFoldProps) {
    const personas = homePersonas(strings)
    const { index, select, picked, reducedMotion, ref, pauseHandlers } = useHomePersonaCycle(personas.length)
    const current = personas[index]

    return (
        <Band ground="yellow">
            <SectionTitle>{strings.heading}</SectionTitle>

            {/* from lg the avatars sit beside the card, so the stage spans the band, not its left half */}
            <div
                ref={ref}
                {...pauseHandlers}
                className="mt-10 max-w-2xl md:mt-14 lg:grid lg:max-w-none lg:grid-cols-[auto_minmax(0,42rem)] lg:items-center lg:justify-start lg:gap-14"
            >
                <ul className="flex flex-wrap items-center gap-4">
                    {personas.map((persona, i) => (
                        <li key={persona.key}>
                            <button
                                type="button"
                                aria-label={persona.who}
                                aria-pressed={i === index}
                                disabled={reducedMotion}
                                onClick={() => select(i)}
                                className={twMerge(
                                    'block rounded-full transition-[scale,rotate,opacity] duration-slow ease-spring motion-reduce:scale-100 motion-reduce:rotate-0 motion-reduce:transition-none',
                                    FOCUS_RING,
                                    i === index
                                        ? 'scale-125 -rotate-6 opacity-100'
                                        : 'opacity-60 enabled:hover:opacity-100'
                                )}
                            >
                                <Image
                                    src={avatarSrc(persona.avatar)!}
                                    alt=""
                                    width={176}
                                    height={176}
                                    unoptimized
                                    className="size-12 object-contain md:size-16"
                                />
                            </button>
                        </li>
                    ))}
                </ul>
                <div className="mt-6 grid lg:mt-0" aria-hidden>
                    {personas.map((persona, i) => (
                        <HomePersonaCard
                            key={persona.key}
                            persona={persona}
                            withAvatar={false}
                            className={twMerge(
                                'col-start-1 row-start-1 -rotate-1',
                                styles.card,
                                i === index ? styles.active : 'invisible'
                            )}
                        />
                    ))}
                </div>
                <p className="sr-only" aria-live={picked ? 'polite' : 'off'}>
                    {current.who}: {current.line}
                </p>
            </div>
        </Band>
    )
}
