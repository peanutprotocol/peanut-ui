'use client'

import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { DoDont } from '../../_components/DoDont'
import Title, { knerdTitle } from '@/components/0_Bruddle/Title'
import { FONT_TOKENS, TEXT_STYLES, type TextStyle } from '../tokens.generated'

const SEMANTIC_STYLES = TEXT_STYLES.filter((t) => t.section === 'semantic')
const PARITY_STYLES = TEXT_STYLES.filter((t) => t.section === 'parity')

const px = (rem?: string) => (rem?.endsWith('rem') ? `${parseFloat(rem) * 16}px` : rem)

function styleSpec(t: TextStyle) {
    return [px(t.fontSize), t.lineHeight && `lh ${px(t.lineHeight)}`, t.fontWeight && `w${t.fontWeight}`]
        .filter(Boolean)
        .join(' · ')
}

export default function TypographyPage() {
    return (
        <DocPage>
            <DocHeader
                title="Typography"
                description="Generated from the @theme block in globals.css (pnpm gen:ds-tokens) — previews render the real token values."
            />

            {/* Font families */}
            <DocSection title="Font Families">
                <DocSection.Content>
                    <div className="space-y-2 rounded-sm border border-border-default p-3">
                        {FONT_TOKENS.map((font) => (
                            <div key={font.name}>
                                <p className={`text-label-l ${font.previewClass}`}>font-{font.name}</p>
                                <p className="font-mono text-body-xs break-all text-foreground-secondary">
                                    {font.stack}
                                    {font.fontVariationSettings && ` · ${font.fontVariationSettings}`}
                                </p>
                            </div>
                        ))}
                        <div>
                            <p className="font-mono text-label-l">font-mono</p>
                            <p className="text-body-s text-foreground-secondary">
                                Stock Tailwind monospace — code, addresses, amounts. Not a theme token but part of the
                                system.
                            </p>
                        </div>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Font Display" code='className="font-display"' />
                </DocSection.Code>
            </DocSection>

            {/* Knerd display title */}
            <DocSection
                title="Knerd Display Title"
                description="The one Knerd treatment (ruled 2026-09-24, design.md → type → knerd display title). Marketing heroes and OG images only, never an app screen."
            >
                <DocSection.Content>
                    <div className="rounded-sm bg-action-primary p-4 text-center">
                        <Title text={'PRESS\nKIT'} className="text-7xl" />
                    </div>
                    <p className="text-body-s text-foreground-secondary">
                        Knerd Filled in white under a Knerd Outline copy that sits{' '}
                        {Math.abs(knerdTitle.outlineOffset.x)}px left and {Math.abs(knerdTitle.outlineOffset.y)}px up of
                        it, letters and lines packed tight enough to overlap, centred, caps, with the per-line tilt of
                        the landing hero artwork. Call sites pass size only. The values below are read from{' '}
                        <code className="font-mono">knerdTitle</code> in Title.tsx, the single source both Title and the
                        OG cards use.
                    </p>
                    <table className="w-full text-body-s">
                        <tbody>
                            {[
                                ['letter-spacing', knerdTitle.letterSpacing],
                                ['line-height', String(knerdTitle.lineHeight)],
                                ['outline offset', `${knerdTitle.outlineOffset.x}px, ${knerdTitle.outlineOffset.y}px`],
                                ['outline scale', String(knerdTitle.outlineScale)],
                                [
                                    'line tilt',
                                    `${knerdTitle.lineTilt[0]}°, ${knerdTitle.lineTilt[1]}° + ${knerdTitle.secondLineShift}`,
                                ],
                                ['alignment, case', 'centred, uppercase'],
                            ].map(([k, v]) => (
                                <tr key={k} className="border-b border-border-subtle">
                                    <td className="py-1 pr-4 text-foreground-secondary">{k}</td>
                                    <td className="py-1 font-mono">{v}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <DoDont
                        doLabel="Title, size only"
                        doExample={
                            <div className="bg-action-primary p-3 text-center">
                                <Title text="WORK HERE." className="text-5xl" />
                            </div>
                        }
                        dontLabel="Hand-rolled layers, own tracking"
                        dontExample={
                            <div className="relative inline-block bg-action-primary p-3 text-5xl whitespace-nowrap">
                                <p className="relative translate-x-[3px] font-knerd-filled text-white">WORK HERE.</p>
                                <p className="absolute top-3 left-3 font-knerd-outline">WORK HERE.</p>
                            </div>
                        }
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Import" code={`import Title from '@/components/0_Bruddle/Title'`} />
                    <CodeBlock
                        label="Hero title (MarketingHero)"
                        code={`<h1>\n  <Title text={title} className="text-5xl md:text-9xl" />\n</h1>`}
                    />
                    <CodeBlock label="Two hand-placed lines" code={`<Title text={'PRESS\\nKIT'} />`} />
                    <CodeBlock
                        label="OG cards (satori, inline styles)"
                        code={`import { knerdTitle } from '@/components/0_Bruddle/Title'\n// fill:    letterSpacing: knerdTitle.letterSpacing\n// outline: top: knerdTitle.outlineOffset.y, left: knerdTitle.outlineOffset.x`}
                    />
                </DocSection.Code>
            </DocSection>

            {/* Semantic type scale */}
            <DocSection title="Semantic Type Scale">
                <p className="text-body-s text-foreground-secondary">
                    1:1 with the figma Heading/Body/Label/Button styles. New screens use these — e.g.{' '}
                    <code className="font-mono text-label-m text-foreground-primary">text-heading-m</code>,{' '}
                    <code className="font-mono text-label-m text-foreground-primary">text-body-s</code>.
                </p>
                <div className="space-y-3 rounded-sm border border-border-default p-3">
                    {SEMANTIC_STYLES.map((t) => (
                        <div key={t.name} className="min-w-0">
                            <p className={`truncate ${t.previewClass}`}>{t.name}</p>
                            <p className="font-mono text-body-xs text-foreground-secondary">
                                .text-{t.name} — {styleSpec(t)}
                            </p>
                        </div>
                    ))}
                </div>
            </DocSection>

            {/* weight conventions — guidance, not token data */}
            <DocSection title="Font Weights">
                <p className="text-body-s text-foreground-secondary">
                    Semantic type tokens carry their own weight. Do not combine them with raw font-weight utilities. Use
                    the token that matches the text role.
                </p>
            </DocSection>

            {/* v3 parity overrides */}
            <DocSection title="v3 Parity Sizes">
                <p className="text-body-s text-foreground-secondary">
                    Overrides ported from the v3 config (changed stock sizes). Existing code only — prefer the semantic
                    scale above.
                </p>
                <div className="space-y-1 rounded-sm border border-border-default p-3 text-body-xs">
                    {PARITY_STYLES.map((t) => (
                        <div key={t.name} className="flex items-baseline justify-between">
                            <code className="font-mono text-label-m">.text-{t.name}</code>
                            <span className="text-foreground-secondary">{styleSpec(t)}</span>
                        </div>
                    ))}
                </div>
            </DocSection>
        </DocPage>
    )
}
