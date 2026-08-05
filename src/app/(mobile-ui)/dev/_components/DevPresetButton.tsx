'use client'

/** One-tap preset pill inside a DevPanel. */
export default function DevPresetButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className="rounded-full border border-n-1 bg-white px-2 py-1 text-xs font-bold transition-colors hover:bg-grey-2"
        >
            {children}
        </button>
    )
}
