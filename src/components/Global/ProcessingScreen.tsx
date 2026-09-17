'use client'

import Loading from '@/components/Global/Loading'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'

/**
 * the full-screen processing treatment (TASK-22452): the one mascot loader
 * over a TitleBlock. replaces the screen-level CyclingLoading misuse — the
 * rulebook keeps that treatment inline-only. shared by the qr-pay and
 * add-money rails, hence Global (placement analog: BackendErrorScreen);
 * callers own the shell, this block centers itself with my-auto inside any
 * flex column. copy stays truthful: no invented durations, no progress, no
 * promises about leaving the flow.
 */
export default function ProcessingScreen({ title, description }: { title: string; description?: string }) {
    return (
        // motion-reduce halts the loader's descendant spin here, scoped to
        // this composition: the shared Loading has no reduced-motion rule of
        // its own and changing it is separate ds debt
        <div className="my-auto flex w-full flex-col items-center gap-6 text-center motion-reduce:[&_.animate-spin]:animate-none">
            <Loading variant="mascot" />
            <TitleBlock align="center" title={title} description={description} />
        </div>
    )
}
