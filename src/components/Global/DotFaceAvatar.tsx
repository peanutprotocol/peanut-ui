'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { twMerge } from '@/utils/tw'

/**
 * Deterministic generative avatar for the user's OWN identity (home chip,
 * self profile header). The username is hashed once; the hash picks one of
 * the seven avatar colors, one of five eye styles, one of five mouths, and
 * whether the cheeks blush — 875 combinations, stable across devices,
 * nothing stored or uploaded.
 *
 * Deliberately NOT used for other people: counterparty rows keep the
 * initials avatar, where letters genuinely help tell contacts apart.
 *
 * Colors come from the avatar board's seven triples (17802:61529) — the same
 * set `AvatarWithBadge` draws initials on. Each triple travels together: the
 * pale fill is the face, its border rims the circle, and its foreground draws
 * the features and blush, so the face is legible at every size without a
 * per-color contrast check.
 */
const PALETTE = ['pink', 'yellow', 'orange', 'blue', 'purple', 'red', 'green'] as const

export type DotFaceColor = (typeof PALETTE)[number]

// full literals so tailwind's scanner emits them; the fill/stroke pair cannot
// both ride currentColor, so the circle takes classes and the features inherit
const FACE_CLASSES: Record<DotFaceColor, { circle: string; text: string; blush: string }> = {
    pink: {
        circle: 'fill-avatar-pink stroke-avatar-pink-border',
        text: 'text-avatar-pink-foreground',
        blush: 'fill-avatar-pink-border',
    },
    yellow: {
        circle: 'fill-avatar-yellow stroke-avatar-yellow-border',
        text: 'text-avatar-yellow-foreground',
        blush: 'fill-avatar-yellow-border',
    },
    orange: {
        circle: 'fill-avatar-orange stroke-avatar-orange-border',
        text: 'text-avatar-orange-foreground',
        blush: 'fill-avatar-orange-border',
    },
    blue: {
        circle: 'fill-avatar-blue stroke-avatar-blue-border',
        text: 'text-avatar-blue-foreground',
        blush: 'fill-avatar-blue-border',
    },
    purple: {
        circle: 'fill-avatar-purple stroke-avatar-purple-border',
        text: 'text-avatar-purple-foreground',
        blush: 'fill-avatar-purple-border',
    },
    red: {
        circle: 'fill-avatar-red stroke-avatar-red-border',
        text: 'text-avatar-red-foreground',
        blush: 'fill-avatar-red-border',
    },
    green: {
        circle: 'fill-avatar-green stroke-avatar-green-border',
        text: 'text-avatar-green-foreground',
        blush: 'fill-avatar-green-border',
    },
}

const djb2 = (value: string): number => {
    let hash = 5381
    for (let i = 0; i < value.length; i++) hash = ((hash << 5) + hash + value.charCodeAt(i)) >>> 0
    return hash
}

/** Tiny LCG so trait draws stay reproducible from the single hash seed. */
const lcg = (seed: number) => {
    let state = seed >>> 0
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0
        return state / 4294967296
    }
}

export interface DotFaceTraits {
    background: DotFaceColor
    eyeStyle: number
    mouthStyle: number
    blush: boolean
}

export const dotFaceTraits = (username: string): DotFaceTraits => {
    const next = lcg(djb2(username.toLowerCase()))
    return {
        background: PALETTE[Math.floor(next() * PALETTE.length)],
        eyeStyle: Math.floor(next() * 5),
        mouthStyle: Math.floor(next() * 5),
        blush: next() > 0.45,
    }
}

const DotFaceAvatar = ({ username, size, className }: { username: string; size?: number; className?: string }) => {
    const t = useTranslations('common')
    const traits = useMemo(() => dotFaceTraits(username), [username])
    const { background, eyeStyle, mouthStyle, blush } = traits
    const face = FACE_CLASSES[background]

    const cx = 50
    const cy = 46
    const sc = 1.5
    const ex = 13 * sc
    const ey = cy - 4 * sc
    const my = cy + 9 * sc

    const eyes = [
        <g key="e">
            <circle cx={cx - ex} cy={ey} r={3.4 * sc} fill="currentColor" />
            <circle cx={cx + ex} cy={ey} r={3.4 * sc} fill="currentColor" />
        </g>,
        <g key="e" fill="none" stroke="currentColor" strokeWidth={3 * sc} strokeLinecap="round">
            <path d={`M${cx - ex - 4 * sc} ${ey} q${4 * sc} ${-5 * sc} ${8 * sc} 0`} />
            <path d={`M${cx + ex - 4 * sc} ${ey} q${4 * sc} ${-5 * sc} ${8 * sc} 0`} />
        </g>,
        <g key="e">
            <circle cx={cx - ex} cy={ey} r={3.4 * sc} fill="currentColor" />
            <path
                d={`M${cx + ex - 4 * sc} ${ey} h${8 * sc}`}
                stroke="currentColor"
                strokeWidth={3 * sc}
                strokeLinecap="round"
            />
        </g>,
        <g key="e" fill="none" stroke="currentColor" strokeWidth={2.4 * sc}>
            <circle cx={cx - ex} cy={ey} r={4.6 * sc} />
            <circle cx={cx + ex} cy={ey} r={4.6 * sc} />
            <path d={`M${cx - ex + 4.6 * sc} ${ey} H${cx + ex - 4.6 * sc}`} />
        </g>,
        <g
            key="e"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.6 * sc}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d={`M${cx - ex - 4 * sc} ${ey + 2 * sc} l${4 * sc} ${-4 * sc} l${4 * sc} ${4 * sc}`} />
            <path d={`M${cx + ex - 4 * sc} ${ey + 2 * sc} l${4 * sc} ${-4 * sc} l${4 * sc} ${4 * sc}`} />
        </g>,
    ][eyeStyle]

    const mouths = [
        <path
            key="m"
            d={`M${cx - 7 * sc} ${my} q${7 * sc} ${7 * sc} ${14 * sc} 0`}
            stroke="currentColor"
            strokeWidth={3 * sc}
            fill="none"
            strokeLinecap="round"
        />,
        <ellipse key="m" cx={cx} cy={my + 1.5 * sc} rx={4.5 * sc} ry={5.5 * sc} fill="currentColor" />,
        <path
            key="m"
            d={`M${cx - 7 * sc} ${my + 2 * sc} q${7 * sc} ${5 * sc} ${14 * sc} 0 q${-7 * sc} ${-1.5 * sc} ${-14 * sc} 0`}
            fill="currentColor"
        />,
        <path
            key="m"
            d={`M${cx - 6 * sc} ${my + 2 * sc} h${12 * sc}`}
            stroke="currentColor"
            strokeWidth={3 * sc}
            strokeLinecap="round"
        />,
        // wide grin — this slot was a frown, and a generated self-avatar has
        // no business looking unhappy. Array length stays 5 so no one else's
        // face changes.
        <path
            key="m"
            d={`M${cx - 9 * sc} ${my - sc} q${9 * sc} ${10 * sc} ${18 * sc} 0`}
            stroke="currentColor"
            strokeWidth={3 * sc}
            fill="none"
            strokeLinecap="round"
        />,
    ][mouthStyle]

    return (
        <span
            className={twMerge('inline-flex shrink-0 items-center justify-center', face.text, className)}
            style={size ? { width: size, height: size } : undefined}
            data-testid="dot-face-avatar"
        >
            <svg
                className="block h-full w-full"
                viewBox="0 0 100 100"
                role="img"
                aria-label={t('userAvatarAlt', { username })}
            >
                <circle cx="50" cy="50" r="47.5" className={face.circle} strokeWidth="5" />
                {eyes}
                <g data-testid="dot-face-mouth">{mouths}</g>
                {blush && (
                    <g className={face.blush} opacity="0.85">
                        <circle cx={cx - ex - 8 * sc} cy={cy + 5 * sc} r={3.2 * sc} />
                        <circle cx={cx + ex + 8 * sc} cy={cy + 5 * sc} r={3.2 * sc} />
                    </g>
                )}
            </svg>
        </span>
    )
}

export default DotFaceAvatar
