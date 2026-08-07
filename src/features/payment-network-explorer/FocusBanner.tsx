/* eslint-disable react/jsx-no-literals -- internal team tool copy is intentionally not localized */
import type { ExplorerNode, ExplorerMeta } from './types'

interface FocusBannerProps {
    focus: NonNullable<ExplorerMeta['focus']>
    node: ExplorerNode | null
    onClear: () => void
}

export default function FocusBanner({ focus, node, onClear }: FocusBannerProps) {
    return (
        <div className="flex h-9 items-center gap-2 border-b border-n-1 bg-primary-3 px-4 text-xs">
            <span className="font-semibold">Focused: {node?.label ?? 'selected node'}</span>
            {focus.outsideWindowIncluded && (
                <span className="rounded-full border border-n-1 bg-white px-1.5 py-0.5 text-[10px] font-bold">
                    outside window
                </span>
            )}
            <button type="button" onClick={onClear} className="ml-auto font-semibold underline">
                Clear focus
            </button>
        </div>
    )
}
