'use client'

import Title from '@/components/0_Bruddle/Title'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
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
                        <div className="rounded-sm bg-action-primary p-3">
                            <Title text="KNERD FONT" />
                            <p className="mt-1 text-body-s text-foreground-primary">
                                Display font with filled+outline double-render effect.
                            </p>
                        </div>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Font Display" code='className="font-display"' />
                    <CodeBlock
                        label="Title Component"
                        code={`import Title from '@/components/0_Bruddle/Title'\n<Title text="PEANUT" />`}
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
                    Overrides ported from the v3 config (text-h1…h7 and changed stock sizes). Existing code only —
                    prefer the semantic scale above.
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
