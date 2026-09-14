'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Card } from '@/components/0_Bruddle/Card'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Icon } from '@/components/Global/Icons/Icon'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { COLOR_TOKENS, type ThemeToken } from '../tokens.generated'

// group tokens by their name prefix (action, background, avatar, ...) keeping
// source order. generated preview classes keep the swatches on the same token
// source while giving Tailwind complete class names to discover at build time.
function groupByPrefix(tokens: ThemeToken[]): Map<string, ThemeToken[]> {
    const groups = new Map<string, ThemeToken[]>()
    for (const t of tokens) {
        const prefix = t.name.split('-')[0]
        groups.set(prefix, [...(groups.get(prefix) ?? []), t])
    }
    return groups
}

const SEMANTIC = groupByPrefix(COLOR_TOKENS.filter((t) => t.section === 'semantic'))
const LEGACY = groupByPrefix(COLOR_TOKENS.filter((t) => t.section === 'legacy'))

const BACKGROUNDS = [
    { name: 'bg-peanut-repeat-normal', description: 'Normal peanut repeat pattern' },
    { name: 'bg-peanut-repeat-large', description: 'Large peanut repeat pattern' },
    { name: 'bg-peanut-repeat-small', description: 'Small peanut repeat pattern' },
]

export default function ColorsPage() {
    const [copiedColor, setCopiedColor] = useState<string | null>(null)

    const copyClass = (cls: string) => {
        navigator.clipboard.writeText(cls)
        setCopiedColor(cls)
        setTimeout(() => setCopiedColor(null), 1500)
    }

    const renderGroups = (groups: Map<string, ThemeToken[]>) => (
        <div className="space-y-4">
            {[...groups.entries()].map(([prefix, tokens]) => (
                <div key={prefix}>
                    <p className="mb-1 font-mono text-label-m text-foreground-secondary uppercase">{prefix}</p>
                    <div className="grid grid-cols-2 gap-2">
                        {tokens.map((token) => {
                            // copy the class matching the token's intent, not blanket bg-
                            const utility = token.name.startsWith('foreground')
                                ? 'text'
                                : token.name.startsWith('border')
                                  ? 'border'
                                  : token.name.startsWith('shadow')
                                    ? 'shadow'
                                    : 'bg'
                            const cls = `${utility}-${token.name}`
                            return (
                                <ListItem
                                    key={token.name}
                                    onClick={() => copyClass(cls)}
                                    leading={
                                        <div
                                            className={`size-8 shrink-0 rounded-sm border border-border-default ${token.previewClass}`}
                                        />
                                    }
                                    title={token.name}
                                    body={<span className="font-mono">{token.value}</span>}
                                    trailing={<Icon name={copiedColor === cls ? 'check' : 'copy'} size={16} />}
                                />
                            )
                        })}
                    </div>
                </div>
            ))}
        </div>
    )

    return (
        <DocPage>
            <DocHeader
                title="Colors"
                description="Generated from the @theme block in globals.css (pnpm gen:ds-tokens) — swatches cannot drift from the source. Tap any swatch to copy the class name."
            />

            <DesignNote type="warning">
                Legacy palette names remain for landing-page migration and these reference swatches. New UI must use
                semantic tokens only.
            </DesignNote>

            <DocSection title="Semantic Tokens">
                <p className="text-body-s text-foreground-secondary">
                    1:1 with the figma variables. New screens use ONLY these — e.g.{' '}
                    <code className="font-mono text-label-m text-foreground-primary">bg-action-primary</code>,{' '}
                    <code className="font-mono text-label-m text-foreground-primary">text-foreground-secondary</code>.
                </p>
                {renderGroups(SEMANTIC)}
            </DocSection>

            <DocSection title="Legacy Palette">
                <p className="text-body-s text-foreground-secondary">
                    Ported verbatim from the v3 config for visual parity. Do not use in new code — consumer migration to
                    the semantic tokens is DS 06+.
                </p>
                {renderGroups(LEGACY)}
            </DocSection>

            {/* Text / BG pairs */}
            <DocSection title="Text Colors">
                <Card className="space-y-2 p-3 text-body-xs">
                    <div className="flex items-center gap-3">
                        <span className="w-20 text-label-m text-foreground-primary">text-foreground-primary</span>
                        <span className="text-foreground-primary">Primary text — headings, labels, body</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="w-20 text-label-m text-foreground-secondary">text-foreground-secondary</span>
                        <span className="text-foreground-secondary">
                            Secondary text — descriptions, hints, metadata
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="w-20 text-label-m text-background-icon-bubble-green">
                            text-background-icon-bubble-green
                        </span>
                        <span className="text-background-icon-bubble-green">Success text — confirmations</span>
                    </div>
                </Card>

                <DesignNote type="info">
                    Use LinkButton for a standalone link. For an inline link inside a sentence, underline the
                    surrounding text and keep semantic foreground colors.
                </DesignNote>
            </DocSection>

            {/* Background patterns */}
            <DocSection title="Background Patterns">
                <DesignNote type="warning">
                    DEAD IN PRODUCT —{' '}
                    <code className="rounded-sm bg-background-default px-1 font-mono text-body-xs">
                        bg-peanut-repeat-*
                    </code>{' '}
                    (normal / large / small) are defined in the Tailwind theme but rendered on{' '}
                    <span className="underline">zero</span> real app screens (0 non-dev, non-test call-sites).
                    Don&rsquo;t treat these as design-system tokens — they&rsquo;re delete-candidates. See{' '}
                    <Link href="/dev/ds/audit/app" className="underline">
                        App Divergences →
                    </Link>
                </DesignNote>
                <div className="space-y-2 opacity-60">
                    {BACKGROUNDS.map((bg) => (
                        <ListItem
                            key={bg.name}
                            onClick={() => copyClass(bg.name)}
                            title={bg.name}
                            body={bg.description}
                            leading={
                                <span
                                    className={`${bg.name} size-8 rounded-sm border border-dashed border-border-default bg-background-badge-accent`}
                                />
                            }
                            trailing={<Icon name={copiedColor === bg.name ? 'check' : 'copy'} size={16} />}
                        />
                    ))}
                </div>
            </DocSection>
        </DocPage>
    )
}
