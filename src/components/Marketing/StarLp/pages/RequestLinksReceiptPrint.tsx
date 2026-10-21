'use client'

import { useInView } from 'framer-motion'
import { useCallback, useRef } from 'react'
import { useEntranceArm } from '@/components/Marketing/StarLp/useEntranceArm'
import { RequestLinksReceipt } from './RequestLinksReceipt'

/**
 * Fold 4: the receipt feeds out of the till's slot once, with two short stalls,
 * when it scrolls into view. The slot keeps the receipt's height, so nothing
 * shifts. It arms only when it starts below the viewport (useEntranceArm), so
 * the server, no-JS and reduced motion paint it at rest.
 */
export function RequestLinksReceiptPrint() {
    const { ref: armRef, armed } = useEntranceArm()
    const node = useRef<HTMLDivElement | null>(null)
    const inView = useInView(node, { once: true, amount: 0.4 })
    const setNode = useCallback(
        (el: HTMLDivElement | null) => {
            node.current = el
            armRef(el)
        },
        [armRef]
    )
    return (
        <div
            ref={setNode}
            className="rl-feed mx-auto w-full max-w-[336px] -rotate-1 md:max-w-[448px]"
            data-armed={armed}
            data-play={armed && inView}
        >
            {/* the till's mouth */}
            <div className="-mx-3 h-0.5 rounded-full bg-border-default" />
            <div className="overflow-hidden">
                <div className="rl-paper">
                    <RequestLinksReceipt />
                </div>
            </div>
        </div>
    )
}
