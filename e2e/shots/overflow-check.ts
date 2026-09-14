/**
 * The i18n overflow detector. Serialized into the page by overflow.spec.ts
 * (real screens) and overflow-detector.spec.ts (synthetic self-tests), so it
 * must stay self-contained: no imports used inside findOverflows, no closures.
 */

export type Overflow = {
    selector: string
    text: string
    kind: 'clip-x' | 'clip-y' | 'placeholder'
    detail: string
}

/**
 * Runs in the page. Finds text the user cannot read:
 *  - an element with a direct text node, clipped by its own overflow
 *    hidden/clip (scrollable containers are fine, ellipsis/line-clamp are
 *    deliberate truncation and skipped)
 *  - a container with overflow hidden whose text content crosses the clipped
 *    edge — either because a text-bearing descendant's box crosses it, or
 *    because the descendant's TEXT overflows its own box that ends at the
 *    edge (nowrap child at 100% width: the box stops at the edge, the text
 *    keeps going — measured via the descendant's scroll extent)
 *  - an input/textarea whose placeholder or value is wider than its content
 *    box (inputs clip natively, scrollWidth does not see it — the original
 *    "Usuario*" bug)
 */
export function findOverflows(exempt: string[]): Overflow[] {
    const bad: Overflow[] = []
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    const path = (el: Element): string => {
        const parts: string[] = []
        let node: Element | null = el
        while (node && node !== document.body && parts.length < 4) {
            const cls = [...node.classList].slice(0, 3).join('.')
            parts.unshift(node.tagName.toLowerCase() + (cls ? `.${cls}` : ''))
            node = node.parentElement
        }
        return parts.join(' > ')
    }

    const isExempt = (el: Element): boolean =>
        exempt.some((sel) => {
            try {
                return el.closest(sel) !== null
            } catch {
                return false
            }
        })

    const seen = new Set<string>()
    const flag = (el: Element, kind: Overflow['kind'], detail: string, text?: string) => {
        const sample = (text ?? (el as HTMLElement).innerText ?? '').trim().replace(/\s+/g, ' ').slice(0, 80)
        const key = `${kind}|${sample}`
        if (seen.has(key)) return
        seen.add(key)
        bad.push({ selector: path(el), text: sample, kind, detail })
    }

    const visible = (el: Element): boolean => {
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false
        const rect = el.getBoundingClientRect()
        // sr-only / visually-hidden text lives in a 1px clipped box on purpose
        return rect.width > 2 && rect.height > 2
    }

    const truncates = (el: Element): boolean => {
        const cs = getComputedStyle(el)
        const clamp = (cs as unknown as Record<string, string>).webkitLineClamp
        return cs.textOverflow === 'ellipsis' || (clamp !== undefined && clamp !== 'none')
    }

    const hasOwnText = (el: Element): boolean =>
        Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0)

    for (const el of Array.from(document.body.querySelectorAll('*'))) {
        if (!visible(el)) continue
        if (isExempt(el)) continue
        const cs = getComputedStyle(el)

        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'hidden') continue
            const text = (el.value || el.placeholder || '').trim()
            if (!text) continue
            ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
            const needed = ctx.measureText(text).width
            const inner = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
            if (needed > inner + 1) {
                flag(el, 'placeholder', `text needs ${Math.round(needed)}px, input fits ${Math.round(inner)}px`, text)
            }
            continue
        }

        const hiddenX = cs.overflowX === 'hidden' || cs.overflowX === 'clip'
        const hiddenY = cs.overflowY === 'hidden' || cs.overflowY === 'clip'
        const clipX = hiddenX && el.scrollWidth > el.clientWidth + 1
        // +3 vertical tolerance: line-height rounding trips a +1 check
        const clipY = hiddenY && el.scrollHeight > el.clientHeight + 3
        if (!clipX && !clipY) continue

        // The clipped pixels may be decorative (positioned art bleeding off a
        // hero on purpose), so attribute the clip to TEXT: flag only text-
        // bearing descendants whose content actually crosses the clipped edge.
        const box = el.getBoundingClientRect()

        // the element clips its own direct text — scrollWidth already proves it
        if (hasOwnText(el) && !truncates(el)) {
            if (clipX) flag(el, 'clip-x', `scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}`)
            else flag(el, 'clip-y', `scrollHeight ${el.scrollHeight} > clientHeight ${el.clientHeight}`)
            continue
        }

        const holders = Array.from(el.querySelectorAll('*')).filter(
            (d) => hasOwnText(d) && visible(d) && !truncates(d) && !isExempt(d)
        )
        for (const d of holders) {
            const r = d.getBoundingClientRect()
            // text extent, not box extent: a nowrap child at 100% width ends
            // its BOX exactly at the clip edge while its TEXT keeps going —
            // scrollWidth/Height see that regardless of the child's own
            // overflow value
            const textRight = r.left + Math.max(d.scrollWidth, r.width)
            const textBottom = r.top + Math.max(d.scrollHeight, r.height)
            if (clipX && textRight > box.right + 2) {
                flag(d, 'clip-x', `text extent ${Math.round(textRight)}px > clip edge ${Math.round(box.right)}px`)
            } else if (clipY && textBottom > box.bottom + 3) {
                flag(d, 'clip-y', `text extent ${Math.round(textBottom)}px > clip edge ${Math.round(box.bottom)}px`)
            }
        }
    }
    return bad
}
