'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Notification } from '@/components/0_Bruddle/Notification'
import { Tabs } from '@/components/0_Bruddle/Tabs'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { getCardPosition, type CardPosition } from '@/components/Global/Card/card.utils'
import DisplayIcon from '@/components/Global/DisplayIcon'
import { Drawer, DrawerContent } from '@/components/Global/Drawer'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { Icon } from '@/components/Global/Icons/Icon'
import { SearchInput } from '@/components/SearchInput'
import { twMerge } from '@/utils/tw'

/**
 * /dev/token-selector draft skins — the selected-row looks, the leading-slot
 * options and the trigger options the proposal page compares.
 *
 * Deliberately LOCAL to this proposal page. `Global/TokenSelector/*` is
 * untouched; the winning skin is applied to the real components in a separate
 * PR and this directory is deleted then.
 *
 * ONE row implementation, four skins. Every skin gets the same real `ListItem`,
 * the same six mock tokens and the same markup — only the class strings in
 * `SKINS` differ, so the page compares looks and nothing else.
 *
 * TWO things had to be built here rather than reused, and both are flagged on
 * the page per design.md law 6:
 *  - `ListItem` has no `selected` prop and forwards no `role`/`aria-selected`,
 *    so the listbox semantics ride a wrapper element. A promotion PR should put
 *    `selected` + ARIA on `ListItem` itself instead of repeating this wrapper.
 *  - putting the interactive affordance on the wrapper means `ListItem` gets no
 *    `onClick`, so it contributes no `role="button"` (which may not nest inside
 *    a `role="option"`) — and no haptic. The haptic comes back with the prop.
 */

// ---------------------------------------------------------------- mock data

export interface TokenOption {
    id: string
    symbol: string
    /** the token's own name — the body line whenever the chain is elsewhere */
    name: string
    chainId: string
    chainName: string
    logoURI: string
    chainLogoURI: string
}

// real logo URLs, copied from src/constants/chainRegistry.consts.ts. next.config
// remotePatterns is a `*` wildcard, so the host is allowed; DisplayIcon falls
// back to the DS initials avatar if a URL ever 404s.
const CHAIN_LOGO = {
    arbitrum: 'https://assets.coingecko.com/asset_platforms/images/33/standard/AO_logomark.png?1706606717',
    base: 'https://assets.coingecko.com/asset_platforms/images/131/standard/base.png?1759905869',
    optimism: 'https://assets.coingecko.com/asset_platforms/images/41/standard/optimism.png?1706606778',
    ethereum: 'https://assets.coingecko.com/asset_platforms/images/279/standard/ethereum.png?1706606803',
} as const

const USDC_LOGO = 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png'
const USDT_LOGO = 'https://assets.coingecko.com/coins/images/325/standard/Tether.png?1696501661'
const ETH_LOGO = 'https://assets.coingecko.com/coins/images/279/standard/ethereum.png?1696501628'
const DAI_LOGO = 'https://assets.coingecko.com/coins/images/9956/standard/Badge_Dai.png?1696509996'

export const MOCK_TOKENS: TokenOption[] = [
    {
        id: 'usdc-42161',
        symbol: 'USDC',
        name: 'USD Coin',
        chainId: '42161',
        chainName: 'Arbitrum',
        logoURI: USDC_LOGO,
        chainLogoURI: CHAIN_LOGO.arbitrum,
    },
    {
        id: 'usdt-42161',
        symbol: 'USDT',
        name: 'Tether',
        chainId: '42161',
        chainName: 'Arbitrum',
        logoURI: USDT_LOGO,
        chainLogoURI: CHAIN_LOGO.arbitrum,
    },
    {
        id: 'eth-42161',
        symbol: 'ETH',
        name: 'Ethereum',
        chainId: '42161',
        chainName: 'Arbitrum',
        logoURI: ETH_LOGO,
        chainLogoURI: CHAIN_LOGO.arbitrum,
    },
    {
        id: 'usdc-8453',
        symbol: 'USDC',
        name: 'USD Coin',
        chainId: '8453',
        chainName: 'Base',
        logoURI: USDC_LOGO,
        chainLogoURI: CHAIN_LOGO.base,
    },
    {
        id: 'usdc-10',
        symbol: 'USDC',
        name: 'USD Coin',
        chainId: '10',
        chainName: 'Optimism',
        logoURI: USDC_LOGO,
        chainLogoURI: CHAIN_LOGO.optimism,
    },
    {
        id: 'dai-1',
        symbol: 'DAI',
        name: 'Dai',
        chainId: '1',
        chainName: 'Ethereum',
        logoURI: DAI_LOGO,
        chainLogoURI: CHAIN_LOGO.ethereum,
    },
]

export const CHAIN_FILTERS = [
    { value: 'all', label: 'All' },
    { value: '42161', label: 'Arbitrum' },
    { value: '8453', label: 'Base' },
    { value: '10', label: 'Optimism' },
    { value: '1', label: 'Ethereum' },
] as const

// ------------------------------------------------------------------- skins

export type SkinKey = 'fill' | 'check' | 'border' | 'fill-check'

interface Skin {
    /** merged onto the selected row's ListItem */
    selected: string
    /** merged onto every UNSELECTED row (Border is the only skin that uses it) */
    unselected: string
    /** colour for the title + body of a selected row */
    selectedText: string
    /** selected rows carry a trailing check glyph */
    check: boolean
}

// `text-foreground-over-color-primary` (#000000) is the token that exists for
// text on a brand fill, and it has zero product call sites. Note the tension:
// the DS audit (dev/ds/audit/audit-data.ts:5613) lists it among four tokens to
// DELETE as exact hex duplicates of tokens already in use. Same #000000 as
// `foreground-primary`, so the pixels are identical either way — this is a
// naming call, not a visual one, and it needs the same ruling.
const SKINS: Record<SkinKey, Skin> = {
    fill: {
        selected: 'bg-action-primary',
        unselected: '',
        selectedText: 'text-foreground-over-color-primary',
        check: false,
    },
    check: {
        selected: '',
        unselected: '',
        selectedText: '',
        check: true,
    },
    border: {
        selected: '',
        // the collision to weigh: border-subtle is ALSO the disabled border
        unselected: 'border-border-subtle',
        selectedText: '',
        check: false,
    },
    'fill-check': {
        selected: 'bg-action-primary',
        unselected: '',
        selectedText: 'text-foreground-over-color-primary',
        check: true,
    },
}

// ----------------------------------------------------------- leading slots

export type LeadingKey = 'logo' | 'badge' | 'composite'

const TokenLogo = ({ token }: { token: TokenOption }) => (
    <DisplayIcon
        iconUrl={token.logoURI}
        altText={`${token.symbol} logo`}
        fallbackName={token.symbol}
        sizeClass="size-6"
    />
)

/**
 * L3 only: the composite that ships today — a 24px token logo with a 16px chain
 * logo pinned to its corner. design.md bans it ("never a hand-rolled composite
 * — no mini-badge overlaid on a logo"), and it is here to be compared, not
 * copied. The shipped one rings the badge in `border-white` with dead
 * `dark:border-black dark:bg-gray-600` siblings; this reproduction spends the
 * semantic equivalent so the page itself stays on tokens.
 */
const CompositeLogo = ({ token }: { token: TokenOption }) => (
    <div className="relative shrink-0">
        <TokenLogo token={token} />
        <div className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-round border-2 border-background-default bg-background-disabled">
            <DisplayIcon
                iconUrl={token.chainLogoURI}
                altText={`${token.chainName} logo`}
                fallbackName={token.chainName}
                sizeClass="size-4"
            />
        </div>
    </div>
)

// --------------------------------------------------------------- the row

interface TokenOptionRowProps {
    token: TokenOption
    selected: boolean
    skin: SkinKey
    leading: LeadingKey
    position: CardPosition
    onSelect: (id: string) => void
}

/**
 * One row, four skins, three leading slots. The ARIA is NOT a variant: every
 * skin ships `role="option"` + `aria-selected`, because a screen reader cannot
 * hear a pink fill. That is the floor the page asks the owner to ratify, not a
 * thing to choose.
 */
export const TokenOptionRow = ({ token, selected, skin, leading, position, onSelect }: TokenOptionRowProps) => {
    const style = SKINS[skin]
    const paint = selected ? style.selectedText : ''

    return (
        // the wrapper carries the option semantics and the interaction, because
        // ListItem forwards neither a role nor aria-selected (flagged on the page)
        <div
            role="option"
            aria-selected={selected}
            tabIndex={0}
            onClick={() => onSelect(token.id)}
            onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                onSelect(token.id)
            }}
            className="cursor-pointer focus-visible:outline-[3px] focus-visible:outline-action-focus"
        >
            <ListItem
                position={position}
                className={twMerge(
                    'transition-colors duration-instant active:bg-background-disabled',
                    selected ? style.selected : style.unselected
                )}
                leading={leading === 'composite' ? <CompositeLogo token={token} /> : <TokenLogo token={token} />}
                title={<span className={paint}>{token.symbol}</span>}
                body={<span className={paint}>{leading === 'logo' ? token.chainName : token.name}</span>}
                trailing={
                    <>
                        {leading === 'badge' && <StatusBadge status="custom" customText={token.chainName} />}
                        {selected && style.check && <Icon name="check" size={20} className={paint} />}
                    </>
                }
            />
        </div>
    )
}

interface TokenOptionListProps {
    tokens: TokenOption[]
    selectedId: string
    onSelect: (id: string) => void
    skin: SkinKey
    leading: LeadingKey
    'aria-label': string
}

/** The grouped list: contiguous rows via getCardPosition, one listbox around them. */
export const TokenOptionList = ({
    tokens,
    selectedId,
    onSelect,
    skin,
    leading,
    'aria-label': ariaLabel,
}: TokenOptionListProps) => (
    <div role="listbox" aria-label={ariaLabel}>
        {tokens.map((token, index) => (
            <TokenOptionRow
                key={token.id}
                token={token}
                selected={token.id === selectedId}
                skin={skin}
                leading={leading}
                position={getCardPosition(index, tokens.length)}
                onSelect={onSelect}
            />
        ))}
    </div>
)

// ------------------------------------------------------------- the trigger

/**
 * T1 — the recommended trigger: a real `ListItem` with a chevron. A row that
 * opens a picker IS a list row, so it needs no overrides at all.
 */
export const ListItemTrigger = ({ token, onClick }: { token: TokenOption; onClick: () => void }) => (
    <ListItem
        position="single"
        leading={<TokenLogo token={token} />}
        title={token.symbol}
        body={token.chainName}
        chevron
        onClick={onClick}
    />
)

/**
 * T2 — today's trigger: a `Button variant="stroke"` beaten into a card. It
 * overrides the Button board's shape, height and padding at the call site,
 * which design.md law 7 puts in `.btn-*` / `Button` and nowhere else.
 *
 * The shipped className also carries `hover:bg-background-default
 * hover:text-foreground-primary`, which neuters the Button's own hover. Those
 * two classes are described rather than reproduced: a `hover:` with no
 * `active:` beside it is itself a ratcheted lint metric, and this page must not
 * spend a point of it to quote one.
 */
export const FakeCardTrigger = ({ token, onClick }: { token: TokenOption; onClick: () => void }) => (
    <Button
        variant="stroke"
        shadowSize="4"
        onClick={onClick}
        className="flex min-h-16 w-full items-center justify-between rounded-sm bg-background-default p-4"
    >
        <div className="flex w-full items-center justify-between gap-3 overflow-hidden">
            <div className="flex items-center gap-2 overflow-hidden">
                <CompositeLogo token={token} />
                <span className="truncate text-body-m-semibold text-foreground-primary">
                    {token.symbol}
                    <span className="text-body-s text-foreground-secondary"> on {token.chainName}</span>
                </span>
            </div>
            <Icon name="chevron-up" size={24} className="shrink-0 rotate-90 text-foreground-primary" />
        </div>
    </Button>
)

// --------------------------------------------------- the composed drawer

/** substring match on symbol, name and chain — what the shipped selector is not */
const matches = (token: TokenOption, query: string) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
        token.symbol.toLowerCase().includes(q) ||
        token.name.toLowerCase().includes(q) ||
        token.chainName.toLowerCase().includes(q)
    )
}

/**
 * Section 5 — the whole picker, composed from DS parts and actually usable.
 *
 * Three structural changes from what ships, each independent of the skin ruling:
 *  - the search field sits ABOVE the tabs, so switching a tab cannot unmount it
 *  - the rows are ONE grouped card (getCardPosition), not N solo cards in a stack
 *  - search is substring, so "usd" finds USDC and USDT
 *
 * The network row is a CONTENTLESS `Tabs`: no tab carries `content`, so only the
 * ruled Weight trigger row renders and the token list is a plain sibling under
 * it. That is the shape the Tabs docblock prescribes for a value toggle — "omit
 * on EVERY tab for a triggers-only row" — and it means the list exists once in
 * the tree instead of once per tab.
 */
export const ComposedPicker = ({ skin, leading }: { skin: SkinKey; leading: LeadingKey }) => {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [chain, setChain] = useState<string>('all')
    const [selectedId, setSelectedId] = useState(MOCK_TOKENS[0].id)

    const visible = useMemo(
        () => MOCK_TOKENS.filter((token) => (chain === 'all' || token.chainId === chain) && matches(token, search)),
        [chain, search]
    )

    const selectedToken = MOCK_TOKENS.find((token) => token.id === selectedId) ?? MOCK_TOKENS[0]

    const list: ReactNode =
        visible.length > 0 ? (
            <TokenOptionList
                tokens={visible}
                selectedId={selectedId}
                onSelect={(id) => {
                    setSelectedId(id)
                    setOpen(false)
                }}
                skin={skin}
                leading={leading}
                aria-label="Token"
            />
        ) : (
            <EmptyState
                icon="search"
                title="No tokens found"
                description="Try another symbol, or clear the network filter."
            />
        )

    return (
        <div className="flex flex-col gap-4">
            <ListItemTrigger token={selectedToken} onClick={() => setOpen(true)} />

            <Drawer open={open} onOpenChange={setOpen}>
                <DrawerContent accessibleTitle="Select a token" className="py-4">
                    <div className="flex flex-col gap-4">
                        <SearchInput
                            value={search}
                            onChange={setSearch}
                            onClear={() => setSearch('')}
                            placeholder="Search token"
                            aria-label="Search token"
                            clearLabel="Clear search"
                        />
                        <Tabs
                            aria-label="Network"
                            value={chain}
                            onValueChange={setChain}
                            tabs={CHAIN_FILTERS.map((filter) => ({
                                value: filter.value,
                                label: filter.label,
                            }))}
                        />
                        {list}
                        <Notification priority="info" title="Everything above is DS parts">
                            Trigger, search field, tabs, rows and the empty state are the shipped components. Only the
                            selected-row skin is a proposal.
                        </Notification>
                    </div>
                </DrawerContent>
            </Drawer>
        </div>
    )
}
