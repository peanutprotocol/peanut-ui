'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { Section } from '@/components/0_Bruddle/Section'
import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import { NAV_CIRCLE_BUTTON_CLASSES } from '@/components/Global/NavHeader/navHeader.consts'
import DevPageShell from '../_components/DevPageShell'

/**
 * /dev/nav-header-centering — the question: should NavHeader collapse its
 * trailing 40px track when no `rightElement` is passed?
 *
 * The title is already mathematically centred. Measured live at 375px: the grid
 * midpoint and the title-ink midpoint are both 187.5, with 85.6px of whitespace
 * on each side. It still READS as off-centre, because the third track is
 * reserved but almost always EMPTY — of the 103 files that render NavHeader,
 * exactly 3 pass `rightElement`, and one of those is a /dev docs page. So the
 * left 40px holds a visible circle and the right 40px holds nothing, and the
 * eye compares the title to the nearest VISIBLE things:
 *
 *   at 375px, title "More networks"   to back circle   to right edge   delta
 *   today                                  102.4px         142.4px      40px
 *   empty track collapsed to 0             122.4px         122.4px       0px
 *
 * The delta is exactly the width of the empty track.
 *
 * The trade-off, shown honestly below, is NOT a centering inversion. With the
 * track collapsed the title BOX starts 64px from the left edge and ends 24px
 * from the right one, and that asymmetric box stays centred on the span between
 * the back circle and the right edge — so the delta is 0 at every title length,
 * long ones included. What the long title actually costs is CLEARANCE: at 320px
 * "Payment limits and regions" ends 30px from the screen edge instead of 75px.
 * The comment on that grid says the fixed side columns are deliberate — they
 * keep both controls at the navigation origin and let a wrapped title grow DOWN
 * rather than into the safe area. That is the thing being traded.
 *
 * Nothing here ships. NavHeader is untouched; variant 2 is a page-local CSS shim
 * standing in for a one-line conditional inside the component. The winner is
 * applied in a separate PR and this directory is deleted.
 */

// --------------------------------------------------------------------- variants

/** PROPOSAL SHIM, not the shipped mechanism. A descendant override on the page
 *  wrapper sets the real NavHeader's own grid to a 0px trailing track, so the
 *  comparison below runs against the REAL component rather than a replica. If
 *  this variant wins, it ships as one conditional inside NavHeader —
 *  `rightElement ? '2.5rem' : '0px'` on the third track — and this class dies. */
const COLLAPSE_SHIM = '[&_.grid]:grid-cols-[2.5rem_minmax(0,1fr)_0px]'

interface Variant {
    key: string
    name: string
    pitch: string
    shimClass?: string
}

const VARIANTS: Variant[] = [
    {
        key: 'today',
        name: 'Today',
        pitch: 'The shipped header, untouched: a 40px back track, a flexible title, and a 40px trailing track that is empty on 100 of the 103 surfaces that render it.',
    },
    {
        key: 'collapsed',
        name: 'Empty trailing track collapsed',
        pitch: 'The same real header, with the empty trailing track set to 0px. The two 24px gaps stay, so the title column recentres on the span between the back circle and the right edge.',
        shimClass: COLLAPSE_SHIM,
    },
]

// ----------------------------------------------------------------- title cases

interface TitleCase {
    key: string
    label: string
    title: string
    rightElement?: ReactNode
}

const TITLE_CASES: TitleCase[] = [
    { key: 'short', label: 'a · short — "Limits"', title: 'Limits' },
    {
        key: 'medium',
        label: 'b · medium — "More networks" (the case that triggered this)',
        title: 'More networks',
    },
    {
        key: 'long',
        label: 'c · long — "Payment limits and regions" (near the fill threshold)',
        title: 'Payment limits and regions',
    },
    {
        key: 'trailing',
        label: 'd · with a trailing element — both slots occupied',
        title: 'More networks',
        // the real trailing control, from Profile: a circle Button in the slot
        rightElement: (
            <Button
                variant="transparent"
                href="/dev"
                icon="edit"
                aria-label="Edit"
                className={NAV_CIRCLE_BUTTON_CLASSES}
            />
        ),
    },
]

const WIDTHS = [
    { px: 320, className: 'w-[320px]' },
    { px: 375, className: 'w-[375px]' },
    { px: 430, className: 'w-[430px]' },
]

// ------------------------------------------------------------------ measurement

interface Metrics {
    /** title ink left edge minus the back circle's right edge */
    backGap: number
    /** container right edge minus the title ink right edge */
    edgeGap: number
    /** |edgeGap - backGap| — 0 means the ink sits centred between what you can see */
    delta: number
    /** the title COLUMN's own insets from the container edges — the trade-off number */
    boxLeft: number
    boxRight: number
}

const round = (n: number) => Math.round(n * 10) / 10

/** Measures one rendered header. The ink box comes from a Range over the title
 *  node, never from the element box: the element box is the full grid column and
 *  would report perfect symmetry for every variant. */
function measure(root: HTMLElement): Metrics | null {
    const grid = root.querySelector('div.grid')
    const back = root.querySelector('[data-testid="nav-back"]')
    if (!grid || !back) return null
    const title = grid.children[1]
    if (!title) return null

    const range = document.createRange()
    range.selectNodeContents(title)
    const ink = range.getBoundingClientRect()
    range.detach()
    if (!ink.width) return null

    const gridRect = grid.getBoundingClientRect()
    const backRect = back.getBoundingClientRect()
    const titleRect = title.getBoundingClientRect()

    const backGap = ink.left - backRect.right
    const edgeGap = gridRect.right - ink.right
    return {
        backGap: round(backGap),
        edgeGap: round(edgeGap),
        delta: round(Math.abs(edgeGap - backGap)),
        boxLeft: round(titleRect.left - gridRect.left),
        boxRight: round(gridRect.right - titleRect.right),
    }
}

/** One header at one width, with its own numbers under it. */
const MeasuredHeader = ({
    width,
    shimClass,
    titleCase,
}: {
    width: (typeof WIDTHS)[number]
    shimClass?: string
    titleCase: TitleCase
}) => {
    const ref = useRef<HTMLDivElement>(null)
    const [metrics, setMetrics] = useState<Metrics | null>(null)
    // the shim is CSS, so it cannot see the props: applying it to a header that
    // DOES carry a trailing element would delete the slot the element sits in.
    // The real conditional lives on the prop, so gate the shim on the prop too.
    const appliedShim = titleCase.rightElement ? undefined : shimClass

    useEffect(() => {
        const run = () => {
            if (ref.current) setMetrics(measure(ref.current))
        }
        run()
        // webfont swap changes the ink width, so re-measure once fonts settle
        document.fonts?.ready.then(run).catch(() => undefined)
    }, [appliedShim, titleCase.title])

    return (
        <div className="flex flex-col gap-2">
            <p className="text-label-m text-foreground-secondary uppercase">{width.px} px</p>
            <div className="overflow-x-auto">
                <div
                    ref={ref}
                    className={`box-content border border-dashed border-border-default bg-background-default ${width.className} ${appliedShim ?? ''}`}
                >
                    <NavHeader
                        title={titleCase.title}
                        rightElement={titleCase.rightElement}
                        hideMaintenanceBanner
                        href="/dev"
                    />
                </div>
            </div>
            <p className="text-body-xs text-foreground-secondary" data-testid={`metrics-${width.px}`}>
                {metrics
                    ? `to back circle ${metrics.backGap} · to right edge ${metrics.edgeGap} · delta ${metrics.delta} · title box inset ${metrics.boxLeft} / ${metrics.boxRight}`
                    : 'measuring…'}
            </p>
        </div>
    )
}

// ---------------------------------------------------------------- page scaffold

const Demo = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="flex flex-col gap-2">
        <p className="text-label-m text-foreground-secondary uppercase">{label}</p>
        <div className="bg-background-default p-4">{children}</div>
    </div>
)

const NoteRow = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="flex flex-col gap-1 py-3">
        <p className="text-label-m text-foreground-secondary uppercase">{label}</p>
        <p className="text-body-s text-foreground-primary">{children}</p>
    </div>
)

export default function NavHeaderCenteringPage() {
    return (
        <DevPageShell
            title="Nav header centering"
            description="Should NavHeader collapse its trailing 40px track when nothing is in it? Both variants are the REAL NavHeader, at three phone widths and four title lengths, with the gaps measured live under each one. Nothing here ships."
            width="prose"
        >
            <div className="flex flex-col gap-10">
                <Callout priority="info" title="How to read the numbers">
                    Each header reports the gap from the title INK to the back circle, the gap from the ink to the
                    container&rsquo;s right edge, and the difference between them. Delta 0 means the title sits centred
                    between the two things a reader can actually see. The last pair is the title COLUMN&rsquo;s own
                    inset from each container edge — that is where the trade-off shows up, not in the delta. Variant 2
                    never posts a non-zero delta at any title length, so the long title does not invert the problem; it
                    spends clearance instead.
                </Callout>

                {VARIANTS.map((variant, index) => (
                    <Section key={variant.key} title={`${index + 1} — ${variant.name}`} className="gap-4">
                        <p className="text-body-s text-foreground-secondary">{variant.pitch}</p>

                        {TITLE_CASES.map((titleCase) => (
                            <Demo key={titleCase.key} label={titleCase.label}>
                                <div className="flex flex-col gap-6">
                                    {WIDTHS.map((width) => (
                                        <MeasuredHeader
                                            key={width.px}
                                            width={width}
                                            shimClass={variant.shimClass}
                                            titleCase={titleCase}
                                        />
                                    ))}
                                </div>
                            </Demo>
                        ))}

                        <Card position="solo" className="divide-y divide-dashed divide-border-default px-4 py-0">
                            <NoteRow label="Trailing track">
                                {variant.shimClass
                                    ? '0px when no rightElement is passed. The two 24px gaps stay, so the title column spans from 64px to 24px-from-the-right.'
                                    : '2.5rem, reserved whether or not anything is in it. The title column spans 64px in from both edges.'}
                            </NoteRow>
                            <NoteRow label="Case d, both slots occupied">
                                {variant.shimClass
                                    ? 'Identical to variant 1, and it has to be: the shim is gated on rightElement exactly as the real conditional would be, because CSS alone cannot see the prop and would delete the slot the element sits in. The numbers above match variant 1 case d; if they ever stop matching, the proposal is wrong.'
                                    : 'The baseline for case d. Both variants render this case identically — a filled trailing track is the case this proposal does not touch.'}
                            </NoteRow>
                            <NoteRow label="Long title, case c">
                                {variant.shimClass
                                    ? 'No inversion: the asymmetric 64/24 column stays centred on the span between the back circle and the right edge, so the delta is 0 at every length. What the long title costs is clearance — at 320px it ends 30px from the screen edge instead of 75px.'
                                    : 'The column is symmetric, 64px in from both edges, so a long title keeps a 64px runway before the screen edge. That clearance is what the fixed trailing track buys.'}
                            </NoteRow>
                            <NoteRow label="How it would ship">
                                {variant.shimClass
                                    ? 'One conditional inside NavHeader on the third track, plus a figma board for the new geometry per design.md. No call site changes.'
                                    : 'No change. 103 files keep rendering it as-is.'}
                            </NoteRow>
                        </Card>
                    </Section>
                ))}

                <Callout priority="info" title="Scope">
                    This page lives only under /dev/nav-header-centering. NavHeader and all 103 files that render it are
                    untouched by this PR — variant 2 is a page-local CSS shim, not a component change. The winner is
                    applied to NavHeader in a separate PR, and this directory is deleted then.
                </Callout>
            </div>
        </DevPageShell>
    )
}
