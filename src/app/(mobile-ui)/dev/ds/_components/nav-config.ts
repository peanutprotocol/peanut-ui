import {
    BellRing,
    Blocks,
    Boxes,
    CaseUpper,
    ChevronDown,
    ChevronsRight,
    ChevronsUpDown,
    CircleAlert,
    CircleDot,
    ClipboardCheck,
    Cloud,
    Coins,
    Compass,
    Component,
    Container,
    CreditCard,
    Ellipsis,
    FileSearch,
    FlaskConical,
    Gauge,
    Gift,
    GitCompare,
    Group,
    Heading1,
    KeyRound,
    Layers,
    Layers2,
    LayoutGrid,
    LayoutTemplate,
    Link2,
    List,
    ListOrdered,
    LoaderCircle,
    Megaphone,
    MessageSquare,
    Minus,
    MousePointerClick,
    MoveHorizontal,
    Palette,
    PanelBottom,
    PanelsTopLeft,
    PanelTop,
    PartyPopper,
    Puzzle,
    RectangleEllipsis,
    RectangleHorizontal,
    Rows2,
    Rows3,
    Ruler,
    Shapes,
    Share2,
    SlidersHorizontal,
    Sparkles,
    Square,
    SquareCheck,
    Table2,
    TextAlignStart,
    TextCursorInput,
    ToggleLeft,
    Type,
    Vibrate,
    Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
    label: string
    href: string
    /** lucide component, rendered directly — the product Icon registry is a
        closed set and must not grow for a dev tool */
    icon: LucideIcon
    /** shown on the tier index card */
    description?: string
    /** catalog badge: production | limited | unused */
    status?: 'production' | 'limited' | 'unused'
}

export interface NavTier {
    label: string
    href: string
    icon: LucideIcon
    /** key into SIDEBAR_CONFIG */
    key: string
}

/** a tier plus the entries that survived a search */
export interface NavGroup {
    tier: NavTier
    items: NavItem[]
}

export const TIERS: NavTier[] = [
    { label: 'Foundations', href: '/dev/ds/foundations', icon: Blocks, key: 'foundations' },
    { label: 'Primitives', href: '/dev/ds/primitives', icon: Component, key: 'primitives' },
    { label: 'Patterns', href: '/dev/ds/patterns', icon: Puzzle, key: 'patterns' },
    { label: 'Audit', href: '/dev/ds/audit', icon: ClipboardCheck, key: 'audit' },
    { label: 'Playground', href: '/dev/ds/playground', icon: FlaskConical, key: 'playground' },
]

export const SIDEBAR_CONFIG: Record<string, NavItem[]> = {
    foundations: [
        { label: 'Colors', icon: Palette, href: '/dev/ds/foundations/colors' },
        { label: 'Typography', icon: Type, href: '/dev/ds/foundations/typography' },
        { label: 'Spacing', icon: Ruler, href: '/dev/ds/foundations/spacing' },
        { label: 'Shadows', icon: Layers, href: '/dev/ds/foundations/shadows' },
        { label: 'Icons', icon: Shapes, href: '/dev/ds/foundations/icons' },
        { label: 'Borders', icon: Square, href: '/dev/ds/foundations/borders' },
        { label: 'Motion & haptics', icon: Vibrate, href: '/dev/ds/foundations/motion-haptics' },
    ],
    primitives: [
        {
            label: 'Button',
            icon: MousePointerClick,
            href: '/dev/ds/primitives/button',
            description: 'Primary interaction component. 7 variants, 3 sizes, shadow options, long-press support',
            status: 'production',
        },
        {
            label: 'Card',
            icon: RectangleHorizontal,
            href: '/dev/ds/primitives/card',
            description: 'Container with optional shadow. Compound component with Header, Title, Description, Content',
            status: 'production',
        },
        {
            label: 'ListItem',
            icon: Rows3,
            href: '/dev/ds/primitives/list-item',
            description: 'Row primitive: leading slot + title/body + trailing slot, grouped via position',
            status: 'production',
        },
        {
            label: 'ListGroup',
            icon: Group,
            href: '/dev/ds/primitives/list-group',
            description: 'Derives first/middle/last positions for ListItem/Card children',
            status: 'production',
        },
        {
            label: 'BulletList',
            icon: List,
            href: '/dev/ds/primitives/bullet-list',
            description: 'Unordered text facts with 4px action-primary pink markers and wrapping support',
            status: 'production',
        },
        {
            label: 'NumberedList',
            icon: ListOrdered,
            href: '/dev/ds/primitives/numbered-list',
            description: 'Ordered steps with 20px action-primary numbered circles',
            status: 'production',
        },
        {
            label: 'IconBubble',
            icon: CircleDot,
            href: '/dev/ds/primitives/icon-bubble',
            description: 'Round colored icon container. Sizes xs/s/m/l, five colors + logo',
            status: 'production',
        },
        {
            label: 'BaseInput',
            icon: TextCursorInput,
            href: '/dev/ds/primitives/base-input',
            description: 'Text input with sm/md variants, component-owned states and right content slot',
            status: 'production',
        },
        {
            label: 'FieldError',
            icon: CircleAlert,
            href: '/dev/ds/primitives/field-error',
            description: 'Inline field-level error (Body/XS, foreground-error) — flow errors stay Callout',
            status: 'production',
        },
        {
            label: 'Field',
            icon: RectangleEllipsis,
            href: '/dev/ds/primitives/field',
            description: 'Form-field chrome: label + control + helper/error line — error is text only, never borders',
            status: 'production',
        },
        {
            label: 'FieldColumn',
            icon: Rows2,
            href: '/dev/ds/primitives/field-column',
            description:
                'Input + FieldError stacked 4px apart, from the form-field board — whether it folds into Field is an open question',
            status: 'production',
        },
        {
            label: 'BaseSelect',
            icon: ChevronsUpDown,
            href: '/dev/ds/primitives/base-select',
            description: 'Radix-based dropdown select with error and disabled states',
            status: 'production',
        },
        {
            label: 'Checkbox',
            icon: SquareCheck,
            href: '/dev/ds/primitives/checkbox',
            description: 'Simple checkbox with optional label',
            status: 'production',
        },
        {
            label: 'Toggle',
            icon: ToggleLeft,
            href: '/dev/ds/primitives/toggle',
            description: 'Switch from the figma toggle board. Black knob on, outlined knob off',
            status: 'production',
        },
        {
            label: 'SlideToConfirm',
            icon: MoveHorizontal,
            href: '/dev/ds/primitives/slide-to-confirm',
            description: 'The one money-confirm control. Commits only at 100% travel, resets after failure',
            status: 'production',
        },
        {
            label: 'PinInput',
            icon: KeyRound,
            href: '/dev/ds/primitives/pin-input',
            description: 'Filled-dot PIN entry (card flows). Code-only — no figma board yet',
            status: 'limited',
        },
        {
            label: 'Tabs',
            icon: PanelsTopLeft,
            href: '/dev/ds/primitives/tabs',
            description:
                'One look, no variants — the bottom nav standing still. Three sizes; content tabs and value toggles, same row',
            status: 'production',
        },
        {
            label: 'ProgressBar',
            icon: Gauge,
            href: '/dev/ds/primitives/progress-bar',
            description: 'Track + fill + optional tick markers; consumers own colors via tokens',
            status: 'production',
        },
        {
            label: 'CarouselDots',
            icon: Ellipsis,
            href: '/dev/ds/primitives/carousel-dots',
            description: 'Dot pagination from the dots/stepper board, tappable with 44px hit areas',
            status: 'production',
        },
        {
            label: 'Toast',
            icon: BellRing,
            href: '/dev/ds/primitives/toast',
            description:
                'Floating transient feedback over Callout. Four tones, reading-time auto-dismiss, persistent and custom-content options',
            status: 'production',
        },
        {
            label: 'ToastStack',
            icon: Layers2,
            href: '/dev/ds/primitives/toast-stack',
            description: "The toast provider's render surface — product code fires toasts via useToast()",
            status: 'production',
        },
        {
            label: 'Callout',
            icon: Megaphone,
            href: '/dev/ds/primitives/callout',
            description: 'Inline callout banner. 5 priorities, title + body, dismiss, up to 2 CTAs',
            status: 'limited',
        },
        {
            label: 'LinkButton',
            icon: Link2,
            href: '/dev/ds/primitives/link-button',
            description: 'Standalone underlined link for lightweight navigation. Optional trailing icon',
            status: 'limited',
        },
        {
            label: 'Accordion',
            icon: ChevronDown,
            href: '/dev/ds/primitives/accordion',
            description: 'Expand/collapse sections over the radix base. Single or multiple, disabled items',
            status: 'production',
        },
        {
            label: 'Divider',
            icon: Minus,
            href: '/dev/ds/primitives/divider',
            description: 'Horizontal divider with optional text label',
            status: 'production',
        },
        {
            label: 'Breadcrumb',
            icon: ChevronsRight,
            href: '/dev/ds/primitives/breadcrumb',
            description: 'Trail of parent pages for marketing and content pages. Current page never links',
            status: 'production',
        },
        {
            label: 'DataRow',
            icon: Table2,
            href: '/dev/ds/primitives/data-row',
            description:
                'Label + value row, promoted from TransactionDetails/ReceiptRow. Copy, tooltip, loading, trailing slot',
            status: 'production',
        },
        {
            label: 'Section',
            icon: Heading1,
            href: '/dev/ds/primitives/section',
            description: 'Section title above a list/card stack. Owns the heading token',
            status: 'production',
        },
        {
            label: 'TitleBlock',
            icon: TextAlignStart,
            href: '/dev/ds/primitives/title-block',
            description: 'Title + supporting-text pair extracted from EmptyState',
            status: 'production',
        },
        {
            label: 'PageStack',
            icon: LayoutTemplate,
            href: '/dev/ds/primitives/page-stack',
            description: 'Page shell recipe: NavHeader + vertical stack with Center and Footer regions',
            status: 'production',
        },
        {
            label: 'PageContainer',
            icon: Container,
            href: '/dev/ds/primitives/page-container',
            description: 'Responsive page wrapper with max-width and alignment options',
            status: 'production',
        },
        {
            label: 'MiniHeader',
            icon: CaseUpper,
            href: '/dev/ds/primitives/mini-header',
            description: 'Grey uppercase mini-header labelling a block of plain prose. Code-only, ruling pending',
            status: 'limited',
        },
        {
            label: 'ScreenMark',
            icon: Sparkles,
            href: '/dev/ds/primitives/screen-mark',
            description: "Centered IconBubble size l above a screen's content. Code-only, ruling pending",
            status: 'limited',
        },
        {
            label: 'CloudsBackground',
            icon: Cloud,
            href: '/dev/ds/primitives/clouds-background',
            description: 'Decorative drifting-clouds backdrop for success and marketing moments. Code-only (brand)',
            status: 'production',
        },
    ],
    patterns: [
        { label: 'Modal', icon: PanelTop, href: '/dev/ds/patterns/modal' },
        { label: 'Drawer', icon: PanelBottom, href: '/dev/ds/patterns/drawer' },
        { label: 'Navigation', icon: Compass, href: '/dev/ds/patterns/navigation' },
        { label: 'Loading', icon: LoaderCircle, href: '/dev/ds/patterns/loading' },
        { label: 'Feedback', icon: MessageSquare, href: '/dev/ds/patterns/feedback' },
        { label: 'Copy & Share', icon: Share2, href: '/dev/ds/patterns/copy-share' },
        { label: 'Layouts', icon: LayoutGrid, href: '/dev/ds/patterns/layouts' },
        { label: 'Cards (Global)', icon: CreditCard, href: '/dev/ds/patterns/cards-global' },
        { label: 'AmountInput', icon: Coins, href: '/dev/ds/patterns/amount-input' },
        { label: 'Slider', icon: SlidersHorizontal, href: '/dev/ds/patterns/slider' },
    ],
    audit: [
        { label: 'Code Audit', icon: FileSearch, href: '/dev/ds/audit' },
        { label: 'App Divergences', icon: GitCompare, href: '/dev/ds/audit/app' },
        { label: 'Big Components', icon: Boxes, href: '/dev/ds/audit/components' },
    ],
    // Playground items are standalone harnesses that live under /dev (not /dev/ds), so
    // clicking one leaves the doc-site chrome. The /dev/ds/playground index links to them.
    playground: [
        { label: 'Shake & Confetti', icon: PartyPopper, href: '/dev/shake-test' },
        { label: 'Perk Success', icon: Gift, href: '/dev/perk-success-test' },
        { label: 'Share Builder', icon: Wrench, href: '/dev/share-builder' },
    ],
}

/**
 * Filters every tier by label and description. An empty query returns the whole
 * nav, so the sidebar renders search results and the full tree the same way.
 */
export const filterNav = (query: string): NavGroup[] => {
    const q = query.trim().toLowerCase()
    return TIERS.map((tier) => ({
        tier,
        items: q
            ? (SIDEBAR_CONFIG[tier.key] ?? []).filter(
                  (item) => item.label.toLowerCase().includes(q) || (item.description ?? '').toLowerCase().includes(q)
              )
            : (SIDEBAR_CONFIG[tier.key] ?? []),
    })).filter((group) => !q || group.items.length > 0 || group.tier.label.toLowerCase().includes(q))
}
