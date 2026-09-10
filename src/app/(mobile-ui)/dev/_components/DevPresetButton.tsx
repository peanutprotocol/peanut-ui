'use client'

/** One-tap preset pill inside a DevPanel. */
export default function DevPresetButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className="rounded-full border border-border-default bg-white px-2 py-1 text-label-m transition-colors"
        >
            {children}
        </button>
    )
}
