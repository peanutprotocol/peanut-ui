import type { ReactNode } from 'react'

/** The round leading or trailing mark of a sample row: a currency sign or an icon on a brand fill. */
export function A1SampleBubble({ fillClassName, children }: { fillClassName: string; children: ReactNode }) {
    return (
        <span
            className={`flex size-8 flex-none items-center justify-center rounded-full border border-border-button text-body-m-semibold ${fillClassName}`}
        >
            {children}
        </span>
    )
}
