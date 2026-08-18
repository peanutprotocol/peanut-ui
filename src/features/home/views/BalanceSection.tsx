'use client'

import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import Loading from '@/components/Global/Loading'
import { printableUsdc } from '@/utils/balance.utils'
import { formatExtendedNumber } from '@/utils/general.utils'
import { useHaptic } from 'use-haptic'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

interface BalanceSectionProps {
    balance: bigint | undefined
    isFetching: boolean
    isHidden: boolean
    onToggleVisibility: () => void
}

const SUBMENU_ACTIONS: Array<{ key: 'add' | 'send' | 'request'; href: string; icon: IconName }> = [
    { key: 'add', href: '/add-money', icon: 'plus' },
    { key: 'send', href: '/send', icon: 'arrow-up-right' },
    { key: 'request', href: '/request', icon: 'arrow-down-left' },
]

/**
 * balance block (figma home board 17830:75689): centered usd balance with
 * visibility toggle, plus the add / send / request submenu underneath.
 */
export function BalanceSection({ balance, isFetching, isHidden, onToggleVisibility }: BalanceSectionProps) {
    const t = useTranslations('home')
    const tNav = useTranslations('navigation')
    const { triggerHaptic } = useHaptic()

    return (
        <div className="flex flex-col gap-6 pb-4">
            <div className="flex items-center justify-center gap-2">
                {isFetching || balance === undefined ? (
                    <Loading />
                ) : (
                    <>
                        <span className="text-heading-s text-foreground-primary">$</span>
                        <span className="text-heading-xl text-foreground-primary">
                            {isHidden ? '****' : formatExtendedNumber(printableUsdc(balance))}
                        </span>
                    </>
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
                {SUBMENU_ACTIONS.map(({ key, href, icon }) => (
                    <Link
                        key={key}
                        href={href}
                        onClick={() => triggerHaptic()}
                        className="flex w-14 flex-col items-center gap-2"
                    >
                        <span className="flex size-12 items-center justify-center rounded-round border border-border-default">
                            <Icon name={icon} size={24} className="text-foreground-primary" />
                        </span>
                        <span className="text-button-m text-foreground-primary">{tNav(key)}</span>
                    </Link>
                ))}
            </div>
        </div>
    )
}
