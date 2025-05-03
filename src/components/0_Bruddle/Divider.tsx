import { twMerge } from 'tailwind-merge'

type DividerProps = {
    text?: string
    dividerClassname?: HTMLElement['className']
} & React.HTMLAttributes<HTMLDivElement>

const Divider = ({ text, className, dividerClassname, ...props }: DividerProps) => {
    return (
        <div className={twMerge('flex w-full items-center justify-center py-2', className)} {...props}>
            <span className={twMerge('h-0.25 w-full bg-n-1 dark:bg-white', dividerClassname)}></span>
            {text && <span className="mx-4 text-sm font-medium">{text}</span>}
            <span className={twMerge('h-0.25 w-full bg-n-1 dark:bg-white', dividerClassname)}></span>
        </div>
    )
}

export default Divider
