'use client'

import Title, { knerdTitle } from '@/components/0_Bruddle/Title'
import { KnerdReferenceFrame } from '@/app/dev/ds-marketing-preview/_components/KnerdReferenceFrame'
import { CodeBlock } from '../../_components/CodeBlock'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { WhenToUse } from '../../_components/WhenToUse'
import { FOLLOW_THE_PULL as motion } from '../../../../../../../public/dev/knerd/preset'

function SpecTable({ rows }: { rows: [string, string][] }) {
    return (
        <div className="overflow-x-auto rounded-sm border border-border-default">
            <table className="w-full text-left text-body-s">
                <thead>
                    <tr className="bg-background-page">
                        <th className="border-b border-border-default px-3 py-2">Property</th>
                        <th className="border-b border-border-default px-3 py-2">Exact setting</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(([name, value]) => (
                        <tr key={name}>
                            <th scope="row" className="border-b border-border-default px-3 py-2 font-medium">
                                {name}
                            </th>
                            <td className="border-b border-border-default px-3 py-2">{value}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

export default function KnerdPage() {
    return (
        <DocPage>
            <DocHeader
                title="Knerd"
                description="Our display lettering: white fill, offset black outline, tight tracking and tilted lines. Use it for a few expressive marketing words."
            />
            <DocSection
                title="The type treatment"
                description="Static Knerd goes through Title. These values come directly from its shared knerdTitle settings."
            >
                <div className="overflow-hidden rounded-sm bg-background-brand p-6 text-center">
                    <Title text={'IN\nPINK'} className="text-heading md:text-headingMedium" />
                </div>
                <SpecTable
                    rows={[
                        ['Layers', 'Knerd Filled in white; Knerd Outline in black.'],
                        ['Tracking', knerdTitle.letterSpacing],
                        ['Line height', String(knerdTitle.lineHeight)],
                        [
                            'Outline offset',
                            `${knerdTitle.outlineOffset.x}px horizontally; ${knerdTitle.outlineOffset.y}px vertically`,
                        ],
                        ['Outline scale', String(knerdTitle.outlineScale)],
                        [
                            'Line tilt',
                            `${knerdTitle.lineTilt[0]}° on line 1; ${knerdTitle.lineTilt[1]}° and ${knerdTitle.secondLineShift} right on line 2`,
                        ],
                    ]}
                />
                <WhenToUse
                    use={[
                        '1–3 accent words in a marketing hero.',
                        'A closing fold lockup.',
                        'OG card amounts with the same shared type values.',
                    ]}
                    dontUse={[
                        'Body copy, long sentences, navigation, or wallet app headings.',
                        'A custom outline offset, tracking, or tilt at a call site.',
                        'Animation on every Knerd word in a page.',
                    ]}
                />
                <CodeBlock
                    label="Static title"
                    code={`import Title from '@/components/0_Bruddle/Title'\n\n<Title text={'IN\\nPINK'} className="text-heading md:text-headingMedium" />`}
                />
            </DocSection>

            <section id="hero-animation" className="space-y-6 scroll-mt-6">
                <DocSection
                    title="Hero animation — Follow the pull"
                    description="The selected C treatment. Individual letters spring up into place, lean toward the pointer, and settle back when released. Quiet at rest."
                >
                    <KnerdReferenceFrame />
                </DocSection>
            </section>

            <DocSection
                title="When to use the hero animation"
                description="Use this exact preset for oversized Knerd in a hero fold. The motion belongs to the accent words; supporting copy and the CTA stay still."
            >
                <WhenToUse
                    use={[
                        'A hero headline with a short Knerd phrase and room for the letters to move.',
                        'Wide text above 600px; the specified stacked lines at 600px and below.',
                        'US above “and EUROPE” on phones, with the small Roboto “and” kept still.',
                        'A single entrance when the hero becomes visible. Replay is a documentation control.',
                    ]}
                    dontUse={[
                        'Repulsion, continuous floating, random motion, or different physics per landing page.',
                        'Scaling the fill and outline separately.',
                        'Moving introductory text, body copy or the CTA with the letters.',
                        'A long paragraph squeezed into the hero. Shorten the phrase instead.',
                    ]}
                />
            </DocSection>

            <DocSection
                title="Entrance specification"
                description="These are the reviewed C values, not a generic spring approximation. The timing table and demo import the same preset."
            >
                <SpecTable
                    rows={[
                        ['Duration', `${motion.duration}ms per letter`],
                        ['Stagger', `${motion.stagger}ms × letter index; spaces and “and” do not count`],
                        [
                            'Direction and travel',
                            `Rise from below: min(70px, ${motion.drop} × letter font size, available lower clearance)`,
                        ],
                        [
                            'Alternating rotation',
                            `${motion.rotation}° × alternating sign; reduce magnitude to 2° when upper clearance is 20px or less`,
                        ],
                        ['Easing', 'cubic-bezier(.33, 0, .2, 1)'],
                        ['Transform origin', '50% 85%'],
                    ]}
                />
                <SpecTable
                    rows={[
                        ['0%', 'Y = travel; rotation = bend; scale X .97, Y 1.04'],
                        ['50%', 'Y = −travel × .095; rotation = −bend × .3; scale X 1.045, Y .945'],
                        ['72%', 'Y = travel × .13; rotation = bend × .18; scale 1'],
                        ['90%', 'Y = −travel × .02; rotation 0; scale 1'],
                        ['100%', 'Y 0; rotation 0; scale 1'],
                    ]}
                />
                <p className="text-body-s text-foreground-secondary">
                    Clearance protects the stationary copy. Upper clearance subtracts .22 × font size and 16px below the
                    lead. Lower clearance subtracts .08 × font size and 16px above the optional following copy or the
                    footer.
                </p>
            </DocSection>

            <DocSection
                title="Magnetic response specification"
                description="Attract letters toward the pointer using stable, untransformed letter anchors. Activate the field after the entrance finishes."
            >
                <SpecTable
                    rows={[
                        ['Field radius', `min(${motion.radius}px, viewport width × .42)`],
                        ['Falloff', 'max(0, 1 − distance / radius) ^ 1.4'],
                        ['Maximum pull', `min(${motion.force}px, letter font size × .17) × falloff`],
                        ['Stiffness / damping', `${motion.stiffness} / ${motion.damping}`],
                        ['Frame step', 'dt = min(2, elapsed milliseconds / 16.667); first frame dt = 1'],
                        ['Velocity', '(velocity + (target − position) × stiffness × dt) × damping ^ dt'],
                        ['Position / tilt', 'position += velocity × dt; rotation = horizontal position × .075°'],
                        [
                            'Settle threshold',
                            '.025 for total X/Y error plus X/Y velocity; clear transforms after release and settling',
                        ],
                        ['Idle movement', `${motion.idle} — no looping drift`],
                        [
                            'Touch / keyboard',
                            '500ms pull pulse. Enter or Space pulls near 45% of headline width and height.',
                        ],
                    ]}
                />
                <p className="text-body-s text-foreground-secondary">
                    Reserve 12px at the horizontal viewport edges. Moving the pointer away releases the letters into the
                    same spring. Touch release keeps the pulse alive; pointer cancellation ends it so scrolling remains
                    natural.
                </p>
            </DocSection>

            <DocSection
                title="Fill the fold"
                description="Fit the phrase to the available space after the real fonts load. Keep one shared font size across the lines; this is C’s wide/stacked composition."
            >
                <SpecTable
                    rows={[
                        ['Width budget', '92% of headline width on desktop; 90% at 600px and below'],
                        [
                            'Height budget',
                            'Hero body minus vertical padding, lead, optional following line and their gaps',
                        ],
                        [
                            'Fit',
                            'Measure lines at 100px, choose the smallest width-fitting size, then reduce only if the title exceeds the height budget',
                        ],
                        ['Headline padding / gap', '.2em top, .04em sides, .06em bottom; .025em between lines'],
                        [
                            'Spaces / join',
                            'Space .24em; “and” in Roboto Flex at .24em, weight 900, with .3em side margins',
                        ],
                        ['Hero min height', '570px desktop; 620px at 600px and below; otherwise fill 100svh'],
                        ['Body padding / gap', 'Desktop 32px 38px 25px / 20px; phone 22px 25px 18px / 22px'],
                        [
                            'Very narrow phones',
                            'At 350px and below: 22px side padding and 24px lead; otherwise phone lead is 27px',
                        ],
                    ]}
                />
                <p className="text-body-s text-foreground-secondary">
                    Keep the lead and CTA visible. On resize, wait 100ms, reset transforms and refit; do not replay the
                    entrance. The reference includes all six reviewed headline compositions.
                </p>
            </DocSection>

            <DocSection title="Accessibility and lifecycle">
                <WhenToUse
                    use={[
                        'Reduced motion: show the full, still headline. Disable the entrance, magnet, tap pulse and demo.',
                        'Expose one complete headline to assistive technology. Hide duplicate glyph/outline layers.',
                        'Keep a visible focus ring on the keyboard-interactive headline.',
                        'Pause offscreen and while the document is hidden. Resume when visible.',
                        'Cancel animation frames, animations, timers and listeners when an integrated component unmounts.',
                    ]}
                    dontUse={[
                        'Starting interaction before the entrance completes.',
                        'Keeping a frame loop running after pointer/demo release and spring settling.',
                        'Replacing touch scrolling with a drag gesture.',
                    ]}
                />
            </DocSection>

            <DocSection
                title="Reference and implementation"
                description="The embedded reference preserves the reviewed C engine. It does not change the existing landing pages."
            >
                <CodeBlock label="Exact preset used by the demo" code={JSON.stringify(motion, null, 2)} />
                <p className="text-body-s">
                    The reference lives in <code>public/dev/knerd/</code>. Its <code>preset.js</code> is shared by this
                    page and the demo. <code>hero.js</code> contains the sizing, keyframes, physics, and lifecycle
                    behavior to preserve in a production port. Static Knerd continues to use <code>Title</code>.
                </p>
                <p className="text-body-s">
                    <a
                        className="underline"
                        href="https://star-lp-knerd-motion.white-reed-3690.chatgpt.site/final-draft.html?version=c"
                    >
                        Selected design draft
                    </a>{' '}
                    ·{' '}
                    <a
                        className="underline"
                        href="https://star-lp-knerd-motion.white-reed-3690.chatgpt.site/review.html"
                    >
                        Adversarial review and fixes
                    </a>
                </p>
            </DocSection>
        </DocPage>
    )
}
