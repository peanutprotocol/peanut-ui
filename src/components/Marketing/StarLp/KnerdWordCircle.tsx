import ScribbleCircle from '@/assets/illustrations/scribble-circle.svg'
import { knerdTitle } from '@/components/0_Bruddle/Title'
import { twMerge } from '@/utils/tw'
import { PopIn } from './PopIn'
import { KNERD_SIZE_CLASS } from './starLp.consts'
import type { KnerdWordCircleProps } from './starLp.types'

/**
 * The homepage's hand-drawn scribble circle around one word of a KnerdTitle.
 * It is painted under the title but its stroke crosses the letters' tops and
 * feet, as in the picked mockup. Place it before the KnerdTitle in a `relative
 * inline-block` box. It lays the title out again with transparent text, using
 * the same lines, tilts and spacing as Title, so the circle lands on the word
 * without measuring it after paint.
 */
export function KnerdWordCircle({ text, word, size }: KnerdWordCircleProps) {
    const target = word.toLowerCase()
    const lines = text.split('\n')
    return (
        <span
            aria-hidden
            className={twMerge(
                'pointer-events-none absolute inset-0 block text-center text-transparent uppercase select-none',
                KNERD_SIZE_CLASS[size]
            )}
            style={{ letterSpacing: knerdTitle.letterSpacing, lineHeight: knerdTitle.lineHeight }}
        >
            <span className="block font-knerd-filled">
                {lines.map((line, i) => {
                    const tilt = knerdTitle.lineTilt[i] ?? 0
                    const shift = i === 1 ? knerdTitle.secondLineShift : '0'
                    const at = line.toLowerCase().indexOf(target)
                    const tail = i < lines.length - 1 ? ' ' : ''
                    return (
                        <span
                            key={i}
                            className="block"
                            style={{ transform: `rotate(${tilt}deg) translateX(${shift})` }}
                        >
                            {at < 0 ? (
                                line + tail
                            ) : (
                                <>
                                    {line.slice(0, at)}
                                    <span className="relative inline-block">
                                        {line.slice(at, at + word.length)}
                                        <PopIn
                                            as="span"
                                            delay={0.3}
                                            tilt={-4}
                                            className="absolute -top-[0.2em] right-[calc(-9%-0.03em)] -bottom-[0.08em] left-[calc(-9%+0.03em)] block"
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={ScribbleCircle.src}
                                                width={ScribbleCircle.width}
                                                height={ScribbleCircle.height}
                                                alt=""
                                                className="block h-full w-full max-w-none"
                                            />
                                        </PopIn>
                                    </span>
                                    {line.slice(at + word.length) + tail}
                                </>
                            )}
                        </span>
                    )
                })}
            </span>
        </span>
    )
}
