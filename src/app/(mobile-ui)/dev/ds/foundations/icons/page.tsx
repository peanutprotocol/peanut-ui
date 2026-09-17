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

            <DocSection title="Usage">
                <DocSection.Code>
                    <CodeBlock
                        label="Usage"
                        code={`import { Icon, type IconName } from '@/components/Global/Icons/Icon'\n<Icon name="check" size={20} />`}
                    />
                    <CodeBlock
                        label="Size Classes (tailwind)"
                        code={`.icon-16 .icon-18 .icon-20 .icon-22 .icon-24 .icon-28`}
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
                        code={`import { getFlagUrl } from '@/constants/countryCurrencyMapping'\n<img src={getFlagUrl(countryCode)} alt="flag" className="h-6 w-6 rounded-round object-cover" />`}
                    />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
