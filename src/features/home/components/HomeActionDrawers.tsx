'use client'

import { Drawer, DrawerContent, DrawerTitle } from '@/components/Global/Drawer'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import { useHomeDrawer, type HomeDrawer } from '../useHomeDrawer'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

type HomeDrawerKey = 'sendToFriends' | 'withdrawToOwnAccounts'
type HomeDrawerBodyKey = 'sendToFriendsDescription' | 'withdrawToOwnAccountsDescription'
type AddMethodKey = 'bankTransfer' | 'crypto'

interface DrawerOption {
    key: string
    /** i18n namespace + key — 'drawers' = home.drawers, 'methods' = addMoney.methods */
    titleKey: ['drawers', HomeDrawerKey] | ['methods', AddMethodKey]
    bodyKey?: HomeDrawerBodyKey
    icon: IconName
    href: string
}

// send drawer board 17831:79186; add drawer board 17830:76839. the add drawer
// carries a withdraw entry per the section arrows (Add -> Withdraw) — this IA
// restores withdraw access from home through both drawers.
const DRAWER_OPTIONS: Record<HomeDrawer, DrawerOption[]> = {
    send: [
        {
            key: 'send-friends',
            titleKey: ['drawers', 'sendToFriends'],
            bodyKey: 'sendToFriendsDescription',
            icon: 'arrow-up-right',
            href: '/send',
        },
        {
            key: 'withdraw',
            titleKey: ['drawers', 'withdrawToOwnAccounts'],
            bodyKey: 'withdrawToOwnAccountsDescription',
            icon: 'arrow-down',
            href: '/withdraw',
        },
    ],
    add: [
        { key: 'bank', titleKey: ['methods', 'bankTransfer'], icon: 'bank', href: '/add-money?method=bank' },
        { key: 'crypto', titleKey: ['methods', 'crypto'], icon: 'credit-card', href: '/add-money/crypto' },
        {
            key: 'withdraw',
            titleKey: ['drawers', 'withdrawToOwnAccounts'],
            bodyKey: 'withdrawToOwnAccountsDescription',
            icon: 'arrow-down',
            href: '/withdraw',
        },
    ],
}

/**
 * home IA bottom drawers (figma boards 17831:79186 / 17830:76839): the Add and
 * Send quick actions open a drawer with routing options instead of navigating.
 * open state is url-backed via useHomeDrawer (?drawer=add|send).
 */
export function HomeActionDrawers() {
    const [drawer, setDrawer] = useHomeDrawer()
    const t = useTranslations('home.drawers')
    const tMethods = useTranslations('addMoney.methods')
    const tNav = useTranslations('navigation')
    const router = useRouter()

    const navigate = (href: string) => {
        // clear the drawer param first so browser-back from the destination
        // lands on a closed home, then route
        setDrawer(null)
        router.push(href)
    }

    return (
        <Drawer open={drawer !== null} onOpenChange={(isOpen) => !isOpen && setDrawer(null)}>
            <DrawerContent className="px-4 pb-8">
                {drawer && (
                    <div className="flex flex-col gap-4">
                        <DrawerTitle className="text-center text-heading-s text-foreground-primary">
                            {tNav(drawer)}
                        </DrawerTitle>
                        <div className="flex flex-col">
                            {DRAWER_OPTIONS[drawer].map((option, index, all) => (
                                <ListItem
                                    key={option.key}
                                    position={getCardPosition(index, all.length)}
                                    leading={<Icon name={option.icon} size={24} className="text-foreground-primary" />}
                                    title={
                                        option.titleKey[0] === 'methods'
                                            ? tMethods(option.titleKey[1] as AddMethodKey)
                                            : t(option.titleKey[1] as HomeDrawerKey)
                                    }
                                    body={option.bodyKey ? t(option.bodyKey) : undefined}
                                    chevron
                                    onClick={() => navigate(option.href)}
                                    data-testid={`home-drawer-${drawer}-${option.key}`}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </DrawerContent>
        </Drawer>
    )
}
