import type React from 'react'

/** One choice in a SelectList or DrawerSelect. */
export interface SelectOption<T extends string> {
    value: T
    /** The row text, and the row's accessible name. */
    label: string
    /** The row's leading slot: an IconBubble, a flag, a logo. */
    leading?: React.ReactNode
    /** BCP 47 tag when the label is in another language (language pickers). */
    lang?: string
}
