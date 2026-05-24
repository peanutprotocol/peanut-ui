/* eslint-disable @typescript-eslint/no-explicit-any */
// Peanut-mascot ragdoll. Ported from ragdoll/src/main.js with one structural
// change: all mutable state lives inside startRagdoll(canvas) and the function
// returns a cleanup() that tears down listeners + RAF, so the React wrapper
// can mount/unmount cleanly without leaks.
import * as p2 from 'p2-es'

import shellSvg from './parts/shell.svg'
import armSvg from './parts/arm.svg'
import legSvg from './parts/leg.svg'
import handSvg from './parts/hand.svg'
import footSvg from './parts/foot.svg'
import faceSvg from './parts/face.svg'
import faceSurprisedSvg from './parts/face_surprised.svg'
import faceSleepySvg from './parts/sleepy.svg'
import faceThoughtfulSvg from './parts/Toughtful.svg'
import faceWhistlingSvg from './parts/Whistling.svg'
import faceWinkingSvg from './parts/Winking.svg'

const SVG_PX_PER_UNIT = 100

// Play-area bounds. Height is anchored (GROUND_Y..TOP_Y is always 7 units
// tall — defines how big the peanut feels). Width is derived from the
// container's aspect ratio at resize() time so the cage always matches the
// layout — no enforced phone-aspect, no letterbox.
const GROUND_Y = -3.0
const WORLD_H = 7.0
const TOP_Y = GROUND_Y + WORLD_H
const CENTER_Y = (GROUND_Y + TOP_Y) / 2

const SHELL_LOBE_R = 0.45
const SHELL_OVERLAP = 0.55
const ARM_W = 0.2
const LEG_W = 0.2
const HAND_R = 0.28
const FOOT_R = 0.22

// Ragdoll geometry + joint limits. Inlined from the prototype's `tune` struct;
// the slider panel that varied these at runtime isn't part of the production
// build.
const ARM_L = 0.5975
const LEG_L = 0.96
const SHOULDER_X = 0.18
const HIP_X = 0.3
const SHOULDER_DEG = 90
const HIP_DEG = 60
const WRIST_DEG = 30
const ANKLE_DEG = 30
const HAND_DEG = 20

const REST_SETTLE = 1.5
const IDLE_DWELL_MIN = 1.5,
    IDLE_DWELL_MAX = 3.0
const SLEEP_THRESH_MIN = 6.0,
    SLEEP_THRESH_MAX = 9.0
const WINK_DURATION = 0.8
const WINK_GAP_MIN = 1.5,
    WINK_GAP_MAX = 3.0

const IDLE_POOL: { name: string; weight: number }[] = [
    { name: 'faceThoughtful', weight: 30 },
    { name: 'faceNeutral', weight: 25 },
    { name: 'faceWhistling', weight: 20 },
    { name: 'faceCurious', weight: 15 },
    { name: 'face', weight: 7 }, // Cheers
    { name: 'faceTalking', weight: 2 },
    { name: 'faceExcited', weight: 1 },
]

const BODYPARTS = 1 << 2
const GROUND = 1 << 3

const FACE_STIFF = 200
const FACE_DAMP = 14

const IDLE_SLEEP_MS = 15000

const deg2rad = (d: number) => (d * Math.PI) / 180
const rand = (min: number, max: number) => min + Math.random() * (max - min)

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((res, rej) => {
        const img = new Image()
        img.onload = () => res(img)
        img.onerror = (e) => rej(new Error('failed to load ' + url + ': ' + String(e)))
        img.src = url
    })
}

export function startRagdoll(canvas: HTMLCanvasElement): () => void {
    const ctxNullable = canvas.getContext('2d')
    if (!ctxNullable) throw new Error('PeanutRagdoll: 2d canvas context unavailable')
    // narrowing doesn't survive into nested closures, so alias to a const
    // that the type checker keeps as non-null.
    const ctx: CanvasRenderingContext2D = ctxNullable

    // Engine sizes itself to the wrapping element rather than the viewport so
    // the cage fits the modal panel — not the whole window. The React wrapper
    // is responsible for putting the canvas in a sized container.
    const containerNullable = canvas.parentElement
    if (!containerNullable) throw new Error('PeanutRagdoll: canvas must be mounted in a parent element')
    // Narrowing doesn't survive into nested closures (same trick as `ctx` above).
    const container: HTMLElement = containerNullable

    // ---- rest-time face state machine ----
    let restTime = 0
    let restPhase: 'cheers' | 'idle' | 'sleep' = 'cheers'
    let phaseUntil = 0
    let phaseFace: string | null = null
    let sleepThreshold = 0
    let restMood: Record<string, number> | null = null
    let nextWinkAt = 0
    let winkUntil = 0

    // ---- world / camera ----
    let world: any = null
    let parts: any = null
    let pixelsPerUnit = 140
    const cameraOffset = { x: 0, y: CENTER_Y }
    // Live half-width of the cage. resize() recomputes from container aspect
    // and moves the side-wall bodies; the initial value matches the rendered
    // canvas aspect before the first resize() runs.
    let halfWorldW = (WORLD_H * 9) / 32

    // ---- sprite + bitmap caches ----
    const sprites: Record<string, HTMLImageElement> = {}
    const bitmapCache = new Map<string, HTMLCanvasElement>()
    let currentDpr = 1

    // ---- face bobble ----
    let faceAngle = 0
    let faceAngularVel = 0
    const faceCfg = { ox: 0, oy: -25, w: 54, h: 63 }

    // ---- loop / sleep state ----
    let paused = false
    let frozen = true
    let lastT = performance.now()
    let sleeping = false
    let rafId = 0
    let lastInteractionT = performance.now()

    // ---- mouse drag ----
    const mouseBody: any = new (p2 as any).Body({ mass: 0, type: (p2 as any).Body.STATIC })
    let mouseConstraint: any = null
    let dragging = false
    let activePointerId: number | null = null

    // Promise resolved when the eight first-paint sprites are loaded. We hold
    // onto it so cleanup can no-op if the user closes the modal before the
    // sprites have loaded (the loop never started).
    let started = false

    function pickIdleFace(exclude: string | null) {
        let total = 0
        const entries: { name: string; w: number }[] = []
        for (const e of IDLE_POOL) {
            if (e.name === exclude) continue
            const mult = (restMood && restMood[e.name]) || 1
            const w = e.weight * mult
            if (w <= 0) continue
            total += w
            entries.push({ name: e.name, w })
        }
        let r = Math.random() * total
        for (const e of entries) if ((r -= e.w) <= 0) return e.name
        return entries[entries.length - 1].name
    }

    function rollMood(): Record<string, number> | null {
        if (Math.random() < 0.5) return null
        const candidates = IDLE_POOL.filter((e) => e.name !== 'face').map((e) => e.name)
        return { [candidates[Math.floor(Math.random() * candidates.length)]]: 3 }
    }

    function resetRest() {
        restTime = 0
        restPhase = 'cheers'
        phaseUntil = 0
        phaseFace = null
        sleepThreshold = 0
        restMood = null
        nextWinkAt = REST_SETTLE + 1.0 + 0.5 * Math.random()
        winkUntil = 0
    }

    function advanceRestPhase() {
        if (restPhase === 'cheers') {
            if (restTime < REST_SETTLE) return
            restMood = rollMood()
            phaseFace = pickIdleFace(null)
            phaseUntil = restTime + rand(IDLE_DWELL_MIN, IDLE_DWELL_MAX)
            sleepThreshold = restTime + rand(SLEEP_THRESH_MIN, SLEEP_THRESH_MAX) - REST_SETTLE
            restPhase = 'idle'
            return
        }
        if (restPhase === 'idle') {
            if (restTime >= sleepThreshold) {
                restPhase = 'sleep'
                phaseFace = 'faceSleepy'
            } else if (restTime >= phaseUntil) {
                phaseFace = pickIdleFace(phaseFace)
                phaseUntil = restTime + rand(IDLE_DWELL_MIN, IDLE_DWELL_MAX)
            }
        }
    }

    function bakeBitmap(img: HTMLImageElement, displayW: number, displayH: number): HTMLCanvasElement {
        const c = document.createElement('canvas')
        c.width = Math.max(1, Math.ceil(displayW * currentDpr))
        c.height = Math.max(1, Math.ceil(displayH * currentDpr))
        const cx = c.getContext('2d')!
        cx.imageSmoothingEnabled = true
        cx.imageSmoothingQuality = 'high'
        cx.drawImage(img, 0, 0, c.width, c.height)
        return c
    }

    function getBitmap(img: HTMLImageElement, displayW: number, displayH: number) {
        const w = Math.round(displayW * 2) / 2
        const h = Math.round(displayH * 2) / 2
        const key = `${img.src}@${w}x${h}@${currentDpr}`
        let bmp = bitmapCache.get(key)
        if (!bmp) {
            bmp = bakeBitmap(img, w, h)
            bitmapCache.set(key, bmp)
        }
        return bmp
    }

    function resize() {
        const w = container.clientWidth
        const h = container.clientHeight
        if (w === 0 || h === 0) return
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
        canvas.style.width = w + 'px'
        canvas.style.height = h + 'px'
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        // Anchor scale to the height (WORLD_H units), then derive the cage's
        // horizontal half-extent from the container's aspect. The walls move
        // with the layout — wide container → wider play area, no letterbox.
        const newPpu = (h / WORLD_H) * 0.95
        halfWorldW = w / newPpu / 2
        if (parts) {
            parts.leftWall.position[0] = -halfWorldW
            parts.rightWall.position[0] = halfWorldW
        }
        if (dpr !== currentDpr || newPpu !== pixelsPerUnit) {
            bitmapCache.clear()
            currentDpr = dpr
            pixelsPerUnit = newPpu
        }
        if (sleeping && parts) render()
    }

    function worldToScreen(x: number, y: number) {
        return {
            x: container.clientWidth / 2 + (x - cameraOffset.x) * pixelsPerUnit,
            y: container.clientHeight / 2 - (y - cameraOffset.y) * pixelsPerUnit,
        }
    }

    function screenToWorld(sx: number, sy: number) {
        return {
            x: (sx - container.clientWidth / 2) / pixelsPerUnit + cameraOffset.x,
            y: -(sy - container.clientHeight / 2) / pixelsPerUnit + cameraOffset.y,
        }
    }

    function makeShellBody() {
        const body: any = new (p2 as any).Body({ mass: 3, position: [0, 0.5] })
        const top = new (p2 as any).Circle({ radius: SHELL_LOBE_R })
        const bot = new (p2 as any).Circle({ radius: SHELL_LOBE_R })
        body.addShape(top, [0, SHELL_OVERLAP / 2])
        body.addShape(bot, [0, -SHELL_OVERLAP / 2])
        for (const s of body.shapes) {
            s.collisionGroup = BODYPARTS
            s.collisionMask = GROUND
        }
        body.__sprite = sprites.shell
        return body
    }

    function makeLimbSegment(opts: {
        position: [number, number]
        width: number
        length: number
        sprite: HTMLImageElement
        vertical?: boolean
        mass?: number
    }) {
        const { position, width, length, sprite, vertical = false, mass = 0.5 } = opts
        const body: any = new (p2 as any).Body({ mass, position })
        const box = vertical
            ? new (p2 as any).Box({ width, height: length })
            : new (p2 as any).Box({ width: length, height: width })
        box.collisionGroup = BODYPARTS
        box.collisionMask = GROUND
        body.addShape(box)
        body.__sprite = sprite
        return body
    }

    function makeEndCap(opts: { position: [number, number]; radius: number; sprite: HTMLImageElement; mass?: number }) {
        const { position, radius, sprite, mass = 0.3 } = opts
        const body: any = new (p2 as any).Body({ mass, position })
        const circle = new (p2 as any).Circle({ radius })
        circle.collisionGroup = BODYPARTS
        circle.collisionMask = GROUND
        body.addShape(circle)
        body.__sprite = sprite
        return body
    }

    function buildWorld() {
        if (world) {
            if (mouseConstraint) world.removeConstraint(mouseConstraint)
            if (mouseBody.world === world) world.removeBody(mouseBody)
        }
        mouseConstraint = null
        dragging = false

        const SHOULDER_LIMIT = deg2rad(SHOULDER_DEG)
        const HIP_LIMIT = deg2rad(HIP_DEG)
        const WRIST_LIMIT = deg2rad(WRIST_DEG)
        const ANKLE_LIMIT = deg2rad(ANKLE_DEG)
        const HAND_REST = deg2rad(HAND_DEG)

        const ARM_SPRITE_W = ARM_L * 100
        const ARM_SPRITE_H = 22.983
        const LEG_SPRITE_W = 30
        const LEG_SPRITE_H = LEG_L * 100

        world = new (p2 as any).World({ gravity: [0, -10] })
        world.solver.iterations = 10

        const shell = makeShellBody()
        world.addBody(shell)

        const SHOULDER_Y = 0.1
        const ARM_TILT = deg2rad(20)
        const armDx = (Math.cos(ARM_TILT) * ARM_L) / 2
        const armDy = (Math.sin(ARM_TILT) * ARM_L) / 2
        const ARM_MASS = 0.3
        const ARM_ANG_DAMP = 0.03
        const leftArm: any = makeLimbSegment({
            position: [-SHOULDER_X - armDx, shell.position[1] + SHOULDER_Y + armDy],
            width: ARM_W,
            length: ARM_L,
            sprite: sprites.arm,
            mass: ARM_MASS,
        })
        leftArm.angle = -ARM_TILT
        leftArm.angularDamping = ARM_ANG_DAMP
        leftArm.__sw = ARM_SPRITE_W
        leftArm.__sh = ARM_SPRITE_H
        const rightArm: any = makeLimbSegment({
            position: [SHOULDER_X + armDx, shell.position[1] + SHOULDER_Y + armDy],
            width: ARM_W,
            length: ARM_L,
            sprite: sprites.arm,
            mass: ARM_MASS,
        })
        rightArm.angle = ARM_TILT
        rightArm.angularDamping = ARM_ANG_DAMP
        rightArm.__sw = ARM_SPRITE_W
        rightArm.__sh = ARM_SPRITE_H
        rightArm.__flipX = true

        const HAND_PIVOT: [number, number] = [0, 0]
        const leftWristX = leftArm.position[0] + Math.cos(leftArm.angle) * (-ARM_L / 2)
        const leftWristY = leftArm.position[1] + Math.sin(leftArm.angle) * (-ARM_L / 2)
        const rightWristX = rightArm.position[0] + Math.cos(rightArm.angle) * (ARM_L / 2)
        const rightWristY = rightArm.position[1] + Math.sin(rightArm.angle) * (ARM_L / 2)
        const HAND_SPRITE_ANCHOR_Y = 1.0
        const leftHand: any = makeEndCap({
            position: [leftWristX, leftWristY],
            radius: HAND_R,
            sprite: sprites.hand,
            mass: 0.15,
        })
        leftHand.angle = HAND_REST
        leftHand.__flipX = false
        leftHand.__flipY = false
        leftHand.__spriteAnchorY = HAND_SPRITE_ANCHOR_Y
        const rightHand: any = makeEndCap({
            position: [rightWristX, rightWristY],
            radius: HAND_R,
            sprite: sprites.hand,
            mass: 0.15,
        })
        rightHand.angle = -HAND_REST
        rightHand.__flipX = true
        rightHand.__flipY = false
        rightHand.__spriteAnchorY = HAND_SPRITE_ANCHOR_Y

        const hipY = shell.position[1] - SHELL_LOBE_R
        const leftLeg: any = makeLimbSegment({
            position: [-HIP_X, hipY - LEG_L / 2],
            width: LEG_W,
            length: LEG_L,
            vertical: true,
            sprite: sprites.leg,
        })
        leftLeg.__sw = LEG_SPRITE_W
        leftLeg.__sh = LEG_SPRITE_H
        leftLeg.__spriteAngle = -Math.PI / 2
        const rightLeg: any = makeLimbSegment({
            position: [HIP_X, hipY - LEG_L / 2],
            width: LEG_W,
            length: LEG_L,
            vertical: true,
            sprite: sprites.leg,
        })
        rightLeg.__sw = LEG_SPRITE_W
        rightLeg.__sh = LEG_SPRITE_H
        rightLeg.__spriteAngle = Math.PI / 2

        const FOOT_DX = FOOT_R * 0.5
        const leftFoot: any = makeEndCap({
            position: [leftLeg.position[0] + FOOT_DX, leftLeg.position[1] - LEG_L / 2],
            radius: FOOT_R,
            sprite: sprites.foot,
        })
        const rightFoot: any = makeEndCap({
            position: [rightLeg.position[0] + FOOT_DX, rightLeg.position[1] - LEG_L / 2],
            radius: FOOT_R,
            sprite: sprites.foot,
        })

        const limbs = [leftArm, rightArm, leftHand, rightHand, leftLeg, rightLeg, leftFoot, rightFoot]
        for (const b of limbs) world.addBody(b)

        const addRev = (a: any, b: any, pa: number[], pb: number[], lo: number, hi: number) => {
            const c = new (p2 as any).RevoluteConstraint(a, b, { localPivotA: pa, localPivotB: pb })
            c.setLimits(lo, hi)
            world.addConstraint(c)
            return c
        }

        addRev(shell, leftArm, [-SHOULDER_X, SHOULDER_Y], [ARM_L / 2, 0], -SHOULDER_LIMIT, SHOULDER_LIMIT)
        addRev(shell, rightArm, [SHOULDER_X, SHOULDER_Y], [-ARM_L / 2, 0], -SHOULDER_LIMIT, SHOULDER_LIMIT)
        addRev(leftArm, leftHand, [-ARM_L / 2, 0], HAND_PIVOT, HAND_REST - WRIST_LIMIT, HAND_REST + WRIST_LIMIT)
        addRev(rightArm, rightHand, [ARM_L / 2, 0], HAND_PIVOT, -HAND_REST - WRIST_LIMIT, -HAND_REST + WRIST_LIMIT)

        addRev(shell, leftLeg, [-HIP_X, -SHELL_LOBE_R], [0, LEG_L / 2], -HIP_LIMIT, HIP_LIMIT)
        addRev(shell, rightLeg, [HIP_X, -SHELL_LOBE_R], [0, LEG_L / 2], -HIP_LIMIT, HIP_LIMIT)
        const FOOT_PIVOT_X = -FOOT_R * 0.5
        addRev(leftLeg, leftFoot, [0, -LEG_L / 2], [FOOT_PIVOT_X, 0], -ANKLE_LIMIT, ANKLE_LIMIT)
        addRev(rightLeg, rightFoot, [0, -LEG_L / 2], [FOOT_PIVOT_X, 0], -ANKLE_LIMIT, ANKLE_LIMIT)

        function makeFrame(pos: [number, number], angle: number) {
            const body: any = new (p2 as any).Body({ position: pos, angle })
            const plane = new (p2 as any).Plane()
            plane.collisionGroup = GROUND
            plane.collisionMask = BODYPARTS
            body.addShape(plane)
            body.__isFrame = true
            return body
        }
        const ground = makeFrame([0, GROUND_Y], 0)
        // Side walls are positioned from halfWorldW, which resize() keeps in
        // sync with the container aspect. Initial values match the
        // pre-first-resize() halfWorldW so bodies aren't created at 0/0.
        const leftWall = makeFrame([-halfWorldW, 0], -Math.PI / 2)
        const rightWall = makeFrame([halfWorldW, 0], Math.PI / 2)
        const ceiling = makeFrame([0, TOP_Y], Math.PI)
        world.addBody(ground)
        world.addBody(leftWall)
        world.addBody(rightWall)
        world.addBody(ceiling)

        parts = { shell, ground, leftWall, rightWall, ceiling }
        faceAngle = shell.angle
        faceAngularVel = 0
        bitmapCache.clear()
        resetRest()
    }

    function drawSprite(body: any) {
        const img: HTMLImageElement | undefined = body.__sprite
        if (!img) return
        const scale = pixelsPerUnit / SVG_PX_PER_UNIT
        const sw = body.__sw ?? img.width
        const sh = body.__sh ?? img.height
        const displayW = sw * scale
        const displayH = sh * scale
        const bmp = getBitmap(img, displayW, displayH)
        ctx.save()
        const s = worldToScreen(body.position[0], body.position[1])
        ctx.translate(s.x, s.y)
        ctx.rotate(-body.angle)
        if (body.__spriteAngle) ctx.rotate(body.__spriteAngle)
        if (body.__flipX || body.__flipY) {
            ctx.scale(body.__flipX ? -1 : 1, body.__flipY ? -1 : 1)
        }
        const ay = body.__spriteAnchorY ?? 0.5
        ctx.drawImage(bmp, -displayW / 2, -displayH * ay, displayW, displayH)
        ctx.restore()
    }

    function chooseFace(): HTMLImageElement | undefined {
        if (dragging || mouseConstraint) return sprites.faceSurprised
        if (restPhase === 'cheers') return sprites.face
        if (restPhase === 'idle') {
            if (restTime < winkUntil) return sprites.faceWinking || sprites.face
            if (restTime >= nextWinkAt) {
                winkUntil = restTime + WINK_DURATION
                nextWinkAt = winkUntil + rand(WINK_GAP_MIN, WINK_GAP_MAX)
                return sprites.faceWinking || sprites.face
            }
        }
        return (phaseFace && sprites[phaseFace]) || sprites.face
    }

    function drawFace() {
        const shell = parts.shell
        const img = chooseFace()
        if (!img) return
        const scale = pixelsPerUnit / SVG_PX_PER_UNIT
        const w = faceCfg.w
        const h = w * (img.height / img.width)
        const displayW = w * scale
        const displayH = h * scale
        const bmp = getBitmap(img, displayW, displayH)
        ctx.save()
        const s = worldToScreen(shell.position[0], shell.position[1])
        ctx.translate(s.x, s.y)
        ctx.rotate(-shell.angle)
        ctx.translate(faceCfg.ox * scale, faceCfg.oy * scale)
        ctx.rotate(-(faceAngle - shell.angle))
        ctx.drawImage(bmp, -displayW / 2, -displayH / 2, displayW, displayH)
        ctx.restore()
    }

    function render() {
        // Clear leaves the canvas transparent so the wrapper's bg shows
        // through everywhere — no letterbox, no frame. Cage bounds are now
        // implicit (the side walls live at the container edges).
        ctx.clearRect(0, 0, container.clientWidth, container.clientHeight)
        for (const b of world.bodies) {
            if (b === parts.shell || b.__isFrame) continue
            drawSprite(b)
        }
        drawSprite(parts.shell)
        drawFace()
    }

    function updateFaceBobble(dt: number) {
        const target = parts.shell.angle
        const a = (target - faceAngle) * FACE_STIFF - faceAngularVel * FACE_DAMP
        faceAngularVel += a * dt
        faceAngle += faceAngularVel * dt
    }

    function updateRest(dt: number) {
        const shell = parts.shell
        const v = Math.hypot(shell.velocity[0], shell.velocity[1])
        const w = Math.abs(shell.angularVelocity)
        const still = v < 0.05 && w < 0.1 && !mouseConstraint
        if (still) {
            restTime += dt
            advanceRestPhase()
        } else {
            resetRest()
        }
    }

    function thaw() {
        frozen = false
    }

    function wake() {
        if (!sleeping && rafId !== 0) return
        sleeping = false
        lastT = performance.now()
        lastInteractionT = lastT
        if (rafId === 0) rafId = requestAnimationFrame(loop)
    }

    function loop(t: number) {
        rafId = 0
        const dt = Math.min((t - lastT) / 1000, 1 / 30)
        lastT = t
        if (!paused && !frozen) world.step(1 / 60, dt, 6)
        updateFaceBobble(dt)
        updateRest(dt)

        const idleLongEnough = t - lastInteractionT > IDLE_SLEEP_MS
        if (idleLongEnough && restTime > 1.0 && !dragging && !document.hidden) {
            restPhase = 'sleep'
            phaseFace = 'faceSleepy'
            render()
            sleeping = true
            return
        }

        render()
        rafId = requestAnimationFrame(loop)
    }

    function pointerWorld(e: PointerEvent) {
        const rect = canvas.getBoundingClientRect()
        return screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
    }

    function endDrag() {
        if (!dragging) return
        dragging = false
        canvas.classList.remove('dragging')
        if (mouseConstraint) {
            world.removeConstraint(mouseConstraint)
            mouseConstraint = null
        }
        if (activePointerId !== null && canvas.hasPointerCapture?.(activePointerId)) {
            canvas.releasePointerCapture(activePointerId)
        }
        activePointerId = null
    }

    const onPointerDown = (e: PointerEvent) => {
        if (!world) return
        // Reject secondary pointers while a drag is active. Without this, a
        // second touch leaks the previous mouseConstraint into world.constraints
        // and any subsequent pointerup tears down the drag for both pointers.
        if (activePointerId !== null) return
        lastInteractionT = performance.now()
        if (sleeping) wake()
        if (frozen) thaw()
        const w = pointerWorld(e)
        const hit = world.hitTest([w.x, w.y], world.bodies, 0.05).filter((b: any) => b.mass > 0)[0]
        if (!hit) return
        if (!world.bodies.includes(mouseBody)) world.addBody(mouseBody)
        mouseBody.position[0] = w.x
        mouseBody.position[1] = w.y
        const localPoint = (p2 as any).vec2.create()
        hit.toLocalFrame(localPoint, [w.x, w.y])
        mouseConstraint = new (p2 as any).RevoluteConstraint(mouseBody, hit, {
            localPivotA: [0, 0],
            localPivotB: localPoint,
            maxForce: 1e5,
        })
        world.addConstraint(mouseConstraint)
        dragging = true
        activePointerId = e.pointerId
        canvas.setPointerCapture?.(e.pointerId)
        canvas.classList.add('dragging')
        e.preventDefault()
    }

    const onPointerMove = (e: PointerEvent) => {
        if (!dragging || e.pointerId !== activePointerId) return
        const w = pointerWorld(e)
        mouseBody.position[0] = w.x
        mouseBody.position[1] = w.y
        e.preventDefault()
    }

    const onPointerEnd = () => endDrag()

    const onVisibilityChange = () => {
        if (document.hidden) {
            if (dragging) endDrag()
            if (rafId) {
                cancelAnimationFrame(rafId)
                rafId = 0
            }
            sleeping = true
        } else if (started && !rafId) {
            // Tab became visible again — restart the loop so the ragdoll
            // resumes mid-pose. Without this the simulation stays frozen
            // until the user clicks the canvas (the only other wake path).
            lastT = performance.now()
            rafId = requestAnimationFrame(loop)
        }
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerEnd)
    canvas.addEventListener('pointercancel', onPointerEnd)
    document.addEventListener('visibilitychange', onVisibilityChange)

    // ResizeObserver tracks the modal panel rather than the viewport, so a
    // panel that grows/shrinks reflows the cage. Fires once on .observe().
    const ro = new ResizeObserver(() => resize())
    ro.observe(container)

    // Async sprite load + bootstrap. Captures `cancelled` so a cleanup() called
    // mid-load never starts the render loop.
    let cancelled = false
    ;(async () => {
        try {
            resize()
            const [shell, arm, leg, hand, foot, face, faceSurprised, faceSleepy] = await Promise.all([
                loadImage(shellSvg.src),
                loadImage(armSvg.src),
                loadImage(legSvg.src),
                loadImage(handSvg.src),
                loadImage(footSvg.src),
                loadImage(faceSvg.src),
                loadImage(faceSurprisedSvg.src),
                loadImage(faceSleepySvg.src),
            ])
            if (cancelled) return
            Object.assign(sprites, { shell, arm, leg, hand, foot, face, faceSurprised, faceSleepy })
            buildWorld()
            lastT = performance.now()
            lastInteractionT = lastT
            rafId = requestAnimationFrame(loop)
            started = true

            loadImage(faceThoughtfulSvg.src)
                .then((img) => {
                    if (!cancelled) sprites.faceThoughtful = img
                })
                .catch(() => {})
            loadImage(faceWhistlingSvg.src)
                .then((img) => {
                    if (!cancelled) sprites.faceWhistling = img
                })
                .catch(() => {})
            loadImage(faceWinkingSvg.src)
                .then((img) => {
                    if (!cancelled) sprites.faceWinking = img
                })
                .catch(() => {})
        } catch (err) {
            if (!cancelled) console.error('PeanutRagdoll start failed', err)
        }
    })()

    return function cleanup() {
        cancelled = true
        if (rafId) {
            cancelAnimationFrame(rafId)
            rafId = 0
        }
        canvas.removeEventListener('pointerdown', onPointerDown)
        canvas.removeEventListener('pointermove', onPointerMove)
        canvas.removeEventListener('pointerup', onPointerEnd)
        canvas.removeEventListener('pointercancel', onPointerEnd)
        document.removeEventListener('visibilitychange', onVisibilityChange)
        ro.disconnect()
        if (activePointerId !== null && canvas.hasPointerCapture?.(activePointerId)) {
            canvas.releasePointerCapture(activePointerId)
        }
        bitmapCache.clear()
        // best-effort world disposal; p2 has no explicit destroy.
        if (world) {
            try {
                if (mouseConstraint) world.removeConstraint(mouseConstraint)
                world.clear?.()
            } catch {
                /* ignore */
            }
        }
        void started
    }
}
