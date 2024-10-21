import { twMerge } from 'tailwind-merge'

const BaseInput = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => {
    return <input className={twMerge('input', className)} {...props} />
}

export default BaseInput
