/**
 * The shadow-clip detector shared by the DS showcase sweep
 * (ds-shadow-clip.spec.ts) and the drawer and modal sweep
 * (drawer-shadow-clip.spec.ts).
 *
 * Every DS button paints a hard offset shadow (4px by default, up to 8px). A
 * box-shadow is NOT part of an element's scrollable overflow region, so any
 * ancestor whose overflow is not `visible` cuts the shadow off in a straight
 * line at its padding-box edge.
 */

export interface ShadowClipOptions {
    scope?: string
    viewportClips?: boolean
}

export interface ShadowClip {
    button: string
    overflowBy: string
    clippedBy: string
}

/**
 * Runs in the page. For every button carrying an outer box-shadow, expands the
 * border box by the shadow's offset/blur/spread and asks whether the nearest
 * clipping ancestor still contains it.
 *
 * Only flags a button whose BORDER box fits but whose SHADOW box does not —
 * a button that is itself outside the clip box is a layout bug, not this one.
 *
 * `scope` limits the scan to buttons inside the matching elements — an open
 * dialog, say, so the page behind it (which vaul scales and clips while a
 * drawer is open) is not judged. `viewportClips` also judges the window edge,
 * for fixed sheets and modals that cannot scroll a shadow into view.
 * Self-contained: page.evaluate serializes it.
 */
export function collectShadowClips({ scope, viewportClips = false }: ShadowClipOptions = {}): ShadowClip[] {
    const TOLERANCE = 1 // px: scrollWidth/clientWidth are integers, rects are not

    const describe = (el: Element) => {
        const tag = el.tagName.toLowerCase()
        const cls = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).slice(0, 4).join('.')
        const text = (el.textContent ?? '').trim().slice(0, 30)
        return `${tag}${cls ? `.${cls}` : ''}${text ? ` "${text}"` : ''}`
    }

    // computed box-shadow: "rgb(0, 0, 0) 4px 4px 0px 0px, rgba(...) 0px 0px 0px 1px inset"
    const shadowExtent = (value: string) => {
        if (!value || value === 'none') return null
        const layers = value.split(/,(?![^(]*\))/)
        let l = 0
        let r = 0
        let t = 0
        let b = 0
        let found = false
        for (const layer of layers) {
            if (layer.includes('inset')) continue
            const nums = (layer.replace(/\w+\([^)]*\)/g, '').match(/-?[\d.]+px/g) ?? []).map(parseFloat)
            if (nums.length < 2) continue
            const [offX, offY, blur = 0, spread = 0] = nums
            const reach = blur + spread
            if (offX === 0 && offY === 0 && reach === 0) continue
            found = true
            l = Math.min(l, offX - reach)
            r = Math.max(r, offX + reach)
            t = Math.min(t, offY - reach)
            b = Math.max(b, offY + reach)
        }
        return found ? { l, r, t, b } : null
    }

    // how far [lo, hi] sticks out of [boxLo, boxHi], 0 when it fits
    const over = (axisClips: boolean, lo: number, hi: number, boxLo: number, boxHi: number) =>
        axisClips ? Math.max(0, boxLo - lo, hi - boxHi) : 0

    const offenders: ShadowClip[] = []

    const BUTTONS = 'button, a.btn, .btn, [class*="btn-"]'
    const roots = scope ? Array.from(document.querySelectorAll(scope)) : [document]
    const buttons = roots.flatMap((root) => Array.from(root.querySelectorAll(BUTTONS)))
    for (const el of buttons) {
        const style = getComputedStyle(el)
        if (style.visibility === 'hidden' || style.display === 'none') continue
        const extent = shadowExtent(style.boxShadow)
        if (!extent) continue

        const rect = el.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) continue
        const shadow = {
            left: rect.left + extent.l,
            right: rect.right + extent.r,
            top: rect.top + extent.t,
            bottom: rect.bottom + extent.b,
        }

        for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
            const cs = getComputedStyle(node)
            const clipsX = cs.overflowX !== 'visible'
            const clipsY = cs.overflowY !== 'visible'
            const clipPath = cs.clipPath !== 'none'
            if (!clipsX && !clipsY && !clipPath) continue

            const nodeRect = node.getBoundingClientRect()
            const padLeft = nodeRect.left + parseFloat(cs.borderLeftWidth)
            const padTop = nodeRect.top + parseFloat(cs.borderTopWidth)

            // Painting is cut at the padding box, and a box-shadow is never
            // part of an element's scrollable overflow, so the two axes are
            // judged differently:
            //   X — the visible window. A doc column scrolls DOWN, never
            //       sideways, so a shadow that only appears after a sideways
            //       drag is cut off in practice. Any sideways range it has is
            //       an accident of some other element sticking out.
            //   Y — the scrollable region. Scrolling down is how the page is
            //       read, so a shadow further down is genuinely visible; only
            //       one past the END of the region can never be reached.
            const bounds = {
                left: padLeft,
                right: padLeft + node.clientWidth,
                top: padTop - node.scrollTop,
                bottom: padTop - node.scrollTop + node.scrollHeight,
            }
            if (clipPath) {
                // cannot evaluate an arbitrary shape — assume the border box
                bounds.left = nodeRect.left
                bounds.top = nodeRect.top
                bounds.right = nodeRect.right
                bounds.bottom = nodeRect.bottom
            }

            const elOver =
                over(clipsX || clipPath, rect.left, rect.right, bounds.left, bounds.right) +
                over(clipsY || clipPath, rect.top, rect.bottom, bounds.top, bounds.bottom)
            if (elOver > TOLERANCE) break // the button itself is out of view — not our bug

            const dx = over(clipsX || clipPath, shadow.left, shadow.right, bounds.left, bounds.right)
            const dy = over(clipsY || clipPath, shadow.top, shadow.bottom, bounds.top, bounds.bottom)
            if (dx > TOLERANCE || dy > TOLERANCE) {
                offenders.push({
                    button: describe(el),
                    overflowBy: `x:${dx.toFixed(1)} y:${dy.toFixed(1)}`,
                    clippedBy: `${describe(node)} [overflow ${cs.overflowX}/${cs.overflowY}]`,
                })
            }
            break // only the nearest clipping ancestor matters
        }

        if (viewportClips) {
            const { innerWidth: w, innerHeight: h } = window
            const inView = over(true, rect.left, rect.right, 0, w) + over(true, rect.top, rect.bottom, 0, h)
            const dx = over(true, shadow.left, shadow.right, 0, w)
            const dy = over(true, shadow.top, shadow.bottom, 0, h)
            if (inView <= TOLERANCE && (dx > TOLERANCE || dy > TOLERANCE)) {
                offenders.push({
                    button: describe(el),
                    overflowBy: `x:${dx.toFixed(1)} y:${dy.toFixed(1)}`,
                    clippedBy: 'the viewport',
                })
            }
        }
    }

    return offenders
}
