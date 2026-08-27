'use client'

/** Labelled form field used inside DevPanel. */
export default function DevField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="flex flex-col gap-1.5">
            <span className="text-label-m text-foreground-secondary">{label}</span>
            {children}
        </label>
    )
}
