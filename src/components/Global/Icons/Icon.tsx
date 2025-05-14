import { ComponentType, FC, SVGProps } from 'react'
import { AchievementsIcon } from './achievements'
import { ArrowDownIcon } from './arrow-down'
import { ArrowDownLeftIcon } from './arrow-down-left'
import { ArrowUpIcon } from './arrow-up'
import { ArrowUpRightIcon } from './arrow-up-right'
import { BankIcon } from './bank'
import { CameraIcon } from './camera'
import { CancelIcon } from './cancel'
import { CheckIcon } from './check'
import { ChevronUpIcon } from './chevron-up'
import { ClipIcon } from './clip'
import { CopyIcon } from './copy'
import { CurrencyIcon } from './currency'
import { DownloadIcon } from './download'
import { ErrorIcon } from './error'
import { ExchangeIcon } from './exchange'
import { EyeIcon } from './eye'
import { EyeSlashIcon } from './eye-slash'
import { FeesIcon } from './fees'
import { GiftIcon } from './gift'
import { HomeIcon } from './home'
import { LinkIcon } from './link'
import { LogoutIcon } from './logout'
import { PaperClipIcon } from './paper-clip'
import { PeanutSupportIcon } from './peanut-support'
import { QrCodeIcon } from './qr-code'
import { SearchIcon } from './search'
import { ShareIcon } from './share'
import { SmileIcon } from './smile'
import { StarIcon } from './star'
import { TxnOffIcon } from './txn-off'
import { UserIcon } from './user'
import { UserPlusIcon } from './user-plus'
import { WalletIcon } from './wallet'
import { WalletCancelIcon } from './wallet-cancel'
import { WalletOutlineIcon } from './wallet-outline'

// available icon names
export type IconName =
    | 'arrow-down'
    | 'arrow-down-left'
    | 'arrow-up'
    | 'arrow-up-right'
    | 'bank'
    | 'camera'
    | 'check'
    | 'chevron-up'
    | 'copy'
    | 'cancel'
    | 'download'
    | 'eye'
    | 'eye-slash'
    | 'exchange'
    | 'fees'
    | 'gift'
    | 'home'
    | 'peanut-support'
    | 'search'
    | 'txn-off'
    | 'wallet'
    | 'wallet-cancel'
    | 'wallet-outline'
    | 'currency'
    | 'achievements'
    | 'link'
    | 'logout'
    | 'paperclip'
    | 'smile'
    | 'star'
    | 'user'
    | 'share'
    | 'user-plus'
    | 'qr-code'
    | 'error'
    | 'clip'

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
    bank: BankIcon,
    camera: CameraIcon,
    check: CheckIcon,
    'chevron-up': ChevronUpIcon,
    download: DownloadIcon,
    eye: EyeIcon,
    'eye-slash': EyeSlashIcon,
    exchange: ExchangeIcon,
    fees: FeesIcon,
    gift: GiftIcon,
    home: HomeIcon,
    'peanut-support': PeanutSupportIcon,
    search: SearchIcon,
    'txn-off': TxnOffIcon,
    wallet: WalletIcon,
    'wallet-cancel': WalletCancelIcon,
    'wallet-outline': WalletOutlineIcon,
    currency: CurrencyIcon,
    achievements: AchievementsIcon,
    link: LinkIcon,
    logout: LogoutIcon,
    paperclip: PaperClipIcon,
    smile: SmileIcon,
    user: UserIcon,
    share: ShareIcon,
    star: StarIcon,
    'user-plus': UserPlusIcon,
    copy: CopyIcon,
    cancel: CancelIcon,
    'qr-code': QrCodeIcon,
    error: ErrorIcon,
    clip: ClipIcon,
}

export const Icon: FC<IconProps> = ({ name, size = 24, width, height, ...props }) => {
    const IconComponent = iconComponents[name]

    if (!IconComponent) {
        console.warn(`Icon "${name}" not found`)
        return null
    }

    return <IconComponent width={width || size} height={height || size} {...props} />
}
