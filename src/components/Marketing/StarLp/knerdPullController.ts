import {
    entranceKeyframes,
    entranceMotion,
    entranceTiming,
    frameStep,
    KNERD_PULL_PRESET,
    magnetTarget,
    magnetTransform,
    springStep,
} from './knerdPull.utils'
import type { KnerdSpring } from './knerdPull.types'

interface PullLetter {
    anchor: HTMLElement
    magnet: HTMLElement
    glyph: HTMLElement
    i: number
    font: number
    spring: KnerdSpring
}

/** `pending` hides the glyphs until the entrance (globals.css), `live` runs it, `rest` shows them still. */
type PullState = 'pending' | 'live' | 'rest'

const atRest = (): KnerdSpring => ({ x: 0, y: 0, vx: 0, vy: 0 })
const isShown = (el: Element) => el.getClientRects().length > 0

/**
 * Runs Follow the pull on a headline that Title rendered with `letters`: the
 * lifecycle of public/dev/knerd/hero.js without its iframe parts (postMessage,
 * demo, replay, pause, Escape). The server already rendered the letters at
 * rest and CSS sized them, so this only measures and moves; it never rebuilds
 * the DOM.
 *
 * The root holds one or more letter copies (wide and stacked); the visible one
 * moves. The stationary line above is the root's previous sibling, and the
 * first visible `[data-knerd-below]` in the root's section is the copy below.
 * Returns the cleanup.
 */
export function startKnerdPull(root: HTMLElement): () => void {
    const preset = KNERD_PULL_PRESET
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    const section = root.closest('section') ?? document.body
    const lead = root.previousElementSibling
    let letters: PullLetter[] = []
    let entrances: Animation[] = []
    let ready = false
    let visible = false
    let entering = false
    let entranceComplete = false
    let destroyed = false
    let frame = 0
    let previousTime = 0
    let elapsed = 0
    let generation = 0
    let resizeTimer: ReturnType<typeof setTimeout> | undefined
    let releaseTimer: ReturnType<typeof setTimeout> | undefined
    let pointer: { x: number; y: number } | null = null

    const setState = (state: PullState) => {
        root.dataset.knerdPull = state
    }

    function collect() {
        const copy = [...root.querySelectorAll<HTMLElement>('[data-knerd-letters]')].find(isShown)
        const anchors = copy ? [...copy.querySelectorAll<HTMLElement>('[data-knerd-letter]')] : []
        letters = anchors.map((anchor, i) => ({
            anchor,
            magnet: anchor.firstElementChild as HTMLElement,
            glyph: anchor.querySelector<HTMLElement>('[data-knerd-glyph]')!,
            i,
            font: parseFloat(getComputedStyle(anchor).fontSize),
            spring: atRest(),
        }))
    }

    function resetMotion() {
        generation++
        entrances.forEach((a) => a.cancel())
        entrances = []
        cancelAnimationFrame(frame)
        frame = 0
        previousTime = 0
        clearTimeout(releaseTimer)
        pointer = null
        entering = false
        letters.forEach((l) => {
            l.magnet.style.transform = ''
            l.spring = atRest()
        })
    }

    /** The entrance is over or will not run: show the letters at rest. */
    function settle() {
        entranceComplete = true
        if (root.dataset.knerdPull === 'pending') setState('rest')
    }

    const canMove = () => ready && visible && !document.hidden && !reduced.matches && !destroyed

    function startLoop() {
        if (frame || !canMove()) return
        previousTime = 0
        frame = requestAnimationFrame(tick)
    }

    function tick(time: number) {
        frame = 0
        if (!canMove()) return
        const dt = frameStep(time, previousTime)
        previousTime = time
        elapsed += dt
        let active = !!pointer || preset.idle > 0
        letters.forEach((l) => {
            const bounds = l.anchor.getBoundingClientRect()
            const { tx, ty } = magnetTarget({
                dx: bounds.left + bounds.width / 2 - (pointer?.x ?? 0),
                dy: bounds.top + bounds.height / 2 - (pointer?.y ?? 0),
                font: l.font,
                viewportWidth: innerWidth,
                left: bounds.left,
                right: bounds.right,
                elapsed,
                index: l.i,
                pulled: !!pointer,
                entering,
            })
            const { next, moving } = springStep(l.spring, tx, ty, dt)
            l.spring = next
            if (moving) active = true
            l.magnet.style.transform = magnetTransform(next)
        })
        if (active) frame = requestAnimationFrame(tick)
        else {
            previousTime = 0
            letters.forEach((l) => {
                l.magnet.style.transform = ''
                l.spring = atRest()
            })
        }
    }

    function enter() {
        resetMotion()
        entranceComplete = false
        if (!canMove()) return
        // The CSS fallback already showed the letters (slow script): arriving now would jump them.
        const glyph = letters[0]?.glyph
        if (!glyph || getComputedStyle(glyph).opacity !== '0') {
            settle()
            startLoop()
            return
        }
        entering = true
        const thisGeneration = generation
        const leadBottom = lead ? lead.getBoundingClientRect().bottom : section.getBoundingClientRect().top
        const below = [...section.querySelectorAll('[data-knerd-below]')].find(isShown)
        const belowTop = below ? below.getBoundingClientRect().top : innerHeight
        letters.forEach((l, i) => {
            const bounds = l.anchor.getBoundingClientRect()
            const { travel, bend } = entranceMotion(
                { index: i, font: l.font, top: bounds.top, bottom: bounds.bottom, leadBottom, belowTop },
                preset
            )
            entrances.push(l.glyph.animate(entranceKeyframes(travel, bend), entranceTiming(i, preset)))
        })
        setState('live')
        Promise.all(entrances.map((a) => a.finished))
            .then(() => {
                if (thisGeneration !== generation) return
                entrances.forEach((a) => a.cancel())
                entrances = []
                entering = false
                entranceComplete = true
                startLoop()
            })
            .catch(() => {})
    }

    function setVisible(value: boolean) {
        visible = value
        if (!canMove()) {
            cancelAnimationFrame(frame)
            frame = 0
            entrances.forEach((a) => a.pause())
            pointer = null
            clearTimeout(releaseTimer)
        } else if (ready && !entrances.length && !entranceComplete) enter()
        else {
            entrances.forEach((a) => a.play())
            startLoop()
        }
    }

    function pulse(x: number, y: number) {
        if (!canMove()) return
        pointer = { x, y }
        clearTimeout(releaseTimer)
        releaseTimer = setTimeout(() => {
            pointer = null
            startLoop()
        }, 500)
        startLoop()
    }

    const release = () => {
        pointer = null
        startLoop()
    }
    const onPointerMove = (event: PointerEvent) => {
        if (event.pointerType === 'touch' || !canMove()) return
        pointer = { x: event.clientX, y: event.clientY }
        startLoop()
    }
    const onPointerLeave = (event: PointerEvent) => {
        if (event.pointerType === 'mouse') release()
    }
    // No preventDefault: a touch still scrolls the page.
    const onPointerDown = (event: PointerEvent) => {
        if (event.pointerType !== 'mouse') pulse(event.clientX, event.clientY)
    }
    const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        const r = root.getBoundingClientRect()
        pulse(r.left + r.width * 0.45, r.top + r.height * 0.45)
    }
    const onVisibility = () => setVisible(visible)
    const onReducedChange = () => {
        resetMotion()
        settle()
        if (!reduced.matches) startLoop()
    }
    let lastWidth = innerWidth
    let lastHeight = innerHeight
    const onResize = () => {
        if (innerWidth === lastWidth && innerHeight === lastHeight) return
        lastWidth = innerWidth
        lastHeight = innerHeight
        clearTimeout(resizeTimer)
        resizeTimer = setTimeout(() => {
            resetMotion()
            collect()
            settle()
            startLoop()
        }, 100)
    }

    root.addEventListener('pointermove', onPointerMove)
    root.addEventListener('pointerleave', onPointerLeave)
    root.addEventListener('pointercancel', release)
    root.addEventListener('pointerdown', onPointerDown)
    root.addEventListener('keydown', onKeyDown)
    window.addEventListener('blur', release)
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVisibility)
    reduced.addEventListener('change', onReducedChange)
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))

    collect()
    if (reduced.matches) settle()
    const glyph = root.querySelector('[data-knerd-glyph]')
    // Only the Knerd face itself: next/font's local() fallback face rejects the load where that font is missing.
    const families = [glyph, glyph?.lastElementChild].flatMap((el) =>
        el ? [getComputedStyle(el).fontFamily.split(',')[0].trim()] : []
    )
    Promise.all(families.map((family) => document.fonts.load(`100px ${family}`)))
        .then(() => {
            if (destroyed) return
            ready = true
            collect()
            if (reduced.matches) settle()
            // The first report from the observer starts the entrance when the headline is on screen.
            observer.observe(root)
        })
        .catch(() => {
            if (!destroyed) settle()
        })

    return () => {
        destroyed = true
        resetMotion()
        clearTimeout(resizeTimer)
        observer.disconnect()
        root.removeEventListener('pointermove', onPointerMove)
        root.removeEventListener('pointerleave', onPointerLeave)
        root.removeEventListener('pointercancel', release)
        root.removeEventListener('pointerdown', onPointerDown)
        root.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('blur', release)
        window.removeEventListener('resize', onResize)
        document.removeEventListener('visibilitychange', onVisibility)
        reduced.removeEventListener('change', onReducedChange)
    }
}
