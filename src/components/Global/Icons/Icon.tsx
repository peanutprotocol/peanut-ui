import { type ComponentType, type FC, type SVGProps } from 'react'
import {
    ArrowDownward as ArrowDownwardIcon,
    SouthWest as SouthWestIcon,
    ArrowUpward as ArrowUpwardIcon,
    NorthEast as NorthEastIcon,
    AccountBalanceRounded as AccountBalanceRoundedIcon,
    NotificationsActiveOutlined as NotificationsActiveOutlinedIcon,
    GppGoodOutlined as GppGoodOutlinedIcon,
    CameraAlt as CameraAltIcon,
    Check as CheckIcon,
    KeyboardArrowUp as KeyboardArrowUpIcon,
    GetAppRounded as GetAppRoundedIcon,
    AttachMoneyRounded as AttachMoneyRoundedIcon,
    DoneAllRounded as DoneAllRoundedIcon,
    RemoveRedEyeRounded as RemoveRedEyeRoundedIcon,
    VisibilityOffRounded as VisibilityOffRoundedIcon,
    CurrencyExchangeRounded as CurrencyExchangeRoundedIcon,
    LocalOfferOutlined as LocalOfferOutlinedIcon,
    CardGiftcardRounded as CardGiftcardRoundedIcon,
    HomeRounded as HomeRoundedIcon,
    SearchRounded as SearchRoundedIcon,
    AccountBalanceWalletRounded as AccountBalanceWalletRoundedIcon,
    AccountBalanceWalletOutlined as AccountBalanceWalletOutlinedIcon,
    PaymentsOutlined as PaymentsOutlinedIcon,
    WorkspacePremiumOutlined as WorkspacePremiumOutlinedIcon,
    LinkOutlined as LinkOutlinedIcon,
    LinkOffOutlined as LinkOffOutlinedIcon,
    LogoutOutlined as LogoutOutlinedIcon,
    AttachmentRounded as AttachmentRoundedIcon,
    MoodOutlined as MoodOutlinedIcon,
    PersonOutlineOutlined as PersonOutlineOutlinedIcon,
    IosShareOutlined as IosShareOutlinedIcon,
    StarRounded as StarRoundedIcon,
    PersonAddOutlined as PersonAddOutlinedIcon,
    ContentCopyOutlined as ContentCopyOutlinedIcon,
    CloseRounded as CloseRoundedIcon,
    QrCode2Rounded as QrCode2RoundedIcon,
    UpdateRounded as UpdateRoundedIcon,
    ErrorOutlined as ErrorOutlinedIcon,
    InfoOutlined as InfoOutlinedIcon,
    OpenInNewOutlined as OpenInNewOutlinedIcon,
    AddRounded as AddRoundedIcon,
    WarningAmberRounded as WarningAmberRoundedIcon,
    PowerSettingsNewRounded as PowerSettingsNewRoundedIcon,
    CheckCircleOutlineRounded as CheckCircleOutlineRoundedIcon,
    InstallMobileOutlined as InstallMobileOutlinedIcon,
    AutorenewRounded as AutorenewRoundedIcon,
    AssignmentIndOutlined as AssignmentIndOutlinedIcon,
    AccessTimeOutlined as AccessTimeOutlinedIcon,
    HourglassEmptyRounded as HourglassEmptyRoundedIcon,
    KeyboardArrowDownRounded as KeyboardArrowDownRoundedIcon,
    HelpOutlineRounded as HelpOutlineRoundedIcon,
    VerifiedUserOutlined as VerifiedUserOutlinedIcon,
    EmojiEventsOutlined as EmojiEventsOutlinedIcon,
    LockOutlined as LockOutlinedIcon,
    CallSplitRounded as CallSplitRoundedIcon,
    VpnLockOutlined as VpnLockOutlinedIcon,
} from '@mui/icons-material'
import { DocsIcon } from './docs'
import { PeanutSupportIcon } from './peanut-support'
import { TxnOffIcon } from './txn-off'
import { WalletCancelIcon } from './wallet-cancel'
import { InviteHeartIcon } from './invite-heart'
import { BulbIcon } from './bulb'

// available icon names
export type IconName =
    | 'alert'
    | 'arrow-down'
    | 'arrow-down-left'
    | 'arrow-up'
    | 'arrow-up-right'
    | 'bank'
    | 'bell'
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
    | 'split'
    | 'globe-lock'
    | 'bulb'
export interface IconProps extends SVGProps<SVGSVGElement> {
    name: IconName
    size?: number | string
}

// wrapper component to apply black color and transformations
const MaterialIconWrapper: FC<
    {
        Icon: ComponentType<any>
        transformClassName?: string
    } & SVGProps<SVGSVGElement> & { sx?: any }
> = ({ Icon, transformClassName = '', sx, fill, className, width, height, ...props }) => {
    // merge transform className with provided className
    const mergedClassName = [transformClassName, className].filter(Boolean).join(' ')
    // Material UI icons use fontSize for sizing
    const size = width || height

    // determine icon color:
    // 1. if fill prop is provided, use it (highest priority)
    // 2. if className contains text-* classes, don't set color in sx (let Tailwind CSS handle it)
    // 3. otherwise default to black
    const hasTextColorClass = className && /text-/.test(className)

    // build sx object - only set color if no Tailwind color class is present
    // Material UI icons use currentColor by default, so we let CSS handle it when className has color
    const sxProps: any = {
        fontSize: size,
        ...sx,
    }

    // only set color in sx if:
    // - fill prop is provided (use it)
    // - no Tailwind color class is present (default to black)
    // when Tailwind color class is present, don't set color in sx - let CSS/Tailwind handle it
    if (fill) {
        sxProps.color = fill
    } else if (!hasTextColorClass) {
        sxProps.color = 'black'
    }
    // if hasTextColorClass, don't set color in sx - Material UI icons will inherit from CSS

    // use htmlColor to ensure SVG fill uses currentColor when Tailwind color class is present
    const iconProps: any = {
        ...props,
        className: mergedClassName || undefined,
        sx: sxProps,
    }

    if (hasTextColorClass && !fill) {
        // ensure SVG fill uses currentColor to inherit from Tailwind classes
        iconProps.htmlColor = 'currentColor'
    } else if (fill) {
        iconProps.htmlColor = fill
    }

    return <Icon {...iconProps} />
}

// icon names mapping to their components
const iconComponents: Record<IconName, ComponentType<SVGProps<SVGSVGElement>>> = {
    'arrow-down': (props) => <MaterialIconWrapper Icon={ArrowDownwardIcon} {...props} />,
    'arrow-down-left': (props) => <MaterialIconWrapper Icon={SouthWestIcon} {...props} />,
    'arrow-up': (props) => <MaterialIconWrapper Icon={ArrowUpwardIcon} {...props} />,
    'arrow-up-right': (props) => <MaterialIconWrapper Icon={NorthEastIcon} {...props} />,
    bank: (props) => <MaterialIconWrapper Icon={AccountBalanceRoundedIcon} {...props} />,
    bell: (props) => <MaterialIconWrapper Icon={NotificationsActiveOutlinedIcon} {...props} />,
    badge: (props) => <MaterialIconWrapper Icon={GppGoodOutlinedIcon} {...props} />,
    camera: (props) => <MaterialIconWrapper Icon={CameraAltIcon} {...props} />,
    check: (props) => <MaterialIconWrapper Icon={CheckIcon} {...props} />,
    'chevron-up': (props) => <MaterialIconWrapper Icon={KeyboardArrowUpIcon} {...props} />,
    download: (props) => <MaterialIconWrapper Icon={GetAppRoundedIcon} {...props} />,
    dollar: (props) => <MaterialIconWrapper Icon={AttachMoneyRoundedIcon} {...props} />,
    'double-check': (props) => <MaterialIconWrapper Icon={DoneAllRoundedIcon} {...props} />,
    eye: (props) => <MaterialIconWrapper Icon={RemoveRedEyeRoundedIcon} {...props} />,
    'eye-slash': (props) => <MaterialIconWrapper Icon={VisibilityOffRoundedIcon} {...props} />,
    exchange: (props) => <MaterialIconWrapper Icon={CurrencyExchangeRoundedIcon} {...props} />,
    fees: (props) => <MaterialIconWrapper Icon={LocalOfferOutlinedIcon} {...props} />,
    gift: (props) => <MaterialIconWrapper Icon={CardGiftcardRoundedIcon} {...props} />,
    home: (props) => <MaterialIconWrapper Icon={HomeRoundedIcon} {...props} />,
    'peanut-support': PeanutSupportIcon,
    search: (props) => <MaterialIconWrapper Icon={SearchRoundedIcon} {...props} transformClassName="scale-x-[-1]" />,
    'txn-off': TxnOffIcon,
    wallet: (props) => <MaterialIconWrapper Icon={AccountBalanceWalletRoundedIcon} {...props} />,
    'wallet-cancel': WalletCancelIcon,
    'wallet-outline': (props) => <MaterialIconWrapper Icon={AccountBalanceWalletOutlinedIcon} {...props} />,
    currency: (props) => <MaterialIconWrapper Icon={PaymentsOutlinedIcon} {...props} />,
    achievements: (props) => <MaterialIconWrapper Icon={WorkspacePremiumOutlinedIcon} {...props} />,
    link: (props) => <MaterialIconWrapper Icon={LinkOutlinedIcon} {...props} transformClassName="rotate-[-45deg]" />,
    'link-slash': (props) => <MaterialIconWrapper Icon={LinkOffOutlinedIcon} {...props} />,
    logout: (props) => <MaterialIconWrapper Icon={LogoutOutlinedIcon} {...props} />,
    paperclip: (props) => (
        <MaterialIconWrapper Icon={AttachmentRoundedIcon} {...props} transformClassName="rotate-[-45deg]" />
    ),
    smile: (props) => <MaterialIconWrapper Icon={MoodOutlinedIcon} {...props} />,
    user: (props) => <MaterialIconWrapper Icon={PersonOutlineOutlinedIcon} {...props} />,
    share: (props) => <MaterialIconWrapper Icon={IosShareOutlinedIcon} {...props} />,
    star: (props) => <MaterialIconWrapper Icon={StarRoundedIcon} {...props} />,
    'user-plus': (props) => <MaterialIconWrapper Icon={PersonAddOutlinedIcon} {...props} />,
    copy: (props) => <MaterialIconWrapper Icon={ContentCopyOutlinedIcon} {...props} />,
    cancel: (props) => <MaterialIconWrapper Icon={CloseRoundedIcon} {...props} />,
    'qr-code': (props) => <MaterialIconWrapper Icon={QrCode2RoundedIcon} {...props} />,
    history: (props) => (
        <MaterialIconWrapper Icon={UpdateRoundedIcon} {...props} transformClassName="rotate-[10deg] scale-x-[-1]" />
    ),
    docs: DocsIcon,
    error: (props) => <MaterialIconWrapper Icon={ErrorOutlinedIcon} {...props} />,
    clip: (props) => (
        <MaterialIconWrapper Icon={AttachmentRoundedIcon} {...props} transformClassName="rotate-[-45deg]" />
    ),
    info: (props) => <MaterialIconWrapper Icon={InfoOutlinedIcon} {...props} />,
    'external-link': (props) => <MaterialIconWrapper Icon={OpenInNewOutlinedIcon} {...props} />,
    plus: (props) => <MaterialIconWrapper Icon={AddRoundedIcon} {...props} />,
    alert: (props) => <MaterialIconWrapper Icon={WarningAmberRoundedIcon} {...props} />,
    switch: (props) => <MaterialIconWrapper Icon={PowerSettingsNewRoundedIcon} {...props} />,
    'check-circle': (props) => <MaterialIconWrapper Icon={CheckCircleOutlineRoundedIcon} {...props} />,
    'mobile-install': (props) => <MaterialIconWrapper Icon={InstallMobileOutlinedIcon} {...props} />,
    retry: (props) => <MaterialIconWrapper Icon={AutorenewRoundedIcon} {...props} />,
    'user-id': (props) => <MaterialIconWrapper Icon={AssignmentIndOutlinedIcon} {...props} />,
    clock: (props) => <MaterialIconWrapper Icon={AccessTimeOutlinedIcon} {...props} />,
    success: (props) => <MaterialIconWrapper Icon={CheckIcon} {...props} />,
    pending: (props) => <MaterialIconWrapper Icon={HourglassEmptyRoundedIcon} {...props} />,
    processing: (props) => <MaterialIconWrapper Icon={AutorenewRoundedIcon} {...props} />,
    failed: (props) => <MaterialIconWrapper Icon={ErrorOutlinedIcon} {...props} />,
    'chevron-down': (props) => <MaterialIconWrapper Icon={KeyboardArrowDownRoundedIcon} {...props} />,
    'question-mark': (props) => <MaterialIconWrapper Icon={HelpOutlineRoundedIcon} {...props} />,
    shield: (props) => <MaterialIconWrapper Icon={VerifiedUserOutlinedIcon} {...props} />,
    trophy: (props) => <MaterialIconWrapper Icon={EmojiEventsOutlinedIcon} {...props} />,
    'invite-heart': InviteHeartIcon,
    lock: (props) => <MaterialIconWrapper Icon={LockOutlinedIcon} {...props} />,
    split: (props) => <MaterialIconWrapper Icon={CallSplitRoundedIcon} {...props} />,
    'globe-lock': (props) => <MaterialIconWrapper Icon={VpnLockOutlinedIcon} {...props} />,
    bulb: BulbIcon,
}

export const Icon: FC<IconProps> = ({ name, size = 24, width, height, ...props }) => {
    const IconComponent = iconComponents[name]

    if (!IconComponent) {
        console.warn(`Icon "${name}" not found`)
        return null
    }

    return <IconComponent width={width || size} height={height || size} {...props} />
}
