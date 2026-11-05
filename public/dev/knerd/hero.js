// Reference: approved C at star-lp-motion-lab f89a323. Keep the spring and magnetic equations intact.
import { pages, versions } from './data.js'
const params = new URLSearchParams(location.search)
const pageKey = pages[params.get('page')] ? params.get('page') : 'card'
const versionKey = versions[params.get('version')] ? params.get('version') : 'c'
const page = pages[pageKey],
    config = versions[versionKey]
const title = document.querySelector('#headline')
const reduced = matchMedia('(prefers-reduced-motion: reduce)')
let letters = [],
    entrances = [],
    ready = false,
    paused = false,
    visible = true,
    entering = false
let frame = 0,
    previousTime = 0,
    elapsed = 0,
    generation = 0,
    resizeTimer,
    releaseTimer
let pointer = null,
    demo = null,
    demoPending = false,
    entranceComplete = false
const origin = location.origin
function report(extra = {}) {
    if (parent !== window)
        parent.postMessage(
            {
                type: 'hero-status',
                version: versionKey,
                page: pageKey,
                paused,
                reduced: reduced.matches,
                entering,
                ...extra,
            },
            origin
        )
}
document.querySelector('#category').textContent = page.name
document.querySelector('#lead').textContent = page.lead
document.querySelector('#after').textContent = page.after || ''
document.querySelector('#after').hidden = !page.after
document.querySelector('#subtitle').textContent = page.subtitle
document.querySelector('#cta').textContent = `${page.cta} ↗`
function makeLine(text) {
    const line = document.createElement('span')
    line.className = 'line'
    line.setAttribute('aria-hidden', 'true')
    if (text.startsWith('and ')) {
        const join = document.createElement('span')
        join.className = 'join'
        join.textContent = 'and'
        line.append(join)
        text = text.slice(4)
    }
    text.split(/( and )/).forEach((part) => {
        if (part === ' and ') {
            const join = document.createElement('span')
            join.className = 'join'
            join.textContent = 'and'
            line.append(join)
            return
        }
        for (const ch of part) {
            if (ch === ' ') {
                const space = document.createElement('span')
                space.className = 'space'
                line.append(space)
                continue
            }
            const anchor = document.createElement('span')
            anchor.className = 'letter'
            const magnet = document.createElement('span')
            magnet.className = 'magnet'
            const glyph = document.createElement('span')
            glyph.className = 'glyph'
            glyph.textContent = ch === 'Q' ? 'q' : ch
            const outline = document.createElement('span')
            outline.className = 'outline'
            outline.textContent = glyph.textContent
            glyph.append(outline)
            magnet.append(glyph)
            anchor.append(magnet)
            line.append(anchor)
        }
    })
    return line
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
    demo = null
    demoPending = false
    entering = false
    letters.forEach((l) => {
        l.magnet.style.transform = ''
        l.x = l.y = l.vx = l.vy = 0
    })
}
function fit() {
    if (!ready) return
    const mobile = innerWidth <= 600
    const textLines =
        pageKey === 'accounts' && (mobile || config.layout === 'monument')
            ? ['US', 'and EUROPE']
            : config.layout === 'wide' && !mobile
              ? page.wide
              : page.lines
    title.setAttribute('aria-label', textLines.join(' '))
    title.replaceChildren(...textLines.map(makeLine))
    const body = document.querySelector('.hero-body'),
        style = getComputedStyle(body)
    const after = document.querySelector('#after'),
        lead = document.querySelector('#lead')
    const availableHeight =
        body.clientHeight -
        parseFloat(style.paddingTop) -
        parseFloat(style.paddingBottom) -
        lead.offsetHeight -
        (after.hidden ? 0 : after.offsetHeight) -
        parseFloat(style.gap) * (after.hidden ? 1 : 2)
    const availableWidth = title.clientWidth * (mobile ? 0.9 : 0.92)
    const lines = [...title.children]
    title.style.fontSize = '100px'
    const widths = lines.map((l) => l.getBoundingClientRect().width)
    let sizes = widths.map((w) => (availableWidth / w) * 100)
    if (config.layout !== 'monument') sizes = sizes.map(() => Math.min(...sizes))
    const base = Math.min(...sizes)
    title.style.fontSize = `${base}px`
    lines.forEach((l, i) => (l.style.fontSize = `${sizes[i]}px`))
    const heightFactor = Math.min(1, Math.max(30, availableHeight) / title.offsetHeight)
    title.style.fontSize = `${base * heightFactor}px`
    lines.forEach((l, i) => (l.style.fontSize = `${sizes[i] * heightFactor}px`))
    letters = [...title.querySelectorAll('.letter')].map((anchor, i) => ({
        anchor,
        magnet: anchor.firstElementChild,
        glyph: anchor.querySelector('.glyph'),
        i,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        font: parseFloat(getComputedStyle(anchor).fontSize),
    }))
    report({
        size: `${Math.round(Math.min(...sizes) * heightFactor)}–${Math.round(Math.max(...sizes) * heightFactor)}px`,
    })
}
function canMove() {
    return ready && !paused && visible && !document.hidden && !reduced.matches
}
function startLoop() {
    if (frame || !canMove()) return
    previousTime = 0
    frame = requestAnimationFrame(tick)
}
function tick(time) {
    frame = 0
    if (!canMove()) return
    const dt = previousTime ? Math.min(2, (time - previousTime) / 16.667) : 1
    previousTime = time
    elapsed += dt
    const field = title.getBoundingClientRect()
    const demoProgress = demo ? (time - demo.start) / 2100 : 0
    if (demo && demoProgress >= 1) {
        demo = null
        pointer = null
    }
    if (demo)
        pointer = { x: field.left + field.width * (0.15 + 0.7 * demoProgress), y: field.top + field.height * 0.48 }
    let active = !!demo || !!pointer || config.idle > 0
    letters.forEach((l) => {
        let tx = 0,
            ty = entering ? 0 : Math.sin(elapsed * 0.018 + l.i * 1.3) * Math.min(4, l.font * config.idle)
        const bounds = l.anchor.getBoundingClientRect()
        if (pointer && !entering) {
            const dx = bounds.left + bounds.width / 2 - pointer.x,
                dy = bounds.top + bounds.height / 2 - pointer.y
            const distance = Math.hypot(dx, dy),
                radius = Math.min(config.radius, innerWidth * 0.42)
            const strength = Math.max(0, 1 - distance / radius) ** 1.4
            const force = Math.min(config.force, l.font * 0.17) * strength
            const sign = config.attraction ? -1 : 1
            tx += (dx / Math.max(distance, 1)) * force * sign
            ty += (dy / Math.max(distance, 1)) * force * sign
        }
        // Reserve room for the font's visible ink and line tilt at both edges.
        tx = Math.max(-Math.max(0, bounds.left - 12), Math.min(Math.max(0, innerWidth - bounds.right - 12), tx))
        l.vx = (l.vx + (tx - l.x) * config.stiffness * dt) * config.damping ** dt
        l.vy = (l.vy + (ty - l.y) * config.stiffness * dt) * config.damping ** dt
        l.x += l.vx * dt
        l.y += l.vy * dt
        if (Math.abs(l.x - tx) + Math.abs(l.y - ty) + Math.abs(l.vx) + Math.abs(l.vy) > 0.025) active = true
        l.magnet.style.transform = `translate(${l.x.toFixed(3)}px,${l.y.toFixed(3)}px) rotate(${(l.x * 0.075).toFixed(3)}deg)`
    })
    if (active) frame = requestAnimationFrame(tick)
    else {
        previousTime = 0
        letters.forEach((l) => {
            l.magnet.style.transform = ''
            l.x = l.y = l.vx = l.vy = 0
        })
    }
}
function enter() {
    resetMotion()
    entranceComplete = false
    if (!canMove()) {
        report()
        return
    }
    entering = true
    const thisGeneration = generation
    letters.forEach((l, i) => {
        const sign = i % 2 ? -1 : 1
        const bounds = l.anchor.getBoundingClientRect()
        const leadBottom = document.querySelector('#lead').getBoundingClientRect().bottom
        const after = document.querySelector('#after')
        const bottomTop = (after.hidden ? document.querySelector('.bottom') : after).getBoundingClientRect().top
        // Knerd ink extends above its tight line box; protect the stationary copy during arrival.
        const upClearance = Math.max(0, bounds.top - l.font * 0.22 - leadBottom - 16)
        const downClearance = Math.max(0, bottomTop - bounds.bottom - l.font * 0.08 - 16)
        const travel =
            config.drop < 0
                ? -Math.min(70, Math.abs(config.drop * l.font), upClearance)
                : Math.min(70, config.drop * l.font, downClearance)
        const bend = Math.min(Math.abs(config.rotation), upClearance > 20 ? 8 : 2) * Math.sign(config.rotation) * sign
        const transform = (y, r, sx = 1, sy = 1) => `translateY(${y}px) rotate(${r}deg) scale(${sx},${sy})`
        const animation = l.glyph.animate(
            [
                { transform: transform(travel, bend, 0.97, 1.04), offset: 0 },
                { transform: transform(-travel * 0.095, -bend * 0.3, 1.045, 0.945), offset: 0.5 },
                { transform: transform(travel * 0.13, bend * 0.18), offset: 0.72 },
                { transform: transform(-travel * 0.02, 0), offset: 0.9 },
                { transform: transform(0, 0), offset: 1 },
            ],
            { duration: config.duration, delay: i * config.stagger, easing: 'cubic-bezier(.33,0,.2,1)', fill: 'both' }
        )
        entrances.push(animation)
    })
    report()
    Promise.all(entrances.map((a) => a.finished))
        .then(() => {
            if (thisGeneration !== generation) return
            entrances.forEach((a) => a.cancel())
            entrances = []
            entering = false
            entranceComplete = true
            if (demoPending) {
                demoPending = false
                demo = { start: performance.now() }
            }
            report()
            startLoop()
        })
        .catch(() => {})
}
function setPaused(value) {
    paused = value
    if (paused) {
        cancelAnimationFrame(frame)
        frame = 0
        entrances.forEach((a) => a.pause())
        demo = null
        demoPending = false
        pointer = null
    } else if (canMove()) {
        if (!entrances.length && !entranceComplete) enter()
        else {
            entrances.forEach((a) => a.play())
            startLoop()
        }
    }
    report()
}
function setVisible(value) {
    visible = value
    if (!canMove()) {
        cancelAnimationFrame(frame)
        frame = 0
        entrances.forEach((a) => a.pause())
        pointer = null
        demo = null
        demoPending = false
    } else if (ready && !entrances.length && !entranceComplete) enter()
    else {
        entrances.forEach((a) => a.play())
        startLoop()
    }
}
function pulse(x, y) {
    if (!canMove()) return
    demo = null
    pointer = { x, y }
    clearTimeout(releaseTimer)
    releaseTimer = setTimeout(() => {
        pointer = null
        startLoop()
    }, 500)
    startLoop()
}
title.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch' || !canMove()) return
    demo = null
    pointer = { x: event.clientX, y: event.clientY }
    startLoop()
})
title.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') {
        pointer = null
        startLoop()
    }
})
title.addEventListener('pointercancel', () => {
    pointer = null
    startLoop()
})
title.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse') pulse(event.clientX, event.clientY)
})
title.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && parent !== window) parent.postMessage({ type: 'hero-escape' }, origin)
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        const r = title.getBoundingClientRect()
        pulse(r.left + r.width * 0.45, r.top + r.height * 0.45)
    }
})
window.addEventListener('blur', () => {
    pointer = null
    startLoop()
})
window.addEventListener('message', (event) => {
    if (event.origin !== origin || event.source !== parent || !event.data) return
    if (event.data.type === 'replay') {
        paused = false
        enter()
    }
    if (event.data.type === 'pause') setPaused(!!event.data.value)
    if (event.data.type === 'visible') setVisible(!!event.data.value)
    if (event.data.type === 'demo' && canMove()) {
        if (entering) demoPending = true
        else {
            demo = { start: performance.now() }
            startLoop()
        }
    }
})
document.addEventListener('visibilitychange', () => setVisible(visible))
reduced.addEventListener('change', () => {
    resetMotion()
    entranceComplete = true
    report()
    if (!reduced.matches) startLoop()
})
let lastWidth = innerWidth,
    lastHeight = innerHeight
window.addEventListener('resize', () => {
    if (innerWidth === lastWidth && innerHeight === lastHeight) return
    lastWidth = innerWidth
    lastHeight = innerHeight
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
        resetMotion()
        fit()
        entranceComplete = true
        report()
        startLoop()
    }, 100)
})
document.documentElement.classList.add('no-fonts')
Promise.all([
    document.fonts.load('100px Knerd'),
    document.fonts.load('100px KnerdOutline'),
    document.fonts.load('700 20px RobotoFlex'),
])
    .then(() => {
        ready = true
        fit()
        document.documentElement.classList.remove('no-fonts')
        enter()
    })
    .catch(() => {
        document.documentElement.classList.remove('no-fonts')
        report({ error: 'The Knerd fonts could not load. Reload before reviewing this draft.' })
    })
