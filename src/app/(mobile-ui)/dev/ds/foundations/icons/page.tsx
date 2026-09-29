'use client'

import { useState } from 'react'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { CodeBlock } from '../../_components/CodeBlock'
import { DesignNote } from '../../_components/DesignNote'

// design.md "icon sizing": three steps, bigger only for an empty/error hero
const SIZES: { size: string; use: string; inCards: string }[] = [
    {
        size: '16',
        use: 'Inline next to text: info hints, section titles, a status beside a label',
        inCards: 'A hint or status next to text inside the card',
    },
    {
        size: '20',
        use: 'Inside buttons and nav circles (40px circle + 20px icon)',
        inCards: 'The trailing chevron of a list item (ListItem chevron draws it)',
    },
    {
        size: '24',
        use: 'The default (no size prop): list-item leading, standalone icons',
        inCards: 'A bare list-item leading icon; the card header icon, inside an m IconBubble',
    },
    {
        size: '40+',
        use: 'Only a hero illustration on an empty or error state',
        inCards: 'Never inside a content card',
    },
]

const ALL_ICONS: IconName[] = [
    'alert',
    'alert-filled',
    'arrow-down',
    'arrow-down-left',
    'arrow-up',
    'arrow-up-right',
    'arrow-exchange',
    'badge',
    'bank',
    'bell',
    'bulb',
    'camera',
    'camera-flip',
    'cancel',
    'check',
    'check-circle',
    'chevron-up',
    'chevron-down',
    'clip',
    'clock',
    'copy',
    'currency',
    'dice',
    'docs',
    'dollar',
    'double-check',
    'download',
    'error',
    'exchange',
    'external-link',
    'eye',
    'eye-slash',
    'failed',
    'fees',
    'gift',
    'globe-lock',
    'history',
    'home',
    'info',
    'info-filled',
    'invite-heart',
    'link',
    'link-slash',
    'lock',
    'logout',
    'menu',
    'meter',
    'minus-circle',
    'mobile-install',
    'paperclip',
    'paste',
    'peanut-support',
    'pending',
    'plus',
    'plus-circle',
    'processing',
    'qr-code',
    'question-mark',
    'retry',
    'search',
    'share',
    'shield',
    'smile',
    'star',
    'success',
    'switch',
    'trophy',
    'txn-off',
    'upload-cloud',
    'user',
    'user-id',
    'user-plus',
    'users',
    'wallet',
    'wallet-cancel',
    'wallet-outline',
    'achievements',
]

export default function IconsPage() {
    const [search, setSearch] = useState('')
    const [copiedIcon, setCopiedIcon] = useState<string | null>(null)

    const filtered = search ? ALL_ICONS.filter((name) => name.includes(search.toLowerCase())) : ALL_ICONS

    const copyIcon = (name: string) => {
        navigator.clipboard.writeText(name)
        setCopiedIcon(name)
        setTimeout(() => setCopiedIcon(null), 1500)
    }

    return (
        <DocPage>
            <DocHeader
                title={`Icons (${ALL_ICONS.length})`}
                description="Material design icons. Tap any icon to copy its name."
            />

            {/* Search */}
            <BaseInput
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search icons..."
            />

            {/* Grid */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((name) => (
                    <ListItem
                        key={name}
                        onClick={() => copyIcon(name)}
                        leading={<IconBubble icon={name} size="s" color="gray" />}
                        title={name}
                        trailing={copiedIcon === name ? <Icon name="check" size={16} /> : undefined}
                    />
                ))}
            </div>

            {filtered.length === 0 && (
                <EmptyState icon="search" title="No matching icons" description={`No icons match “${search}”.`} />
            )}

            <DocSection
                title="Sizes"
                description="Three steps: 16, 20, 24. Always pass size={N}, never tailwind h-X w-X. A wrong-size icon in a button is a bug, not a taste choice."
            >
                <DocSection.Content>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-body-s">
                            <thead className="text-foreground-secondary">
                                <tr>
                                    <th className="py-2 pr-4">Size</th>
                                    <th className="py-2 pr-4">Use for</th>
                                    <th className="py-2">In a card</th>
                                </tr>
                            </thead>
                            <tbody>
                                {SIZES.map((row) => (
                                    <tr key={row.size} className="border-t border-border-default align-top">
                                        <td className="py-2 pr-4">
                                            <code>{row.size}</code>
                                        </td>
                                        <td className="py-2 pr-4">{row.use}</td>
                                        <td className="py-2">{row.inCards}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <DesignNote type="info">
                        Inside an IconBubble the bubble sets the glyph: xs and s draw 16, m draws 24, l draws 40. Pass
                        the bubble size, never an Icon size. A list item uses two sizes at once: 24 leading, 20 for the
                        trailing chevron.
                    </DesignNote>
                    <DesignNote type="warning">
                        18, 22 and 28 are off the scale. The .icon-16 to .icon-28 classes are legacy: globals.css
                        applies .icon-18 and .icon-16 only to old non-Icon SVGs inside .btn, and .icon-20, .icon-22,
                        .icon-24 and .icon-28 have no callers. Do not size an icon with a class.
                    </DesignNote>
                </DocSection.Content>
            </DocSection>

            <DocSection title="Usage">
                <DocSection.Code>
                    <CodeBlock
                        label="Usage"
                        code={`import { Icon, type IconName } from '@/components/Global/Icons/Icon'\n<Icon name="check" size={20} />`}
                    />
                </DocSection.Code>
            </DocSection>

            <DocSection title="Country Flags">
                <DocSection.Content>
                    <p className="text-body-xs text-foreground-secondary">
                        Countries are shown with circle-flags SVGs (copied to public/flags/ by scripts/copy-flags.mjs)
                        plus country data from AddMoney/consts.
                    </p>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="CountryList — searchable list with geolocation sorting"
                        code={`import { CountryList } from '@/components/Common/CountryList'`}
                    />
                    <CodeBlock
                        label="Flag URL pattern"
                        code={`import { getFlagUrl } from '@/constants/countryCurrencyMapping'\n<img src={getFlagUrl(countryCode)} alt="flag" className="h-6 w-6 rounded-full object-cover" />`}
                    />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
