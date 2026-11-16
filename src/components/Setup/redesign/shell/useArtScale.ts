'use client'

import { type RefObject, useLayoutEffect, useState } from 'react'
import type { SetupStageSize } from './shell.types'
import type { ShellDevice } from './useShellDevice'

/** The art box's design size: 390 wide, as tall as the mock's stage for that size (screen-top px on a 390x844 phone). */
export const ART_BOX_W = 390
export const DESIGN_STAGE_PX: Record<SetupStageSize, number> = { tall: 520, std: 440, compact: 300, full: 844 }

/**
 * Scale for the 390-wide art box so the hero clears the headline and fits the phone (mock shell.js layoutArt).
 * The box hangs from the stage bottom, so the art's top lands at stageH - (designH - artTop) * s, and it must sit
 * under the headline (whose bottom includes an 8 px gap). Small phones keep 0.62 to 0.82, or the screen's fixed
 * `smScale`; other phones never grow the art past the mock, and keep 1 for art beside the headline.
 */
export function useArtScale({
    stageRef,
    titleRef,
    stage,
    artTop,
    smArtTop,
    smScale,
    artBesideTitle,
    device,
}: {
    stageRef: RefObject<HTMLElement | null>
    titleRef: RefObject<HTMLElement | null>
    stage: SetupStageSize
    artTop?: number
    smArtTop?: number
    smScale?: number
    artBesideTitle?: boolean
    device: ShellDevice
}) {
    const [scale, setScale] = useState(1)
    useLayoutEffect(() => {
        const stageEl = stageRef.current
        if (!stageEl) return
        const measure = () => {
            const designH = DESIGN_STAGE_PX[stage]
            const width = stageEl.clientWidth / ART_BOX_W
            if (device === 'sm' && smScale) {
                setScale(Math.min(smScale, width))
                return
            }
            if (device !== 'sm' && artBesideTitle) {
                setScale(Math.min(1, width))
                return
            }
            const stageH = stageEl.clientHeight
            const title = titleRef.current
            const titleBottom = title ? title.offsetTop + title.offsetHeight + 8 : 64
            const top = (device === 'sm' ? (smArtTop ?? artTop) : artTop) ?? designH - 244
            const fit = (stageH - titleBottom) / (designH - top)
            const next = device === 'sm' ? Math.max(0.62, Math.min(0.82, fit)) : Math.max(0.55, Math.min(1, fit))
            setScale(Number(Math.min(next, width).toFixed(3)))
        }
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(stageEl)
        if (titleRef.current) observer.observe(titleRef.current)
        return () => observer.disconnect()
    }, [stageRef, titleRef, stage, artTop, smArtTop, smScale, artBesideTitle, device])
    return scale
}
