'use client'

import Title from '@/components/0_Bruddle/Title'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

const WEIGHTS = [
    { class: 'font-light', label: 'Light', usages: 5 },
    { class: 'font-normal', label: 'Normal', usages: 50 },
    { class: 'font-medium', label: 'Medium', usages: 104 },
    { class: 'font-semibold', label: 'Semibold', usages: 66 },
    { class: 'font-bold', label: 'Bold', usages: 304 },
    { class: 'font-extrabold', label: 'Extrabold', usages: 55 },
    { class: 'font-black', label: 'Black', usages: 16 },
]

const SIZES = [
    { class: 'text-xs', example: 'Extra small (12px)', note: 'metadata, badges, hints' },
    { class: 'text-sm', example: 'Small (14px)', note: 'body text, descriptions' },
    { class: 'text-base', example: 'Base (16px)', note: 'default' },
    { class: 'text-lg', example: 'Large (18px)', note: 'section headings' },
    { class: 'text-xl', example: 'Extra large (20px)', note: 'page titles' },
    { class: 'text-2xl', example: '2XL (24px)', note: 'hero text' },
]

export default function TypographyPage() {
    return (
        <DocPage>
            <DocHeader title="Typography" description="Font families, weights, and text sizes used across the app." />

            {/* Font families */}
            <DocSection title="Font Families">
                <DocSection.Content>
                    <div className="space-y-2 rounded-sm border border-n-1 p-3">
                        <div>
                            <p className="text-sm font-bold">System Default</p>
                            <p className="text-sm text-grey-1">Primary body font. Used everywhere by default.</p>
                        </div>
                        <div>
                            <p className="font-mono text-sm font-bold">font-mono</p>
                            <p className="text-sm text-grey-1">Monospace for code, addresses, amounts. 21 usages.</p>
                        </div>
                        <div>
                            <p className="font-roboto-flex text-sm font-bold">font-roboto-flex</p>
                            <p className="text-sm text-grey-1">Roboto Flex for specific UI elements. 16 usages.</p>
                        </div>
                        <div className="rounded-sm bg-purple-1 p-3">
                            <Title text="KNERD FONT" />
                            <p className="mt-1 text-sm text-n-1">Display font with filled+outline double-render effect.</p>
                        </div>
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock label="Font Mono" code='className="font-mono"' />
                    <CodeBlock
                        label="Title Component"
                        code={`import Title from '@/components/0_Bruddle/Title'\n<Title text="PEANUT" />`}
                    />
                </DocSection.Code>
            </DocSection>

            {/* Font weights */}
            <DocSection title="Font Weights">
                <div className="space-y-1 rounded-sm border border-n-1 p-3">
                    {WEIGHTS.map((w) => (
                        <div key={w.class} className="flex items-baseline justify-between">
                            <p className={`text-sm ${w.class}`}>
                                {w.label} <span className="font-mono text-[10px] text-grey-1">.{w.class}</span>
                            </p>
                            <span className="text-xs text-grey-1">{w.usages}</span>
                        </div>
                    ))}
                </div>
                <p className="text-sm text-grey-1">
                    font-bold dominates (304 usages). Use font-bold for labels and headings, font-medium for secondary text.
                </p>
            </DocSection>

            {/* Text sizes */}
            <DocSection title="Text Sizes">
                <div className="space-y-2 rounded-sm border border-n-1 p-3">
                    {SIZES.map((s) => (
                        <div key={s.class}>
                            <p className={`${s.class} font-bold`}>{s.example}</p>
                            <p className="text-xs text-grey-1">
                                .{s.class} — {s.note}
                            </p>
                        </div>
                    ))}
                </div>
            </DocSection>
        </DocPage>
    )
}
