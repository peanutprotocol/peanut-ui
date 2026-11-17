import type { ReactNode } from 'react'
import type { IconName } from '@/components/Global/Icons/Icon'

/** The colour behind a screen's headline and art. Two neighbouring screens never share one. */
export type SetupGround = 'sky' | 'yellow' | 'pink'

/**
 * Stage heights, as the mock's 390x844 design px (measured from the screen top): tall 520 (landing, the sell
 * screens), std 440 (every step), compact 300 (long sub-states), full 844 (the celebration: no panel).
 */
export type SetupStageSize = 'tall' | 'std' | 'compact' | 'full'

/** The top bar controls a screen may hide. All default to shown; `back` also needs the page to allow it. */
export type SetupChrome = { back?: boolean; dots?: boolean; lang?: boolean }

export type SetupFooterButton = {
    label: ReactNode
    onClick: () => void
    disabled?: boolean
    loading?: boolean
    icon?: IconName
    /** `data-testid` on the button. */
    testId?: string
}

export type SetupFooterSecondary = SetupFooterButton & {
    /** The DS small button type (14/16) for a long label; two balanced lines allowed. */
    small?: boolean
}

/**
 * The fixed footer. The primary button never moves within a screen or between screens; only its label
 * crossfades. One of `slot` (a link or legal line under the button) or `secondary` (a white button). `below` is
 * a link line under the white button, or under the slot of a one-button footer (it counts toward the note lift).
 */
export type SetupFooterSpec = {
    primary: SetupFooterButton
    slot?: ReactNode
    secondary?: SetupFooterSecondary
    below?: ReactNode
    /**
     * A slot note this screen shows in another state. It is measured with the live slot, so a two-line note
     * that needs the 20 px lift keeps the button at one height in every state of the screen.
     */
    reserve?: ReactNode
}

/** How the footer stack sits: 1 = one button, 2 = two buttons, 3 = two buttons and a link line, n = one button lifted for its note. */
export type SetupFooterStack = '1' | '2' | '3' | 'n'
