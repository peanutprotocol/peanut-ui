import Title from '@/components/0_Bruddle/Title'
import { twMerge } from '@/utils/tw'
import { KNERD_SIZE_CLASS } from './starLp.consts'
import type { KnerdTitleProps } from './starLp.types'

/** The DS knerd `Title` at a preset size, so the six pages share one scale. Spacing goes on the parent. */
export function KnerdTitle({ text, size, mark, align = 'center' }: KnerdTitleProps) {
    return (
        <Title text={text} className={twMerge(KNERD_SIZE_CLASS[size], align === 'start' && 'text-left')} mark={mark} />
    )
}
