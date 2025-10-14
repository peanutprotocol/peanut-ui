'use client'

import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { twMerge } from 'tailwind-merge'

const PERCENTAGE_OPTIONS = [25, 33, 50, 100, 120]

function Slider({
    className,
    defaultValue = [100],
    value: controlledValue,
    onValueChange,
    ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
    // Use internal state for the slider value to enable magnetic snapping
    const [internalValue, setInternalValue] = React.useState<number[]>(controlledValue || defaultValue)

    // Sync with controlled value if it changes externally
    React.useEffect(() => {
        if (controlledValue) {
            setInternalValue(controlledValue)
        }
    }, [controlledValue])

    const _values = React.useMemo(() => internalValue, [internalValue])

    // Snap to nearest percentage option during drag
    const handleValueChange = React.useCallback(
        (newValue: number[]) => {
            const snappedValue = PERCENTAGE_OPTIONS.reduce((prev, curr) =>
                Math.abs(curr - newValue[0]) < Math.abs(prev - newValue[0]) ? curr : prev
            )
            const snappedArray = [snappedValue]

            // Only update if the value actually changed
            if (internalValue[0] !== snappedValue) {
                setInternalValue(snappedArray)
                onValueChange?.(snappedArray)
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
                        className="absolute h-full rounded-full bg-primary-1"
                    />
                </SliderPrimitive.Track>
                {Array.from({ length: _values.length }, (_, index) => (
                    <SliderPrimitive.Thumb
                        data-slot="slider-thumb"
                        key={index}
                        className={twMerge(
                            'relative isolate block size-4 cursor-pointer rounded-full bg-white shadow-lg outline-none ring-0 transition-transform before:absolute before:left-1/2 before:top-1/2 before:z-[-10] before:h-6 before:w-1 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:bg-primary-1 before:content-[""] after:absolute after:inset-0 after:z-10 after:rounded-full after:border-2 after:border-black after:bg-white after:content-[""] disabled:pointer-events-none disabled:opacity-50'
                        )}
                    >
                        <div className="absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap text-xs text-black">
                            {/* Show decimals only if there are any */}
                            {internalValue[index] % 1 === 0
                                ? internalValue[index].toFixed(0)
                                : internalValue[index].toFixed(2)}
                            %
                        </div>
                    </SliderPrimitive.Thumb>
                ))}
            </SliderPrimitive.Root>
        </div>
    )
}

export { Slider }
