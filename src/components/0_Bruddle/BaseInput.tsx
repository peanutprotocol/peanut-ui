import { forwardRef } from 'react'
import { twMerge } from '@/utils/tw'

type BaseInputSize = 'sm' | 'md'

// the native `size` attribute (a character count on text inputs) is dropped:
// nothing passes it, and the board names this axis size.
interface BaseInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
    /** board height row: sm = 40px, md (default) = 48px */
    size?: BaseInputSize
    /** 40px leading slot per the input board */
    leftContent?: React.ReactNode
    rightContent?: React.ReactNode
    /** visual state, owned by the component per the input board (17360:4441).
        error paints the border/error border via aria-invalid — callers never
        pass border classes. the board defines no valid/success state. */
    state?: 'default' | 'error'
}

const BaseInput = forwardRef<HTMLInputElement, BaseInputProps>(
    ({ className, size = 'md', leftContent, rightContent, state = 'default', ...props }, ref) => {
        const sizes: Record<BaseInputSize, string> = {
            sm: 'h-10 px-3',
            md: 'h-12 px-4',
        }

        const c = twMerge('input', sizes[size], className)

        return (
            <div className="relative w-full">
                <input
                    ref={ref}
                    aria-invalid={state === 'error' ? true : undefined}
                    className={twMerge(c, !!leftContent && 'pl-10', !!rightContent && 'pr-15 md:pr-18')}
                    {...props}
                />
                {leftContent && (
                    <div className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2">{leftContent}</div>
                )}
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
