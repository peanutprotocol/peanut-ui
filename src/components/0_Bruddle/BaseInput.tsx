import { forwardRef } from 'react'
import { twMerge } from '@/utils/tw'

type BaseInputVariant = 'sm' | 'md'

interface BaseInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    variant?: BaseInputVariant
    rightContent?: React.ReactNode
    /** visual state, owned by the component per the input board (17360:4441).
        error paints the border/error border via aria-invalid — callers never
        pass border classes. the board defines no valid/success state. */
    state?: 'default' | 'error'
}

const BaseInput = forwardRef<HTMLInputElement, BaseInputProps>(
    ({ className, variant = 'md', rightContent, state = 'default', ...props }, ref) => {
        const variants: Record<BaseInputVariant, string> = {
            sm: 'h-10 px-3',
            md: 'h-12 px-4',
        }

        const c = twMerge('input', variants[variant], className)

        return (
            <div className="relative w-full">
                <input
                    ref={ref}
                    aria-invalid={state === 'error' ? true : undefined}
                    className={twMerge(c, !!rightContent && 'pr-15 md:pr-18')}
                    {...props}
                />
                {rightContent && (
                    <div className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2">{rightContent}</div>
                )}
            </div>
        )
    }
)

BaseInput.displayName = 'BaseInput'

export { BaseInput }
export default BaseInput
