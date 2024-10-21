import classNames from 'classnames'
import { twMerge } from 'tailwind-merge'

type DividerProps = {
    text?: string
} & React.HTMLAttributes<HTMLDivElement>

const Divider = ({ text, className, ...props }: DividerProps) => {
    return (
        <div className={twMerge('flex w-full items-center justify-center py-2', className)} {...props}>
            <span className="h-0.25 w-full bg-n-1 dark:bg-white"></span>
            {text && <span className="mx-4 text-sm font-medium">{text}</span>}
            <span className="h-0.25 w-full bg-n-1 dark:bg-white"></span>
        </div>
    )
}

export default Divider
