import { twMerge } from '@/utils/tw'

type DividerProps = React.HTMLAttributes<HTMLDivElement> &
    (
        | {
              orientation?: 'horizontal'
              text?: string
              dividerClassname?: HTMLElement['className']
              textClassname?: HTMLElement['className']
          }
        | {
              /** a dashed rule between two side-by-side columns: it has no label and no box around the columns */
              orientation: 'vertical'
              text?: never
              dividerClassname?: never
              textClassname?: never
          }
    )

const Divider = ({ orientation, text, className, dividerClassname, textClassname, ...props }: DividerProps) => {
    if (orientation === 'vertical') {
        // self-stretch: the rule runs the height of the taller column even when the columns align to the top
        return (
            <div
                aria-hidden
                className={twMerge('w-0 shrink-0 self-stretch border-l border-dashed border-border-default', className)}
                {...props}
            />
        )
    }

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
