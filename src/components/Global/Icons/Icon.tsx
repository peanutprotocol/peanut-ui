import { ComponentType, FC, SVGProps } from 'react'
import { AchievementsIcon } from './achievements'
import { AlertIcon } from './alert'
import { ArrowDownIcon } from './arrow-down'
import { ArrowDownLeftIcon } from './arrow-down-left'
import { ArrowUpIcon } from './arrow-up'
import { ArrowUpRightIcon } from './arrow-up-right'
import { BankIcon } from './bank'
import { CameraIcon } from './camera'
import { CancelIcon } from './cancel'
import { CheckIcon } from './check'
import { CheckCircleIcon } from './check-circle'
import { ChevronUpIcon } from './chevron-up'
import { ClipIcon } from './clip'
import { CopyIcon } from './copy'
import { CurrencyIcon } from './currency'
import { DocsIcon } from './docs'
import { DownloadIcon } from './download'
import { ErrorIcon } from './error'
import { ExchangeIcon } from './exchange'
import { ExchangeArrowsIcon } from './exchange-arrows'
import { ExternalLinkIcon } from './external-link'
import { EyeIcon } from './eye'
import { EyeSlashIcon } from './eye-slash'
import { FeesIcon } from './fees'
import { GiftIcon } from './gift'
import { HistoryIcon } from './history'
import { HomeIcon } from './home'
import { InfoIcon } from './Info'
import { LinkIcon } from './link'
import { LogoutIcon } from './logout'
import { MobileInstallIcon } from './mobile-install'
import { PaperClipIcon } from './paper-clip'
import { PeanutSupportIcon } from './peanut-support'
import { PlusIcon } from './plus'
import { QrCodeIcon } from './qr-code'
import { RetryIcon } from './retry'
import { SearchIcon } from './search'
import { ShareIcon } from './share'
import { SmileIcon } from './smile'
import { StarIcon } from './star'
import { SwitchIcon } from './switch'
import { TxnOffIcon } from './txn-off'
import { UserIcon } from './user'
import { UserPlusIcon } from './user-plus'
import { WalletIcon } from './wallet'
import { WalletCancelIcon } from './wallet-cancel'
import { WalletOutlineIcon } from './wallet-outline'
import { BadgeIcon } from './badge'
import { UserIdIcon } from './user-id'
import { ClockIcon } from './clock'
import { DollarIcon } from './dollar'
import { LinkSlashIcon } from './link-slash'
import { SuccessIcon } from './success'
import { PendingIcon } from './pending'
import { ProcessingIcon } from './processing'
import { FailedIcon } from './failed'
import { ChevronDownIcon } from './chevron-down'
import { DoubleCheckIcon } from './double-check'
import { QuestionMarkIcon } from './question-mark'
import { ShieldIcon } from './shield'
import { TrophyIcon } from './trophy'
import { InviteHeartIcon } from './invite-heart'
import { LockIcon } from './lock'
import { InviterHeartIcon } from './inviter-heart'

// available icon names
export type IconName =
    | 'alert'
    | 'arrow-down'
    | 'arrow-down-left'
    | 'arrow-up'
    | 'arrow-up-right'
    | 'bank'
    | 'camera'
    | 'check'
    | 'chevron-up'
    | 'copy'
    | 'check-circle'
    | 'cancel'
    | 'download'
    | 'double-check'
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
    | 'link-slash'
    | 'logout'
    | 'paperclip'
    | 'smile'
    | 'star'
    | 'user'
    | 'share'
    | 'user-plus'
    | 'qr-code'
    | 'history'
    | 'docs'
    | 'error'
    | 'clip'
    | 'info'
    | 'external-link'
    | 'plus'
    | 'exchange-arrows'
    | 'switch'
    | 'mobile-install'
    | 'retry'
    | 'badge'
    | 'user-id'
    | 'clock'
    | 'dollar'
    | 'success'
    | 'pending'
    | 'processing'
    | 'failed'
    | 'chevron-down'
    | 'shield'
    | 'question-mark'
    | 'trophy'
    | 'invite-heart'
    | 'lock'
    | 'inviter-heart'

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
    badge: BadgeIcon,
    camera: CameraIcon,
    check: CheckIcon,
    'chevron-up': ChevronUpIcon,
    download: DownloadIcon,
    dollar: DollarIcon,
    'double-check': DoubleCheckIcon,
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
    'link-slash': LinkSlashIcon,
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
    history: HistoryIcon,
    docs: DocsIcon,
    error: ErrorIcon,
    clip: ClipIcon,
    info: InfoIcon,
    'external-link': ExternalLinkIcon,
    plus: PlusIcon,
    'exchange-arrows': ExchangeArrowsIcon,
    alert: AlertIcon,
    switch: SwitchIcon,
    'check-circle': CheckCircleIcon,
    'mobile-install': MobileInstallIcon,
    retry: RetryIcon,
    'user-id': UserIdIcon,
    clock: ClockIcon,
    success: SuccessIcon,
    pending: PendingIcon,
    processing: ProcessingIcon,
    failed: FailedIcon,
    'chevron-down': ChevronDownIcon,
    'question-mark': QuestionMarkIcon,
    shield: ShieldIcon,
    trophy: TrophyIcon,
    'invite-heart': InviteHeartIcon,
    lock: LockIcon,
    'inviter-heart': InviterHeartIcon,
}

export const Icon: FC<IconProps> = ({ name, size = 24, width, height, ...props }) => {
    const IconComponent = iconComponents[name]

    if (!IconComponent) {
        console.warn(`Icon "${name}" not found`)
        return null
    }

    return <IconComponent width={width || size} height={height || size} {...props} />
}
