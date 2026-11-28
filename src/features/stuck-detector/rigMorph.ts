/**
 * Cross-animation Lottie rig morphing (ported from `mono/assets/mascot/lottie-lab/interactive.html`).
 *
 * Every approved Peanut mascot Lottie shares the same 13 named body-part layers (`Body`,
 * `L Arm`, `L Hand`, `R Arm`, `R Hand`, `Eye 1/2`, `Nose`, `Wrinkles`, `L/R Leg`, `L/R Shoe`).
 * Rather than hard-swapping SVGs or cross-fading opacities (which creates vector ghosting),
 * we freeze both stacked rigs, decompose each shared layer's affine matrix into
 * translate / rotate / scale / shear, interpolate with shortest-path rotation and subtle
 * Disney anticipation/settle easing, and perform a clean 1-frame art cut at the midpoint.
 */

export interface AffineComponents {
    a: number
    b: number
    c: number
    d: number
    e: number
    f: number
}

export interface DecomposedMatrix {
    tx: number
    ty: number
    rot: number
    sx: number
    sy: number
    shear: number
}

export interface RigLayerPair {
    gFrom: SVGGElement
    gTo: SVGGElement
    dFrom: DecomposedMatrix
    dTo: DecomposedMatrix
    baseFrom: string | null
    baseTo: string | null
}

/** Decompose a 2D affine matrix via QR-style factorization so rotating limbs never shear or shrink. */
export function decomposeMatrix(m: AffineComponents): DecomposedMatrix {
    const sx = Math.hypot(m.a, m.b) || 1e-6
    const rot = Math.atan2(m.b, m.a)
    const shear = (m.a * m.c + m.b * m.d) / (sx * sx)
    const sy = (m.a * m.d - m.b * m.c) / sx
    return { tx: m.e, ty: m.f, rot, sx, sy, shear }
}

/** Recompose translate/rotate/scale/shear back into an SVG `matrix(...)` attribute string. */
export function recomposeMatrix(d: DecomposedMatrix): string {
    const cos = Math.cos(d.rot)
    const sin = Math.sin(d.rot)
    const a = d.sx * cos
    const b = d.sx * sin
    const c = d.sy * (d.shear * cos - sin)
    const dd = d.sy * (d.shear * sin + cos)
    return `matrix(${a.toFixed(5)} ${b.toFixed(5)} ${c.toFixed(5)} ${dd.toFixed(5)} ${d.tx.toFixed(3)} ${d.ty.toFixed(3)})`
}

/** Shortest-path angular + linear interpolation between two decomposed rig matrices. */
export function lerpDecomposed(from: DecomposedMatrix, to: DecomposedMatrix, progress: number): DecomposedMatrix {
    let deltaRot = to.rot - from.rot
    while (deltaRot > Math.PI) deltaRot -= 2 * Math.PI
    while (deltaRot < -Math.PI) deltaRot += 2 * Math.PI
    return {
        tx: from.tx + (to.tx - from.tx) * progress,
        ty: from.ty + (to.ty - from.ty) * progress,
        rot: from.rot + deltaRot * progress,
        sx: from.sx + (to.sx - from.sx) * progress,
        sy: from.sy + (to.sy - from.sy) * progress,
        shear: from.shear + (to.shear - from.shear) * progress,
    }
}

/**
 * Weighted Disney-style ease with a tiny overshoot & settle (`c1 = 1.35`):
 * gives Peanut a snappy, weighty feel as he plants his feet out of a walk into a wave or worried pose.
 */
export function easeOutBackWeight(t: number): number {
    const clamped = Math.max(0, Math.min(1, t))
    const c1 = 1.35
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(clamped - 1, 3) + c1 * Math.pow(clamped - 1, 2)
}

/**
 * Subtle foot-plant squash & stretch envelope over `[0, 1]` morph progress:
 * compresses slightly as Peanut brakes (`t ~ 0.25`), rebounds upright (`t ~ 0.65`), and settles to `1, 1`.
 */
export function computeFootPlantSquash(t: number): { scaleX: number; scaleY: number; translateY: number } {
    const clamped = Math.max(0, Math.min(1, t))
    const wave = Math.sin(clamped * Math.PI * 2) * Math.exp(-clamped * 3.2)
    const scaleX = 1 + 0.065 * wave
    const scaleY = 1 - 0.065 * wave
    const translateY = 2.5 * Math.max(0, wave)
    return { scaleX, scaleY, translateY }
}

interface LottieRendererElementLike {
    data?: { nm?: string }
    layerElement?: SVGGElement
}

interface LottieAnimationLike {
    renderer?: { elements?: LottieRendererElementLike[] }
}

function readElementMatrix(g: SVGGElement): AffineComponents {
    try {
        const consolidated = g.transform?.baseVal?.consolidate?.()
        if (consolidated?.matrix) {
            const { a, b, c, d, e, f } = consolidated.matrix
            return { a, b, c, d, e, f }
        }
    } catch {
        // jsdom / non-SVG fallback
    }
    return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
}

function mapLayersByName(anim: LottieAnimationLike): Map<string, SVGGElement> {
    const map = new Map<string, SVGGElement>()
    const elements = anim.renderer?.elements
    if (!Array.isArray(elements)) return map
    for (const el of elements) {
        const name = el?.data?.nm
        if (name && el.layerElement) {
            map.set(name, el.layerElement)
        }
    }
    return map
}

/** Pair every shared named layer between the walking rig and the target pose rig. */
export function collectSharedRigPairs(fromAnim: LottieAnimationLike, toAnim: LottieAnimationLike): RigLayerPair[] {
    const fromMap = mapLayersByName(fromAnim)
    const toMap = mapLayersByName(toAnim)
    const pairs: RigLayerPair[] = []
    fromMap.forEach((gFrom, name) => {
        const gTo = toMap.get(name)
        if (!gTo) return
        pairs.push({
            gFrom,
            gTo,
            dFrom: decomposeMatrix(readElementMatrix(gFrom)),
            dTo: decomposeMatrix(readElementMatrix(gTo)),
            baseFrom: gFrom.getAttribute('transform'),
            baseTo: gTo.getAttribute('transform'),
        })
    })
    return pairs
}

/** Apply decomposed rig morph transforms at normalized progress `t in [0, 1]`. */
export function applyRigMorphStep(pairs: readonly RigLayerPair[], t: number): { showTargetArt: boolean } {
    const eased = easeOutBackWeight(t)
    for (const pair of pairs) {
        const attr = recomposeMatrix(lerpDecomposed(pair.dFrom, pair.dTo, eased))
        pair.gFrom.setAttribute('transform', attr)
        pair.gTo.setAttribute('transform', attr)
    }
    // Hard 1-frame art cut at the midpoint — never opacity-blend sharp vector rigs.
    return { showTargetArt: t >= 0.5 }
}

/** Restore Lottie-owned base transforms before handing playback back to the target rig. */
export function restoreRigTransforms(pairs: readonly RigLayerPair[]): void {
    for (const pair of pairs) {
        if (pair.baseFrom === null) pair.gFrom.removeAttribute('transform')
        else pair.gFrom.setAttribute('transform', pair.baseFrom)
        if (pair.baseTo === null) pair.gTo.removeAttribute('transform')
        else pair.gTo.setAttribute('transform', pair.baseTo)
    }
}
