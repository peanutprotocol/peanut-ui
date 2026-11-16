'use client'

import { type RefObject, useLayoutEffect, useState } from 'react'

/** Least space between the sentence block and the CTA top (mock CTA_GAP). */
const CTA_GAP = 16

/** The sentence type: 30/44 (24/36 on a small phone), or one step down when that does not fit above the CTA. */
export const SENTENCE_CLASS = {
    regular: 'text-heading-m leading-[2.75rem] signup-sm:text-heading-s signup-sm:leading-9',
    small: 'text-heading-s leading-9',
} as const

/**
 * The mock's fitSentence: the sentence steps down to 24/36 when its block (the sentence and anything pinned under
 * it) would end closer than 16 px to the CTA. It only ever steps down during a visit, so a later pick never makes
 * the type grow back. `remeasure` re-checks when the block below the sentence comes or goes. Without the shell's
 * footer (a screen rendered alone) it keeps the regular size.
 */
export function useSentenceFit(blockRef: RefObject<HTMLElement | null>, remeasure?: unknown): string {
    const [small, setSmall] = useState(false)
    useLayoutEffect(() => {
        const block = blockRef.current
        const footer = block?.ownerDocument.querySelector('[data-setup-footer]')
        if (small || !block || !footer) return
        if (block.getBoundingClientRect().bottom > footer.getBoundingClientRect().top - CTA_GAP) setSmall(true)
    }, [blockRef, remeasure, small])
    return small ? SENTENCE_CLASS.small : SENTENCE_CLASS.regular
}
