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
    ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
    // Use internal state for the slider value to enable magnetic snapping
    const [internalValue, setInternalValue] = React.useState<number[]>(defaultValue || controlledValue)

    // Sync internal state when controlled value changes from external source
    React.useEffect(() => {
        if (controlledValue !== undefined && controlledValue[0] !== internalValue[0]) {
            setInternalValue(controlledValue)
        }
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
            <div className="mb-2 flex w-full items-center justify-between text-xs font-bold">
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
                    'relative flex w-full touch-none select-none items-center data-[disabled]:opacity-50',
                    className
                )}
                {...props}
            >
                <SliderPrimitive.Track
                    data-slot="slider-track"
                    className="relative h-1.5 w-full overflow-visible rounded-full bg-grey-2"
                >
                    <SliderPrimitive.Range
                        data-slot="slider-range"
                        className="absolute h-full rounded-full bg-primary-1 transition-all duration-150 ease-out"
                    />
                </SliderPrimitive.Track>

                <SliderPrimitive.Thumb
                    data-slot="slider-thumb"
                    className={twMerge(
                        'relative isolate block size-4 cursor-pointer rounded-full bg-white shadow-lg outline-none ring-0 transition-all duration-150 ease-out disabled:pointer-events-none disabled:opacity-50'
                    )}
                >
                    {/* Vertical tick mark - only visible when at a snap point */}
                    {activeSnapPoint !== undefined && (
                        <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-6 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-1 transition-all duration-150" />
                    )}

                    {/* White circle with border on top of the tick */}
                    <div className="absolute inset-0 z-10 rounded-full border-2 border-black bg-white" />

                    {/* Current value label */}
                    <div className="absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap text-xs text-black">
                        {internalValue[0] % 1 === 0 ? internalValue[0].toFixed(0) : internalValue[0].toFixed(2)}%
                    </div>
                </SliderPrimitive.Thumb>
            </SliderPrimitive.Root>
        </div>
    )
}

export { Slider }
