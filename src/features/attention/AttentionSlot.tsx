'use client'

import { Suspense, useEffect, useLayoutEffect, useRef } from 'react'
import { useAttentionOptional } from './AttentionProvider'
import { SurfaceBoundary } from './AttentionInterrupt'
import { INLINE_SURFACES } from './inlineSurfaces'
import { isFirstSlotInstance, registerSlot, updateSlot, useMountedSlots } from './slotStore'
import type { SlotContext, SlotId } from './types'

export function AttentionSlot({ id, context }: { id: SlotId; context?: SlotContext }) {
    const attention = useAttentionOptional()
    const owner = useRef(Symbol('attention-slot'))
    const mounted = useMountedSlots()
    const enabled = !!attention
    useLayoutEffect(() => {
        if (!enabled) return
        return registerSlot(owner.current, { id })
    }, [id, enabled])
    useLayoutEffect(() => {
        if (enabled) updateSlot(owner.current, { id, context })
    })
    const first = mounted.length > 0 && isFirstSlotInstance(owner.current, id)
    const pick = attention?.decision.inline
    const askId = first && pick?.slot === id ? pick.id : null
    const Surface = askId ? INLINE_SURFACES[askId] : undefined
    const openedSurface = attention?.openedSurface
    useEffect(() => {
        if (askId && Surface) openedSurface?.(askId, 'inline')
    }, [askId, Surface, openedSurface])
    if (!attention || !askId || !Surface) return null
    return (
        <SurfaceBoundary
            key={`${attention.state.userId}:${askId}`}
            askId={askId}
            onCrash={() => attention.crashed(askId, 'inline')}
        >
            <Suspense fallback={null}>
                <Surface
                    askId={askId}
                    slot={id}
                    context={context}
                    onActed={() => attention.acted(askId, 'inline')}
                    onDismissed={() => attention.dismissed(askId, 'inline')}
                    onSnoozed={(until) => attention.snoozed(askId, until, 'inline')}
                />
            </Suspense>
        </SurfaceBoundary>
    )
}

export default AttentionSlot
