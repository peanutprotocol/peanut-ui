import { twMerge } from '@/utils/tw'

type DividerProps = {
    text?: string
    dividerClassname?: HTMLElement['className']
    textClassname?: HTMLElement['className']
} & React.HTMLAttributes<HTMLDivElement>

const Divider = ({ text, className, dividerClassname, textClassname, ...props }: DividerProps) => {
    return (
        <div className={twMerge('flex w-full items-center justify-center py-2', className)} {...props}>
            <span className={twMerge('h-0.25 w-full bg-n-1 dark:bg-white', dividerClassname)}></span>
            {/* text span stays out of twMerge: unconfigured twMerge classifies DS
                typography tokens (text-label-m, text-body-s) as colors and drops
                them against text-foreground-* (extendTailwindMerge is a tracked
                follow-up). textClassname fully replaces the default typography. */}
            {text && <span className={`mx-4 ${textClassname ?? 'text-sm font-medium'}`}>{text}</span>}
            <span className={twMerge('h-0.25 w-full bg-n-1 dark:bg-white', dividerClassname)}></span>
        </div>
    )
}

Divider.displayName = 'Divider'

export { Divider }
export default Divider
