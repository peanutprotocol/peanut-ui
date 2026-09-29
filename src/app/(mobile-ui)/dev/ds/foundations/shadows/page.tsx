'use client'

import type React from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { DocPage } from '../../_components/DocPage'
import { ProductUsage } from '../../_components/ProductUsage'

// counted on the dev tree, 2026-09-23 (TASK-22969). product only: /dev,
// tests and stories excluded. evidence for the one-shadow decision, not a
// ruling — nothing here changes a shadow.

interface Site {
    title: string
    path: string
    description: string
    code?: string
    render: React.ReactNode
}

interface Step {
    title: string
    mechanism: string
    count: string
    verdict: string
    sites: Site[]
}

const STEPS: Step[] = [
    {
        title: '4px hard offset — the default',
        mechanism: 'btn-primary / btn-secondary built in · shadowSize="4" · shadow-4 utility',
        count: '~340 call sites',
        verdict: 'load-bearing',
        sites: [
            {
                title: 'Primary + secondary buttons (built in)',
                path: 'src/features/payments/flows/qr-pay/views/QrPaySuccessView.tsx',
                description:
                    '243 JSX Button sites are primary or secondary, so they carry 4px with no prop (+9 with a computed variant). Top areas: Global 27, Kyc 19, Setup 18, Claim 16, Card 13, TransactionDetails 12, deposit-accounts 12. 187 of them (120 files) also pass shadowSize="4" — every one on a primary/secondary, so the prop changes nothing. 52 more shadowSize: \'4\' sit in CTA config objects (ActionModal ctas in 16 files, KYC modals).',
                code: `<Button shadowSize="4" onClick={() => router.push('/home')}>{tCommon('goToHome')}</Button>
<Button variant="secondary" shadowSize="4">…</Button>`,
                render: (
                    <div className="flex flex-col gap-4">
                        <Button>Go to home</Button>
                        <Button variant="secondary">See receipt</Button>
                    </div>
                ),
            },
            {
                title: 'Card shadowSize="4"',
                path: 'src/components/Marketing/DestinationGrid.tsx',
                description:
                    '20 sites in 10 files, almost all marketing: press, status board, careers, DestinationGrid, Steps, mdx CTA / ExchangeWidget / RelatedPages, payment-network-explorer. Plus ExchangeRateWidget, which sets it only when its shadow prop is true.',
                code: '<Card shadowSize="4" className={`flex-row items-center gap-3 p-4 ${CARD_HOVER}`}>',
                render: (
                    <Card shadowSize="4" className="flex-row items-center gap-3 p-4">
                        <p className="text-label-l">Send money to Argentina</p>
                    </Card>
                ),
            },
            {
                title: 'Raw shadow-4 utility',
                path: 'src/components/Global/BottomNav/index.tsx',
                description:
                    '12 sites: BottomNav bar + QR circle (design.md ruling 2026-09-02), Callout, SlideToConfirm, ProfileHeader pill, [...recipient]/error.tsx and withdraw/manteca cards, ProblemFold, shhhhh (2), merchant landing (2). Off-name 4px: RegulatedRails spells btn-shadow-primary-4 raw, mdx Hero re-adds 4px with an arbitrary value.',
                code: 'className={`relative flex flex-1 items-center justify-between ${PILL_TRACK} shadow-4`}',
                render: (
                    <Card className="p-4 shadow-4">
                        <p className="text-label-l">shadow-4 surface</p>
                    </Card>
                ),
            },
        ],
    },
    {
        title: '6px — marketing only',
        mechanism: 'shadow-primary-6 (Card shadowSize="6" and Button shadowSize="6": 0 sites)',
        count: '4 sites',
        verdict: 'marginal',
        sites: [
            {
                title: 'Marketing card lift + tweet cards',
                path: 'src/components/Marketing/constants.ts',
                description:
                    'CARD_HOVER grows the shadow to 6px on hover (used by DestinationGrid and RelatedPages). The other two are raw classes: LandingPage/TweetCarousel.tsx:115 and app/m/[slug]/MerchantLandingPage.tsx:242. No app screen uses 6px.',
                code: `// CARD_HOVER: the hover lift grows the shadow to shadow-primary-6,
// the press drops it to shadow-none
<Card shadowSize="4" className={\`… \${CARD_HOVER}\`}>`,
                render: (
                    <Card shadowSize="6" className="p-4">
                        <p className="text-label-l">shadowSize=&quot;6&quot;</p>
                    </Card>
                ),
            },
        ],
    },
    {
        title: '8px — one site',
        mechanism: 'shadow-primary-8 (Card shadowSize="8" and Button shadowSize="8": 0 sites)',
        count: '1 site',
        verdict: 'marginal',
        sites: [
            {
                title: 'Merchant landing hero card',
                path: 'src/app/m/[slug]/MerchantLandingPage.tsx',
                description: 'Line 185, the yellow hero card on the merchant landing. The only 8px in the product.',
                render: (
                    <Card shadowSize="8" className="p-4">
                        <p className="text-label-l">shadowSize=&quot;8&quot;</p>
                    </Card>
                ),
            },
        ],
    },
    {
        title: '2px — small controls',
        mechanism: 'shadow-2 utility',
        count: '2 token sites + 2 off-token',
        verdict: 'marginal',
        sites: [
            {
                title: 'Slider thumb',
                path: 'src/components/Global/Slider/index.tsx',
                description:
                    'Line 112, the slider thumb (the only app use). Marketing LocaleSwitcher.tsx:103 is the other. Off-token ~2px: AddMoney/views/CryptoDeposit.view.tsx:231 (arbitrary 0.12rem) and hooks/usePullToRefresh.ts:101 (inline style string).',
                render: (
                    <div className="flex items-center gap-4">
                        <Card className="shadow-2 size-8 rounded-full" />
                        <p className="text-body-s text-foreground-secondary">thumb with shadow-2</p>
                    </div>
                ),
            },
        ],
    },
    {
        title: 'Soft blurred shadows — off the DS language',
        mechanism: 'stock Tailwind shadow-sm / md / lg / xl, drop-shadow-sm',
        count: '21 sites',
        verdict: 'off-system',
        sites: [
            {
                title: 'Select + combobox popovers, tooltip, flags',
                path: 'src/components/0_Bruddle/BaseSelect.tsx',
                description:
                    'shadow-lg 8 (BaseSelect, Common/CountryCombobox, MoreInfo, LandingPage CurrencySelect + TweetCarousel, InvitesGraph 2, PerkClaimGiftBox), shadow-sm 8 (Tooltip, CountryFlagAndName 2, CardPaymentRows, DepositMethodList, PerkClaimGiftBox 2, GraphTopBar), shadow-md 2, shadow-xl 1, drop-shadow-sm 1, plus the video Modal backdrop. BaseSelect is a 0_Bruddle primitive and Tooltip a shared component, so these two spread the soft look to every caller.',
                render: (
                    <Card className="p-4 shadow-lg">
                        <p className="text-label-l">shadow-lg popover</p>
                    </Card>
                ),
            },
        ],
    },
]

const UNUSED = [
    ['Button shadowSize="3"', 'btn-shadow-primary-3 — 0 product sites'],
    ['Button shadowSize="6" / "8"', 'btn-shadow-primary-6 / -8 — 0 product sites'],
    ['Card shadowSize="6" / "8"', '0 product sites — 6px and 8px ship only as raw classes'],
] as const

export default function ShadowsPage() {
    return (
        <DocPage>
            <DocHeader
                title="Shadows"
                description="Every shadow the product ships, counted by call site, with a live recreation of each."
            />

            <DesignNote type="info">
                design.md: shadows are always black. The bottom nav and QR circle carry shadow-4 (ruled 2026-09-02). The
                button press moves 4px to drop into its own 4px shadow, so the press is only meaningful with the 4px
                step. Counts are from the dev tree on 2026-09-23 — /dev, tests and stories excluded.
            </DesignNote>

            {/* one row per step, counts first */}
            <DocSection title="Inventory">
                <div className="space-y-2">
                    {STEPS.map((s) => (
                        <Card key={s.title} className="flex-row items-start justify-between gap-4 p-4">
                            <div>
                                <p className="text-label-l">{s.title}</p>
                                <p className="mt-1 text-body-xs text-foreground-secondary">{s.mechanism}</p>
                            </div>
                            <div className="shrink-0 text-right">
                                <p className="text-label-l">{s.count}</p>
                                <p className="text-body-xs text-foreground-secondary">{s.verdict}</p>
                            </div>
                        </Card>
                    ))}
                    {UNUSED.map(([name, note]) => (
                        <Card key={name} className="border-dashed border-border-subtle bg-background-page p-4">
                            <p className="text-label-l">{name}</p>
                            <p className="mt-1 text-body-xs text-foreground-secondary">{note}</p>
                        </Card>
                    ))}
                </div>
            </DocSection>

            {STEPS.map((s) => (
                <DocSection key={s.title} title={s.title} description={`${s.count} · ${s.mechanism}`}>
                    {s.sites.map((site) => (
                        <ProductUsage.Example
                            key={site.path}
                            title={site.title}
                            path={site.path}
                            description={site.description}
                            code={site.code}
                        >
                            {site.render}
                        </ProductUsage.Example>
                    ))}
                </DocSection>
            ))}

            <DocSection title="Consolidation evidence">
                <div className="space-y-4 text-body-s">
                    <p>
                        <span className="text-label-l">4px is the system.</span> About 340 call sites: every primary and
                        secondary Button, 21 Cards, 12 raw shadow-4 surfaces (bottom nav, Callout, SlideToConfirm). The
                        button press translate is built on it.
                    </p>
                    <p>
                        <span className="text-label-l">6px and 8px are marketing leftovers.</span> 5 sites in total, all
                        on landing, marketing or merchant pages, all as raw classes. The Card and Button props for them
                        have 0 callers.
                    </p>
                    <p>
                        <span className="text-label-l">3px is dead.</span> Button shadowSize=&quot;3&quot; has 0 product
                        callers.
                    </p>
                    <p>
                        <span className="text-label-l">2px is the one small-scale case.</span> The Slider thumb is its
                        only app use; LocaleSwitcher is marketing. Two more ~2px shadows bypass the token.
                    </p>
                    <p>
                        <span className="text-label-l">Soft blurred shadows are off the DS language.</span> 21 sites,
                        led by the BaseSelect primitive and the shared Tooltip.
                    </p>
                    <p>
                        <span className="text-label-l">Prop noise.</span> 187 Button shadowSize=&quot;4&quot; plus 52
                        CTA-config shadowSize: &apos;4&apos; repeat what primary and secondary already render.
                    </p>
                    <p className="text-foreground-secondary">
                        The counts support one app shadow — the 4px hard offset. This page is evidence; the ruling and
                        any removal are separate.
                    </p>
                </div>
            </DocSection>
        </DocPage>
    )
}
