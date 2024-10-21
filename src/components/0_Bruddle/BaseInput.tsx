import { forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'

const BaseInput = forwardRef(
    ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>, ref: React.Ref<HTMLInputElement>) => {
        return <input ref={ref} className={twMerge('input', className)} {...props} />
    }
)

export default BaseInput
