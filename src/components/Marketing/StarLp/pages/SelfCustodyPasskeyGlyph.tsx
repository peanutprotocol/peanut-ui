import { twMerge } from '@/utils/tw'
import type { SelfCustodyGlyphProps } from './selfCustody.types'

/** The face-scan mark of a passkey prompt, drawn as UI (not brand art). */
export function SelfCustodyPasskeyGlyph({ className }: SelfCustodyGlyphProps) {
    return (
        <svg
            viewBox="0 0 54 54"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            aria-hidden
            className={twMerge('h-11 w-11', className)}
        >
            <path d="M3 15V9a6 6 0 0 1 6-6h6M39 3h6a6 6 0 0 1 6 6v6M51 39v6a6 6 0 0 1-6 6h-6M15 51H9a6 6 0 0 1-6-6v-6M18 20v4M36 20v4M27 20v12h-3M19 38c5 4 11 4 16 0" />
        </svg>
    )
}
