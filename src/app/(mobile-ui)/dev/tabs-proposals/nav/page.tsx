'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { LIMITS } from '@/constants/query.consts'
import { Notification } from '@/components/0_Bruddle/Notification'
import { Section } from '@/components/0_Bruddle/Section'
import { NAV_LOOK_KEYS, TABS_LOOK_NAMES, TabsLookProvider, type TabsLook } from '@/components/0_Bruddle/TabsLook'
import RhinoDepositView from '@/components/AddMoney/views/RhinoDeposit.view'
import { ContentLinkList } from '@/components/Marketing/ContentLanding'
import { HUB_WIDTH } from '@/components/Marketing/constants'
import { Tabs as MarketingTabs, TabPanel } from '@/components/Marketing/mdx/Tabs'
import { Icon } from '@/components/Global/Icons/Icon'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import MantecaLimitsView from '@/features/limits/views/MantecaLimitsView'
import ExplorerHeader from '@/features/payment-network-explorer/ExplorerHeader'
import FilterPanel from '@/features/payment-network-explorer/FilterPanel'
import DevPageShell from '../../_components/DevPageShell'
import { ProposalTabs } from '../_components/TabVariants'
import {
    CONTENT_ITEMS,
    CONTENT_STRINGS,
    EXPLORER_FILTERS,
    EXPLORER_RELATIONSHIPS,
    LIMITS_FIXTURE,
    RHINO_DEPOSIT,
} from '../surfaces/fixtures'

/**
 * /dev/tabs-proposals/nav — TASK-22707, the bottom-nav tab look in its two
 * polarities.
 *
 * Kush reversed the "Weight" ruling on 2026-09-21: the tab row should be the
 * app's own bottom navigation, standing still. `Global/BottomNav` is a bordered
 * pill bar on the page tint (`background-page`) carrying a bordered WHITE thumb
 * (`background-default`). This page takes that bar, drops `shadow-4`, the
 * spring and the sliding thumb, and renders the static result on the screens
 * that actually carry tabs.
 *
 * ONE decision is open, and it is which fill means selected:
 *   A — selected white on a page-tint track. The nav's own polarity.
 *   B — selected page-tint on a white track. Kush's description.
 * Everything else about the two is identical, so each pair isolates exactly
 * that. Both are rendered on every surface, one under the other, at the
 * ground the real screen puts them on.
 *
 * The measured fact both polarities have to live with: `background-default`
 * against `background-page` is 1.09:1. The FILL pair is invisible on its own —
 * the 1px `border-default` chip outline (18.1:1 on white, 16.6:1 on the tint)
 * is what makes a nav pill read, and it is what makes either polarity read
 * here. Neither fill carries selection alone; do not read these blocks as if it
 * did.
 *
 * Nothing here ships. `0_Bruddle/Tabs` and every call site are untouched — the
 * looks reach the real screens through a context they read (`0_Bruddle/TabsLook`),
 * which is null on every shipped screen. `0_Bruddle/PillSurface` is the one
 * piece that is NOT dev-only: it is the shared radius/border/fill that BottomNav
 * now reads too, and it survives this directory being deleted.
 */

// ------------------------------------------------------------------ scaffolding

/** the ground a tab row lands on, which is what decides whether a fill reads */
type Ground = 'page' | 'card' | 'yellow'

const GROUND_CLASS: Record<Ground, string> = {
    page: 'bg-background-page',
    card: 'bg-background-default',
    yellow: 'bg-yellow-500',
}

const GROUND_LABEL: Record<Ground, string> = {
    page: 'ground: background-page #faf4f0 (the app body)',
    card: 'ground: background-default #ffffff (card, drawer, article)',
    yellow: 'ground: yellow-500 #ffc900 (merchant fold)',
}

/** one surface rendered once per polarity, each block anchored for screenshotting */
const Polarities = ({
    surface,
    ground,
    children,
}: {
    surface: string
    ground: Ground
    children: (look: TabsLook) => ReactNode
}) => (
    <div className="flex flex-col gap-6">
        <p className="text-label-m text-foreground-secondary uppercase">{GROUND_LABEL[ground]}</p>
        {NAV_LOOK_KEYS.map((look) => (
            <div key={look} id={`${surface}-${look}`} data-look-block className="flex flex-col gap-2">
                <p className="text-label-m text-foreground-secondary uppercase">{TABS_LOOK_NAMES[look]}</p>
                <div className={`border border-border-subtle ${GROUND_CLASS[ground]}`}>
                    <TabsLookProvider look={look}>{children(look)}</TabsLookProvider>
                </div>
            </div>
        ))}
    </div>
)

/** a viewport-sized window on a full screen: the tab row and what sits under it */
const Viewport = ({ height = 'h-[560px]', children }: { height?: string; children: ReactNode }) => (
    <div className={`${height} overflow-hidden p-4`}>{children}</div>
)

const Note = ({ children }: { children: ReactNode }) => (
    <p className="text-body-s text-foreground-secondary">{children}</p>
)

const noop = () => {}

const NETWORK_TABS = [
    { value: 'all', label: 'All' },
    { value: 'arbitrum', label: 'Arbitrum' },
    { value: 'base', label: 'Base' },
    { value: 'optimism', label: 'Optimism' },
    { value: 'polygon', label: 'Polygon' },
    { value: 'ethereum', label: 'Ethereum' },
    { value: 'solana', label: 'Solana' },
    { value: 'tron', label: 'Tron' },
]

const ICON_TABS = [
    {
        value: 'send',
        label: (
            <>
                <Icon name="arrow-up-right" size={16} />
                Send
            </>
        ),
    },
    {
        value: 'receive',
        label: (
            <>
                <Icon name="download" size={16} />
                Receive
            </>
        ),
    },
    {
        value: 'card',
        label: (
            <>
                <Icon name="credit-card" size={16} />
                Card
            </>
        ),
    },
]

// -------------------------------------------------------------------- the page

export default function TabsNavLookPage() {
    const queryClient = useQueryClient()

    // MantecaLimitsView reads useLimits(); prime the cache instead of mocking the
    // hook, so the REAL view renders its real data branch.
    useState(() => queryClient.setQueryData([LIMITS], LIMITS_FIXTURE))

    const [chainType, setChainType] = useState<'EVM' | 'SOL' | 'TRON'>('EVM')

    return (
        <DevPageShell
            title="Tabs — the bottom-nav look, two polarities"
            backHref="/dev/tabs-proposals"
            description="TASK-22707 — the tab row modelled on Global/BottomNav: a bordered pill track carrying a bordered chip, with the shadow, the spring and the sliding thumb dropped. A = selected white on a tinted track (the nav's own polarity). B = selected tinted on a white track. Read the product blocks at 375x667 and the marketing blocks at ~1280."
        >
            <div className="flex flex-col gap-12">
                <Notification priority="info" title="The border carries selection, not the fill">
                    <code>background-default</code> <code>#ffffff</code> against <code>background-page</code>{' '}
                    <code>#faf4f0</code> is <strong>1.09:1</strong> — the two fills are nearly the same colour. What
                    makes a bottom-nav pill read is its 1px <code>border-default</code> outline, which is 18.1:1 on
                    white and 16.6:1 on the tint. Both polarities below keep that border on the selected chip. Judge the
                    pair on which GROUND each one survives, not on the fill difference, which is barely there.
                </Notification>

                {/* --------------------------------------------------- 0 grounds */}
                <Section id="grounds" title="0 — The same row on all three grounds" className="gap-4">
                    <Note>
                        Before the real screens: one plain 3-tab row on each ground the app actually has. This is the
                        whole decision in one block. A goes quiet on the page tint (its track melts into the body and
                        only the chip border shows — exactly how the nav behaves) and loud on white. B does the reverse:
                        it goes quiet on white and loud on the page tint, where its WHITE track is the thing that pops
                        and the selected tinted chip reads as a hole.
                    </Note>
                    {(['page', 'card', 'yellow'] as const).map((ground) => (
                        <Polarities key={ground} surface={`ground-${ground}`} ground={ground}>
                            {(look) => (
                                <div className="p-4">
                                    <ProposalTabs
                                        variant={look}
                                        aria-label="Ground test"
                                        tabs={[
                                            { value: 'graph', label: 'Graph' },
                                            { value: 'table', label: 'Table' },
                                            { value: 'list', label: 'List' },
                                        ]}
                                    />
                                </div>
                            )}
                        </Polarities>
                    ))}
                </Section>

                {/* ------------------------------------------------------ 1 limits */}
                <Section id="limits" title="1 — Limits, Manteca (product)" className="gap-4">
                    <Note>
                        <code>features/limits/views/MantecaLimitsView</code>. The period control is rendered inside the{' '}
                        <code>.map()</code> over currencies, so a LATAM user with ARS and BRL limits sees the same
                        control twice. Each one sits inside a white currency card, so this is the card ground — and a
                        bordered pill repeated N times is the loudness test.
                    </Note>
                    <Polarities surface="limits" ground="page">
                        {() => (
                            <Viewport height="h-[600px]">
                                <MantecaLimitsView />
                            </Viewport>
                        )}
                    </Polarities>
                </Section>

                {/* ---------------------------------------------------- 2 explorer */}
                <Section id="explorer-header" title="2 — Explorer header (product)" className="gap-4">
                    <Note>
                        <code>features/payment-network-explorer/ExplorerHeader</code>. The header paints{' '}
                        <code>bg-background-default</code>, so Graph/Table lands on WHITE beside a title, a live-data
                        badge, a search box and a Close link.
                    </Note>
                    <Polarities surface="explorer-header" ground="card">
                        {() => (
                            <ExplorerHeader
                                view="graph"
                                searching={false}
                                searchError={null}
                                onViewChange={noop}
                                onSearch={async () => true}
                            />
                        )}
                    </Polarities>
                </Section>

                {/* ------------------------------------------------- 3 filterpanel */}
                <Section id="filter-panel" title="3 — Explorer filter panel (product, fullWidth)" className="gap-4">
                    <Note>
                        <code>features/payment-network-explorer/FilterPanel</code> in its 280px aside, which also paints{' '}
                        <code>bg-background-default</code>. The direction control is <code>fullWidth</code> inside a
                        fieldset, directly under a legend and above more form rows — the case where a bordered row can
                        read as an input instead of a control.
                    </Note>
                    <Polarities surface="filter-panel" ground="card">
                        {() => (
                            <div className="w-[280px]">
                                <FilterPanel
                                    filters={EXPLORER_FILTERS}
                                    relationships={EXPLORER_RELATIONSHIPS}
                                    onChange={noop}
                                    onReset={noop}
                                />
                            </div>
                        )}
                    </Polarities>
                </Section>

                {/* ------------------------------------------------------- 4 rhino */}
                <Section id="rhino-deposit" title="4 — Crypto deposit networks (product, fullWidth)" className="gap-4">
                    <Note>
                        <code>components/AddMoney/views/RhinoDeposit.view</code>. EVM / Solana / Tron,{' '}
                        <code>fullWidth</code>, on the app body (page tint) directly above a QR code. Not reachable by
                        navigation without a live deposit address, so it is mounted with fixture props.
                    </Note>
                    <Polarities surface="rhino-deposit" ground="page">
                        {() => (
                            <Viewport height="h-[620px]">
                                <RhinoDepositView
                                    chainType={chainType}
                                    setChainType={(next) => setChainType(next as 'EVM' | 'SOL' | 'TRON')}
                                    depositAddressData={RHINO_DEPOSIT}
                                    isDepositAddressDataLoading={false}
                                    headerTitle="Add money"
                                    onSuccess={noop}
                                />
                            </Viewport>
                        )}
                    </Polarities>
                </Section>

                {/* ----------------------------------------------- 5 tokenselector */}
                <Section id="token-selector" title="5 — Token selector networks (product, panelled)" className="gap-4">
                    <Note>
                        <code>components/Global/TokenSelector</code> — the one product screen where the tabs carry a
                        real panel AND icon+text labels. The tabs live inside the drawer, which paints white. Open one
                        button at a time; each button is wrapped in its own polarity.
                    </Note>
                    <Polarities surface="token-selector" ground="card">
                        {(look) => (
                            <div className="p-4">
                                <TokenSelector viewType="withdraw" classNameButton={`token-selector-nav-${look}`} />
                            </div>
                        )}
                    </Polarities>
                </Section>

                {/* --------------------------------------------------- 6 mdx tabs */}
                <Section id="marketing-mdx" title="6 — Marketing content tabs (marketing, panelled)" className="gap-4">
                    <Note>
                        <code>components/Marketing/mdx/Tabs</code> with the real comparison block from{' '}
                        <code>content/send-to/argentina</code>. Panelled, <code>forceMount</code>, long prose, white
                        article ground. Read this one at desktop width.
                    </Note>
                    <Polarities surface="marketing-mdx" ground="card">
                        {() => (
                            <MarketingTabs labels="Peanut,Wise,Western Union">
                                <TabPanel label="Peanut">
                                    <p className="mb-3">
                                        <strong>Fee:</strong> Free — no deposit, transfer, or spending fees.
                                    </p>
                                    <p className="mb-3">
                                        <strong>Exchange rate:</strong> Cripto dólar (free market rate). Consistently
                                        2–11% better than MEP.
                                    </p>
                                    <p>
                                        <strong>Best for:</strong> Anyone who wants the most pesos per dollar with zero
                                        fees.
                                    </p>
                                </TabPanel>
                                <TabPanel label="Wise">
                                    <p className="mb-3">
                                        <strong>Fee:</strong> 0.4-1.5% per transfer ($2-$7.50 on $500).
                                    </p>
                                    <p className="mb-3">
                                        <strong>Exchange rate:</strong> MEP-equivalent — 2–11% worse than cripto dólar.
                                    </p>
                                    <p>
                                        <strong>Best for:</strong> Users who prefer a traditional bank-to-bank transfer
                                        flow.
                                    </p>
                                </TabPanel>
                                <TabPanel label="Western Union">
                                    <p className="mb-3">
                                        <strong>Fee:</strong> $5-$15+ flat fee per transfer.
                                    </p>
                                    <p className="mb-3">
                                        <strong>Exchange rate:</strong> 5-10% markup built into the rate.
                                    </p>
                                    <p>
                                        <strong>Best for:</strong> Cash pickup where no bank account exists.
                                    </p>
                                </TabPanel>
                            </MarketingTabs>
                        )}
                    </Polarities>
                </Section>

                {/* ------------------------------------------------ 7 content hub */}
                <Section id="content-hub" title="7 — Content hub filters (marketing, PROPOSED)" className="gap-4">
                    <Note>
                        <strong>Not yet migrated.</strong> <code>components/Marketing/ContentLanding</code> still
                        filters with five raw <code>&lt;button&gt;</code> chips painted{' '}
                        <code>bg-action-primary/20</code>. Below is the proposed migration on the hub&rsquo;s own page
                        tint, with the real result list under it.
                    </Note>
                    <Polarities surface="content-hub" ground="page">
                        {(look) => (
                            <div className="py-4">
                                <div className={`mx-auto ${HUB_WIDTH} px-6 md:px-4`}>
                                    <ProposalTabs
                                        variant={look}
                                        aria-label="Filter content"
                                        tabs={[
                                            { value: 'all', label: CONTENT_STRINGS.filterAll },
                                            { value: 'blog', label: CONTENT_STRINGS.filterBlog },
                                            { value: 'stories', label: CONTENT_STRINGS.filterStories },
                                            { value: 'use-cases', label: CONTENT_STRINGS.filterUseCases },
                                            { value: 'compare', label: CONTENT_STRINGS.filterCompare },
                                        ]}
                                    />
                                </div>
                                <ContentLinkList items={CONTENT_ITEMS} strings={CONTENT_STRINGS} grouped={false} />
                            </div>
                        )}
                    </Polarities>
                </Section>

                {/* --------------------------------------------- 8 merchant fold */}
                <Section id="merchant-fold" title="8 — Merchant yellow fold (marketing, PROPOSED)" className="gap-4">
                    <Note>
                        <strong>Not yet migrated.</strong> <code>app/m/[slug]</code>&rsquo;s menu fold toggles USD/EUR
                        with two raw <code>&lt;button&gt;</code>s in a 2px-bordered box, selected painted{' '}
                        <code>bg-action-primary</code>. It is the only colour ground a tab row has to survive:{' '}
                        <code>yellow-500</code> <code>#ffc900</code>. Both fills are near-white against it —{' '}
                        <code>background-page</code> 1.42:1, <code>background-default</code> 1.54:1 — so whichever
                        polarity wins, the row lands as a pale block pasted on the fold. The label pair is the part{' '}
                        <code>tone</code> can fix; the FILL pair is not.
                    </Note>
                    <Polarities surface="merchant-fold" ground="yellow">
                        {(look) => (
                            <div className="px-4 py-10 text-center">
                                <h2 className="text-heading-s text-foreground-primary uppercase">The menu, in pesos</h2>
                                <p className="mt-4 text-body-m text-foreground-primary">
                                    Every price at the cripto dólar rate.
                                </p>
                                <div className="mt-8 inline-flex">
                                    <ProposalTabs
                                        variant={look}
                                        aria-label="Currency"
                                        tabs={[
                                            { value: 'usd', label: 'USD' },
                                            { value: 'eur', label: 'EUR' },
                                        ]}
                                    />
                                </div>
                            </div>
                        )}
                    </Polarities>
                </Section>

                {/* ----------------------------------------------------- 9 states */}
                <Section id="states" title="9 — Focus, overflow, icon+text" className="gap-4">
                    <Note>
                        The three states a look has to survive beyond a resting row: the ruled 3px{' '}
                        <code>action-focus</code> ring (drawn unconditionally here, because <code>:focus-visible</code>{' '}
                        cannot be forced from CSS — never pink), an 8-tab row that overflows and scrolls, and icon+text
                        labels. Shown on the page tint, which is the ground the overflowing rows actually use.
                    </Note>
                    <Polarities surface="state-focus" ground="page">
                        {(look) => (
                            <div className="p-4">
                                <ProposalTabs
                                    variant={look}
                                    aria-label="Keyboard focus"
                                    forceFocusIndex={1}
                                    tabs={[
                                        { value: 'monthly', label: 'Monthly' },
                                        { value: 'yearly', label: 'Yearly' },
                                    ]}
                                />
                            </div>
                        )}
                    </Polarities>
                    <Polarities surface="state-overflow" ground="page">
                        {(look) => (
                            <div className="w-[343px] p-4">
                                <ProposalTabs variant={look} aria-label="Networks" tabs={NETWORK_TABS} />
                            </div>
                        )}
                    </Polarities>
                    <Polarities surface="state-icons" ground="page">
                        {(look) => (
                            <div className="p-4">
                                <ProposalTabs variant={look} aria-label="Actions" tabs={ICON_TABS} />
                            </div>
                        )}
                    </Polarities>
                </Section>

                <Notification priority="info" title="Scope">
                    <code>0_Bruddle/TabsLook</code> and every <code>/dev/tabs-proposals</code> page are dev-only. With
                    no look provider above them — which is every shipped screen — <code>Tabs</code> and{' '}
                    <code>SegmentedControl</code> render exactly as they do today, and all of it is deleted when the
                    winner lands. The one piece that stays is <code>0_Bruddle/PillSurface</code>: the radius, border and
                    fill that <code>BottomNav</code> and this look now share. BottomNav&rsquo;s rendered output is
                    byte-for-byte unchanged.
                </Notification>
            </div>
        </DevPageShell>
    )
}
