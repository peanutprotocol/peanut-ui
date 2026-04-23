import { type ComponentType, type FC, type SVGProps } from 'react'
import {
    AlertCircle,
    AlertTriangle,
    ArrowDown,
    ArrowDownLeft,
    ArrowLeftRight,
    ArrowRightLeft,
    ArrowUp,
    ArrowUpRight,
    Award,
    Banknote,
    Bell,
    Camera,
    Check,
    CircleCheck,
    CircleHelp,
    CircleMinus,
    CirclePlus,
    Clipboard,
    Clock,
    ContactRound,
    Copy,
    CreditCard,
    ChevronDown,
    ChevronUp,
    DollarSign,
    Download,
    ExternalLink,
    Eye,
    EyeOff,
    Gauge,
    Gift,
    Globe,
    History,
    Home,
    Hourglass,
    Info,
    Landmark,
    Link as LinkIcon,
    LogOut,
    Lock,
    Paperclip,
    Plus,
    Power,
    QrCode,
    RefreshCw,
    Search,
    Share,
    Shield,
    ShieldCheck,
    Smartphone,
    Smile,
    Star,
    SwitchCamera,
    Tag,
    Trophy,
    Undo,
    Unlink,
    UploadCloud,
    User,
    UserPlus,
    Users,
    Wallet,
    X,
} from 'lucide-react'
import { DocsIcon } from './docs'
import { PeanutSupportIcon } from './peanut-support'
import { TxnOffIcon } from './txn-off'
import { WalletCancelIcon } from './wallet-cancel'
import { InviteHeartIcon } from './invite-heart'
import { BulbIcon } from './bulb'
import { DoubleCheckIcon } from './double-check'

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
    | 'info-filled'
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
    | 'undo'
    | 'upload-cloud'
    | 'alert-filled'
    | 'paste'
    | 'credit-card'
export interface IconProps extends SVGProps<SVGSVGElement> {
    name: IconName
    size?: number | string
}

// Wrapper: map our Icon API (size + fill + Tailwind text-* className) onto Lucide's
// native props. Stays on Lucide's defaults (strokeWidth=2, stroke=currentColor) so
// rendering matches lucide.dev exactly; the consumer controls colour via CSS.
//
// Fill handling is Tailwind-class-based (not the svg `fill=` attribute) because
// tailwind.config.js `.btn svg { @apply fill-inherit }` beats the attribute with
// CSS specificity — inside a .btn the attribute loses, open-curve Lucide paths
// close up, and the icon renders as a filled blob. Using `fill-none` / `fill-current`
// utility classes puts us on the same specificity footing and order-of-rules wins.
const LucideWrapper: FC<
    {
        Icon: ComponentType<any>
        transformClassName?: string
        filled?: boolean
    } & SVGProps<SVGSVGElement>
> = ({ Icon, transformClassName = '', filled, fill, className, width, height, ...rest }) => {
    const fillClass = filled ? 'fill-current' : 'fill-none'
    const mergedClassName = [fillClass, transformClassName, className].filter(Boolean).join(' ')

    // Lucide's `size` controls width + height proportionally. Our callers pass width
    // and height separately (always equal in practice), so collapse back to `size`.
    const size = width ?? height

    // Stroke colour: only override if the caller passed an explicit `fill`. Otherwise
    // leave Lucide's default (`stroke="currentColor"`) so Tailwind text-* classes and
    // inherited CSS colour just work.
    const color = fill ? (fill as string) : undefined

    return <Icon {...rest} size={size} color={color} className={mergedClassName} />
}

const iconComponents: Record<IconName, ComponentType<SVGProps<SVGSVGElement>>> = {
    'arrow-down': (props) => <LucideWrapper Icon={ArrowDown} {...props} />,
    'arrow-down-left': (props) => <LucideWrapper Icon={ArrowDownLeft} {...props} />,
    'arrow-up': (props) => <LucideWrapper Icon={ArrowUp} {...props} />,
    'arrow-up-right': (props) => <LucideWrapper Icon={ArrowUpRight} {...props} />,
    'arrow-exchange': (props) => <LucideWrapper Icon={ArrowRightLeft} {...props} />,
    bank: (props) => <LucideWrapper Icon={Landmark} {...props} />,
    bell: (props) => <LucideWrapper Icon={Bell} {...props} />,
    badge: (props) => <LucideWrapper Icon={ShieldCheck} {...props} />,
    camera: (props) => <LucideWrapper Icon={Camera} {...props} />,
    'camera-flip': (props) => <LucideWrapper Icon={SwitchCamera} {...props} />,
    check: (props) => <LucideWrapper Icon={Check} {...props} />,
    'chevron-up': (props) => <LucideWrapper Icon={ChevronUp} {...props} />,
    download: (props) => <LucideWrapper Icon={Download} {...props} />,
    dollar: (props) => <LucideWrapper Icon={DollarSign} {...props} />,
    'double-check': DoubleCheckIcon,
    eye: (props) => <LucideWrapper Icon={Eye} {...props} />,
    'eye-slash': (props) => <LucideWrapper Icon={EyeOff} {...props} />,
    exchange: (props) => <LucideWrapper Icon={ArrowLeftRight} {...props} />,
    fees: (props) => <LucideWrapper Icon={Tag} {...props} />,
    gift: (props) => <LucideWrapper Icon={Gift} {...props} />,
    home: (props) => <LucideWrapper Icon={Home} {...props} />,
    'peanut-support': PeanutSupportIcon,
    search: (props) => <LucideWrapper Icon={Search} {...props} transformClassName="scale-x-[-1]" />,
    wallet: (props) => <LucideWrapper Icon={Wallet} {...props} />,
    'wallet-cancel': WalletCancelIcon,
    'wallet-outline': (props) => <LucideWrapper Icon={Wallet} {...props} />,
    currency: (props) => <LucideWrapper Icon={Banknote} {...props} />,
    achievements: (props) => <LucideWrapper Icon={Award} {...props} />,
    link: (props) => <LucideWrapper Icon={LinkIcon} {...props} />,
    'link-slash': (props) => <LucideWrapper Icon={Unlink} {...props} />,
    logout: (props) => <LucideWrapper Icon={LogOut} {...props} />,
    paperclip: (props) => <LucideWrapper Icon={Paperclip} {...props} />,
    smile: (props) => <LucideWrapper Icon={Smile} {...props} />,
    user: (props) => <LucideWrapper Icon={User} {...props} />,
    share: (props) => <LucideWrapper Icon={Share} {...props} />,
    star: (props) => <LucideWrapper Icon={Star} {...props} />,
    'user-plus': (props) => <LucideWrapper Icon={UserPlus} {...props} />,
    copy: (props) => <LucideWrapper Icon={Copy} {...props} />,
    cancel: (props) => <LucideWrapper Icon={X} {...props} />,
    'qr-code': (props) => <LucideWrapper Icon={QrCode} {...props} />,
    history: (props) => <LucideWrapper Icon={History} {...props} />,
    error: (props) => <LucideWrapper Icon={AlertCircle} {...props} />,
    clip: (props) => <LucideWrapper Icon={Paperclip} {...props} />,
    info: (props) => <LucideWrapper Icon={Info} {...props} />,
    'external-link': (props) => <LucideWrapper Icon={ExternalLink} {...props} />,
    'info-filled': (props) => <LucideWrapper Icon={Info} {...props} filled />,
    plus: (props) => <LucideWrapper Icon={Plus} {...props} />,
    alert: (props) => <LucideWrapper Icon={AlertTriangle} {...props} />,
    switch: (props) => <LucideWrapper Icon={Power} {...props} />,
    'check-circle': (props) => <LucideWrapper Icon={CircleCheck} {...props} />,
    'mobile-install': (props) => <LucideWrapper Icon={Smartphone} {...props} />,
    retry: (props) => <LucideWrapper Icon={RefreshCw} {...props} />,
    'user-id': (props) => <LucideWrapper Icon={ContactRound} {...props} />,
    clock: (props) => <LucideWrapper Icon={Clock} {...props} />,
    success: (props) => <LucideWrapper Icon={Check} {...props} />,
    pending: (props) => <LucideWrapper Icon={Hourglass} {...props} />,
    processing: (props) => <LucideWrapper Icon={RefreshCw} {...props} />,
    failed: (props) => <LucideWrapper Icon={AlertCircle} {...props} />,
    'chevron-down': (props) => <LucideWrapper Icon={ChevronDown} {...props} />,
    'question-mark': (props) => <LucideWrapper Icon={CircleHelp} {...props} />,
    shield: (props) => <LucideWrapper Icon={Shield} {...props} />,
    trophy: (props) => <LucideWrapper Icon={Trophy} {...props} />,
    lock: (props) => <LucideWrapper Icon={Lock} {...props} />,
    split: (props) => <LucideWrapper Icon={Users} {...props} />,
    'globe-lock': (props) => <LucideWrapper Icon={Globe} {...props} />,
    'plus-circle': (props) => <LucideWrapper Icon={CirclePlus} {...props} />,
    'minus-circle': (props) => <LucideWrapper Icon={CircleMinus} {...props} />,
    meter: (props) => <LucideWrapper Icon={Gauge} {...props} />,
    // custom icons (unchanged)
    'txn-off': TxnOffIcon,
    docs: DocsIcon,
    bulb: BulbIcon,
    undo: (props) => <LucideWrapper Icon={Undo} {...props} />,
    'upload-cloud': (props) => <LucideWrapper Icon={UploadCloud} {...props} />,
    'invite-heart': InviteHeartIcon,
    'alert-filled': (props) => <LucideWrapper Icon={AlertTriangle} {...props} filled />,
    paste: (props) => <LucideWrapper Icon={Clipboard} {...props} />,
    'credit-card': (props) => <LucideWrapper Icon={CreditCard} {...props} />,
}

export const Icon: FC<IconProps> = ({ name, size = 24, width, height, ...props }) => {
    const IconComponent = iconComponents[name]

    if (!IconComponent) {
        console.warn(`Icon "${name}" not found`)
        return null
    }

    return <IconComponent width={width || size} height={height || size} {...props} />
}
