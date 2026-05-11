import { useEffect } from 'react'

let patched = false

// patches removeChild and insertBefore to prevent crashes when browser
// translation extensions (google translate, brave translate, etc) move
// dom nodes out of their react-managed parents. without this, react's
// reconciliation throws "not a child of this node" during unmount/update.
export const useTranslationMutationHandler = () => {
    useEffect(() => {
        if (patched) return
        patched = true

        const originalRemoveChild = Node.prototype.removeChild
        Node.prototype.removeChild = function <T extends Node>(child: T): T {
            if (child.parentNode !== this) {
                return child
            }
            return originalRemoveChild.call(this, child) as T
        }

        const originalInsertBefore = Node.prototype.insertBefore
        Node.prototype.insertBefore = function <T extends Node>(newNode: T, refNode: Node | null): T {
            if (refNode && refNode.parentNode !== this) {
                return newNode
            }
            return originalInsertBefore.call(this, newNode, refNode) as T
        }
    }, [])
}
