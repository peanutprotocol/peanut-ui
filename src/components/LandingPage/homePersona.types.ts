import type { FocusEvent } from 'react'

/** The earners of the home persona fold, in the order they cycle. */
export type HomePersonaKey = 'designer' | 'developer' | 'editor' | 'writer' | 'photographer'

/** One earner's trade and city, and their first-person line, in the page language. */
export interface HomePersonaText {
    /** Trade and city, e.g. "Designer, Buenos Aires". */
    who: string
    /** First person, one sentence, no quote marks, e.g. "A Berlin agency pays me in euros.". */
    line: string
}

/** f3: the fold's h2 and every earner's text. */
export type HomePersonaStrings = { heading: string } & Record<HomePersonaKey, HomePersonaText>

/** One earner as the fold draws it. */
export interface HomePersona extends HomePersonaText {
    key: HomePersonaKey
    /** Avatar sticker key (avatar.utils), e.g. "basic.flower". */
    avatar: string
}

export interface HomePersonaFoldProps {
    strings: HomePersonaStrings
}

export interface HomePersonaCardProps {
    persona: HomePersona
    /** False where the avatar already shows beside the card (the cycling row). */
    withAvatar?: boolean
    className?: string
}

export interface HomePersonaCycleState {
    /** The earner on show. */
    index: number
    /** Shows one earner and stops the cycle for good: the reader took over. */
    select: (index: number) => void
    /** True once the reader picked an earner, so the card announces changes. */
    picked: boolean
    /** Attach to the cycling stage: it cycles only while on screen. */
    ref: (node: HTMLElement | null) => void
    /** Spread on the stage: hover or keyboard focus inside pauses the cycle. */
    pauseHandlers: {
        onMouseEnter: () => void
        onMouseLeave: () => void
        onFocus: () => void
        onBlur: (event: FocusEvent<HTMLElement>) => void
    }
}
