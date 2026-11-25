'use client'

import { useEffect } from 'react'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import Loading from '@/components/Global/Loading'
import { printableUsdc } from '@/utils/balance.utils'
import { formatExtendedNumber } from '@/utils/general.utils'
import { useAppHaptic } from '@/hooks/useAppHaptic'
import { twMerge } from '@/utils/tw'
import { useTranslations } from 'next-intl'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import Link from 'next/link'
import { useHomeDrawer, type HomeDrawer } from '../useHomeDrawer'
import { homeDrawerOptions } from '../home-drawer-options'
import { useDepositAccountsEnabled } from '@/features/deposit-accounts/useDepositAccountsEnabled'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import posthog from 'posthog-js'
import { balanceBucket, showsAddMoneyPill } from '../addMoneyPill.utils'
import Image from 'next/image'
import sparkle from '@/assets/illustrations/sparkle.svg'

interface BalanceSectionProps {
    addMoneyEntry?: 'picker' | 'drawer'
    /** identity verified: with a balance under $10, Add moves to the centre as the pink button.
     *  it reads "Add money" for returning users too: one label, no "Top up" (TASK-25341) */
    isVerified?: boolean
    balance: bigint | undefined
    isFetching: boolean
    /** balance is the persisted last-known-good while the live sum is still
     *  pending — dim it rather than asserting it as current */
    isStale?: boolean
    isHidden: boolean
    onToggleVisibility: () => void
}

// home IA (figma section 17609:2334): add, send and request each open a bottom
// drawer. request offers two ways to be paid — share a request link, or share
// standing bank details. while only the link is offered it skips the drawer.
// the grid keeps Send centred and Request at the end whatever width Add takes
const SUBMENU_ACTIONS: Array<{ key: HomeDrawer; icon: IconName; slot: string }> = [
    { key: 'add', icon: 'plus', slot: 'justify-self-start' },
    { key: 'send', icon: 'arrow-up-right', slot: 'justify-self-center' },
    { key: 'request', icon: 'arrow-down-left', slot: 'justify-self-end' },
]
// low balance: Add takes the centre, between Send and Request
const ADD_CENTRED_ACTIONS = [SUBMENU_ACTIONS[1], SUBMENU_ACTIONS[0], SUBMENU_ACTIONS[2]].map((action, i) => ({
    ...action,
    slot: SUBMENU_ACTIONS[i].slot,
}))

/**
 * balance block (figma home board 17830:75689): centered usd balance with
 * visibility toggle, plus the add / send / request submenu underneath.
 * submenu states per component 17533:117867 (default / pressed).
 */
export function BalanceSection({
    addMoneyEntry = 'picker',
    isVerified = false,
    balance,
    isFetching,
    isStale,
    isHidden,
    onToggleVisibility,
}: BalanceSectionProps) {
    const t = useAppTranslations('home')
    const tNav = useTranslations('navigation')
    const { triggerHaptic } = useAppHaptic()
    const [openDrawer, setOpenDrawer] = useHomeDrawer()
    const depositAccounts = useDepositAccountsEnabled()

    // a hidden balance keeps the plain Add, so the pink button does not reveal it is under $10
    const showPill = !isHidden && showsAddMoneyPill({ isVerified, balance, isFetching, isStale })
    const trackTap = (action: HomeDrawer) =>
        posthog.capture(ANALYTICS_EVENTS.HOME_SUBMENU_TAPPED, { action, add_cta_active: showPill })

    useEffect(() => {
        if (!showPill || balance === undefined) return
        posthog.capture(ANALYTICS_EVENTS.HOME_ADD_CTA_SHOWN, {
            balance_bucket: balanceBucket(balance),
            label: 'add_money',
        })
        // once each time the pink button appears, not on every balance tick
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showPill])

    const openActionDrawer = (drawer: HomeDrawer) => {
        trackTap(drawer)
        triggerHaptic()
        setOpenDrawer(drawer)
    }

    return (
        <div className="flex flex-col gap-6 pb-4">
            {/* Keep the amount's line height while its smaller spinner is visible. */}
            <div className="flex min-h-[var(--text-heading-xl--line-height)] items-center justify-center gap-2">
                {isFetching || balance === undefined ? (
                    <Loading />
                ) : (
                    <span className={twMerge('flex items-center gap-2', isStale && 'opacity-50')}>
                        <span className="text-heading-s text-foreground-primary">$</span>
                        <span className="text-heading-xl text-foreground-primary">
                            {isHidden ? '****' : formatExtendedNumber(printableUsdc(balance))}
                        </span>
                    </span>
                )}
                {/* toggle stays reachable even when the balance query errors
                    (balance undefined, not fetching) — it also controls the
                    activity amounts, matching the old page's behavior */}
                {!isFetching && (
                    <button
                        type="button"
                        onClick={onToggleVisibility}
                        // 20px visual — extend the pressable area to 44px (touch-target law)
                        className="relative cursor-pointer after:absolute after:-inset-3"
                        aria-pressed={isHidden}
                        aria-label={isHidden ? t('showBalance') : t('hideBalance')}
                    >
                        <Icon name={isHidden ? 'eye-slash' : 'eye'} size={20} className="text-foreground-primary" />
                    </button>
                )}
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start px-10">
                {(showPill ? ADD_CENTRED_ACTIONS : SUBMENU_ACTIONS).map((action) => {
                    // a drawer with one row is a pointless extra tap: link to
                    // that row's destination instead (request, while standing
                    // bank details are not offered)
                    const options = action.key === 'add' ? [] : homeDrawerOptions(action.key, depositAccounts)
                    const directHref =
                        action.key === 'add' && addMoneyEntry === 'picker'
                            ? '/add-money'
                            : options.length === 1
                              ? options[0].href
                              : undefined
                    // pink fill, DS 4px shadow, press drops into it
                    const isPinkAdd = action.key === 'add' && showPill
                    const inner = (
                        <>
                            <span
                                className={twMerge(
                                    'relative flex size-12 items-center justify-center rounded-full border border-border-default transition-colors duration-instant',
                                    // pressed = action-primary per button board 17308:13973
                                    // ("buttons turn primary when pressed"); the submenu
                                    // board's ghost-hover binding resolves to the same pink
                                    // in figma, but the code token is the dark ghost-text
                                    // tint — see PR body token note
                                    !directHref && openDrawer === action.key
                                        ? 'border-border-button bg-action-primary'
                                        : 'active:border-border-button active:bg-action-primary',
                                    // last, so its press colour wins over the ghost press above
                                    isPinkAdd &&
                                        'border-border-button bg-action-primary shadow-4 transition-[translate,box-shadow,background-color] active:translate-x-1 active:translate-y-1 active:bg-action-primary-press active:shadow-none'
                                )}
                            >
                                <Icon name={action.icon} size={24} className="text-foreground-primary" />
                                {isPinkAdd && (
                                    <Image
                                        src={sparkle}
                                        alt=""
                                        aria-hidden
                                        className="add-cta-sparkle pointer-events-none absolute -top-3 -right-4 h-4 w-auto"
                                    />
                                )}
                            </span>
                            {/* one word in every locale, like Send and Request, so the label never wraps (Hugo, 25 Nov) */}
                            <span className="text-button-m text-foreground-primary">{tNav(action.key)}</span>
                        </>
                    )
                    const shared = {
                        className: twMerge(
                            'flex w-14 cursor-pointer flex-col items-center gap-2 focus-visible:outline-[3px] focus-visible:outline-action-focus',
                            action.slot
                        ),
                        'data-testid': `home-submenu-${action.key}`,
                    }
                    return directHref ? (
                        <Link
                            key={action.key}
                            href={directHref}
                            onClick={() => {
                                trackTap(action.key)
                                triggerHaptic()
                            }}
                            {...shared}
                        >
                            {inner}
                        </Link>
                    ) : (
                        <button
                            key={action.key}
                            type="button"
                            onClick={() => openActionDrawer(action.key)}
                            aria-expanded={openDrawer === action.key}
                            {...shared}
                        >
                            {inner}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
