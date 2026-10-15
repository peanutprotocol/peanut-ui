import { ViewportFrame } from '@/app/dev/ds-marketing-preview/_components/ViewportFrame'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { CONTAINER_SET, CTA_RULES, HERO_RECIPES, SECTION_PADDING } from './landing-data'

export default function MarketingLandingPage() {
    return (
        <DocPage>
            <DocHeader
                title="Landing"
                description="The LP recipe book (ruled 2026-10-15, q4): two LP heroes — the key visual on the main LP, the promoted product split on sub-LPs — plus the one content hero, the FAQ fold, the Knerd closing fold, the on-band CTA, and the landing containers."
            />

            <DesignNote type="info">
                Every framed demo renders the real components in an iframe at a TRUE viewport width — toggle Phone 390 /
                Desktop 1440 on each frame. Tablet is explicitly ignored: the rulings pin phone and desktop, and between
                them the bands interpolate.
            </DesignNote>

            {/* The three heroes */}
            <DocSection
                title="The three heroes"
                description="Two LP heroes and one content hero — the whole set. A page gets exactly one, picked by the placement rule under each frame; /shhhhh itself stays exempt as a deliberate one-off."
            >
                <div className="grid gap-6 xl:grid-cols-3">
                    {HERO_RECIPES.map((hero) => (
                        <div key={hero.demo} className="space-y-2 min-w-0">
                            <p className="text-body-m-semibold">{hero.name}</p>
                            <p className="text-body-s text-foreground-secondary">{hero.useWhen}</p>
                            <ViewportFrame demo={hero.demo} label={`${hero.name} hero`} heights={hero.heights} />
                            {hero.pending && <p className="text-label-m text-foreground-secondary">{hero.pending}</p>}
                        </div>
                    ))}
                </div>
            </DocSection>

            {/* FAQ fold */}
            <DocSection
                title="FAQ fold"
                description="One FAQ fold (ruled 2026-10-14): Global/FAQs on the cream page ground, the ruled heading pair — headingSmall 42 at 390, headingMedium 80 at 1440 — and the copy is 'FAQ.' everywhere, /shhhhh included."
            >
                <ViewportFrame demo="faq-fold" label="FAQ fold" heights={{ phone: 640, desktop: 720 }} />
            </DocSection>

            {/* Closing fold */}
            <DocSection
                title="Closing fold"
                description="Done RIGHT (ruled 2026-10-14): the 1–3 knerd accent words go through the Title component — never hand-rolled font-knerd layers, never a whole sentence. The shipped landing closer still hand-rolls it; the fix branch moves it onto Title."
            >
                <ViewportFrame demo="closing-fold" label="Closing fold" heights={{ phone: 480, desktop: 560 }} />
            </DocSection>

            {/* On-band CTA */}
            <DocSection
                title="On-band CTA"
                description="The CTA hierarchy (ruled 2026-10-14): which pill goes on which ground, with no per-site visual overrides."
            >
                <ul className="space-y-1 text-body-s">
                    {CTA_RULES.map((rule) => (
                        <li key={rule}>{rule}</li>
                    ))}
                </ul>
                <ViewportFrame demo="cta-bands" label="On-band CTA" heights={{ phone: 1000, desktop: 1000 }} />
            </DocSection>

            {/* Containers */}
            <DocSection
                title="Containers"
                description="Three containers, always centred (ruled 2026-10-14): 1280 for LP folds, 720 for content hubs, 640 for prose. Bars at quarter scale."
            >
                <div className="space-y-2 rounded-sm border border-border-default bg-background-page p-4">
                    {CONTAINER_SET.map((container) => (
                        <div key={container.label} className="space-y-1">
                            <p className="font-mono text-label-m text-foreground-secondary">
                                {container.label} · {container.px}px — {container.role}
                            </p>
                            <div className="flex justify-center">
                                <div className={`h-4 rounded-sm bg-background-brand ${container.barClass}`} />
                            </div>
                        </div>
                    ))}
                </div>
            </DocSection>

            {/* Section rhythm */}
            <DocSection
                title="Section rhythm"
                description="One section spacing step (ruled 2026-10-14): 64 at 390, 96 at 1440 — band padding never picks other values. Blocks at full scale."
            >
                <div className="flex items-end gap-6 rounded-sm border border-border-default bg-background-page p-4">
                    {SECTION_PADDING.map((step) => (
                        <div key={step.label} className="space-y-1">
                            <div className={`w-16 rounded-sm bg-action-secondary ${step.barClass}`} />
                            <p className="font-mono text-label-m text-foreground-secondary">{step.label}</p>
                        </div>
                    ))}
                </div>
            </DocSection>
        </DocPage>
    )
}
