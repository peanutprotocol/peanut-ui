import { twMerge } from '@/utils/tw'

type DividerProps = {
    text?: string
    dividerClassname?: HTMLElement['className']
    textClassname?: HTMLElement['className']
} & React.HTMLAttributes<HTMLDivElement>

const Divider = ({ text, className, dividerClassname, textClassname, ...props }: DividerProps) => {
    return (
        <div className={twMerge('flex w-full items-center justify-center py-2', className)} {...props}>
            <span className={twMerge('h-0.25 w-full bg-border-default', dividerClassname)}></span>
            {text && <span className={twMerge('mx-4 text-body-s', textClassname)}>{text}</span>}
            <span className={twMerge('h-0.25 w-full bg-border-default', dividerClassname)}></span>
        </div>
    )
}

Divider.displayName = 'Divider'

export { Divider }
export default Divider
