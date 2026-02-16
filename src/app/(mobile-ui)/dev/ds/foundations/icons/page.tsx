'use client'

import { useState } from 'react'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'

const ALL_ICONS: IconName[] = [
    'alert', 'alert-filled', 'arrow-down', 'arrow-down-left', 'arrow-up', 'arrow-up-right',
    'arrow-exchange', 'badge', 'bank', 'bell', 'bulb', 'camera', 'camera-flip', 'cancel',
    'check', 'check-circle', 'chevron-up', 'chevron-down', 'clip', 'clock', 'copy', 'currency',
    'docs', 'dollar', 'double-check', 'download', 'error', 'exchange', 'external-link',
    'eye', 'eye-slash', 'failed', 'fees', 'gift', 'globe-lock', 'history', 'home',
    'info', 'info-filled', 'invite-heart', 'link', 'link-slash', 'lock', 'logout', 'meter',
    'minus-circle', 'mobile-install', 'paperclip', 'paste', 'peanut-support', 'pending',
    'plus', 'plus-circle', 'processing', 'qr-code', 'question-mark', 'retry', 'search',
    'share', 'shield', 'smile', 'split', 'star', 'success', 'switch', 'trophy',
    'txn-off', 'upload-cloud', 'user', 'user-id', 'user-plus', 'wallet', 'wallet-cancel',
    'wallet-outline', 'achievements',
]

export default function IconsPage() {
    const [search, setSearch] = useState('')
    const [copiedIcon, setCopiedIcon] = useState<string | null>(null)

    const filtered = search
        ? ALL_ICONS.filter((name) => name.includes(search.toLowerCase()))
        : ALL_ICONS

    const copyIcon = (name: string) => {
        navigator.clipboard.writeText(name)
        setCopiedIcon(name)
        setTimeout(() => setCopiedIcon(null), 1500)
    }

    return (
        <DocPage>
            <DocHeader title={`Icons (${ALL_ICONS.length})`} description="Material design icons. Tap any icon to copy its name." />

            {/* Search */}
            <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search icons..."
                className="w-full rounded-sm border border-n-1 px-3 py-2 text-sm"
            />

            {/* Grid */}
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8">
                {filtered.map((name) => (
                    <button
                        key={name}
                        onClick={() => copyIcon(name)}
                        className={`flex flex-col items-center gap-0.5 rounded-sm border p-1.5 transition-colors ${
                            copiedIcon === name
                                ? 'border-success-3 bg-success-3/10'
                                : 'border-n-1/10 hover:border-n-1/40'
                        }`}
                    >
                        <Icon name={name} size={18} />
                        <span className="text-[7px] leading-tight text-grey-1">{name}</span>
                    </button>
                ))}
            </div>

            {filtered.length === 0 && (
                <p className="py-8 text-center text-sm text-grey-1">No icons match &quot;{search}&quot;</p>
            )}

            <DocSection title="Usage">
                <DocSection.Code>
                    <CodeBlock
                        label="Usage"
                        code={`import { Icon, type IconName } from '@/components/Global/Icons/Icon'\n<Icon name="check" size={20} />`}
                    />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
