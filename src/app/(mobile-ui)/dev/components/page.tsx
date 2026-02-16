'use client'

import { useState } from 'react'
import NavHeader from '@/components/Global/NavHeader'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import Divider from '@/components/0_Bruddle/Divider'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import GlobalCard from '@/components/Global/Card'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import BaseSelect from '@/components/0_Bruddle/BaseSelect'
import Checkbox from '@/components/0_Bruddle/Checkbox'
import CopyField from '@/components/Global/CopyField'
import Loading from '@/components/Global/Loading'
import PeanutLoading from '@/components/Global/PeanutLoading'
import ErrorAlert from '@/components/Global/ErrorAlert'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NoDataEmptyState from '@/components/Global/EmptyStates/NoDataEmptyState'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import StatusPill from '@/components/Global/StatusPill'
import { useToast } from '@/components/0_Bruddle/Toast'
import FlowHeader from '@/components/Global/FlowHeader'
import Modal from '@/components/Global/Modal'
import ActionModal from '@/components/Global/ActionModal'
import Title from '@/components/0_Bruddle/Title'
import CopyToClipboard from '@/components/Global/CopyToClipboard'
import AddressLink from '@/components/Global/AddressLink'
import MoreInfo from '@/components/Global/MoreInfo'
import { Section, PropTable, CopySnippet, StatusTag } from './showcase-utils'

const TOC: { id: string; label: string; icon: IconName }[] = [
    { id: 'guidelines', label: 'Guidelines', icon: 'docs' },
    { id: 'buttons', label: 'Buttons', icon: 'switch' },
    { id: 'cards', label: 'Cards', icon: 'docs' },
    { id: 'inputs', label: 'Inputs', icon: 'clip' },
    { id: 'feedback', label: 'Feedback', icon: 'meter' },
    { id: 'navigation', label: 'Navigation', icon: 'link' },
    { id: 'layouts', label: 'Layouts', icon: 'switch' },
    { id: 'patterns', label: 'Patterns', icon: 'bulb' },
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
    'split',
    'star',
    'success',
    'switch',
    'trophy',
    'txn-off',
    'upload-cloud',
    'user',
    'user-id',
    'user-plus',
    'wallet',
    'wallet-cancel',
    'wallet-outline',
    'achievements',
]

export default function ComponentsPage() {
    const [inputValue, setInputValue] = useState('')
    const [selectValue, setSelectValue] = useState('')
    const [checkboxValue, setCheckboxValue] = useState(false)
    const [showPeanutLoading, setShowPeanutLoading] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [showActionModal, setShowActionModal] = useState(false)
    const { success, error, info, warning } = useToast()

    return (
        <div className="flex w-full flex-col">
            <div className="px-4 pt-4">
                <NavHeader title="Components" href="/dev" />
            </div>

            {/* sticky TOC */}
            <div className="sticky top-0 z-10 border-b border-n-1 bg-background px-4 py-2">
                <div className="flex gap-1 overflow-x-auto">
                    {TOC.map((item) => (
                        <a
                            key={item.id}
                            href={`#${item.id}`}
                            className="flex shrink-0 items-center gap-1.5 rounded-sm border border-n-1/20 px-2.5 py-1.5 text-xs font-bold hover:border-n-1/40 hover:bg-primary-3/20"
                        >
                            <Icon name={item.icon} size={14} />
                            {item.label}
                        </a>
                    ))}
                </div>
            </div>

            <div className="space-y-8 px-4 py-6">
                {/* ━━━━━━━━━━━━━━━━━━ GUIDELINES ━━━━━━━━━━━━━━━━━━ */}
                <div id="guidelines" className="scroll-mt-16 space-y-4">
                    <h2 className="text-lg font-bold">Guidelines & Legend</h2>

                    {/* legend */}
                    <div className="rounded-sm border border-n-1 p-3">
                        <p className="text-xs font-bold">status tags</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            <div className="flex items-center gap-1.5">
                                <StatusTag status="production" />
                                <span className="text-[10px] text-grey-1">stable, widely used</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <StatusTag status="limited" />
                                <span className="text-[10px] text-grey-1">{'< 5 usages'}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <StatusTag status="unused" />
                                <span className="text-[10px] text-grey-1">0 production usages</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <StatusTag status="needs-refactor" />
                                <span className="text-[10px] text-grey-1">works but needs cleanup</span>
                            </div>
                        </div>
                    </div>

                    {/* design rules */}
                    <div className="space-y-3 rounded-sm border border-n-1 bg-primary-3/20 p-3 text-xs">
                        <p className="font-bold">design rules</p>
                        <div>
                            <p className="font-bold">buttons</p>
                            <ul className="mt-1 space-y-0.5 text-grey-1">
                                <li>
                                    primary CTA: variant=&quot;purple&quot; shadowSize=&quot;4&quot; w-full — NO size
                                    prop
                                </li>
                                <li>secondary CTA: variant=&quot;stroke&quot; w-full</li>
                                <li>
                                    default h-13 is tallest. size=&quot;large&quot; is h-10 — never for primary CTAs
                                </li>
                            </ul>
                        </div>
                        <div>
                            <p className="font-bold">text & links</p>
                            <ul className="mt-1 space-y-0.5 text-grey-1">
                                <li>primary text: text-n-1 | secondary: text-grey-1</li>
                                <li>inline links: text-black underline — never text-purple-1</li>
                            </ul>
                        </div>
                        <div>
                            <p className="font-bold">containers</p>
                            <ul className="mt-1 space-y-0.5 text-grey-1">
                                <li>
                                    standalone: Bruddle Card (named export) | stacked lists: Global Card (default
                                    export)
                                </li>
                                <li>shadows: always black #000 | border radius: always rounded-sm</li>
                            </ul>
                        </div>
                        <div>
                            <p className="font-bold">modals</p>
                            <ul className="mt-1 space-y-0.5 text-grey-1">
                                <li>
                                    informational: Modal | user action/confirmation: ActionModal | mobile interaction:
                                    Drawer
                                </li>
                            </ul>
                        </div>
                        <div>
                            <p className="font-bold">loading</p>
                            <ul className="mt-1 space-y-0.5 text-grey-1">
                                <li>
                                    inline spinner: Loading | page-level branded: PeanutLoading | with entertainment:
                                    PeanutFactsLoading
                                </li>
                            </ul>
                        </div>
                        <div>
                            <p className="font-bold">messaging</p>
                            <ul className="mt-1 space-y-0.5 text-grey-1">
                                <li>
                                    card deposits: &quot;starter balance&quot; — never &quot;card balance&quot; or
                                    &quot;Peanut rewards&quot;
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* three-tier architecture */}
                    <div className="rounded-sm border border-n-1 p-3 text-xs">
                        <p className="font-bold">architecture (three tiers)</p>
                        <div className="mt-2 space-y-1.5 text-grey-1">
                            <p>
                                <span className="font-bold text-n-1">Bruddle primitives</span> —
                                src/components/0_Bruddle/ — Button, Card, BaseInput, BaseSelect, Checkbox, Divider,
                                Title, Toast
                            </p>
                            <p>
                                <span className="font-bold text-n-1">Global shared</span> — src/components/Global/ —
                                NavHeader, FlowHeader, Modal, ActionModal, Drawer, Loading, PeanutLoading, StatusBadge,
                                EmptyState, CopyField, Icon, AddressLink, MoreInfo, etc.
                            </p>
                            <p>
                                <span className="font-bold text-n-1">Tailwind classes</span> — .row, .col, .shadow-2,
                                .shadow-4, .label-*, .brutal-border, .bg-peanut-repeat-*
                            </p>
                        </div>
                    </div>
                </div>

                <Divider />

                {/* ━━━━━━━━━━━━━━━━━━ BUTTONS ━━━━━━━━━━━━━━━━━━ */}
                <div id="buttons" className="scroll-mt-16 space-y-6">
                    <Section
                        title="Button"
                        importPath={`import { Button } from '@/components/0_Bruddle/Button'`}
                        status="production"
                        quality={4}
                        usages={120}
                    >
                        <PropTable
                            rows={[
                                [
                                    'variant',
                                    'purple | stroke | primary-soft | transparent | dark | transparent-dark | transparent-light',
                                    'purple',
                                ],
                                ['size', 'small | medium | large', '(none = h-13)'],
                                ['shadowSize', '3 | 4 | 6 | 8', '(none)'],
                                ['icon', 'IconName | ReactNode', '(none)'],
                                ['iconPosition', 'left | right', 'left'],
                                ['loading', 'boolean', 'false'],
                                ['longPress', '{ duration, onLongPress }', '(none)'],
                            ]}
                        />

                        <div className="rounded-sm bg-yellow-1/30 p-2 text-xs font-bold">
                            size=&quot;large&quot; is h-10 (SHORTER than default h-13). default = tallest button.
                            primary CTAs should use NO size prop.
                        </div>
                    </Section>

                    <Section title="Variants">
                        <div className="space-y-3">
                            {(
                                [
                                    ['purple', '59 usages', 'production'],
                                    ['stroke', '27 usages', 'production'],
                                    ['primary-soft', '18 usages', 'production'],
                                    ['transparent', '12 usages', 'production'],
                                    ['dark', '2 usages', 'limited'],
                                    ['transparent-dark', '3 usages', 'limited'],
                                ] as const
                            ).map(([variant, count, status]) => (
                                <div key={variant}>
                                    <div className="mb-1 flex items-center gap-2">
                                        <span className="text-xs font-bold">{variant}</span>
                                        <span className="text-[10px] text-grey-1">{count}</span>
                                        <StatusTag status={status} />
                                    </div>
                                    <Button variant={variant}>{variant}</Button>
                                    <CopySnippet code={`<Button variant="${variant}">Label</Button>`} />
                                </div>
                            ))}

                            <div>
                                <div className="mb-1 flex items-center gap-2">
                                    <span className="text-xs font-bold">transparent-light</span>
                                    <span className="text-[10px] text-grey-1">2 usages</span>
                                    <StatusTag status="limited" />
                                </div>
                                <div className="rounded-sm bg-n-1 p-2">
                                    <Button variant="transparent-light">transparent-light</Button>
                                </div>
                                <CopySnippet code={`<Button variant="transparent-light">Label</Button>`} />
                            </div>

                        </div>
                    </Section>

                    <Section title="Sizes">
                        <div className="flex flex-wrap items-end gap-2">
                            <div className="text-center">
                                <Button variant="stroke">default</Button>
                                <p className="mt-1 text-[10px] text-grey-1">h-13 (52px)</p>
                            </div>
                            <div className="text-center">
                                <Button variant="stroke" size="small">
                                    small
                                </Button>
                                <p className="mt-1 text-[10px] text-grey-1">h-8 · 29 usages</p>
                            </div>
                            <div className="text-center">
                                <Button variant="stroke" size="medium">
                                    medium
                                </Button>
                                <p className="mt-1 text-[10px] text-grey-1">h-9 · 10 usages</p>
                            </div>
                            <div className="text-center">
                                <Button variant="stroke" size="large">
                                    large
                                </Button>
                                <p className="mt-1 text-[10px] text-grey-1">h-10 · 5 usages</p>
                            </div>
                        </div>
                    </Section>

                    <Section title="Shadows">
                        <p className="text-xs text-grey-1">
                            shadowSize=&quot;4&quot; has 160 usages. everything else is negligible.
                        </p>
                        <div className="flex flex-wrap gap-4">
                            {(['3', '4', '6', '8'] as const).map((s) => (
                                <div key={s} className="text-center">
                                    <Button variant="purple" shadowSize={s}>
                                        shadow {s}
                                    </Button>
                                    <p className="mt-1 text-[10px] text-grey-1">
                                        {s === '4' ? '160 usages' : s === '8' ? '1 usage' : '0 usages'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </Section>

                    <Section title="Canonical Patterns">
                        <p className="text-xs font-bold">primary CTA (most common pattern)</p>
                        <Button variant="purple" shadowSize="4" className="w-full">
                            Continue
                        </Button>
                        <CopySnippet
                            code={`<Button variant="purple" shadowSize="4" className="w-full">Continue</Button>`}
                        />

                        <p className="mt-4 text-xs font-bold">secondary CTA</p>
                        <Button variant="stroke" className="w-full">
                            Go Back
                        </Button>
                        <CopySnippet code={`<Button variant="stroke" className="w-full">Go Back</Button>`} />

                        <p className="mt-4 text-xs font-bold">with icon</p>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="purple" icon="share">
                                Share
                            </Button>
                            <Button variant="stroke" icon="copy">
                                Copy
                            </Button>
                        </div>
                        <CopySnippet code={`<Button variant="purple" icon="share">Share</Button>`} />

                        <p className="mt-4 text-xs font-bold">states</p>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="purple" disabled>
                                Disabled
                            </Button>
                            <Button variant="purple" loading>
                                Loading
                            </Button>
                        </div>
                    </Section>
                </div>

                <Divider />

                {/* ━━━━━━━━━━━━━━━━━━ CARDS ━━━━━━━━━━━━━━━━━━ */}
                <div id="cards" className="scroll-mt-16 space-y-6">
                    <Section
                        title="Bruddle Card"
                        importPath={`import { Card } from '@/components/0_Bruddle/Card'`}
                        status="production"
                        quality={4}
                    >
                        <p className="text-xs text-grey-1">standalone containers with optional shadow. named export.</p>
                        <PropTable
                            rows={[
                                ['shadowSize', '4 | 6 | 8', '(none)'],
                                ['color', 'primary | secondary', 'primary'],
                            ]}
                        />

                        <Card className="p-4">
                            <p className="text-sm">no shadow</p>
                        </Card>
                        <CopySnippet code={`<Card className="p-4">content</Card>`} />

                        <Card shadowSize="4" className="p-4">
                            <p className="text-sm">shadowSize=&quot;4&quot;</p>
                        </Card>
                        <CopySnippet code={`<Card shadowSize="4" className="p-4">content</Card>`} />

                        <Card shadowSize="6" className="p-4">
                            <p className="text-sm">shadowSize=&quot;6&quot;</p>
                        </Card>
                        <Card shadowSize="8" className="p-4">
                            <p className="text-sm">shadowSize=&quot;8&quot;</p>
                        </Card>

                        <p className="mt-2 text-xs font-bold">with sub-components</p>
                        <Card shadowSize="4" className="p-4">
                            <Card.Header>
                                <Card.Title>Card Title</Card.Title>
                                <Card.Description>description text</Card.Description>
                            </Card.Header>
                            <Card.Content>
                                <p className="text-sm">body content</p>
                            </Card.Content>
                        </Card>
                        <CopySnippet
                            code={`<Card shadowSize="4" className="p-4">
  <Card.Header>
    <Card.Title>Title</Card.Title>
    <Card.Description>Description</Card.Description>
  </Card.Header>
  <Card.Content>Content</Card.Content>
</Card>`}
                        />
                    </Section>

                    <Section
                        title="Global Card (Stacked Lists)"
                        importPath={`import Card from '@/components/Global/Card'`}
                        status="production"
                        quality={4}
                    >
                        <p className="text-xs text-grey-1">
                            for stacked list items with position-aware borders. default export. heavily used across the
                            app.
                        </p>
                        <PropTable
                            rows={[
                                ['position', 'single | first | middle | last', 'single'],
                                ['border', 'boolean', 'true'],
                                ['onClick', '() => void', '(none)'],
                            ]}
                        />

                        <GlobalCard position="single" className="py-3">
                            <p className="text-sm">position=&quot;single&quot;</p>
                        </GlobalCard>
                        <CopySnippet code={`<Card position="single" className="py-3">content</Card>`} />

                        <p className="mt-2 text-xs font-bold">stacked list</p>
                        <div className="space-y-0">
                            <GlobalCard position="first" className="py-3">
                                <p className="text-sm">position=&quot;first&quot;</p>
                            </GlobalCard>
                            <GlobalCard position="middle" className="py-3">
                                <p className="text-sm">position=&quot;middle&quot;</p>
                            </GlobalCard>
                            <GlobalCard position="middle" className="py-3">
                                <p className="text-sm">position=&quot;middle&quot;</p>
                            </GlobalCard>
                            <GlobalCard position="last" className="py-3">
                                <p className="text-sm">position=&quot;last&quot;</p>
                            </GlobalCard>
                        </div>
                        <CopySnippet
                            code={`<div className="space-y-0">
  <Card position="first" className="py-3">First</Card>
  <Card position="middle" className="py-3">Middle</Card>
  <Card position="last" className="py-3">Last</Card>
</div>`}
                        />

                        <p className="mt-2 text-xs font-bold">no border</p>
                        <GlobalCard border={false} className="bg-primary-3/20 py-3">
                            <p className="text-sm">border=false</p>
                        </GlobalCard>
                    </Section>
                </div>

                <Divider />

                {/* ━━━━━━━━━━━━━━━━━━ INPUTS ━━━━━━━━━━━━━━━━━━ */}
                <div id="inputs" className="scroll-mt-16 space-y-6">
                    <Section
                        title="BaseInput"
                        importPath={`import BaseInput from '@/components/0_Bruddle/BaseInput'`}
                        status="production"
                        quality={3}
                    >
                        <PropTable
                            rows={[
                                ['variant', 'sm | md | lg', 'md'],
                                ['rightContent', 'ReactNode', '(none)'],
                            ]}
                        />
                        <BaseInput
                            placeholder="default (md)"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                        />
                        <CopySnippet
                            code={`<BaseInput placeholder="Amount" value={value} onChange={(e) => setValue(e.target.value)} />`}
                        />
                        <BaseInput variant="sm" placeholder="small (sm)" />
                        <BaseInput variant="lg" placeholder="large (lg)" />
                        <BaseInput
                            placeholder="with right content"
                            rightContent={<span className="text-sm text-grey-1">USD</span>}
                        />
                    </Section>

                    <Section
                        title="BaseSelect"
                        importPath={`import BaseSelect from '@/components/0_Bruddle/BaseSelect'`}
                        status="production"
                        quality={4}
                    >
                        <PropTable
                            rows={[
                                ['options', 'Array<{label, value}>', '(required)'],
                                ['placeholder', 'string', 'Select...'],
                                ['value', 'string', '(none)'],
                                ['onValueChange', '(value: string) => void', '(none)'],
                                ['disabled', 'boolean', 'false'],
                                ['error', 'boolean', 'false'],
                            ]}
                        />
                        <BaseSelect
                            options={[
                                { label: 'Option 1', value: '1' },
                                { label: 'Option 2', value: '2' },
                                { label: 'Option 3', value: '3' },
                            ]}
                            placeholder="Select an option"
                            value={selectValue}
                            onValueChange={setSelectValue}
                        />
                        <CopySnippet
                            code={`<BaseSelect options={[{ label: 'Option 1', value: '1' }]} value={value} onValueChange={setValue} />`}
                        />
                        <div className="flex gap-2">
                            <BaseSelect options={[{ label: 'Disabled', value: 'd' }]} placeholder="disabled" disabled />
                            <BaseSelect options={[{ label: 'Error', value: 'e' }]} placeholder="error" error />
                        </div>
                    </Section>

                    <Section
                        title="Checkbox"
                        importPath={`import Checkbox from '@/components/0_Bruddle/Checkbox'`}
                        status="production"
                        quality={3}
                    >
                        <Checkbox
                            label="I agree to the terms"
                            value={checkboxValue}
                            onChange={(e) => setCheckboxValue(e.target.checked)}
                        />
                        <CopySnippet
                            code={`<Checkbox label="I agree" value={checked} onChange={(e) => setChecked(e.target.checked)} />`}
                        />
                    </Section>

                    <Section
                        title="CopyField"
                        importPath={`import CopyField from '@/components/Global/CopyField'`}
                        status="production"
                        quality={4}
                    >
                        <p className="text-xs text-grey-1">
                            input + copy button combo. used for addresses, codes, links.
                        </p>
                        <CopyField text="0x1234...abcd" />
                        <CopySnippet code={`<CopyField text="0x1234...abcd" />`} />
                        <CopyField text="peanut.me/invite/abc123" shadowSize="4" />
                    </Section>

                    <Section title="Other Input Components (reference)">
                        <div className="space-y-2 rounded-sm border border-n-1 p-3 text-xs">
                            <p>
                                <span className="font-bold">ValidatedInput</span> — async validation with debounce,
                                loading state, check/error icons. used in setup flows.
                            </p>
                            <CopySnippet code={`import ValidatedInput from '@/components/Global/ValidatedInput'`} />
                            <p className="mt-2">
                                <span className="font-bold">AmountInput</span> — large currency input with conversion,
                                slider, balance display. used in payment flows.
                            </p>
                            <CopySnippet code={`import AmountInput from '@/components/Global/AmountInput'`} />
                            <p className="mt-2">
                                <span className="font-bold">GeneralRecipientInput</span> — multi-type recipient input
                                (address, username, etc).
                            </p>
                            <CopySnippet
                                code={`import GeneralRecipientInput from '@/components/Global/GeneralRecipientInput'`}
                            />
                            <p className="mt-2">
                                <span className="font-bold">FileUploadInput</span> — file upload with drag-and-drop.
                            </p>
                            <CopySnippet code={`import FileUploadInput from '@/components/Global/FileUploadInput'`} />
                        </div>
                    </Section>
                </div>

                <Divider />

                {/* ━━━━━━━━━━━━━━━━━━ FEEDBACK ━━━━━━━━━━━━━━━━━━ */}
                <div id="feedback" className="scroll-mt-16 space-y-6">
                    <Section
                        title="Loading (Spinner)"
                        importPath={`import Loading from '@/components/Global/Loading'`}
                        status="production"
                        quality={5}
                    >
                        <p className="text-xs text-grey-1">
                            simple css spinner. default h-4 w-4. clean, minimal, no deps.
                        </p>
                        <div className="flex items-center gap-6">
                            {['h-4 w-4', 'h-8 w-8', 'h-12 w-12'].map((size) => (
                                <div key={size} className="flex flex-col items-center gap-1">
                                    <Loading className={size} />
                                    <span className="text-[10px] text-grey-1">{size}</span>
                                </div>
                            ))}
                        </div>
                        <CopySnippet code={`<Loading className="h-8 w-8" />`} />
                    </Section>

                    <Section
                        title="PeanutLoading"
                        importPath={`import PeanutLoading from '@/components/Global/PeanutLoading'`}
                        status="production"
                        quality={4}
                    >
                        <p className="text-xs text-grey-1">
                            branded loading with animated peanutman logo. optional fullscreen overlay and message.
                        </p>
                        <PropTable
                            rows={[
                                ['coverFullScreen', 'boolean', 'false'],
                                ['message', 'string', '(none)'],
                            ]}
                        />
                        <PeanutLoading message="loading your data..." />
                        <CopySnippet code={`<PeanutLoading message="loading..." />`} />
                        {showPeanutLoading && <PeanutLoading coverFullScreen />}
                        <Button
                            variant="stroke"
                            size="small"
                            onClick={() => {
                                setShowPeanutLoading(true)
                                setTimeout(() => setShowPeanutLoading(false), 2000)
                            }}
                        >
                            test fullscreen (2s)
                        </Button>
                    </Section>

                    <Section
                        title="Toast"
                        importPath={`import { useToast } from '@/components/0_Bruddle/Toast'`}
                        status="production"
                        quality={5}
                    >
                        <p className="text-xs text-grey-1">
                            context-based toast system. 4 types. auto-dismiss. clean API.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="stroke" size="small" onClick={() => success('Operation successful!')}>
                                success
                            </Button>
                            <Button variant="stroke" size="small" onClick={() => error('Something went wrong')}>
                                error
                            </Button>
                            <Button variant="stroke" size="small" onClick={() => info('Did you know?')}>
                                info
                            </Button>
                            <Button variant="stroke" size="small" onClick={() => warning('Check this out')}>
                                warning
                            </Button>
                        </div>
                        <CopySnippet
                            code={`const { success, error, info, warning } = useToast()\nsuccess('Done!')\nerror('Failed!')`}
                        />
                    </Section>

                    <Section
                        title="StatusBadge"
                        importPath={`import StatusBadge from '@/components/Global/Badges/StatusBadge'`}
                        status="production"
                        quality={4}
                    >
                        <p className="text-xs text-grey-1">
                            color-coded text badge. 9 status types. 3 sizes. well-structured.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {(
                                [
                                    'completed',
                                    'pending',
                                    'processing',
                                    'failed',
                                    'cancelled',
                                    'refunded',
                                    'soon',
                                    'closed',
                                ] as const
                            ).map((s) => (
                                <StatusBadge key={s} status={s} />
                            ))}
                        </div>
                        <CopySnippet code={`<StatusBadge status="completed" />`} />
                        <p className="text-xs font-bold">sizes</p>
                        <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status="completed" size="small" />
                            <StatusBadge status="completed" size="medium" />
                            <StatusBadge status="completed" size="large" />
                        </div>
                    </Section>

                    <Section
                        title="StatusPill"
                        importPath={`import StatusPill from '@/components/Global/StatusPill'`}
                        status="production"
                        quality={4}
                    >
                        <p className="text-xs text-grey-1">
                            compact circular icon indicator. smaller than StatusBadge.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            {(
                                [
                                    'completed',
                                    'pending',
                                    'processing',
                                    'failed',
                                    'cancelled',
                                    'refunded',
                                    'soon',
                                    'closed',
                                ] as const
                            ).map((s) => (
                                <div key={s} className="flex flex-col items-center gap-1">
                                    <StatusPill status={s} />
                                    <span className="text-[9px] text-grey-1">{s}</span>
                                </div>
                            ))}
                        </div>
                        <CopySnippet code={`<StatusPill status="completed" />`} />
                    </Section>

                    <Section
                        title="ErrorAlert"
                        importPath={`import ErrorAlert from '@/components/Global/ErrorAlert'`}
                        status="production"
                        quality={3}
                    >
                        <p className="text-xs text-grey-1">inline error message display. simple, clean.</p>
                        <ErrorAlert description="something went wrong. please try again." />
                        <CopySnippet code={`<ErrorAlert description="Something went wrong" />`} />
                    </Section>

                    <Section
                        title="EmptyState"
                        importPath={`import EmptyState from '@/components/Global/EmptyStates/EmptyState'`}
                        status="production"
                        quality={4}
                    >
                        <p className="text-xs text-grey-1">
                            structured empty state with icon, title, description, optional CTA.
                        </p>
                        <EmptyState icon="search" title="No results found" description="try a different search term" />
                        <CopySnippet code={`<EmptyState icon="search" title="No results" description="Try again" />`} />
                    </Section>

                    <Section
                        title="NoDataEmptyState"
                        importPath={`import NoDataEmptyState from '@/components/Global/EmptyStates/NoDataEmptyState'`}
                        status="production"
                        quality={3}
                    >
                        <p className="text-xs text-grey-1">branded empty state with crying peanutman animation.</p>
                        <NoDataEmptyState message="nothing here yet" animSize="sm" />
                        <CopySnippet code={`<NoDataEmptyState message="Nothing here yet" animSize="sm" />`} />
                    </Section>
                </div>

                <Divider />

                {/* ━━━━━━━━━━━━━━━━━━ NAVIGATION ━━━━━━━━━━━━━━━━━━ */}
                <div id="navigation" className="scroll-mt-16 space-y-6">
                    <Section
                        title="NavHeader"
                        importPath={`import NavHeader from '@/components/Global/NavHeader'`}
                        status="production"
                        quality={4}
                    >
                        <p className="text-xs text-grey-1">
                            primary navigation header. used on nearly every mobile screen.
                        </p>
                        <PropTable
                            rows={[
                                ['title', 'string', '(none)'],
                                ['href', 'string', '/home'],
                                ['onPrev', '() => void', '(none)'],
                                ['icon', 'IconName', 'chevron-up'],
                                ['disableBackBtn', 'boolean', 'false'],
                                ['showLogoutBtn', 'boolean', 'false'],
                            ]}
                        />
                        <div className="space-y-2 rounded-sm border border-n-1 p-2">
                            <NavHeader title="Page Title" onPrev={() => {}} />
                        </div>
                        <CopySnippet code={`<NavHeader title="Page Title" onPrev={() => router.back()} />`} />
                        <div className="space-y-2 rounded-sm border border-n-1 p-2">
                            <NavHeader title="With Logout" onPrev={() => {}} showLogoutBtn />
                        </div>
                    </Section>

                    <Section
                        title="FlowHeader"
                        importPath={`import FlowHeader from '@/components/Global/FlowHeader'`}
                        status="production"
                        quality={4}
                    >
                        <p className="text-xs text-grey-1">
                            minimal header for multi-step flows. back button + optional right element.
                        </p>
                        <div className="rounded-sm border border-n-1 p-2">
                            <FlowHeader
                                onPrev={() => {}}
                                rightElement={<span className="text-sm text-grey-1">Step 2/3</span>}
                            />
                        </div>
                        <CopySnippet code={`<FlowHeader onPrev={handleBack} rightElement={<span>Step 2/3</span>} />`} />
                    </Section>

                    <Section
                        title="Modal"
                        importPath={`import Modal from '@/components/Global/Modal'`}
                        status="production"
                        quality={4}
                    >
                        <p className="text-xs text-grey-1">
                            base dialog wrapper using @headlessui. backdrop, transitions, close button.
                        </p>
                        <Button variant="stroke" size="small" onClick={() => setShowModal(true)}>
                            open modal
                        </Button>
                        <CopySnippet
                            code={`<Modal visible={show} onClose={() => setShow(false)} title="Modal Title">
  <p>Content here</p>
</Modal>`}
                        />
                        <Modal visible={showModal} onClose={() => setShowModal(false)} title="Example Modal">
                            <p className="text-sm text-grey-1">
                                base modal component. has backdrop overlay, animated transitions, and close button.
                            </p>
                        </Modal>
                    </Section>

                    <Section
                        title="ActionModal"
                        importPath={`import ActionModal from '@/components/Global/ActionModal'`}
                        status="production"
                        quality={5}
                    >
                        <p className="text-xs text-grey-1">
                            enhanced modal with structured layout: icon + title + description + buttons + optional
                            checkbox.
                        </p>
                        <Button variant="stroke" size="small" onClick={() => setShowActionModal(true)}>
                            open action modal
                        </Button>
                        <CopySnippet
                            code={`<ActionModal
  visible={show}
  onClose={() => setShow(false)}
  title="Confirm Action"
  description="Are you sure?"
  icon="alert"
  ctas={[
    { text: 'Confirm', variant: 'purple', onClick: handleConfirm },
    { text: 'Cancel', variant: 'stroke', onClick: () => setShow(false) },
  ]}
/>`}
                        />
                        <ActionModal
                            visible={showActionModal}
                            onClose={() => setShowActionModal(false)}
                            title="Confirm Action"
                            description="are you sure you want to proceed?"
                            icon="alert"
                            ctas={[
                                {
                                    text: 'Confirm',
                                    variant: 'purple' as const,
                                    onClick: () => setShowActionModal(false),
                                },
                                {
                                    text: 'Cancel',
                                    variant: 'stroke' as const,
                                    onClick: () => setShowActionModal(false),
                                },
                            ]}
                        />
                    </Section>

                    <Section
                        title="Drawer (Bottom Sheet)"
                        importPath={`import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from '@/components/Global/Drawer'`}
                        status="production"
                        quality={5}
                    >
                        <p className="text-xs text-grey-1">
                            vaul-based bottom drawer. compound component API. mobile-optimized with snap points.
                        </p>
                        <CopySnippet
                            code={`<Drawer>
  <DrawerTrigger asChild>
    <Button>Open</Button>
  </DrawerTrigger>
  <DrawerContent>
    <DrawerTitle>Title</DrawerTitle>
    <p>Content</p>
  </DrawerContent>
</Drawer>`}
                        />
                    </Section>

                    <Section title="All Modal Types (reference)">
                        <div className="space-y-1 rounded-sm border border-n-1 p-3 text-xs text-grey-1">
                            <p>
                                <span className="font-bold text-n-1">Modal</span> — base dialog (informational content)
                            </p>
                            <p>
                                <span className="font-bold text-n-1">ActionModal</span> — structured
                                confirmations/actions
                            </p>
                            <p>
                                <span className="font-bold text-n-1">Drawer</span> — bottom sheet (mobile-first
                                interactions)
                            </p>
                            <p>
                                <span className="font-bold text-n-1">InviteFriendsModal</span> — referral sharing
                            </p>
                            <p>
                                <span className="font-bold text-n-1">ConfirmInviteModal</span> — invite confirmation
                            </p>
                            <p>
                                <span className="font-bold text-n-1">GuestLoginModal</span> — guest auth flow
                            </p>
                            <p>
                                <span className="font-bold text-n-1">KycVerifiedOrReviewModal</span> — KYC status
                            </p>
                            <p>
                                <span className="font-bold text-n-1">BalanceWarningModal</span> — low balance warning
                            </p>
                            <p>
                                <span className="font-bold text-n-1">TokenAndNetworkConfirmationModal</span> — tx
                                confirmation
                            </p>
                        </div>
                    </Section>
                </div>

                <Divider />

                {/* ━━━━━━━━━━━━━━━━━━ LAYOUTS ━━━━━━━━━━━━━━━━━━ */}
                <div id="layouts" className="scroll-mt-16 space-y-6">
                    <Section title="Page Layout Recipes">
                        <p className="text-xs text-grey-1">
                            all mobile screens use <span className="font-mono">min-h-[inherit]</span> from the app
                            shell. these are the standard patterns for arranging NavHeader + content + CTA.
                        </p>

                        <div className="rounded-sm bg-yellow-1/30 p-2 text-xs font-bold">
                            CTA buttons always go INSIDE the my-auto wrapper so they center as a group with the content.
                            never leave CTA as a sibling of the content div.
                        </div>
                    </Section>

                    <Section title="Centered Content + CTA (default)">
                        <p className="text-xs text-grey-1">
                            most common layout. content + CTA grouped and vertically centered. used in card flow,
                            confirmation screens, empty states.
                        </p>

                        {/* live demo */}
                        <div className="flex h-72 flex-col gap-8 rounded-sm border border-n-1 bg-primary-3/10 p-4">
                            <div className="h-6 w-24 rounded-sm bg-n-1/10" />
                            <div className="my-auto flex flex-col gap-4">
                                <div className="flex flex-col items-center gap-2 rounded-sm border border-dashed border-n-1/30 p-4">
                                    <div className="size-10 rounded-full bg-purple-1/40" />
                                    <div className="h-3 w-32 rounded-sm bg-n-1/20" />
                                    <div className="h-2 w-48 rounded-sm bg-n-1/10" />
                                </div>
                                <div className="h-10 w-full rounded-sm bg-purple-1/60" />
                            </div>
                        </div>

                        <CopySnippet
                            code={`<div className="flex min-h-[inherit] flex-col gap-8">
  <NavHeader title="Title" onPrev={onBack} />
  <div className="my-auto flex flex-col gap-6">
    {/* content */}
    <Card className="p-6">...</Card>
    {/* CTA — inside my-auto wrapper */}
    <Button variant="purple" shadowSize="4" className="w-full">
      Continue
    </Button>
  </div>
</div>`}
                        />
                    </Section>

                    <Section title="Pinned Footer CTA">
                        <p className="text-xs text-grey-1">
                            CTA pinned to bottom, content centered above. used for success screens, landing pages where
                            CTA should always be visible.
                        </p>

                        {/* live demo */}
                        <div className="flex h-72 flex-col justify-between gap-8 rounded-sm border border-n-1 bg-primary-3/10 p-4">
                            <div className="h-6 w-24 rounded-sm bg-n-1/10" />
                            <div className="flex flex-col items-center gap-2">
                                <div className="size-10 rounded-full bg-green-1/40" />
                                <div className="h-3 w-32 rounded-sm bg-n-1/20" />
                                <div className="h-2 w-48 rounded-sm bg-n-1/10" />
                            </div>
                            <div className="h-10 w-full rounded-sm bg-purple-1/60" />
                        </div>

                        <CopySnippet
                            code={`<div className="flex min-h-[inherit] flex-col justify-between gap-8">
  <NavHeader title="Title" onPrev={onBack} />
  <div className="my-auto flex flex-col items-center gap-4">
    {/* content centers itself */}
  </div>
  {/* CTA pinned to bottom via justify-between */}
  <Button variant="purple" shadowSize="4" className="w-full">
    Done
  </Button>
</div>`}
                        />
                    </Section>

                    <Section title="Scrollable List">
                        <p className="text-xs text-grey-1">
                            for long lists. CTA at bottom after content, no forced centering. used in history, settings,
                            transaction lists.
                        </p>

                        {/* live demo */}
                        <div className="flex h-72 flex-col gap-4 overflow-hidden rounded-sm border border-n-1 bg-primary-3/10 p-4">
                            <div className="h-6 w-24 rounded-sm bg-n-1/10" />
                            <div className="flex flex-col gap-2 overflow-y-auto">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div key={i} className="h-12 shrink-0 rounded-sm border border-n-1/20 bg-white p-2">
                                        <div className="h-2 w-24 rounded-sm bg-n-1/10" />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <CopySnippet
                            code={`<div className="flex min-h-[inherit] flex-col gap-4">
  <NavHeader title="Title" onPrev={onBack} />
  <div className="flex flex-col gap-3">
    {items.map(item => <Card key={item.id}>...</Card>)}
  </div>
</div>`}
                        />
                    </Section>

                    <Section title="Common Mistakes">
                        <div className="space-y-2 text-xs">
                            <div className="flex items-start gap-2 rounded-sm border border-error-1/40 bg-error-1/10 p-2">
                                <Icon name="cancel" size={14} className="mt-0.5 shrink-0 text-error-1" />
                                <div>
                                    <p className="font-bold">CTA as sibling of my-auto div</p>
                                    <p className="text-grey-1">
                                        button gets pushed to bottom by gap, not grouped with content
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2 rounded-sm border border-error-1/40 bg-error-1/10 p-2">
                                <Icon name="cancel" size={14} className="mt-0.5 shrink-0 text-error-1" />
                                <div>
                                    <p className="font-bold">justify-between when you want grouped centering</p>
                                    <p className="text-grey-1">
                                        pins CTA to bottom instead of keeping it close to content
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2 rounded-sm border border-error-1/40 bg-error-1/10 p-2">
                                <Icon name="cancel" size={14} className="mt-0.5 shrink-0 text-error-1" />
                                <div>
                                    <p className="font-bold">using space-y-8 on outer div</p>
                                    <p className="text-grey-1">conflicts with flex centering. use gap-8 instead</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2 rounded-sm border border-success-1/40 bg-success-1/10 p-2">
                                <Icon name="check" size={14} className="mt-0.5 shrink-0 text-success-3" />
                                <div>
                                    <p className="font-bold">CTA inside my-auto wrapper</p>
                                    <p className="text-grey-1">content + CTA center as one unit</p>
                                </div>
                            </div>
                        </div>
                    </Section>
                </div>

                <Divider />

                {/* ━━━━━━━━━━━━━━━━━━ PATTERNS ━━━━━━━━━━━━━━━━━━ */}
                <div id="patterns" className="scroll-mt-16 space-y-6">
                    <Section
                        title={`Icon System (${ALL_ICONS.length} icons)`}
                        importPath={`import { Icon, type IconName } from '@/components/Global/Icons/Icon'`}
                        status="production"
                        quality={4}
                    >
                        <p className="text-xs text-grey-1">material design icons. tap any icon name to copy.</p>
                        <div className="grid grid-cols-5 gap-1.5">
                            {ALL_ICONS.map((name) => (
                                <button
                                    key={name}
                                    onClick={() => navigator.clipboard.writeText(name)}
                                    className="flex flex-col items-center gap-0.5 rounded-sm border border-n-1/10 p-1.5 hover:border-n-1/40"
                                >
                                    <Icon name={name} size={18} />
                                    <span className="text-[7px] leading-tight text-grey-1">{name}</span>
                                </button>
                            ))}
                        </div>
                        <CopySnippet code={`<Icon name="check" size={20} />`} />
                    </Section>

                    <Section title="Color Tokens">
                        <p className="text-xs text-grey-1">
                            from tailwind.config.js — names can be misleading. tap to copy class name.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                ['purple-1', 'bg-purple-1', '#FF90E8', 'pink!'],
                                ['primary-3', 'bg-primary-3', '#EFE4FF', 'lavender'],
                                ['primary-4', 'bg-primary-4', '#D8C4F6', 'deeper lavender'],
                                ['yellow-1', 'bg-yellow-1', '#FFC900', 'peanut yellow'],
                                ['green-1', 'bg-green-1', '#98E9AB', 'success green'],
                                ['n-1', 'bg-n-1', '#000000', 'black'],
                                ['grey-1', 'bg-grey-1', '#6B6B6B', 'secondary text'],
                                ['teal-1', 'bg-teal-1', '#C3F5E4', 'teal'],
                                ['violet-1', 'bg-violet-1', '#A78BFA', 'violet'],
                                ['error-1', 'bg-error-1', '#FF6B6B', 'error red'],
                                ['success-3', 'bg-success-3', '#4ADE80', 'success bg'],
                                ['secondary-1', 'bg-secondary-1', '#FFC900', 'same as yellow-1'],
                            ].map(([name, bg, hex, note]) => (
                                <button
                                    key={name}
                                    onClick={() => navigator.clipboard.writeText(bg)}
                                    className="flex items-center gap-2 rounded-sm border border-n-1/20 p-2 text-left hover:border-n-1/40"
                                >
                                    <div className={`size-8 shrink-0 rounded-sm border border-n-1 ${bg}`} />
                                    <div>
                                        <p className="text-xs font-bold">{name}</p>
                                        <p className="text-[9px] text-grey-1">
                                            {hex} · {note}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </Section>

                    <Section title="Background Patterns">
                        <div className="space-y-2">
                            <div className="bg-peanut-repeat-normal h-20 rounded-sm border border-n-1 bg-primary-3 p-2">
                                <span className="font-mono text-[10px]">.bg-peanut-repeat-normal</span>
                            </div>
                            <CopySnippet code={`className="bg-peanut-repeat-normal bg-primary-3"`} />
                            <div className="bg-peanut-repeat-large h-20 rounded-sm border border-n-1 bg-primary-3 p-2">
                                <span className="font-mono text-[10px]">.bg-peanut-repeat-large</span>
                            </div>
                            <div className="bg-peanut-repeat-small h-20 rounded-sm border border-n-1 bg-primary-3 p-2">
                                <span className="font-mono text-[10px]">.bg-peanut-repeat-small</span>
                            </div>
                        </div>
                    </Section>

                    <Section
                        title="Title (Knerd Font)"
                        importPath={`import Title from '@/components/0_Bruddle/Title'`}
                        status="production"
                        quality={3}
                    >
                        <div className="rounded-sm bg-purple-1 p-4">
                            <Title text="PEANUT" />
                        </div>
                        <CopySnippet code={`<Title text="PEANUT" />`} />
                        <div className="rounded-sm bg-purple-1 p-4">
                            <Title text="NO OFFSET" offset={false} />
                        </div>
                    </Section>

                    <Section title="Copy & Share Utilities">
                        <div className="space-y-3">
                            <div>
                                <div className="mb-1 flex items-center gap-2">
                                    <span className="text-xs font-bold">CopyToClipboard</span>
                                    <StatusTag status="production" />
                                </div>
                                <p className="text-xs text-grey-1">icon or button mode. 2s checkmark feedback.</p>
                                <div className="mt-1 flex items-center gap-3">
                                    <CopyToClipboard textToCopy="copied text!" />
                                    <span className="text-xs text-grey-1">icon mode (default)</span>
                                </div>
                                <CopySnippet
                                    code={`import CopyToClipboard from '@/components/Global/CopyToClipboard'\n<CopyToClipboard textToCopy="text" />`}
                                />
                            </div>
                            <div>
                                <div className="mb-1 flex items-center gap-2">
                                    <span className="text-xs font-bold">ShareButton</span>
                                    <StatusTag status="production" />
                                </div>
                                <p className="text-xs text-grey-1">
                                    web share API with clipboard fallback. async URL generation.
                                </p>
                                <CopySnippet
                                    code={`import ShareButton from '@/components/Global/ShareButton'\n<ShareButton url="https://peanut.me/..." title="Share" />`}
                                />
                            </div>
                        </div>
                    </Section>

                    <Section title="Address & Identity">
                        <div className="space-y-3">
                            <div>
                                <div className="mb-1 flex items-center gap-2">
                                    <span className="text-xs font-bold">AddressLink</span>
                                    <StatusTag status="production" />
                                </div>
                                <p className="text-xs text-grey-1">
                                    shortened address with ENS resolution and profile link.
                                </p>
                                <AddressLink address="0x1234567890abcdef1234567890abcdef12345678" />
                                <CopySnippet
                                    code={`import AddressLink from '@/components/Global/AddressLink'\n<AddressLink address="0x1234..." />`}
                                />
                            </div>
                            <div>
                                <div className="mb-1 flex items-center gap-2">
                                    <span className="text-xs font-bold">MoreInfo (Tooltip)</span>
                                    <StatusTag status="production" />
                                </div>
                                <p className="text-xs text-grey-1">
                                    info icon with smart-positioned tooltip. portal-rendered.
                                </p>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm">some label</span>
                                    <MoreInfo text="this explains what the label means" />
                                </div>
                                <CopySnippet
                                    code={`import MoreInfo from '@/components/Global/MoreInfo'\n<MoreInfo text="Explanation here" />`}
                                />
                            </div>
                        </div>
                    </Section>

                    <Section title="Country Representation">
                        <p className="text-xs text-grey-1">
                            countries are represented using flagcdn.com images + country data from AddMoney/consts.
                        </p>
                        <div className="space-y-2 rounded-sm border border-n-1 p-3 text-xs">
                            <p>
                                <span className="font-bold">CountryList</span> — searchable country list with
                                geolocation sorting, flag images, and status badges.
                            </p>
                            <CopySnippet code={`import { CountryList } from '@/components/Common/CountryList'`} />
                            <p className="mt-2">
                                <span className="font-bold">CountryFlagAndName</span> — single country display with
                                flag. supports multi-flag for bridge regions.
                            </p>
                            <CopySnippet
                                code={`import { CountryFlagAndName } from '@/components/Kyc/CountryFlagAndName'`}
                            />
                            <p className="mt-2">
                                <span className="font-bold">flag images pattern</span>
                            </p>
                            <CopySnippet
                                code={`<img src={\`https://flagcdn.com/w160/\${countryCode}.png\`} alt="flag" className="h-6 w-6 rounded-full object-cover" />`}
                            />
                        </div>
                    </Section>

                    <Section
                        title="Divider"
                        importPath={`import Divider from '@/components/0_Bruddle/Divider'`}
                        status="production"
                    >
                        <Divider />
                        <Divider text="or" />
                        <CopySnippet code={`<Divider text="or" />`} />
                    </Section>

                    <Section title="Tailwind Custom Classes">
                        <div className="space-y-3 text-xs">
                            <div className="rounded-sm border border-n-1 p-3">
                                <p className="font-bold">layout</p>
                                <p className="mt-1 font-mono text-grey-1">.row — flex items-center gap-2</p>
                                <p className="font-mono text-grey-1">.col — flex flex-col gap-2</p>
                            </div>
                            <div className="rounded-sm border border-n-1 p-3">
                                <p className="font-bold">shadows</p>
                                <div className="mt-2 flex gap-3">
                                    <div className="shadow-2 rounded-sm border border-n-1 px-3 py-2">.shadow-2</div>
                                    <div className="shadow-4 rounded-sm border border-n-1 px-3 py-2">.shadow-4</div>
                                </div>
                            </div>
                            <div className="rounded-sm border border-n-1 p-3">
                                <p className="font-bold">labels</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {['label-stroke', 'label-purple', 'label-yellow', 'label-black', 'label-teal'].map(
                                        (cls) => (
                                            <span
                                                key={cls}
                                                className={`${cls} inline-block rounded-full px-3 py-1 text-xs font-bold`}
                                            >
                                                {cls.replace('label-', '')}
                                            </span>
                                        )
                                    )}
                                </div>
                            </div>
                            <div className="rounded-sm border border-n-1 p-3">
                                <p className="font-bold">borders</p>
                                <p className="mt-1 font-mono text-grey-1">.brutal-border — 2px solid black</p>
                                <p className="font-mono text-grey-1">border border-n-1 — standard 1px black</p>
                                <p className="font-mono text-grey-1">rounded-sm — standard border radius</p>
                            </div>
                            <div className="rounded-sm border border-n-1 p-3">
                                <p className="font-bold">icon sizes</p>
                                <p className="mt-1 font-mono text-grey-1">
                                    .icon-16 .icon-18 .icon-20 .icon-22 .icon-24 .icon-28
                                </p>
                            </div>
                        </div>
                    </Section>
                </div>
            </div>
        </div>
    )
}
