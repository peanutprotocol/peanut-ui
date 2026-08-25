'use client'

/** Bordered control panel with a heading — the builders' left-rail sections. */
export default function DevPanel({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-sm border-2 border-border-default bg-white p-4 shadow-4">
            <h2 className="mb-3 text-xs font-bold tracking-wide text-foreground-secondary uppercase">{title}</h2>
            <div className="flex flex-col gap-3">{children}</div>
        </section>
    )
}
