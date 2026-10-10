import { type ReactNode } from 'react'

/**
 * Shared CTA baseline. The primary action sits at the same height on every step:
 * the slot below it is always reserved, and holds the secondary action (Log in,
 * Skip) or the legal line when the step has one. Hints (help and recovery links)
 * sit above the actions. 24px between hints and CTA: a LinkButton's hit area
 * reaches 14px past its text (design.md tertiary CTA rule).
 */
export default function SetupFooter({
    actions,
    secondary,
    children,
}: {
    actions: ReactNode
    secondary?: ReactNode
    children?: ReactNode
}) {
    return (
        <div
            className="mt-auto flex w-full shrink-0 flex-col gap-8 compact:gap-4 short:gap-3 tight:gap-2"
            data-setup-footer
        >
            <div className="flex w-full flex-col gap-6">
                {children && <div className="flex flex-col items-center gap-3 text-center">{children}</div>}
                <div className="flex w-full flex-col gap-4">{actions}</div>
            </div>
            <div className="flex h-16 shrink-0 flex-col items-center gap-3 text-center compact:h-12 short:h-11">
                {secondary}
            </div>
        </div>
    )
}
