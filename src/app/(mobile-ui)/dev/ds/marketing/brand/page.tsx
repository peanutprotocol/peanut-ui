'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import Title from '@/components/0_Bruddle/Title'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { COLOR_TOKENS } from '../../foundations/tokens.generated'
import { BRAND_BOOK_ERRATA, DISPLAY_RAMP, MARKETING_PALETTE } from './brand-data'

// every displayed value resolves against the generated token table, so this
// page cannot drift from globals.css
const tokenValue = (name: string) => COLOR_TOKENS.find((t) => t.name === name)?.value ?? '—'

export default function MarketingBrandPage() {
    return (
        <DocPage>
            <DocHeader
                title="Brand"
                description="The live site is the brand (ruled 2026-10-14, Konrad). This page documents the ratified marketing reality; the brand book v1.2 gets the errata list at the bottom, not a redesign."
            />

            <DesignNote type="info">
                Scope: the marketing surfaces (LandingPage, Marketing, /lp, /shhhhh, /m). The app&apos;s own rules live
                in the Foundations tier and design.md; the design.md <code className="font-mono">## marketing</code>{' '}
                chapter ships in the docs branch of this run.
            </DesignNote>

            {/* Palette */}
            <DocSection
                title="Palette"
                description="The five grounds of marketing. Values resolve from the generated token table — tap nothing, copy from Foundations → Colors."
            >
                <div className="space-y-2">
                    {MARKETING_PALETTE.map((entry) => (
                        <ListItem
                            key={entry.label}
                            position="solo"
                            leading={
                                <div
                                    className={`size-8 shrink-0 rounded-sm border border-border-default ${entry.swatchClass}`}
                                />
                            }
                            title={
                                <span className="flex items-baseline gap-2">
                                    {entry.label}
                                    <span className="font-mono text-label-m text-foreground-secondary">
                                        {entry.token} · {tokenValue(entry.token)}
                                    </span>
                                </span>
                            }
                            body={
                                <div>
                                    <p>{entry.role}</p>
                                    {entry.pending && (
                                        <p className="mt-1 text-label-m text-foreground-secondary">{entry.pending}</p>
                                    )}
                                </div>
                            }
                        />
                    ))}
                </div>
            </DocSection>

            {/* Corners + borders */}
            <DocSection
                title="Corners and borders"
                description="Ratified as shipped (ruled 2026-10-14, k2 + k3): pill buttons, rounded-sm 2px cards, and the border split — 1px pure black on buttons, 2px near-black on cards."
            >
                <div className="rounded-sm bg-background-page p-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <Button variant="primary" className="w-fit">
                            Get the app
                        </Button>
                        <div className="rounded-sm border-2 border-border-default bg-background-default p-4 shadow-4">
                            <p className="text-body-m">A marketing card</p>
                            <p className="text-body-s text-foreground-secondary">rounded-sm · border-2</p>
                        </div>
                    </div>
                </div>
                <ul className="space-y-1 text-body-s">
                    <li>
                        <span className="font-medium">Buttons:</span> pills (
                        <code className="font-mono text-label-m">rounded-full</code>), 1px{' '}
                        <code className="font-mono text-label-m">border-button {tokenValue('border-button')}</code>.
                    </li>
                    <li>
                        <span className="font-medium">Cards:</span>{' '}
                        <code className="font-mono text-label-m">rounded-sm</code> (2px radius), 2px{' '}
                        <code className="font-mono text-label-m">border-default {tokenValue('border-default')}</code>{' '}
                        via <code className="font-mono text-label-m">border-2</code>.
                    </li>
                    <li>The split is deliberate — do not &quot;normalise&quot; one to the other.</li>
                </ul>
            </DocSection>

            {/* Body weight */}
            <DocSection
                title="Body weight 500"
                description="Marketing prose is Roboto Flex at weight 500 (font-medium). The brand book's Regular 400 is errata, not a target."
            >
                <Card className="space-y-2 p-4">
                    <p className="font-medium">
                        Weight 500 — the ratified marketing body. Send dollars that feel like cash.
                    </p>
                    <p className="font-normal text-foreground-secondary">
                        Weight 400 — the book&apos;s value. Only the errata list remembers it.
                    </p>
                </Card>
            </DocSection>

            {/* Display ramp */}
            <DocSection
                title="Display ramp"
                description="The enforced September ruling (112/104, 80/64, 60/46, 42/36 at weight 1000). Rendered at the RULED leading."
            >
                <DesignNote type="warning">
                    The @theme ramp tokens already carry this leading, but the unlayered{' '}
                    <code className="font-mono">.font-roboto-flex-extrabold</code> class (globals.css ~1355) beats
                    layered utilities and forces line-height 1.0 at every call site. This specimen pins the ruled values
                    with explicit <code className="font-mono">!leading</code> overrides — pending: the @layer fix lands
                    in ds-marketing-tokens, then the overrides here go. Watch es/pt accented caps (Á É Í) at these
                    leadings: the fix branch captures before/after.
                </DesignNote>
                <div className="space-y-8 overflow-x-hidden rounded-sm border border-border-default bg-background-page p-4">
                    {DISPLAY_RAMP.map((step) => (
                        <div key={step.label} className="min-w-0">
                            <p className="font-mono text-label-m text-foreground-secondary">
                                {step.label} — {step.sizePx}/{step.leadingPx}, weight 1000
                            </p>
                            <p className={`font-roboto-flex-extrabold mt-2 break-words ${step.className}`}>
                                {step.sample}
                            </p>
                        </div>
                    ))}
                </div>
            </DocSection>

            {/* Knerd rule */}
            <DocSection
                title="Knerd rule"
                description="Knerd goes through the Title component only, for 1–3 accent words. Never hand-rolled layers, never an app screen, never a paragraph."
            >
                <div className="rounded-sm bg-action-primary p-4 text-center">
                    <Title text="NO FEES." className="text-heading" />
                </div>
                <p className="text-body-s text-foreground-secondary">
                    The full specimen and the knerdTitle numbers live in Foundations → Typography. Call sites pass size
                    only.
                </p>
            </DocSection>

            {/* Brand-book errata */}
            <DocSection
                title="Brand-book errata"
                description="Against public/press/assets/Peanut_Brand_Guidelines.pdf (cover label v1.2 is canonical). Ruling 1: the book gets this list, not a redesign."
            >
                <div className="space-y-2">
                    {BRAND_BOOK_ERRATA.map((entry) => (
                        <Card key={`${entry.pdfRef}-${entry.ruled}`} className="p-3">
                            <p className="font-mono text-label-m text-foreground-secondary">
                                {entry.pdfRef} · {entry.ruled}
                            </p>
                            <p className="mt-1 text-body-s text-foreground-secondary">Book: {entry.bookSays}</p>
                            <p className="text-body-s">Ratified: {entry.ratified}</p>
                        </Card>
                    ))}
                </div>
            </DocSection>
        </DocPage>
    )
}
