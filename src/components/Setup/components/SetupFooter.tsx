import { type ReactNode } from 'react'

/** Shared CTA baseline, with a reserved slot for help, hints and legal links. */
export default function SetupFooter({ actions, children }: { actions: ReactNode; children?: ReactNode }) {
    return (
        <div className="mt-auto flex w-full shrink-0 flex-col gap-6" data-setup-footer>
            <div className="flex w-full flex-col gap-4">{actions}</div>
            <div className="flex h-12 shrink-0 flex-col items-center gap-3 text-center">{children}</div>
        </div>
    )
}
