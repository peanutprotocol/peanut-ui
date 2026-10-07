import { type ReactNode } from 'react'

/**
 * Shared CTA baseline. Hints (help, legal, recovery links) sit above the
 * actions, so the CTA is the last element and pins to the bottom of the panel.
 */
export default function SetupFooter({ actions, children }: { actions: ReactNode; children?: ReactNode }) {
    return (
        <div className="mt-auto flex w-full shrink-0 flex-col gap-4" data-setup-footer>
            {children && <div className="flex flex-col items-center gap-3 text-center">{children}</div>}
            <div className="flex w-full flex-col gap-4">{actions}</div>
        </div>
    )
}
