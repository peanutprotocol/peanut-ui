/** Patched into IntlCore by prepare.mjs; the presence of this marker is how a capture knows copy was recorded. */
export const COPY_RECORDER_MARKER = '/* screen-capture-copy-v1 */'

/** Browser init script: wraps a message catalogue so every resolved message is recorded with its template. */
export function installCopyRecorder() {
    const resolved = new Map()
    const proxies = new WeakMap()
    const wrap = (target, prefix) => {
        const cached = proxies.get(target)
        if (cached) return cached
        // A copy as the proxy target keeps the invariants satisfiable when a bundler freezes JSON modules.
        const proxy = new Proxy(
            { ...target },
            {
                get(_shadow, property) {
                    const value = target[property]
                    if (typeof property !== 'string' || !Object.prototype.hasOwnProperty.call(target, property))
                        return value
                    const path = prefix ? `${prefix}.${property}` : property
                    if (typeof value === 'string') {
                        if (!resolved.has(path)) resolved.set(path, value)
                        return value
                    }
                    return value && typeof value === 'object' && !Array.isArray(value) ? wrap(value, path) : value
                },
            }
        )
        proxies.set(target, proxy)
        return proxy
    }
    Object.defineProperty(window, '__screenCaptureCopy', {
        value: (messages) => (messages && typeof messages === 'object' ? wrap(messages, '') : messages),
        configurable: true,
    })
    Object.defineProperty(window, '__screenCaptureResolvedCopy', { value: resolved, configurable: true })
}

/**
 * Pure geometry for deciding which characters are painted. Self-contained so collectCopyEvidence can ship it
 * to the browser as source; rects are { left, top, right, bottom } in viewport pixels.
 */
export function copyGeometry() {
    const HIDDEN = '\u0000'
    const TOLERANCE = 0.5
    const everywhere = { left: -Infinity, top: -Infinity, right: Infinity, bottom: Infinity }
    const intersect = (...rects) =>
        rects.reduce((a, b) => ({
            left: Math.max(a.left, b.left),
            top: Math.max(a.top, b.top),
            right: Math.min(a.right, b.right),
            bottom: Math.min(a.bottom, b.bottom),
        }))
    const hasArea = (rect) => rect.right - rect.left > 0 && rect.bottom - rect.top > 0
    const inside = (rect, region) =>
        hasArea(rect) &&
        rect.left >= region.left - TOLERANCE &&
        rect.top >= region.top - TOLERANCE &&
        rect.right <= region.right + TOLERANCE &&
        rect.bottom <= region.bottom + TOLERANCE
    const overlaps = (rect, area) => {
        const common = intersect(rect, area)
        return common.right - common.left > TOLERANCE && common.bottom - common.top > TOLERANCE
    }
    // A glyph's box spans the font's full ascent and descent, which tight line-heights clip without cutting ink.
    const glyphInside = (rect, region) => {
        const band = (rect.bottom - rect.top) / 4
        return inside({ left: rect.left, right: rect.right, top: rect.top + band, bottom: rect.bottom - band }, region)
    }
    // A character counts only when every box it paints lies inside the region and outside every exclusion.
    const painted = (rects, region, exclusions) => {
        const boxes = rects.filter(hasArea)
        return (
            boxes.length > 0 &&
            boxes.every((rect) => glyphInside(rect, region)) &&
            !boxes.some((rect) => exclusions.some((area) => overlaps(rect, area)))
        )
    }
    /** Text as painted: hidden runs collapse to one separator that no copy fragment can match across. */
    const paintedText = (characters, region, exclusions = []) => {
        let text = ''
        for (const { text: character, rects } of characters) {
            if (/^\s+$/u.test(character)) text += ' '
            else if (painted(rects, region, exclusions)) text += character
            else if (!text.endsWith(HIDDEN)) text += HIDDEN
        }
        return text
    }
    const px = (value, size) => {
        const match = /^(-?[\d.]+)(px|%)$/.exec(value.trim())
        if (!match) return null
        return match[2] === '%' ? (Number(match[1]) / 100) * size : Number(match[1])
    }
    /** The region an overflow value clips descendants to: the padding box, on each axis that does not overflow visibly. */
    const overflowRegion = (box, borders, overflowX, overflowY) => {
        const x = overflowX !== 'visible'
        const y = overflowY !== 'visible'
        if (!x && !y) return null
        return {
            left: x ? box.left + borders.left : -Infinity,
            right: x ? box.right - borders.right : Infinity,
            top: y ? box.top + borders.top : -Infinity,
            bottom: y ? box.bottom - borders.bottom : Infinity,
        }
    }
    const nowhere = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }
    /**
     * The rectangle a clip-path keeps: inset() and axis-aligned rectangular polygons exactly. Any other shape
     * (a triangle, circle, ellipse, path or url) hides everything under it, so hidden copy can never count.
     */
    const clipPathRegion = (box, value) => {
        if (!value || value === 'none') return null
        const shape = value.replace(/\s*\b(?:border|padding|content|margin|fill|stroke|view)-box\b\s*/g, '').trim()
        if (!shape) return box
        const width = box.right - box.left
        const height = box.bottom - box.top
        const inset = /^inset\(([^)]*?)(?:\s+round\s[^)]*)?\)$/.exec(shape)
        if (inset) {
            const [top, right = top, bottom = top, left = right] = inset[1].trim().split(/\s+/)
            const t = px(top, height)
            const r = px(right, width)
            const b = px(bottom, height)
            const l = px(left, width)
            if ([t, r, b, l].some((n) => n === null)) return nowhere
            return { left: box.left + l, top: box.top + t, right: box.right - r, bottom: box.bottom - b }
        }
        const polygon = /^polygon\((?:(?:nonzero|evenodd)\s*,\s*)?([^)]*)\)$/.exec(shape)
        if (!polygon) return nowhere
        const points = polygon[1].split(',').map((point) => point.trim().split(/\s+/))
        const xs = points.map(([x]) => px(x ?? '', width))
        const ys = points.map(([, y]) => px(y ?? '', height))
        if ([...xs, ...ys].some((n) => n === null)) return nowhere
        const region = {
            left: box.left + Math.min(...xs),
            top: box.top + Math.min(...ys),
            right: box.left + Math.max(...xs),
            bottom: box.top + Math.max(...ys),
        }
        const corners = new Set(xs.map((x, i) => `${x},${ys[i]}`))
        const xEdges = new Set(xs)
        const yEdges = new Set(ys)
        const rectangular = corners.size === 4 && xEdges.size === 2 && yEdges.size === 2
        return rectangular ? region : nowhere
    }
    /** The legacy clip property on an absolutely positioned element; auto edges leave that side unclipped. */
    const clipRectRegion = (box, value) => {
        const match = /^rect\(([^)]*)\)$/.exec(value ?? '')
        if (!match) return null
        const [top, right, bottom, left] = match[1].split(/\s*,\s*|\s+/)
        const edge = (raw, origin, fallback) => (raw === 'auto' ? fallback : origin + (px(raw, 0) ?? 0))
        return {
            top: edge(top, box.top, -Infinity),
            right: edge(right, box.left, Infinity),
            bottom: edge(bottom, box.top, Infinity),
            left: edge(left, box.left, -Infinity),
        }
    }
    /** Where an ellipsis is drawn over text: the inline end of the line(s) that overflow. */
    const ellipsisArea = (content, width, rtl, lastLine) => ({
        left: rtl ? content.left : content.right - width,
        right: rtl ? content.left + width : content.right,
        top: lastLine ? content.bottom - lastLine : content.top,
        bottom: content.bottom,
    })
    const fits = (width, available) => width <= available + TOLERANCE
    return {
        everywhere,
        intersect,
        inside,
        paintedText,
        overflowRegion,
        clipPathRegion,
        clipRectRegion,
        ellipsisArea,
        fits,
    }
}

/**
 * Browser function: the resolved messages plus the text painted inside the captured viewport. A state is one
 * viewport screenshot, so copy below the fold, in a closed drawer, cut off by an overflow or clip ancestor, or
 * hidden under an ellipsis must not count as shown, and neither may aria-label, title or alt, which are not painted.
 */
export function collectCopyEvidence(geometry) {
    const { everywhere, intersect, inside, paintedText, overflowRegion, clipPathRegion, clipRectRegion } = geometry
    const resolved = window.__screenCaptureResolvedCopy
    const viewport = { left: 0, top: 0, right: innerWidth, bottom: innerHeight }
    const styles = new Map()
    const style = (element) => {
        if (!styles.has(element)) styles.set(element, getComputedStyle(element))
        return styles.get(element)
    }
    const visible = (element) => element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    const number = (value) => Number.parseFloat(value) || 0
    const borders = (s) => ({
        left: number(s.borderLeftWidth),
        top: number(s.borderTopWidth),
        right: number(s.borderRightWidth),
        bottom: number(s.borderBottomWidth),
    })
    const contentBox = (element) => {
        const s = style(element)
        const box = element.getBoundingClientRect()
        return {
            left: box.left + number(s.borderLeftWidth) + number(s.paddingLeft),
            top: box.top + number(s.borderTopWidth) + number(s.paddingTop),
            right: box.right - number(s.borderRightWidth) - number(s.paddingRight),
            bottom: box.bottom - number(s.borderBottomWidth) - number(s.paddingBottom),
        }
    }
    const canvas = document.createElement('canvas').getContext('2d')
    const textWidth = (element, text) => {
        const s = style(element)
        canvas.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`
        canvas.letterSpacing = s.letterSpacing === 'normal' ? '0px' : s.letterSpacing
        const shown =
            s.textTransform === 'uppercase'
                ? text.toUpperCase()
                : s.textTransform === 'lowercase'
                  ? text.toLowerCase()
                  : text
        return canvas.measureText(shown).width
    }
    // Viewport-level boxes (root, body) do not clip like ordinary overflow containers.
    const ownsBox = (element) =>
        element !== document.documentElement &&
        element !== document.body &&
        (element instanceof SVGSVGElement || !['contents', 'inline', 'none'].includes(style(element).display))
    const containsFixed = (s) =>
        s.transform !== 'none' ||
        s.perspective !== 'none' ||
        s.filter !== 'none' ||
        (s.backdropFilter ?? 'none') !== 'none' ||
        /paint|layout|strict|content/.test(s.contain) ||
        /transform|perspective|filter/.test(s.willChange) ||
        (s.containerType ?? 'normal') !== 'normal'
    const memo = (compute) => {
        const cache = new Map()
        return (element) => {
            if (!cache.has(element)) cache.set(element, compute(element))
            return cache.get(element)
        }
    }
    // Overflow clips descendants only along the containing-block chain: absolute and fixed boxes escape it.
    const contentOverflow = memo((element) => {
        const s = style(element)
        const own = ownsBox(element)
            ? overflowRegion(element.getBoundingClientRect(), borders(s), s.overflowX, s.overflowY)
            : null
        return own ? intersect(own, boxOverflow(element)) : boxOverflow(element)
    })
    const boxOverflow = memo((element) => {
        const position = style(element).position
        let ancestor = element.parentElement
        if (position === 'fixed') while (ancestor && !containsFixed(style(ancestor))) ancestor = ancestor.parentElement
        else if (position === 'absolute')
            while (ancestor && style(ancestor).position === 'static' && !containsFixed(style(ancestor)))
                ancestor = ancestor.parentElement
        return ancestor ? contentOverflow(ancestor) : everywhere
    })
    // clip-path and clip apply to every descendant, whatever its position.
    const paintClip = memo((element) => {
        const s = style(element)
        const box = element.getBoundingClientRect()
        const own = [clipPathRegion(box, s.clipPath)]
        if (s.position === 'absolute' || s.position === 'fixed') own.push(clipRectRegion(box, s.clip))
        const parent = element.parentElement ? paintClip(element.parentElement) : everywhere
        return intersect(parent, ...own.filter(Boolean))
    })
    const contentRegion = (element) => intersect(viewport, contentOverflow(element), paintClip(element))
    const blockOf = (element) => {
        let block = element
        while (block.parentElement && ['inline', 'contents'].includes(style(block).display)) block = block.parentElement
        return block
    }
    const lineHeight = (s) => (s.lineHeight === 'normal' ? number(s.fontSize) * 1.25 : number(s.lineHeight))
    // Text under a text-overflow or line-clamp ellipsis is laid out inside the box but not painted.
    const exclusionsFor = memo((block) => {
        const s = style(block)
        const area = (lastLine) =>
            geometry.ellipsisArea(contentBox(block), textWidth(block, '…'), s.direction === 'rtl', lastLine)
        const clamped = (s.webkitLineClamp ?? 'none') !== 'none' && block.scrollHeight > block.clientHeight + 1
        const ellipsis =
            s.textOverflow !== 'clip' && s.overflowX !== 'visible' && block.scrollWidth > block.clientWidth + 1
        return [...(ellipsis ? [area(0)] : []), ...(clamped ? [area(lineHeight(s))] : [])]
    })

    const parts = []
    const range = document.createRange()
    const skipped = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TEXTAREA', 'SELECT', 'OPTION', 'OPTGROUP'])
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement
        if (!node.nodeValue?.trim() || !parent || skipped.has(parent.tagName)) continue
        if (!visible(parent)) {
            parts.push('\u0000')
            continue
        }
        const region = contentRegion(parent)
        const exclusions = exclusionsFor(blockOf(parent))
        range.selectNodeContents(node)
        const whole = [...range.getClientRects()]
        if (!whole.some((rect) => inside(intersect(rect, region), region))) {
            parts.push('\u0000')
            continue
        }
        if (!exclusions.length && whole.every((rect) => !(rect.width && rect.height) || inside(rect, region))) {
            parts.push(node.nodeValue)
            continue
        }
        const characters = []
        let offset = 0
        for (const character of node.nodeValue) {
            range.setStart(node, offset)
            range.setEnd(node, offset + character.length)
            characters.push({ text: character, rects: [...range.getClientRects()] })
            offset += character.length
        }
        parts.push(paintedText(characters, region, exclusions))
    }

    const textual = new Set(['', 'text', 'search', 'email', 'tel', 'url', 'number'])
    for (const element of document.querySelectorAll('input,textarea,select')) {
        if (!visible(element)) continue
        const box = element.getBoundingClientRect()
        if (!inside(box, intersect(viewport, boxOverflow(element), paintClip(element)))) continue
        const content = contentBox(element)
        const width = content.right - content.left
        const lines = Math.max(1, Math.floor((content.bottom - content.top) / lineHeight(style(element))))
        const type = element instanceof HTMLInputElement ? element.type : ''
        let text = ''
        let available = width
        if (element instanceof HTMLSelectElement) {
            if (element.multiple || element.size > 1) continue
            text = element.selectedOptions[0]?.text ?? ''
            if (style(element).appearance !== 'none') available -= number(style(element).fontSize) * 1.25
        } else if (element instanceof HTMLTextAreaElement) {
            text = element.value || element.placeholder
            available = width * lines
        } else if (['button', 'submit', 'reset'].includes(type)) text = element.value
        else if (textual.has(type)) text = element.value || element.placeholder
        else if (type === 'password' && !element.value) text = element.placeholder
        if (text.trim() && geometry.fits(textWidth(element, text), available)) parts.push(text)
    }
    return {
        recorded: resolved instanceof Map,
        resolved: resolved ? [...resolved.entries()] : [],
        corpus: parts.join('\n'),
    }
}

/** What capture.ts evaluates in the page: the collector with its geometry shipped alongside as source. */
export const COPY_EVIDENCE_SCRIPT = `(${collectCopyEvidence})((${copyGeometry})())`
