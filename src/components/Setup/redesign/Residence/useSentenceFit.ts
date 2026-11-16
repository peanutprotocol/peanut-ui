'use client'

import { type RefObject, useEffect, useLayoutEffect, useState } from 'react'

/** Least space between the sentence block and the CTA top (mock CTA_GAP). */
const CTA_GAP = 16

/** The sentence type: 30/44 (24/36 on a small phone), or one step down when that does not fit above the CTA. */
export const SENTENCE_CLASS = {
    regular: 'text-heading-m leading-[2.75rem] signup-sm:text-heading-s signup-sm:leading-9',
    small: 'text-heading-s leading-9',
} as const

/** A pill's visible label carries `data-fit-label="<its key in worst>"`; a lead word and its pill share one line in
 *  a `data-fit-group` span. */
const FIT_LABEL = 'data-fit-label'
const FIT_GROUP = 'data-fit-group'

/** The longest of a pill's possible labels; the mock measures by character count as well. */
export const longestLabel = (labels: readonly string[]) =>
    labels.reduce((longest, label) => (label.length > longest.length ? label : longest), '')

/**
 * The mock's fitSentence (07 `screen.js:222-245`, 08 `:323-350`): the type size is picked from the widest labels the
 * pills can hold, so a later pick never changes it. A hidden copy of the block gets each pill's `worst` label; the
 * sentence steps down to 24/36 when that copy would end closer than 16 px to the CTA, cuts a pill label, or pushes a
 * pill off its lead word's line. It only ever steps down during a visit. `remeasure` re-checks when the block below
 * the sentence comes or goes. Without the shell's footer (a screen rendered alone) it keeps the regular size.
 * `fitLabels: false` checks the height only, as the 07 mock does: a country pill truncates on its own line anyway, and
 * the full country list always holds a name longer than any line, which would force the small size on every phone.
 */
export function useSentenceFit(
    blockRef: RefObject<HTMLElement | null>,
    {
        worst = {},
        remeasure,
        fitLabels = true,
    }: { worst?: Record<string, string>; remeasure?: unknown; fitLabels?: boolean } = {}
): string {
    const [small, setSmall] = useState(false)
    const [fontsReady, setFontsReady] = useState(false)
    useEffect(() => {
        let live = true
        void document.fonts?.ready.then(() => live && setFontsReady(true))
        return () => {
            live = false
        }
    }, [])
    const worstKey = JSON.stringify(worst)
    useLayoutEffect(() => {
        const block = blockRef.current
        const footer = block?.ownerDocument.querySelector('[data-setup-footer]')
        if (small || !block || !footer || !block.parentElement) return
        const labels: Record<string, string> = JSON.parse(worstKey)
        const rect = block.getBoundingClientRect()
        const probe = block.cloneNode(true) as HTMLElement
        probe.setAttribute('aria-hidden', 'true')
        probe.removeAttribute('data-setup-screen')
        probe.querySelectorAll('[data-testid]').forEach((node) => node.removeAttribute('data-testid'))
        Object.assign(probe.style, {
            position: 'absolute',
            visibility: 'hidden',
            pointerEvents: 'none',
            left: '0',
            top: '0',
            width: `${rect.width}px`,
        })
        probe.querySelectorAll<HTMLElement>(`[${FIT_LABEL}]`).forEach((node) => {
            const label = labels[node.getAttribute(FIT_LABEL) ?? '']
            if (label) node.textContent = label
        })
        block.parentElement.appendChild(probe)
        const overflows = (node: HTMLElement) => node.scrollWidth > node.clientWidth + 1
        // a height of 0 means no layout ran (jsdom): no verdict on the height then
        const tooTall =
            probe.offsetHeight > 0 && rect.top + probe.offsetHeight > footer.getBoundingClientRect().top - CTA_GAP
        const cut =
            fitLabels &&
            ([...probe.querySelectorAll<HTMLElement>(`[${FIT_LABEL}]`)].some(overflows) ||
                [...probe.querySelectorAll<HTMLElement>(`[${FIT_GROUP}]`)].some(overflows))
        probe.remove()
        if (tooTall || cut) setSmall(true)
    }, [blockRef, remeasure, small, worstKey, fontsReady, fitLabels])
    return small ? SENTENCE_CLASS.small : SENTENCE_CLASS.regular
}
