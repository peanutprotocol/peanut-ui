'use client'

/**
 * <HoldToClaimButton /> — the canonical "press and hold the primary CTA"
 * button.
 *
 * One source of truth for the perk-claim style press-and-hold:
 *   - useHoldToClaim drives progress + isShaking + shakeIntensity + haptics.
 *   - The button is a Bruddle <Button variant="purple" shadowSize="4">
 *     (default primary CTA), with a solid black overlay that fills
 *     left→right as holdProgress climbs. Solid black (not bg-black/30) so
 *     contrast against the pink stays strong — matches the QR-claim button.
 *   - The screen-wide shake is intentionally NOT applied here. Apply
 *     `getShakeClass(isShaking, shakeIntensity)` at the parent column so
 *     the headline + supporting content shake together with the button.
 *     Parents read shake state from the imperative `onShakeChange` callback
 *     or — more commonly — the `useHoldToClaim` hook directly if they need
 *     other fields too. For the simple case, this component just exposes
 *     the result via the same hook internally and lets the parent shake.
 *
 * Call sites:
 *   - QR claim flow (/qr/[code])
 *   - Card eligibility-check (/card)
 */

import { type FC, type ReactNode, useEffect } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { useHoldToClaim, type ShakeIntensity } from '@/hooks/useHoldToClaim'

interface Props {
    onComplete: () => void
    /** Label shown on the button (e.g. "See if you qualify"). */
    children: ReactNode
    /** Disable the hold + button (e.g. while a network claim is in flight). */
    disabled?: boolean
    /** Pass the Bruddle `loading` spinner state through (renders inside the
     *  button). When true, also disables the hold. */
    loading?: boolean
    /** Enable tap-to-progress mode (taps add progress, decays over time).
     *  Default false: pure hold-to-claim. */
    enableTapMode?: boolean
    /** Optional progress tuning knobs forwarded to useHoldToClaim. */
    tapProgress?: number
    holdProgressPerSec?: number
    decayRate?: number
    /** Reports the live shake state to the parent so it can apply
     *  `getShakeClass(isShaking, intensity)` to the surrounding column.
     *  This keeps shake-scope a parent concern (the screen shakes, not the
     *  button), while progress + handlers stay encapsulated here. */
    onShakeChange?: (isShaking: boolean, intensity: ShakeIntensity) => void
    /** Optional aria-label override for the button. */
    ariaLabel?: string
}

export const HoldToClaimButton: FC<Props> = ({
    onComplete,
    children,
    disabled,
    loading,
    enableTapMode,
    tapProgress,
    holdProgressPerSec,
    decayRate,
    onShakeChange,
    ariaLabel,
}) => {
    const { holdProgress, isShaking, shakeIntensity, buttonProps } = useHoldToClaim({
        onComplete,
        disabled: disabled || loading,
        enableTapMode,
        tapProgress,
        holdProgressPerSec,
        decayRate,
    })

    // Surface shake state to the parent. useEffect so we don't setState
    // during render in the parent (would loop). Fires once per shake
    // transition since useHoldToClaim already debounces internally.
    useEffect(() => {
        onShakeChange?.(isShaking, shakeIntensity)
    }, [isShaking, shakeIntensity, onShakeChange])

    return (
        <Button
            {...buttonProps}
            variant="purple"
            shadowSize="4"
            disabled={disabled}
            loading={loading}
            aria-label={ariaLabel}
            className={`${buttonProps.className ?? ''} w-full`}
        >
            {/* Solid black overlay fills left→right with holdProgress.
                Matches the QR-claim button exactly: bg-black (not /30),
                transition-all duration-100. */}
            <div
                className="absolute inset-0 bg-black transition-all duration-100"
                style={{ width: `${holdProgress}%`, left: 0 }}
            />
            <span className="relative z-10">{children}</span>
        </Button>
    )
}

export default HoldToClaimButton
