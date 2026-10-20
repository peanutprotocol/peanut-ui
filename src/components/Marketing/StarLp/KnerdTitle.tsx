import Title from '@/components/0_Bruddle/Title'
import { twMerge } from '@/utils/tw'
import { KNERD_SIZE_CLASS } from './starLp.consts'
import type { KnerdTitleProps } from './starLp.types'

/** The DS knerd `Title` at one of three preset sizes, so the six pages share one scale. */
export function KnerdTitle({ text, size, className }: KnerdTitleProps) {
    return <Title text={text} className={twMerge(KNERD_SIZE_CLASS[size], className)} />
}
