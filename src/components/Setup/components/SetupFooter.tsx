import { type ReactNode } from 'react'

/**
 * Shared CTA baseline. Hints (help, legal, recovery links) sit above the
 * actions, so the CTA is the last element and pins to the bottom of the panel.
 * 24px between hints and CTA: a LinkButton's hit area reaches 14px past its
 * text, so anything tighter overlaps the CTA (design.md tertiary CTA rule).
 */
export default function SetupFooter({ actions, children }: { actions: ReactNode; children?: ReactNode }) {
    return (
        <div className="mt-auto flex w-full shrink-0 flex-col gap-6" data-setup-footer>
            {children && <div className="flex flex-col items-center gap-3 text-center">{children}</div>}
            <div className="flex w-full flex-col gap-4">{actions}</div>
        </div>
    )
}
