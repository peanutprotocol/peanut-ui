'use client'

import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import Loading from '@/components/Global/Loading'
import { printableUsdc } from '@/utils/balance.utils'
import { formatExtendedNumber } from '@/utils/general.utils'
import { useAppHaptic } from '@/hooks/useAppHaptic'
import { twMerge } from 'tailwind-merge'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useHomeDrawer, type HomeDrawer } from '../useHomeDrawer'

interface BalanceSectionProps {
    balance: bigint | undefined
    isFetching: boolean
    /** balance is the persisted last-known-good while the live sum is still
     *  pending — dim it rather than asserting it as current */
    isStale?: boolean
    isHidden: boolean
    onToggleVisibility: () => void
}

// home IA (figma section 17609:2334): add + send open a bottom drawer,
// request navigates directly (a Link, so it keeps prefetch + anchor semantics)
const SUBMENU_ACTIONS: Array<{ key: 'add' | 'send' | 'request'; icon: IconName; drawer?: HomeDrawer; href?: string }> =
    [
        { key: 'add', icon: 'plus', drawer: 'add' },
        { key: 'send', icon: 'arrow-up-right', drawer: 'send' },
        { key: 'request', icon: 'arrow-down-left', href: '/request' },
    ]

/**
 * balance block (figma home board 17830:75689): centered usd balance with
 * visibility toggle, plus the add / send / request submenu underneath.
 * submenu states per component 17533:117867 (default / pressed).
 */
export function BalanceSection({ balance, isFetching, isStale, isHidden, onToggleVisibility }: BalanceSectionProps) {
    const t = useTranslations('home')
    const tNav = useTranslations('navigation')
    const { triggerHaptic } = useAppHaptic()
    const [openDrawer, setOpenDrawer] = useHomeDrawer()

    const handleAction = (action: (typeof SUBMENU_ACTIONS)[number]) => {
        triggerHaptic()
        if (action.drawer) setOpenDrawer(action.drawer)
    }

    return (
        <div className="flex flex-col gap-6 pb-4">
            <div className="flex items-center justify-center gap-2">
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
                        className="cursor-pointer"
                        aria-pressed={isHidden}
                        aria-label={isHidden ? t('showBalance') : t('hideBalance')}
                    >
                        <Icon name={isHidden ? 'eye-slash' : 'eye'} size={20} className="text-foreground-primary" />
                    </button>
                )}
            </div>
            <div className="flex items-start justify-between px-10">
                {SUBMENU_ACTIONS.map((action) => {
                    const inner = (
                        <>
                            <span
                                className={twMerge(
                                    'flex size-12 items-center justify-center rounded-round border border-border-default transition-colors duration-instant',
                                    // pressed state per submenu board 17533:117867
                                    action.drawer && openDrawer === action.drawer
                                        ? 'border-border-button bg-action-ghost-hover'
                                        : 'active:border-border-button active:bg-action-ghost-hover'
                                )}
                            >
                                <Icon name={action.icon} size={24} className="text-foreground-primary" />
                            </span>
                            <span className="text-button-m text-foreground-primary">{tNav(action.key)}</span>
                        </>
                    )
                    const shared = {
                        className: 'flex w-14 cursor-pointer flex-col items-center gap-2',
                        'data-testid': `home-submenu-${action.key}`,
                    }
                    return action.href ? (
                        <Link key={action.key} href={action.href} onClick={() => triggerHaptic()} {...shared}>
                            {inner}
                        </Link>
                    ) : (
                        <button
                            key={action.key}
                            type="button"
                            onClick={() => handleAction(action)}
                            aria-expanded={openDrawer === action.drawer}
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
