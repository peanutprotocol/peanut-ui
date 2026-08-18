'use client'

import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { twMerge } from 'tailwind-merge'

const SNAP_POINTS = [25, 100 / 3, 50, 100] // 100/3 = 33.333...% for equal 3-person splits
const SNAP_THRESHOLD = 5 // ±5% proximity to trigger snap

function Slider({
    className,
    defaultValue = [100],
    value: controlledValue,
    onValueChange,
    // radix renders role="slider" on the Thumb, so the accessible name must land there
    'aria-label': ariaLabel,
    ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
    // Use internal state for the slider value to enable magnetic snapping.
    // Seed from the controlled value when given, so a controlled slider does
    // not first paint at defaultValue (100) and visibly jump after mount.
    const [internalValue, setInternalValue] = React.useState<number[]>(controlledValue ?? defaultValue)

    // Sync internal state when controlled value changes from external source.
    // The parent derives the controlled value from a cent-rounded amount, so a
    // percentage the user snapped to (e.g. 50%) comes back as 49.98% for pots
    // whose half lands on a sub-cent ($33.37 → $16.685 → floored to $16.68).
    // Don't let that sub-cent drift knock the thumb off a snap point it's
    // already resting on (the amount stays correct; only the label was wrong).
    React.useEffect(() => {
        if (controlledValue === undefined || controlledValue[0] === internalValue[0]) return
        const restingSnap = SNAP_POINTS.find((snapPoint) => Math.abs(internalValue[0] - snapPoint) < 0.5)
        if (restingSnap !== undefined && Math.abs(controlledValue[0] - restingSnap) < 0.5) return
        setInternalValue(controlledValue)
    }, [controlledValue])

    // Check if current value is at a snap point (exact match)
    const activeSnapPoint = React.useMemo(() => {
        return SNAP_POINTS.find((snapPoint) => Math.abs(internalValue[0] - snapPoint) < 0.5)
    }, [internalValue])

    // Soft snap to nearby snap points with ±5% threshold
    const handleValueChange = React.useCallback(
        (newValue: number[]) => {
            const rawValue = newValue[0]
            let finalValue = rawValue

            // Check if we're within snap threshold of any snap point
            for (const snapPoint of SNAP_POINTS) {
                if (Math.abs(rawValue - snapPoint) <= SNAP_THRESHOLD) {
                    finalValue = snapPoint
                    break
                }
            }

            const finalArray = [finalValue]

            // Only update if the value actually changed
            if (internalValue[0] !== finalValue) {
                setInternalValue(finalArray)
                onValueChange?.(finalArray)
            }
        },
        [onValueChange, internalValue]
    )

    return (
        <div className="w-full">
            <div className="mb-2 flex w-full items-center justify-between text-body-s text-foreground-primary">
                <p>0%</p>
                <p>120%</p>
            </div>
            <SliderPrimitive.Root
                data-slot="slider"
                value={internalValue}
                onValueChange={handleValueChange}
                min={0}
                max={120}
                step={1}
                className={twMerge(
                    'relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50',
                    className
                )}
                {...props}
            >
                <SliderPrimitive.Track
                    data-slot="slider-track"
                    className="relative h-1.5 w-full overflow-visible rounded-full bg-border-disabled"
                >
                    <SliderPrimitive.Range
                        data-slot="slider-range"
                        className="absolute h-full rounded-full bg-action-primary transition-all duration-fast ease-out"
                    />
                </SliderPrimitive.Track>

                <SliderPrimitive.Thumb
                    data-slot="slider-thumb"
                    aria-label={ariaLabel}
                    className={twMerge(
                        // after: pseudo-element extends the 16px thumb to a 44px hit area
                        // outline-none poisons --tw-outline-style, so the ring needs an
                        // explicit focus-visible:outline-solid to paint (globals.css convention)
                        'relative isolate block size-4 cursor-pointer rounded-full transition-all duration-fast ease-out outline-none after:absolute after:-inset-3.5 focus-visible:outline-2 focus-visible:outline-action-focus focus-visible:outline-solid disabled:pointer-events-none disabled:opacity-50'
                    )}
                >
                    {/* Vertical snap tick - only visible when at a snap point */}
                    {activeSnapPoint !== undefined && (
                        <div className="pointer-events-none absolute top-1/2 left-1/2 z-0 h-6 w-1 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-action-primary transition-all duration-fast" />
                    )}

                    {/* White circle with border on top of the tick */}
                    <div className="shadow-2 absolute inset-0 z-10 rounded-full border border-border-default bg-background-default" />

                    {/* Current value label */}
                    <div className="absolute top-full left-1/2 z-20 mt-2 -translate-x-1/2 text-label-l whitespace-nowrap text-foreground-primary">
                        {internalValue[0] % 1 === 0 ? internalValue[0].toFixed(0) : internalValue[0].toFixed(2)}%
                    </div>
                </SliderPrimitive.Thumb>
            </SliderPrimitive.Root>
        </div>
    )
}

export { Slider }
