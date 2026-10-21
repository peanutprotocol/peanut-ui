import Title from '@/components/0_Bruddle/Title'
import { KNERD_SIZE_CLASS } from './starLp.consts'
import type { KnerdTitleProps } from './starLp.types'

/** The DS knerd `Title` at a preset size, so the six pages share one scale. Spacing goes on the parent. */
export function KnerdTitle({ text, size, mark }: KnerdTitleProps) {
    return <Title text={text} className={KNERD_SIZE_CLASS[size]} mark={mark} />
}
