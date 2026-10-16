import { Button } from '@/components/0_Bruddle/Button'
import { CTA_MOTION } from '@/components/Marketing/constants'

// The on-band CTA (cta-on-band-variant E + cta-hierarchy A, ruled 2026-10-14):
// on the pink and yellow bands the CTA is Button variant=secondary, default size, no
// visual overrides — the white bg and press-to-pink come from the variant, not
// from per-site hacks (the mdx Hero's bg-white override dies in the fix
// branch). On cream, the one primary pink pill. Labels are sentence case
// (cta-casing B). bg-gray-950 is the shipped black band (/shhhhh §4/§7).
// The black band takes the pink primary (audit default 2026-10-16): the secondary's
// black offset shadow is invisible on gray-950, the pink fill is not.
const COLOURED_BANDS = [
    { name: 'Pink band', className: 'bg-background-brand text-foreground-primary', variant: 'secondary' },
    { name: 'Yellow band', className: 'bg-action-secondary text-foreground-primary', variant: 'secondary' },
    { name: 'Black band', className: 'bg-gray-950 text-white', variant: 'primary' },
] as const

export default function CtaBandsPreview() {
    return (
        <main className="bg-background-page">
            {COLOURED_BANDS.map((band) => (
                <section key={band.name} className={`px-4 py-16 text-center ${band.className}`}>
                    <p className="font-roboto-flex-extrabold text-heading-s uppercase">{band.name}</p>
                    <div className="mx-auto mt-6 w-fit">
                        <Button variant={band.variant} className={`w-fit ${CTA_MOTION}`}>
                            Get the app
                        </Button>
                    </div>
                </section>
            ))}
            <section className="px-4 py-16 text-center text-foreground-primary">
                <p className="font-roboto-flex-extrabold text-heading-s uppercase">Cream — the page ground</p>
                <div className="mx-auto mt-6 w-fit">
                    <Button variant="primary" className={`w-fit ${CTA_MOTION}`}>
                        Get the app
                    </Button>
                </div>
            </section>
        </main>
    )
}
