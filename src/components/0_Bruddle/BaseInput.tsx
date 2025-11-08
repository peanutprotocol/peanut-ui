import { forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'

type BaseInputVariant = 'sm' | 'md' | 'lg'

interface BaseInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    variant?: BaseInputVariant
}

const BaseInput = forwardRef<HTMLInputElement, BaseInputProps>(({ className, variant = 'md', ...props }, ref) => {
    const variants: Record<BaseInputVariant, string> = {
        sm: 'h-10 px-3',
        md: 'h-16 px-5',
        lg: 'h-20 px-6',
    }

    const c = twMerge('input', variants[variant], className)

    return <input ref={ref} className={c} {...props} />
})

export default BaseInput
