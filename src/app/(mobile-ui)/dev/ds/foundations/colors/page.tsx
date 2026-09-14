'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Icon } from '@/components/Global/Icons/Icon'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { COLOR_TOKENS, type ThemeToken } from '../tokens.generated'

// group tokens by their name prefix (action, background, avatar, ...) keeping
// source order. swatches use the token VALUE inline — class names are display/
// copy text only, so nothing here depends on tailwind emitting the utility.
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
                                <button
                                    key={token.name}
                                    onClick={() => copyClass(cls)}
                                    className="flex items-center gap-2 rounded-sm border border-border-disabled p-2 text-left transition-colors hover:border-border-default/40"
                                >
                                    <div
                                        className="size-8 shrink-0 rounded-sm border border-border-default"
                                        style={{ backgroundColor: token.value }}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-label-m break-all">{token.name}</p>
                                        <p className="font-mono text-body-xs text-foreground-secondary">
                                            {token.value}
                                        </p>
                                    </div>
                                    {copiedColor === cls ? (
                                        <Icon
                                            name="check"
                                            size={14}
                                            className="shrink-0 text-background-icon-bubble-green"
                                        />
                                    ) : (
                                        <Icon name="copy" size={12} className="shrink-0 text-foreground-secondary" />
                                    )}
                                </button>
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
                purple-1 / primary-1 = #ff90e8 — this is PINK, not purple. The naming is misleading but too widely used
                to rename.
            </DesignNote>

            <DocSection title="Semantic Tokens">
                <p className="text-body-s text-foreground-secondary">
                    1:1 with the figma variables. New screens use ONLY these — e.g.{' '}
                    <code className="font-mono font-bold text-foreground-primary">bg-action-primary</code>,{' '}
                    <code className="font-mono font-bold text-foreground-primary">text-foreground-secondary</code>.
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
                <div className="space-y-2 rounded-sm border border-border-default p-3 text-body-xs">
                    <div className="flex items-center gap-3">
                        <span className="w-20 font-bold text-foreground-primary">text-foreground-primary</span>
                        <span className="text-foreground-primary">Primary text — headings, labels, body</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="w-20 font-bold text-foreground-secondary">text-foreground-secondary</span>
                        <span className="text-foreground-secondary">
                            Secondary text — descriptions, hints, metadata
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="w-20 font-bold text-foreground-error">text-foreground-error</span>
                        <span className="text-foreground-error">Error text — validation messages, alerts</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="w-20 font-bold text-background-icon-bubble-green">
                            text-background-icon-bubble-green
                        </span>
                        <span className="text-background-icon-bubble-green">Success text — confirmations</span>
                    </div>
                </div>

                <DesignNote type="info">
                    Inline links: always use{' '}
                    <code className="rounded-sm bg-background-default px-1 font-mono text-body-xs">
                        text-black underline
                    </code>{' '}
                    — never text-purple-1.
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
                        <button key={bg.name} onClick={() => copyClass(bg.name)} className="w-full text-left">
                            <div
                                className={`${bg.name} h-20 rounded-sm border border-dashed border-border-default bg-background-badge-accent p-2`}
                            >
                                <span className="font-mono text-body-xs">.{bg.name} · unused</span>
                            </div>
                        </button>
                    ))}
                </div>
            </DocSection>
        </DocPage>
    )
}
