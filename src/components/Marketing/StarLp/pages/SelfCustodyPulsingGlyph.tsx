import { twMerge } from '@/utils/tw'
import { SelfCustodyPasskeyGlyph } from './SelfCustodyPasskeyGlyph'
import type { SelfCustodyPulsingGlyphProps } from './selfCustody.types'

const PULSE_KEYFRAMES = '@keyframes sc-glyph-pulse{40%{transform:scale(1.22)}70%{transform:scale(0.94)}}'

/** The passkey glyph, which gives one springy pulse each time `pulse` goes up. Still under reduced motion. */
export function SelfCustodyPulsingGlyph({ pulse, className }: SelfCustodyPulsingGlyphProps) {
    return (
        <>
            <style>{PULSE_KEYFRAMES}</style>
            {/* the key restarts the animation on every bump */}
            <span
                key={pulse}
                className={twMerge(
                    'inline-block',
                    pulse > 0 && 'motion-safe:animate-[sc-glyph-pulse_0.5s_var(--ease-spring)]'
                )}
            >
                <SelfCustodyPasskeyGlyph className={className} />
            </span>
        </>
    )
}
