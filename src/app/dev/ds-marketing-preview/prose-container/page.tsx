import { PROSE_WIDTH } from '@/components/Marketing/constants'

/**
 * The content measure (mobile-gutter A + container-grid A, ruled 2026-10-14):
 * one 24px side inset at 390 — bands, prose and footer share it — and the 640
 * prose container, always centred. The pink strips ARE the inset: at 390 they
 * are the whole margin; at 1440 the margin grows but the strips stay 24px, the
 * floor the content never crosses.
 */
export default function ProseContainerPreview() {
    return (
        <main className="relative min-h-dvh bg-background-page py-10">
            <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-background-brand" />
            <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-background-brand" />
            <article className={`mx-auto ${PROSE_WIDTH} px-6`}>
                <h2 className="text-heading-m text-foreground-primary">The 640 prose container</h2>
                <p className="mt-6 text-body-m leading-7 text-foreground-secondary">
                    At 390 the 24px inset is the whole margin — the prose runs edge to edge inside it, and the old blog
                    double-wrap (a padded column inside a padded column) is gone.
                </p>
                <p className="mt-6 text-body-m leading-7 text-foreground-secondary">
                    At 1440 the container centres at 640px and the margin grows on its own. The pink strips stay 24px:
                    they mark the inset, not the margin.
                </p>
            </article>
        </main>
    )
}
