'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

/**
 * Deterministic generative avatar for the user's OWN identity (home chip,
 * self profile header). The username is hashed once; the hash picks the
 * background from the five Peanut palette colors, one of five eye styles,
 * one of five mouths, and whether the cheeks blush — 625 combinations,
 * stable across devices, nothing stored or uploaded.
 *
 * Deliberately NOT used for other people: counterparty rows keep the
 * initials avatar, where letters genuinely help tell contacts apart.
 * Face strokes use currentColor so the theme token supplies the outline.
 */
const PALETTE = ['#FF90E8', '#FFC900', '#BA8BFF', '#98E9AB', '#90A8ED'] as const
const BLUSH = '#FF90E8'

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
    background: string
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
        <path
            key="m"
            d={`M${cx - 6 * sc} ${my + 4 * sc} q${6 * sc} ${-6 * sc} ${12 * sc} 0`}
            stroke="currentColor"
            strokeWidth={3 * sc}
            fill="none"
            strokeLinecap="round"
        />,
    ][mouthStyle]

    return (
        <span
            className={twMerge('inline-flex shrink-0 items-center justify-center text-n-1 dark:text-white', className)}
            style={size ? { width: size, height: size } : undefined}
            data-testid="dot-face-avatar"
        >
            <svg
                className="block h-full w-full"
                viewBox="0 0 100 100"
                role="img"
                aria-label={t('userAvatarAlt', { username })}
            >
                <circle cx="50" cy="50" r="47.5" fill={background} stroke="currentColor" strokeWidth="5" />
                {eyes}
                {mouths}
                {blush && (
                    <g fill={BLUSH} opacity="0.85">
                        <circle cx={cx - ex - 8 * sc} cy={cy + 5 * sc} r={3.2 * sc} />
                        <circle cx={cx + ex + 8 * sc} cy={cy + 5 * sc} r={3.2 * sc} />
                    </g>
                )}
            </svg>
        </span>
    )
}

export default DotFaceAvatar
