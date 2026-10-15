import { Button } from '@/components/0_Bruddle/Button'
import Title from '@/components/0_Bruddle/Title'

/**
 * The closing fold done RIGHT (knerd-closing-fold A, ruled 2026-10-14): the
 * 1–3 accent words go through the Title component — never hand-rolled knerd
 * layers, never a whole sentence. The shipped landing closer (sendInSeconds)
 * still writes font-knerd-filled on a bare h2; this page is the target state.
 * The CTA follows cta-hierarchy A: white secondary pill on the coloured band.
 */
export default function ClosingFoldPreview() {
    return (
        <main className="bg-background-page">
            <section className="bg-action-secondary px-4 py-16 text-center">
                <h2>
                    <Title text={'SEND\nDOLLARS'} className="text-headingSmall md:text-headingMedium" />
                </h2>
                <p className="mx-auto mt-6 max-w-xl text-body-l text-foreground-primary">
                    The subline stays Roboto Flex — Knerd is only for the accent words above.
                </p>
                <div className="mx-auto mt-8 w-fit">
                    <Button variant="secondary" shadowSize="4" className="w-auto px-8">
                        Get started
                    </Button>
                </div>
            </section>
        </main>
    )
}
