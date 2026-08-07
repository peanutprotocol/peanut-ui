'use client'

/** Labelled form field used inside DevPanel. */
export default function DevField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-grey-1">{label}</span>
            {children}
        </label>
    )
}
