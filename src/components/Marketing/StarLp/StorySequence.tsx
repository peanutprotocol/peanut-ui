'use client'

import { twMerge } from '@/utils/tw'
import { useStoryStep } from './useStoryStep'
import type { StorySequenceProps } from './starLp.types'

/**
 * Plays a list of beats once, one every `stepMs`, when the list scrolls into
 * view (a timeline, a chat, a receipt). A tap (a click, so a scroll swipe does
 * not count) or a scroll key while it runs shows the rest at once. No-JS and
 * reduced motion show every beat.
 */
export function StorySequence({ beats, stepMs, className, beatClassName }: StorySequenceProps) {
    const { ref, step, complete } = useStoryStep(beats.length, stepMs)
    return (
        <div ref={ref} className={className} onClick={complete}>
            {beats.map((beat, i) => (
                <div
                    key={i}
                    className={twMerge('star-lp-beat', beatClassName)}
                    data-shown={i < step}
                    data-story-beat={i}
                >
                    {beat}
                </div>
            ))}
        </div>
    )
}
