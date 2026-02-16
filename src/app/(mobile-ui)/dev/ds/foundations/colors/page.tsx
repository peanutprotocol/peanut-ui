'use client'

import { useState } from 'react'
import { Icon } from '@/components/Global/Icons/Icon'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'

const COLORS = [
    { name: 'purple-1', bg: 'bg-purple-1', text: 'text-purple-1', hex: '#FF90E8', note: 'PINK not purple!' },
    { name: 'primary-3', bg: 'bg-primary-3', text: 'text-primary-3', hex: '#EFE4FF', note: 'lavender' },
    { name: 'primary-4', bg: 'bg-primary-4', text: 'text-primary-4', hex: '#D8C4F6', note: 'deeper lavender' },
    { name: 'yellow-1', bg: 'bg-yellow-1', text: 'text-yellow-1', hex: '#FFC900', note: 'peanut yellow' },
    { name: 'green-1', bg: 'bg-green-1', text: 'text-green-1', hex: '#98E9AB', note: 'success green' },
    { name: 'n-1', bg: 'bg-n-1', text: 'text-n-1', hex: '#000000', note: 'black / primary text' },
    { name: 'grey-1', bg: 'bg-grey-1', text: 'text-grey-1', hex: '#6B6B6B', note: 'secondary text' },
    { name: 'teal-1', bg: 'bg-teal-1', text: 'text-teal-1', hex: '#C3F5E4', note: 'teal accent' },
    { name: 'violet-1', bg: 'bg-violet-1', text: 'text-violet-1', hex: '#A78BFA', note: 'violet' },
    { name: 'error-1', bg: 'bg-error-1', text: 'text-error-1', hex: '#FF6B6B', note: 'error red' },
    { name: 'success-3', bg: 'bg-success-3', text: 'text-success-3', hex: '#4ADE80', note: 'success bg' },
    { name: 'secondary-1', bg: 'bg-secondary-1', text: 'text-secondary-1', hex: '#FFC900', note: 'same as yellow-1' },
]

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

    return (
        <DocPage>
            <DocHeader title="Colors" description="Color tokens from tailwind.config.js. Tap any swatch to copy the class name." />

            <DesignNote type="warning">
                purple-1 / primary-1 = #FF90E8 — this is PINK, not purple. The naming is misleading but too widely used to rename.
            </DesignNote>

            {/* Color grid */}
            <DocSection title="Color Tokens">
                <div className="grid grid-cols-2 gap-2">
                    {COLORS.map((color) => (
                        <button
                            key={color.name}
                            onClick={() => copyClass(color.bg)}
                            className="flex items-center gap-2 rounded-sm border border-n-1/20 p-2 text-left transition-colors hover:border-n-1/40"
                        >
                            <div className={`size-8 shrink-0 rounded-sm border border-n-1 ${color.bg}`} />
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold">{color.name}</p>
                                <p className="text-[9px] text-grey-1">
                                    {color.hex} · {color.note}
                                </p>
                            </div>
                            {copiedColor === color.bg ? (
                                <Icon name="check" size={14} className="shrink-0 text-success-3" />
                            ) : (
                                <Icon name="copy" size={12} className="shrink-0 text-grey-1 opacity-0 group-hover:opacity-100" />
                            )}
                        </button>
                    ))}
                </div>
            </DocSection>

            {/* Text / BG pairs */}
            <DocSection title="Text Colors">
                <div className="space-y-2 rounded-sm border border-n-1 p-3 text-xs">
                    <div className="flex items-center gap-3">
                        <span className="w-20 font-bold text-n-1">text-n-1</span>
                        <span className="text-n-1">Primary text — headings, labels, body (134 usages)</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="w-20 font-bold text-grey-1">text-grey-1</span>
                        <span className="text-grey-1">Secondary text — descriptions, hints, metadata</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="w-20 font-bold text-error-1">text-error-1</span>
                        <span className="text-error-1">Error text — validation messages, alerts</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="w-20 font-bold text-success-3">text-success-3</span>
                        <span className="text-success-3">Success text — confirmations</span>
                    </div>
                </div>

                <DesignNote type="info">
                    Inline links: always use <code className="rounded bg-white px-1 font-mono text-[10px]">text-black underline</code> — never text-purple-1.
                </DesignNote>
            </DocSection>

            {/* Background patterns */}
            <DocSection title="Background Patterns">
                <div className="space-y-2">
                    {BACKGROUNDS.map((bg) => (
                        <button
                            key={bg.name}
                            onClick={() => copyClass(bg.name)}
                            className="w-full text-left"
                        >
                            <div className={`${bg.name} h-20 rounded-sm border border-n-1 bg-primary-3 p-2`}>
                                <span className="font-mono text-[10px]">.{bg.name}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </DocSection>
        </DocPage>
    )
}
