import { type ComponentType, type FC, type SVGProps } from 'react'
import {
    ArrowDownward,
    SouthWest,
    ArrowUpward,
    NorthEast,
    AccountBalanceRounded,
    NotificationsActiveOutlined,
    GppGoodOutlined,
    CameraAlt,
    Check,
    KeyboardArrowUp,
    GetAppRounded,
    AttachMoneyRounded,
    DoneAllRounded,
    RemoveRedEyeRounded,
    VisibilityOffRounded,
    CurrencyExchangeRounded,
    LocalOfferOutlined,
    CardGiftcardRounded,
    HomeRounded,
    SearchRounded,
    AccountBalanceWalletRounded,
    AccountBalanceWalletOutlined,
    PaymentsOutlined,
    WorkspacePremiumOutlined,
    LinkOutlined,
    LinkOffOutlined,
    LogoutOutlined,
    AttachmentRounded,
    MoodOutlined,
    PersonOutlineOutlined,
    IosShareOutlined,
    StarRounded,
    PersonAddOutlined,
    ContentCopyOutlined,
    CloseRounded,
    QrCode2Rounded,
    UpdateRounded,
    ErrorOutlined,
    InfoOutlined,
    OpenInNewOutlined,
    AddRounded,
    WarningAmberRounded,
    PowerSettingsNewRounded,
    CheckCircleOutlineRounded,
    InstallMobileOutlined,
    AutorenewRounded,
    AssignmentIndOutlined,
    AccessTimeOutlined,
    HourglassEmptyRounded,
    KeyboardArrowDownRounded,
    HelpOutlineRounded,
    VerifiedUserOutlined,
    EmojiEventsOutlined,
    LockOutlined,
    CallSplitRounded,
    VpnLockOutlined,
    CameraswitchRounded,
    ControlPointRounded,
    RemoveCircleOutlineRounded,
    CloudUploadOutlined,
    CompareArrowsRounded,
    WarningRounded,
    SpeedRounded,
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
    | 'arrow-exchange'
    | 'bank'
    | 'bell'
    | 'camera'
    | 'camera-flip'
    | 'check'
    | 'chevron-up'
    | 'copy'
    | 'check-circle'
    | 'plus-circle'
    | 'minus-circle'
    | 'meter'
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
    | 'upload-cloud'
    | 'alert-filled'
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
    'arrow-down': (props) => <MaterialIconWrapper Icon={ArrowDownward} {...props} />,
    'arrow-down-left': (props) => <MaterialIconWrapper Icon={SouthWest} {...props} />,
    'arrow-up': (props) => <MaterialIconWrapper Icon={ArrowUpward} {...props} />,
    'arrow-up-right': (props) => <MaterialIconWrapper Icon={NorthEast} {...props} />,
    bank: (props) => <MaterialIconWrapper Icon={AccountBalanceRounded} {...props} />,
    bell: (props) => <MaterialIconWrapper Icon={NotificationsActiveOutlined} {...props} />,
    badge: (props) => <MaterialIconWrapper Icon={GppGoodOutlined} {...props} />,
    camera: (props) => <MaterialIconWrapper Icon={CameraAlt} {...props} />,
    'camera-flip': (props) => <MaterialIconWrapper Icon={CameraswitchRounded} {...props} />,
    check: (props) => <MaterialIconWrapper Icon={Check} {...props} />,
    'chevron-up': (props) => <MaterialIconWrapper Icon={KeyboardArrowUp} {...props} />,
    download: (props) => <MaterialIconWrapper Icon={GetAppRounded} {...props} />,
    dollar: (props) => <MaterialIconWrapper Icon={AttachMoneyRounded} {...props} />,
    'double-check': (props) => <MaterialIconWrapper Icon={DoneAllRounded} {...props} />,
    eye: (props) => <MaterialIconWrapper Icon={RemoveRedEyeRounded} {...props} />,
    'eye-slash': (props) => <MaterialIconWrapper Icon={VisibilityOffRounded} {...props} />,
    exchange: (props) => <MaterialIconWrapper Icon={CurrencyExchangeRounded} {...props} />,
    fees: (props) => <MaterialIconWrapper Icon={LocalOfferOutlined} {...props} />,
    gift: (props) => <MaterialIconWrapper Icon={CardGiftcardRounded} {...props} />,
    home: (props) => <MaterialIconWrapper Icon={HomeRounded} {...props} />,
    'peanut-support': PeanutSupportIcon,
    search: (props) => <MaterialIconWrapper Icon={SearchRounded} {...props} transformClassName="scale-x-[-1]" />,
    wallet: (props) => <MaterialIconWrapper Icon={AccountBalanceWalletRounded} {...props} />,
    'wallet-cancel': WalletCancelIcon,
    'wallet-outline': (props) => <MaterialIconWrapper Icon={AccountBalanceWalletOutlined} {...props} />,
    currency: (props) => <MaterialIconWrapper Icon={PaymentsOutlined} {...props} />,
    achievements: (props) => <MaterialIconWrapper Icon={WorkspacePremiumOutlined} {...props} />,
    link: (props) => <MaterialIconWrapper Icon={LinkOutlined} {...props} transformClassName="rotate-[-45deg]" />,
    'link-slash': (props) => <MaterialIconWrapper Icon={LinkOffOutlined} {...props} />,
    logout: (props) => <MaterialIconWrapper Icon={LogoutOutlined} {...props} />,
    paperclip: (props) => (
        <MaterialIconWrapper Icon={AttachmentRounded} {...props} transformClassName="rotate-[-45deg]" />
    ),
    smile: (props) => <MaterialIconWrapper Icon={MoodOutlined} {...props} />,
    user: (props) => <MaterialIconWrapper Icon={PersonOutlineOutlined} {...props} />,
    share: (props) => <MaterialIconWrapper Icon={IosShareOutlined} {...props} />,
    star: (props) => <MaterialIconWrapper Icon={StarRounded} {...props} />,
    'user-plus': (props) => <MaterialIconWrapper Icon={PersonAddOutlined} {...props} />,
    copy: (props) => <MaterialIconWrapper Icon={ContentCopyOutlined} {...props} />,
    cancel: (props) => <MaterialIconWrapper Icon={CloseRounded} {...props} />,
    'qr-code': (props) => <MaterialIconWrapper Icon={QrCode2Rounded} {...props} />,
    history: (props) => (
        <MaterialIconWrapper Icon={UpdateRounded} {...props} transformClassName="rotate-[10deg] scale-x-[-1]" />
    ),
    error: (props) => <MaterialIconWrapper Icon={ErrorOutlined} {...props} />,
    clip: (props) => <MaterialIconWrapper Icon={AttachmentRounded} {...props} transformClassName="rotate-[-45deg]" />,
    info: (props) => <MaterialIconWrapper Icon={InfoOutlined} {...props} />,
    'external-link': (props) => <MaterialIconWrapper Icon={OpenInNewOutlined} {...props} />,
    plus: (props) => <MaterialIconWrapper Icon={AddRounded} {...props} />,
    alert: (props) => <MaterialIconWrapper Icon={WarningAmberRounded} {...props} />,
    switch: (props) => <MaterialIconWrapper Icon={PowerSettingsNewRounded} {...props} />,
    'check-circle': (props) => <MaterialIconWrapper Icon={CheckCircleOutlineRounded} {...props} />,
    'mobile-install': (props) => <MaterialIconWrapper Icon={InstallMobileOutlined} {...props} />,
    retry: (props) => <MaterialIconWrapper Icon={AutorenewRounded} {...props} />,
    'user-id': (props) => <MaterialIconWrapper Icon={AssignmentIndOutlined} {...props} />,
    clock: (props) => <MaterialIconWrapper Icon={AccessTimeOutlined} {...props} />,
    success: (props) => <MaterialIconWrapper Icon={Check} {...props} />,
    pending: (props) => <MaterialIconWrapper Icon={HourglassEmptyRounded} {...props} />,
    processing: (props) => <MaterialIconWrapper Icon={AutorenewRounded} {...props} />,
    failed: (props) => <MaterialIconWrapper Icon={ErrorOutlined} {...props} />,
    'chevron-down': (props) => <MaterialIconWrapper Icon={KeyboardArrowDownRounded} {...props} />,
    'question-mark': (props) => <MaterialIconWrapper Icon={HelpOutlineRounded} {...props} />,
    shield: (props) => <MaterialIconWrapper Icon={VerifiedUserOutlined} {...props} />,
    trophy: (props) => <MaterialIconWrapper Icon={EmojiEventsOutlined} {...props} />,
    lock: (props) => <MaterialIconWrapper Icon={LockOutlined} {...props} />,
    split: (props) => <MaterialIconWrapper Icon={CallSplitRounded} {...props} />,
    'globe-lock': (props) => <MaterialIconWrapper Icon={VpnLockOutlined} {...props} />,
    'plus-circle': (props) => <MaterialIconWrapper Icon={ControlPointRounded} {...props} />,
    'minus-circle': (props) => <MaterialIconWrapper Icon={RemoveCircleOutlineRounded} {...props} />,
    'arrow-exchange': (props) => <MaterialIconWrapper Icon={CompareArrowsRounded} {...props} />,
    meter: (props) => <MaterialIconWrapper Icon={SpeedRounded} {...props} />,
    // custom icons
    'txn-off': TxnOffIcon,
    docs: DocsIcon,
    bulb: BulbIcon,
    'upload-cloud': (props) => <MaterialIconWrapper Icon={CloudUploadOutlined} {...props} />,
    'invite-heart': InviteHeartIcon,
    'alert-filled': (props) => <MaterialIconWrapper Icon={WarningRounded} {...props} />,
}

export const Icon: FC<IconProps> = ({ name, size = 24, width, height, ...props }) => {
    const IconComponent = iconComponents[name]

    if (!IconComponent) {
        console.warn(`Icon "${name}" not found`)
        return null
    }

    return <IconComponent width={width || size} height={height || size} {...props} />
}
