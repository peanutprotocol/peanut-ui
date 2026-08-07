import { useEffect } from 'react'

const PATCH_KEY = '__peanut_translation_patched__'

// patches removeChild and insertBefore to prevent crashes when browser
// translation extensions (google translate, brave translate, etc) move
// dom nodes out of their react-managed parents. without this, react's
// reconciliation throws "not a child of this node" during unmount/update.
//
// intentionally no useEffect cleanup — patches are permanent for the page
// lifetime. removing them on unmount would re-expose the crash.
export const useTranslationMutationHandler = () => {
    useEffect(() => {
        // window global survives HMR — module-scoped flag resets on hot reload,
        // which would nest patched wrappers around each other
        const patchedWindow = window as Window & Partial<Record<typeof PATCH_KEY, boolean>>
        if (patchedWindow[PATCH_KEY]) return
        patchedWindow[PATCH_KEY] = true

        const originalRemoveChild = Node.prototype.removeChild
        Node.prototype.removeChild = function <T extends Node>(child: T): T {
            if (child.parentNode !== this) {
                if (process.env.NODE_ENV !== 'production') {
                    console.warn('[translation-patch] removeChild: node is not a child, skipping', child)
                }
                return child
            }
            return originalRemoveChild.call(this, child) as T
        }

        const originalInsertBefore = Node.prototype.insertBefore
        Node.prototype.insertBefore = function <T extends Node>(newNode: T, refNode: Node | null): T {
            if (refNode && refNode.parentNode !== this) {
                if (process.env.NODE_ENV !== 'production') {
                    console.warn('[translation-patch] insertBefore: ref node is not a child, skipping', refNode)
                }
                return newNode
            }
            return originalInsertBefore.call(this, newNode, refNode) as T
        }
    }, [])
}
