import { ComponentType, FC, SVGProps } from 'react'
import { ArrowDownIcon } from './arrow-down'
import { ArrowDownLeftIcon } from './arrow-down-left'
import { ArrowUpIcon } from './arrow-up'
import { ArrowUpRightIcon } from './arrow-up-right'
import { BankIcon } from './bank'
import { CheckIcon } from './check'
import { ExchangeIcon } from './exchange'
import { FeesIcon } from './fees'
import { HomeIcon } from './home'
import { OpenIcon } from './open'
import { PeanutSupportIcon } from './peanut-support'
import { SearchIcon } from './search'
import { TxnOffIcon } from './txn-off'
import { WalletIcon } from './wallet'

// allowed icon names
export type IconName =
    | 'arrow-down'
    | 'arrow-down-left'
    | 'arrow-up'
    | 'arrow-up-right'
    | 'check'
    | 'exchange'
    | 'fees'
    | 'home'
    | 'open'
    | 'peanut-support'
    | 'search'
    | 'txn-off'
    | 'bank'
    | 'wallet'

export interface IconProps extends SVGProps<SVGSVGElement> {
    name: IconName
    size?: number | string
}

// icon names mapping to their components
const iconComponents: Record<IconName, ComponentType<SVGProps<SVGSVGElement>>> = {
    'arrow-down': ArrowDownIcon,
    'arrow-down-left': ArrowDownLeftIcon,
    'arrow-up': ArrowUpIcon,
    'arrow-up-right': ArrowUpRightIcon,
    check: CheckIcon,
    exchange: ExchangeIcon,
    fees: FeesIcon,
    home: HomeIcon,
    open: OpenIcon,
    'peanut-support': PeanutSupportIcon,
    search: SearchIcon,
    'txn-off': TxnOffIcon,
    bank: BankIcon,
    wallet: WalletIcon,
}

export const Icon: FC<IconProps> = ({ name, size = 24, width, height, ...props }) => {
    const IconComponent = iconComponents[name]

    if (!IconComponent) {
        console.warn(`Icon "${name}" not found`)
        return null
    }

    return <IconComponent width={width || size} height={height || size} {...props} />
}
