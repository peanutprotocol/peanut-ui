import Image from 'next/image'
import { avatarSrc } from '@/components/Avatar/avatar.utils'
import { Band } from './Band'
import { PopIn } from './PopIn'
import { SectionTitle } from './SectionTitle'
import type { PersonaFoldProps } from './starLp.types'

/** Resting tilts, one per card, so the row reads as stickers and not a table. */
const TILTS = [-1.2, 0.8, -0.6, 1] as const

/**
 * The "that's me" fold of the income pages, straight after the hero: the
 * earners of STAR_LP_EARNERS as white sticker cards on yellow, each with its
 * avatar, trade and city, one line in the first person and one short fact (the
 * rail that pays them, or where the client pays from). Illustrative composites
 * (product/icps.md), so no names, photos or quote marks. The cards pop in one
 * after another; on phones they stack.
 */
export function PersonaFold({ cards }: PersonaFoldProps) {
    return (
        <Band ground="yellow">
            <SectionTitle>Sound like you?</SectionTitle>
            <ul className="mt-10 grid gap-6 md:mt-14 md:grid-cols-2 xl:grid-cols-4">
                {cards.map((card, i) => (
                    <li key={card.who} className="flex">
                        <PopIn delay={i * 0.1} tilt={TILTS[i % TILTS.length]} className="flex w-full">
                            <article className="flex w-full flex-col gap-5 rounded-card border-2 border-border-default bg-background-default p-6 shadow-4">
                                <header className="flex items-center gap-3">
                                    <Image
                                        src={avatarSrc(card.avatar)!}
                                        alt=""
                                        width={176}
                                        height={176}
                                        unoptimized
                                        className="size-12 shrink-0 object-contain"
                                    />
                                    <p className="text-body-s-semibold text-foreground-secondary">{card.who}</p>
                                </header>
                                <p className="text-heading-xs lg:text-heading-s">{card.line}</p>
                                <p className="mt-auto w-fit rounded-full border-2 border-border-default bg-background-brand px-3 py-1 text-label-m">
                                    {card.tag}
                                </p>
                            </article>
                        </PopIn>
                    </li>
                ))}
            </ul>
        </Band>
    )
}
