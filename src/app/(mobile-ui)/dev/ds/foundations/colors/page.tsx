'use client'

import { useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { IconBubble, type IconBubbleColor } from '@/components/0_Bruddle/IconBubble'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { COLOR_TOKENS, type ThemeToken } from '../tokens.generated'

// Every hex on this page comes from the generated tokens, so it cannot drift from
// globals.css. The role sections name tokens by hand; any token they leave out
// falls into the colour library below, so a new token is never invisible.
const TOKENS = new Map(COLOR_TOKENS.map((t) => [t.name, t]))
const hex = (name: string) => TOKENS.get(name)?.value ?? '—'
const PRIMITIVE = /^(gray|pink|yellow|purple|blue|green|red|orange)-\d+$/

const SURFACES = [
    {
        token: 'background-brand',
        also: 'action-primary',
        name: 'Brand pink',
        use: 'Primary actions and brand moments',
        className: 'bg-background-brand',
    },
    { token: 'background-page', name: 'Page beige', use: 'The app canvas', className: 'bg-background-page' },
    {
        token: 'background-default',
        name: 'Surface white',
        use: 'Cards, fields and content',
        className: 'bg-background-default',
    },
    {
        token: 'background-accent-yellow',
        name: 'Accent yellow',
        use: 'Decoration only: marketing bands, pot progress, the QR success star. No button is yellow.',
        className: 'bg-background-accent-yellow',
    },
]

const TINTS = [
    {
        group: 'Information and accents',
        items: [
            {
                token: 'background-badge-info',
                name: 'Information',
                use: 'Methods and plain information',
                sample: 'Bank transfer',
                className: 'bg-background-badge-info',
            },
            {
                token: 'background-badge-attention',
                name: 'Peanut and attention',
                use: 'Peanut concepts, rewards and warnings',
                sample: 'Action needed',
                className: 'bg-background-badge-attention',
            },
            {
                token: 'background-badge-accent',
                name: 'Accent',
                use: 'Supporting badges and avatars',
                sample: 'Member',
                className: 'bg-background-badge-accent',
            },
        ],
    },
    {
        group: 'Status',
        items: [
            {
                token: 'background-badge-success',
                name: 'Success',
                use: 'Completed steps and confirmations',
                sample: 'Transfer complete',
                className: 'bg-background-badge-success',
            },
            {
                token: 'background-badge-error',
                name: 'Error',
                use: 'Failed or blocked states',
                sample: 'Could not complete',
                className: 'bg-background-badge-error',
            },
            {
                token: 'background-badge-helper',
                name: 'Inactive',
                use: 'Unavailable or cancelled',
                sample: 'Not available',
                className: 'bg-background-badge-helper',
            },
        ],
    },
]

const BUBBLES: { color: IconBubbleColor; icon: IconName; token: string; name: string; use: string }[] = [
    {
        color: 'blue',
        icon: 'bank',
        token: 'background-icon-bubble-blue',
        name: 'Blue: methods and information',
        use: 'Bank, crypto, exchange, links, add money, withdraw, verification.',
    },
    {
        color: 'yellow',
        icon: 'credit-card',
        token: 'background-icon-bubble-yellow',
        name: "Yellow: Peanut's own and attention",
        use: 'Card, friends, rewards, balance; pending and warnings in state messages.',
    },
    {
        color: 'brand',
        icon: 'qr-code',
        token: 'background-brand',
        name: 'Pink: the primary action',
        use: 'QR pay, the same pink as the QR button in the bottom navigation.',
    },
    {
        color: 'green',
        icon: 'check',
        token: 'background-icon-bubble-green',
        name: 'Green: done',
        use: 'Completed steps, successful payments, success messages.',
    },
    {
        color: 'red',
        icon: 'alert',
        token: 'background-icon-bubble-red',
        name: 'Red: failed or blocked',
        use: 'Errors, blocked flows, destructive confirms, failed-to-load states.',
    },
    {
        color: 'gray',
        icon: 'cancel',
        token: 'background-icon-bubble-gray',
        name: 'Grey: inactive',
        use: 'Unavailable or cancelled items, empty results.',
    },
]

const TEXT = [
    {
        token: 'foreground-primary',
        name: 'Primary text',
        sample: 'Headings, labels, body',
        className: 'text-foreground-primary',
    },
    {
        token: 'foreground-secondary',
        name: 'Secondary text',
        sample: 'Descriptions and metadata',
        className: 'text-foreground-secondary',
    },
    {
        token: 'foreground-attention',
        name: 'Attention text',
        sample: 'Action needed',
        className: 'text-foreground-attention',
    },
    { token: 'foreground-brand', name: 'Brand text', sample: "Oh, and it's pink.", className: 'text-foreground-brand' },
]

const BORDERS = [
    { token: 'border-default', name: 'Default', className: 'border-border-default' },
    { token: 'border-subtle', name: 'Subtle', className: 'border-border-subtle' },
    { token: 'border-button', name: 'Button', className: 'border-border-button' },
    { token: 'border-brand', name: 'Brand', className: 'border-border-brand' },
    { token: 'border-error', name: 'Error', className: 'border-border-error' },
    { token: 'border-disabled', name: 'Disabled', className: 'border-border-disabled' },
]

// tokens a role section already shows; everything else is the colour library
const SHOWN = new Set([
    ...SURFACES.flatMap((s) => [s.token, s.also].filter(Boolean) as string[]),
    ...TINTS.flatMap((g) => g.items.map((i) => i.token)),
    ...BUBBLES.map((b) => b.token),
    ...TEXT.map((t) => t.token),
    'foreground-error',
    ...BORDERS.map((b) => b.token),
    'action-primary-press',
    'action-ghost-press',
    'action-focus',
    'background-selection',
    'background-disabled',
    'foreground-over-color-primary',
    'foreground-inverse',
])
const LIBRARY = COLOR_TOKENS.filter((t) => !PRIMITIVE.test(t.name) && !SHOWN.has(t.name))
const PALETTE = COLOR_TOKENS.filter((t) => PRIMITIVE.test(t.name))

const TokenName = ({ name }: { name: string }) => (
    <code className="font-mono text-label-m text-foreground-secondary">
        {name} · {hex(name)}
    </code>
)

export default function ColorsPage() {
    const [copied, setCopied] = useState<string | null>(null)

    const copy = (token: ThemeToken) => {
        // copy the class matching the token's intent, not blanket bg-
        const utility = token.name.startsWith('foreground')
            ? 'text'
            : token.name.startsWith('border')
              ? 'border'
              : token.name.startsWith('shadow')
                ? 'shadow'
                : 'bg'
        const cls = `${utility}-${token.name}`
        navigator.clipboard.writeText(cls)
        setCopied(cls)
        setTimeout(() => setCopied(null), 1500)
        return cls
    }

    const tokenRow = (token: ThemeToken) => (
        <ListItem
            key={token.name}
            onClick={() => copy(token)}
            leading={
                <div className={`size-8 shrink-0 rounded-sm border border-border-default ${token.previewClass}`} />
            }
            title={token.name}
            body={<span className="font-mono">{token.value}</span>}
            trailing={<Icon name={copied?.endsWith(token.name) ? 'check' : 'copy'} size={16} />}
        />
    )

    return (
        <DocPage>
            <DocHeader
                title="Colors"
                description="The colours we use, what each one means, and where it shows in the app. Values come from the @theme block in globals.css (pnpm gen:ds-tokens)."
            />

            <DocSection title="Brand and surfaces" description="The ground of every app screen.">
                <div className="grid grid-cols-2 gap-3">
                    {SURFACES.map((s) => (
                        <Card key={s.token} className="overflow-hidden">
                            <div className={`h-16 border-b border-border-default ${s.className}`} />
                            <div className="flex flex-col gap-1 p-3">
                                <span className="text-label-l">{s.name}</span>
                                <span className="text-body-xs text-foreground-secondary">{s.use}</span>
                                <TokenName name={s.token} />
                                {s.also && <TokenName name={s.also} />}
                            </div>
                        </Card>
                    ))}
                </div>
            </DocSection>

            {TINTS.map((g) => (
                <DocSection key={g.group} title={g.group}>
                    <div className="grid grid-cols-1 gap-3">
                        {g.items.map((i) => (
                            <Card key={i.token} className="flex flex-col gap-2 p-3">
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="text-label-l">{i.name}</span>
                                    <span className="text-body-xs text-foreground-secondary">{i.use}</span>
                                </div>
                                <div className={`rounded-sm px-3 py-2 text-body-s ${i.className}`}>{i.sample}</div>
                                <TokenName name={i.token} />
                            </Card>
                        ))}
                    </div>
                </DocSection>
            ))}

            <DocSection
                title="Icon bubbles"
                description="A bubble names a concept or a state. A concept keeps its icon and colour; the badge beside it carries the status."
            >
                <div className="grid grid-cols-1 gap-3">
                    {BUBBLES.map((b) => (
                        <Card key={b.color} className="flex items-start gap-3 p-3">
                            <IconBubble icon={b.icon} color={b.color} />
                            <div className="flex min-w-0 flex-col gap-1">
                                <span className="text-label-l">{b.name}</span>
                                <span className="text-body-xs text-foreground-secondary">{b.use}</span>
                                <TokenName name={b.token} />
                            </div>
                        </Card>
                    ))}
                </div>
            </DocSection>

            <DocSection
                title="Text"
                description="Use foreground tokens for text. Badge and bubble fills are backgrounds."
            >
                <Card className="divide-y divide-dashed divide-border-default px-3">
                    {TEXT.map((t) => (
                        <div key={t.token} className="flex flex-col gap-1 py-3">
                            <div className="flex items-baseline justify-between gap-2">
                                <span className="text-label-l">{t.name}</span>
                                <span className={`text-body-s ${t.className}`}>{t.sample}</span>
                            </div>
                            <TokenName name={t.token} />
                        </div>
                    ))}
                    <div className="flex flex-col gap-1 py-3">
                        <div className="flex items-baseline justify-between gap-2">
                            <span className="text-label-l">Error text (through FieldError)</span>
                            <FieldError className="m-0">Could not complete</FieldError>
                        </div>
                        <TokenName name="foreground-error" />
                    </div>
                    <div className="flex flex-col gap-1 py-3">
                        <div className="flex items-baseline justify-between gap-2">
                            <span className="text-label-l">Inverse text</span>
                            <span className="rounded-sm bg-foreground-primary px-2 text-body-s text-foreground-inverse">
                                On dark surfaces
                            </span>
                        </div>
                        <TokenName name="foreground-inverse" />
                    </div>
                </Card>
            </DocSection>

            <DocSection
                title="Actions and press"
                description="Primary is pink, secondary is white with a black border. Press the buttons: phones show the press colour, and desktop hover reuses it."
            >
                <div className="flex gap-3">
                    <Button variant="primary">Continue</Button>
                    <Button variant="secondary">Cancel</Button>
                </div>
                <Card className="divide-y divide-dashed divide-border-default px-3">
                    <div className="flex flex-col gap-1 py-3">
                        <span className="text-label-l">Primary press</span>
                        <span className="text-body-xs text-foreground-secondary">
                            A pressed primary button. A pressed secondary button turns brand pink.
                        </span>
                        <TokenName name="action-primary-press" />
                    </div>
                    <div className="flex flex-col gap-1 py-3">
                        <span className="text-label-l">
                            Ghost press <span className="text-action-ghost-press">· text buttons and tabs</span>
                        </span>
                        <span className="text-body-xs text-foreground-secondary">A pressed text button or tab.</span>
                        <TokenName name="action-ghost-press" />
                    </div>
                </Card>
                <DesignNote type="info">
                    Figma still names these action/primary-hover, action/ghost-hover and action/secondary (now
                    background-accent-yellow). Code renamed them because they colour the press, which is what a phone
                    shows, and because no button is yellow.
                </DesignNote>
            </DocSection>

            <DocSection title="Three highlights, three jobs" description="Do not swap them.">
                <div className="grid grid-cols-1 gap-3">
                    <Card className="flex flex-col gap-2 p-3">
                        <span className="text-label-l">The field you type in: blue ring</span>
                        <div className="flex h-12 items-center rounded-sm border border-transparent bg-background-default px-4 text-label-l outline-3 outline-action-focus outline-solid">
                            Ana
                        </div>
                        <TokenName name="action-focus" />
                    </Card>
                    <Card className="flex flex-col gap-2 p-3">
                        <span className="text-label-l">The chosen row: pale blue with a check</span>
                        <div className="flex items-center justify-between rounded-sm bg-background-selection px-3 py-2 text-label-l text-foreground-over-color-primary">
                            Brazil
                            <Icon name="check" size={16} />
                        </div>
                        <TokenName name="background-selection" />
                    </Card>
                    <Card className="flex flex-col gap-2 p-3">
                        <span className="text-label-l">A row while you press it: light grey</span>
                        <div className="rounded-sm bg-background-disabled px-3 py-2 text-label-l">Mexico</div>
                        <TokenName name="background-disabled" />
                    </Card>
                </div>
                <DesignNote type="info">
                    The focus ring is blue, not pink: pink is the primary action, so a pink ring would read as
                    &quot;primary&quot;, not &quot;focused&quot;. The ring must also reach 3:1 against its ground (WCAG
                    1.4.11). Blue is 5.17:1 on background-default, 4.74:1 on background-page and 4.50:1 on
                    background-disabled; pink is under 2.1:1 on all three. A pink focus shipped once (ui#3041) and was
                    reverted (ui#3161).
                </DesignNote>
            </DocSection>

            <DocSection title="Borders">
                <div className="grid grid-cols-2 gap-3">
                    {BORDERS.map((b) => (
                        <Card key={b.token} className="flex items-center gap-3 p-3">
                            <div className={`size-8 shrink-0 border bg-background-default ${b.className}`} />
                            <div className="flex min-w-0 flex-col">
                                <span className="text-label-l">{b.name}</span>
                                <TokenName name={b.token} />
                            </div>
                        </Card>
                    ))}
                </div>
                <Card className="divide-y divide-dashed divide-border-default px-3">
                    <div className="flex justify-between py-3 text-body-s">
                        <span className="text-foreground-secondary">Fee</span>
                        <span className="text-label-l">$0</span>
                    </div>
                    <div className="flex justify-between py-3 text-body-s">
                        <span className="text-foreground-secondary">Arrives</span>
                        <span className="text-label-l">In minutes</span>
                    </div>
                </Card>
                <p className="text-body-xs text-foreground-secondary">
                    A receipt separates its groups with one dashed border-default line; the parent card owns it.
                </p>
            </DocSection>

            <DocSection
                title="Colour library"
                description={`${LIBRARY.length} more tokens with narrow jobs: surface tints, avatars, the sign-up hero, vendor colours. Tap to copy the class.`}
            >
                <div className="grid grid-cols-2 gap-2">{LIBRARY.map(tokenRow)}</div>
            </DocSection>

            <DocSection
                title="Palette · reference only"
                description="The figma ramp behind the tokens. Do not use these in new UI: use a token with a role, and if none fits, add one first."
            >
                <div className="grid grid-cols-4 gap-2">
                    {PALETTE.map((t) => (
                        <div key={t.name} className="flex flex-col gap-1">
                            <div className={`h-8 rounded-sm border border-border-default ${t.previewClass}`} />
                            <span className="font-mono text-label-m text-foreground-secondary">{t.name}</span>
                        </div>
                    ))}
                </div>
            </DocSection>
        </DocPage>
    )
}
