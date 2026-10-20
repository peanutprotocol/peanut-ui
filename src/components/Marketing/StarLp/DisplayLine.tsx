import { twMerge } from '@/utils/tw'
import { DISPLAY_LINE_CLASS } from './starLp.consts'
import type { DisplayLineProps } from './starLp.types'

/** A Roboto display line inside a heading, beside a KnerdTitle ("GET PAID FROM" over "US and EUROPE"). */
export function DisplayLine({ children, size = 'lead', className }: DisplayLineProps) {
    return (
        <span
            className={twMerge(
                'font-roboto-flex-extrabold block font-extraBlack uppercase',
                DISPLAY_LINE_CLASS[size],
                className
            )}
        >
            {children}
        </span>
    )
}
