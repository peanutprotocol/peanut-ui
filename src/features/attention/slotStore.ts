'use client'

import { useSyncExternalStore } from 'react'
import type { MountedSlot, SlotContext, SlotId } from './types'

const holds = new Map<symbol, { slot: MountedSlot; count: number }>()
const listeners = new Set<() => void>()
const EMPTY: MountedSlot[] = []
let snapshot = EMPTY

const equalContext = (a: SlotContext | undefined, b: SlotContext | undefined) =>
    a === b ||
    (!!a &&
        !!b &&
        Object.keys(a).length === Object.keys(b).length &&
        Object.keys(a).every((key) => Object.prototype.hasOwnProperty.call(b, key) && Object.is(a[key], b[key])))

function emit() {
    const next = Array.from(holds.values(), (hold) => hold.slot)
    if (
        next.length === snapshot.length &&
        next.every(
            (slot, index) => slot.id === snapshot[index].id && equalContext(slot.context, snapshot[index].context)
        )
    )
        return
    snapshot = next
    listeners.forEach((listener) => listener())
}

export function registerSlot(owner: symbol, slot: MountedSlot): () => void {
    const hold = holds.get(owner)
    holds.set(owner, { slot, count: (hold?.count ?? 0) + 1 })
    emit()
    let released = false
    return () => {
        if (released) return
        released = true
        const current = holds.get(owner)
        if (!current) return
        if (current.count > 1) holds.set(owner, { ...current, count: current.count - 1 })
        else holds.delete(owner)
        emit()
    }
}

export function updateSlot(owner: symbol, slot: MountedSlot): void {
    const hold = holds.get(owner)
    if (!hold || (hold.slot.id === slot.id && equalContext(hold.slot.context, slot.context))) return
    holds.set(owner, { ...hold, slot })
    emit()
}

export function isFirstSlotInstance(owner: symbol, id: SlotId): boolean {
    return Array.from(holds.entries()).find(([, hold]) => hold.slot.id === id)?.[0] === owner
}

export function useMountedSlots(): MountedSlot[] {
    return useSyncExternalStore(
        (listener) => {
            listeners.add(listener)
            return () => {
                listeners.delete(listener)
            }
        },
        () => snapshot,
        () => EMPTY
    )
}
