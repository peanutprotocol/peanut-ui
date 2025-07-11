'use client'

import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { twMerge } from 'tailwind-merge'
import { Icon } from '../Global/Icons/Icon'

export interface SliderProps
    extends Omit<
        React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>,
        'value' | 'onValueChange' | 'max' | 'step' | 'defaultValue'
    > {
    value?: boolean
    onValueChange?: (value: boolean) => void
    defaultValue?: boolean
}

const Slider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, SliderProps>(
    ({ className, value, onValueChange, defaultValue, ...props }, ref) => {
        const isControlled = value !== undefined
        const [uncontrolledState, setUncontrolledState] = React.useState(defaultValue ?? false)
        const currentValue = isControlled ? value : uncontrolledState

        const [slidingValue, setSlidingValue] = React.useState<number[] | null>(null)

        const displayValue = slidingValue ?? (currentValue ? [100] : [0])

        const handleValueChange = (newValue: number[]) => {
            setSlidingValue(newValue)
        }

        const handleValueCommit = (committedValue: number[]) => {
            const isChecked = committedValue[0] > 50
            if (onValueChange) {
                onValueChange(isChecked)
            }
            if (!isControlled) {
                setUncontrolledState(isChecked)
            }
            setSlidingValue(null)
        }

        return (
            <SliderPrimitive.Root
                ref={ref}
                className={twMerge(
                    'btn shadow-4 relative flex h-12 w-full touch-none select-none items-center rounded-sm p-0',
                    className
                )}
                max={100}
                step={1}
                value={displayValue}
                onValueChange={handleValueChange}
                onValueCommit={handleValueCommit}
                {...props}
            >
                <SliderPrimitive.Track className="relative h-full w-full grow overflow-hidden rounded-none bg-white">
                    <SliderPrimitive.Range className="absolute h-full bg-primary-1" />
                    <div className="absolute left-0 top-0 flex h-full w-full items-center justify-center text-sm font-bold text-black">
                        Slide to Proceed
                    </div>
                </SliderPrimitive.Track>
                <SliderPrimitive.Thumb className="flex h-full w-12 cursor-pointer items-center justify-center rounded-r-sm border-2 border-purple-1 bg-primary-1 py-3 ring-offset-black transition-colors focus-visible:outline-none focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-50 ">
                    <div className="flex h-full w-12 items-center justify-center p-0">
                        <Icon name="chevron-up" size={32} className="h-8 w-8 rotate-90 text-black" />
                    </div>
                </SliderPrimitive.Thumb>
            </SliderPrimitive.Root>
        )
    }
)
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
