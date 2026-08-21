import type { ExplorerNode } from './types'

interface FocusBannerProps {
    username: string
    node: ExplorerNode | null
    loaded: boolean
    onClear: () => void
}

export default function FocusBanner({ username, node, loaded, onClear }: FocusBannerProps) {
    return (
        <div className="flex h-9 items-center gap-2 border-b border-n-1 bg-primary-3 px-4 text-xs">
            <span className="font-semibold">Focused: {node?.username ?? username}</span>
            {loaded && !node && (
                <span className="rounded-full border border-n-1 bg-white px-1.5 py-0.5 text-[10px] font-bold">
                    not in loaded graph
                </span>
            )}
            <button type="button" onClick={onClear} className="ml-auto font-semibold underline">
                Clear focus
            </button>
        </div>
    )
}
