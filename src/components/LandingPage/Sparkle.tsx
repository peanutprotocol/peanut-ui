/**
 * Four-point sparkle drawn in currentColor-free white, for the black beats.
 * The shared `Sparkle` in @/assets/illustrations is filled #121212, so it
 * disappears on black — this one is the white-on-black twin, not a third
 * star shape.
 */
export function Sparkle({ filled }: { filled: boolean }) {
    return (
        <svg viewBox="0 0 24 24" aria-hidden className="size-5">
            <path
                d="M12 0l2.6 8.4L23 11l-8.4 2.6L12 22l-2.6-8.4L1 11l8.4-2.6z"
                fill={filled ? '#fff' : 'none'}
                stroke={filled ? undefined : '#fff'}
                strokeWidth={filled ? undefined : 1.6}
            />
        </svg>
    )
}
