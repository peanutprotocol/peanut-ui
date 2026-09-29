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

/** e2e/flows/icon-regression.spec.ts needs the fill as an inline style, and
    scripts/ds-lint-counts.mjs counts literal `style={{` objects — so the object
    lives here once and every raw-lucide render site references it. */
export const LUCIDE_FILL_NONE = { fill: 'none' } as const

export interface NavItem {
    label: string
    href: string
    /** lucide component, rendered directly — the product Icon registry is a
        closed set and must not grow for a dev tool */
    icon: LucideIcon
    /** shown on the tier index card */
    description?: string
    /** catalog badge */
    status?: 'production' | 'limited' | 'unused' | 'needs-refactor'
    /** catalog quality score, shown on the tier index card */
    quality?: 1 | 2 | 3 | 4 | 5
    /** product usage count, shown on the tier index card */
    usages?: number
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
        {
            label: 'Colors',
            icon: Palette,
            href: '/dev/ds/foundations/colors',
            description: 'Semantic tokens, legacy palettes, and color usage rules',
            status: 'production',
        },
        {
            label: 'Typography',
            icon: Type,
            href: '/dev/ds/foundations/typography',
            description: 'Font families, weights, text sizes, and the Knerd display font',
            status: 'production',
        },
        {
            label: 'Spacing',
            icon: Ruler,
            href: '/dev/ds/foundations/spacing',
            description: 'Spacing scale, layout utilities (.row, .col), and gap conventions',
            status: 'production',
        },
        {
            label: 'Shadows',
            icon: Layers,
            href: '/dev/ds/foundations/shadows',
            description: 'Shadow tokens and visual comparison. shadowSize=4 is the standard',
            status: 'production',
        },
        {
            label: 'Icons',
            icon: Shapes,
            href: '/dev/ds/foundations/icons',
            description:
                'The 89-name product Icon registry (81 lucide, 8 custom) with searchable grid and copy-to-clipboard',
            status: 'production',
            quality: 4,
        },
        {
            label: 'Borders',
            icon: Square,
            href: '/dev/ds/foundations/borders',
            description: 'Border radius and semantic border styles',
            status: 'production',
        },
        {
            label: 'Motion & haptics',
            icon: Vibrate,
            href: '/dev/ds/foundations/motion-haptics',
            description: 'Duration and easing tokens, reduced motion, and native feedback primitives',
            status: 'limited',
        },
    ],
    primitives: [
        {
            label: 'Button',
            icon: MousePointerClick,
            href: '/dev/ds/primitives/button',
            description: 'Primary interaction component. 3 variants, 3 sizes, shadow options, long-press support',
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
            description: 'Text input with sm/md sizes, component-owned states and right content slot',
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
            description:
                'Form-field chrome: optional label + control + helper/error line — error is text only, never borders',
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
        {
            label: 'Modal',
            icon: PanelTop,
            href: '/dev/ds/patterns/modal',
            description: 'ActionModal for short decisions and confirmations',
            status: 'production',
            quality: 4,
        },
        {
            label: 'Drawer',
            icon: PanelBottom,
            href: '/dev/ds/patterns/drawer',
            description: 'Vaul-based bottom sheet with compound component API',
            status: 'production',
            quality: 5,
        },
        {
            label: 'Navigation',
            icon: Compass,
            href: '/dev/ds/patterns/navigation',
            description: 'NavHeader for screen navigation',
            status: 'production',
            quality: 4,
        },
        {
            label: 'Loading',
            icon: LoaderCircle,
            href: '/dev/ds/patterns/loading',
            description: 'One Loading component — spinner and mascot variants',
            status: 'production',
            quality: 4,
        },
        {
            label: 'Feedback',
            icon: MessageSquare,
            href: '/dev/ds/patterns/feedback',
            description: 'Badge, inline errors, and EmptyState',
            status: 'production',
            quality: 4,
        },
        {
            label: 'Copy & Share',
            icon: Share2,
            href: '/dev/ds/patterns/copy-share',
            description: 'CopyField, CopyToClipboard, and ShareButton',
            status: 'production',
            quality: 4,
        },
        {
            label: 'Layouts',
            icon: LayoutGrid,
            href: '/dev/ds/patterns/layouts',
            description: 'Page layout recipes: centered CTA, pinned footer, scrollable list',
            status: 'production',
            quality: 4,
        },
        {
            label: 'Cards (Global)',
            icon: CreditCard,
            href: '/dev/ds/patterns/cards-global',
            description: 'Global Card for stacked lists with position-aware borders',
            status: 'production',
            quality: 4,
        },
        {
            label: 'AmountInput',
            icon: Coins,
            href: '/dev/ds/patterns/amount-input',
            description: 'Large currency input with conversion, slider, balance display',
            status: 'needs-refactor',
            quality: 3,
        },
        {
            label: 'Slider',
            icon: SlidersHorizontal,
            href: '/dev/ds/patterns/slider',
            description: 'Percentage slider with magnetic snap points. Used by AmountInput in contribute-pot',
            status: 'production',
            usages: 1,
        },
    ],
    audit: [
        { label: 'Code Audit', icon: FileSearch, href: '/dev/ds/audit' },
        { label: 'App Divergences', icon: GitCompare, href: '/dev/ds/audit/app' },
        { label: 'Big Components', icon: Boxes, href: '/dev/ds/audit/components' },
    ],
    // Playground items are standalone harnesses that live under /dev (not /dev/ds), so
    // clicking one leaves the doc-site chrome. The /dev/ds/playground index links to them.
    playground: [
        {
            label: 'Shake & Confetti',
            icon: PartyPopper,
            href: '/dev/shake-test',
            description: 'Tune shake intensity + hold-to-claim progress and fire the double-star confetti burst.',
        },
        {
            label: 'Perk Success',
            icon: Gift,
            href: '/dev/perk-success-test',
            description: 'The perk-unlock success screen with mock perks — preview the celebration + confetti flow.',
        },
        {
            label: 'Share Builder',
            icon: Wrench,
            href: '/dev/share-builder',
            description: 'Iterator for the D3 card share asset — stress-test tiers, names and edge cases.',
        },
    ],
}

/**
 * Filters every tier by label and description. An empty query returns the whole
 * nav, so the sidebar renders search results and the full tree the same way.
 * A query that matches a tier label returns that tier with all of its items.
 */
export const filterNav = (query: string): NavGroup[] => {
    const q = query.trim().toLowerCase()
    return TIERS.map((tier) => {
        const items = SIDEBAR_CONFIG[tier.key] ?? []
        // a tier-label hit keeps the whole tier — a heading with no items under it is not a result
        const wholeTier = !q || tier.label.toLowerCase().includes(q)
        return {
            tier,
            items: wholeTier
                ? items
                : items.filter(
                      (item) =>
                          item.label.toLowerCase().includes(q) || (item.description ?? '').toLowerCase().includes(q)
                  ),
        }
    }).filter((group) => !q || group.items.length > 0)
}
