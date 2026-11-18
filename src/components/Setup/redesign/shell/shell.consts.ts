import type { MascotPose } from '@/components/Global/PeanutMascot/PeanutMascot.types'
import type { SetupGround, SetupStageSize } from './shell.types'

/** The CSS variable (globals.css `.signup-shell`) that holds each stage height inside the safe area. */
export const STAGE_HEIGHT_VAR: Record<SetupStageSize, string> = {
    tall: 'var(--sr-stage-tall)',
    std: 'var(--sr-stage-std)',
    compact: 'var(--sr-stage-compact)',
    full: 'var(--sr-stage-full)',
}

/** Grounds are the app's own tokens: sky = the setup hero blue, yellow = the accent yellow, pink = the brand pink. */
export const GROUND_CLASS: Record<SetupGround, string> = {
    sky: 'bg-background-setup-hero',
    yellow: 'bg-background-accent-yellow',
    pink: 'bg-background-brand',
}

/** The same grounds as CSS values, for the status bar and the safe-area fill above the shell. */
export const GROUND_VAR: Record<SetupGround, string> = {
    sky: 'var(--color-background-setup-hero)',
    yellow: 'var(--color-background-accent-yellow)',
    pink: 'var(--color-background-brand)',
}

/**
 * The panel's lead paragraph (mock core/shell.css `.desc`): 16/26 medium grey, 14/20 on a small phone. The DS
 * body-m line height (20 px) packs the lead tighter than the mock and moves every field under it up.
 */
export const SETUP_LEAD_CLASS =
    'text-body-m leading-[26px] text-foreground-secondary signup-sm:text-body-s signup-sm:leading-5'

/**
 * Where each approved pose's figure sits inside the 1050 x 1000 comp at its hold frame, in comp units (mock
 * core/mascot.js HOLD_BOX, measured on boat.dev 13 Nov 2026; worried at frame 30).
 */
export const HOLD_BOX: Partial<Record<MascotPose, { x: number; y: number; w: number; h: number }>> = {
    cheering: { x: 159, y: 241, w: 694, h: 735 },
    'too-cool': { x: 261, y: 124, w: 542, h: 785 },
    worried: { x: 281, y: 159, w: 418, h: 789 },
    thinking: { x: 262, y: 124, w: 414, h: 815 },
    'waving-hello': { x: 93, y: 189, w: 790, h: 733 },
    pointing: { x: 254, y: 124, w: 620, h: 815 },
}
