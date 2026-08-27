interface ExplorerStatePanelProps {
    title: string
    detail: string
    busy?: boolean
    onRetry?: () => void
}

export default function ExplorerStatePanel({ title, detail, busy = false, onRetry }: ExplorerStatePanelProps) {
    return (
        <section className="flex h-full items-center justify-center bg-[#f7f4ef] p-6 text-center" aria-live="polite">
            <div className="max-w-sm rounded-sm border border-n-1 bg-white p-6 shadow-[4px_4px_0_#000]">
                {busy && (
                    <span className="mx-auto mb-3 block size-4 animate-spin rounded-full border-2 border-n-1 border-t-transparent motion-reduce:animate-none" />
                )}
                <h2 className="text-base font-bold">{title}</h2>
                <p className="mt-2 text-xs text-grey-1">{detail}</p>
                {onRetry && (
                    <button
                        type="button"
                        onClick={onRetry}
                        className="mt-4 rounded-sm border border-n-1 bg-primary-3 px-3 py-1.5 text-xs font-bold shadow-[2px_2px_0_#000]"
                    >
                        Retry
                    </button>
                )}
            </div>
        </section>
    )
}
