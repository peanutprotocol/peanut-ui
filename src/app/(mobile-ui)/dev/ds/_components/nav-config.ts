import type { IconName } from '@/components/Global/Icons/Icon'

export interface NavItem {
    label: string
    href: string
    icon: IconName
    /** shown on the tier index card */
    description?: string
    /** catalog badge: production | limited | unused */
    status?: 'production' | 'limited' | 'unused'
}

export const TIERS = [
    { label: 'Foundations', href: '/dev/ds/foundations', icon: 'bulb' as IconName },
    { label: 'Primitives', href: '/dev/ds/primitives', icon: 'switch' as IconName },
    { label: 'Patterns', href: '/dev/ds/patterns', icon: 'docs' as IconName },
    { label: 'Audit', href: '/dev/ds/audit', icon: 'search' as IconName },
    { label: 'Playground', href: '/dev/ds/playground', icon: 'bulb' as IconName },
]

export const SIDEBAR_CONFIG: Record<string, NavItem[]> = {
    foundations: [
        { label: 'Colors', icon: 'bulb', href: '/dev/ds/foundations/colors' },
        { label: 'Typography', icon: 'docs', href: '/dev/ds/foundations/typography' },
        { label: 'Spacing', icon: 'switch', href: '/dev/ds/foundations/spacing' },
        { label: 'Shadows', icon: 'docs', href: '/dev/ds/foundations/shadows' },
        { label: 'Icons', icon: 'search', href: '/dev/ds/foundations/icons' },
        { label: 'Borders', icon: 'docs', href: '/dev/ds/foundations/borders' },
    ],
    primitives: [
        {
            label: 'Button',
            icon: 'switch',
            href: '/dev/ds/primitives/button',
            description: 'Primary interaction component. 7 variants, 3 sizes, shadow options, long-press support',
            status: 'production',
        },
        {
            label: 'Card',
            icon: 'docs',
            href: '/dev/ds/primitives/card',
            description: 'Container with optional shadow. Compound component with Header, Title, Description, Content',
            status: 'production',
        },
        {
            label: 'ListItem',
            icon: 'docs',
            href: '/dev/ds/primitives/list-item',
            description: 'Row primitive: leading slot + title/body + trailing slot, grouped via position',
            status: 'production',
        },
        {
            label: 'ListGroup',
            icon: 'docs',
            href: '/dev/ds/primitives/list-group',
            description: 'Derives first/middle/last positions for ListItem/Card children',
            status: 'production',
        },
        {
            label: 'IconBubble',
            icon: 'plus-circle',
            href: '/dev/ds/primitives/icon-bubble',
            description: 'Round colored icon container. Sizes xs/s/m/l, five colors + logo',
            status: 'production',
        },
        {
            label: 'BaseInput',
            icon: 'clip',
            href: '/dev/ds/primitives/base-input',
            description: 'Text input with sm/md variants, component-owned states and right content slot',
            status: 'production',
        },
        {
            label: 'FieldError',
            icon: 'alert',
            href: '/dev/ds/primitives/field-error',
            description: 'Inline field-level error (Body/XS, foreground-error) — flow errors stay Notification',
            status: 'production',
        },
        {
            label: 'BaseSelect',
            icon: 'clip',
            href: '/dev/ds/primitives/base-select',
            description: 'Radix-based dropdown select with error and disabled states',
            status: 'production',
        },
        {
            label: 'Checkbox',
            icon: 'check',
            href: '/dev/ds/primitives/checkbox',
            description: 'Simple checkbox with optional label',
            status: 'production',
        },
        {
            label: 'Toggle',
            icon: 'switch',
            href: '/dev/ds/primitives/toggle',
            description: 'Switch from the figma toggle board. Black knob on, outlined knob off',
            status: 'production',
        },
        {
            label: 'SlideToConfirm',
            icon: 'chevron-right',
            href: '/dev/ds/primitives/slide-to-confirm',
            description: 'The one money-confirm control. Commits only at 100% travel, resets after failure',
            status: 'production',
        },
        {
            label: 'SegmentedControl',
            icon: 'switch',
            href: '/dev/ds/primitives/segmented-control',
            description: 'Radix tabs styled as a pill row for period/network toggles',
            status: 'production',
        },
        {
            label: 'ProgressBar',
            icon: 'meter',
            href: '/dev/ds/primitives/progress-bar',
            description: 'Track + fill + optional tick markers; consumers own colors via tokens',
            status: 'production',
        },
        {
            label: 'CarouselDots',
            icon: 'minus-circle',
            href: '/dev/ds/primitives/carousel-dots',
            description: 'Dot pagination from the dots/stepper board, tappable with 44px hit areas',
            status: 'production',
        },
        {
            label: 'Toast',
            icon: 'bell',
            href: '/dev/ds/primitives/toast',
            description: 'Context-based toast notification system. 4 types, auto-dismiss',
            status: 'production',
        },
        {
            label: 'Notification',
            icon: 'alert',
            href: '/dev/ds/primitives/notification',
            description: 'Inline notification banner. 5 priorities, title + body, dismiss, up to 2 CTAs',
            status: 'limited',
        },
        {
            label: 'LinkButton',
            icon: 'link',
            href: '/dev/ds/primitives/link-button',
            description: 'Standalone underlined link for lightweight navigation. Optional trailing icon',
            status: 'limited',
        },
        {
            label: 'Accordion',
            icon: 'chevron-down',
            href: '/dev/ds/primitives/accordion',
            description: 'Expand/collapse sections over the radix base. Single or multiple, disabled items',
            status: 'production',
        },
        {
            label: 'Divider',
            icon: 'minus-circle',
            href: '/dev/ds/primitives/divider',
            description: 'Horizontal divider with optional text label',
            status: 'production',
        },
        {
            label: 'DataRow',
            icon: 'docs',
            href: '/dev/ds/primitives/data-row',
            description:
                'Label + value row, promoted from TransactionDetails/ReceiptRow. Copy, tooltip, loading, trailing slot',
            status: 'production',
        },
        {
            label: 'Section',
            icon: 'docs',
            href: '/dev/ds/primitives/section',
            description: 'Section title above a list/card stack. Owns the heading token',
            status: 'production',
        },
        {
            label: 'TitleBlock',
            icon: 'docs',
            href: '/dev/ds/primitives/title-block',
            description: 'Title + supporting-text pair extracted from EmptyState',
            status: 'production',
        },
        {
            label: 'PageStack',
            icon: 'docs',
            href: '/dev/ds/primitives/page-stack',
            description: 'Page shell recipe: NavHeader + vertical stack with Center and Footer regions',
            status: 'production',
        },
        {
            label: 'PageContainer',
            icon: 'docs',
            href: '/dev/ds/primitives/page-container',
            description: 'Responsive page wrapper with max-width and alignment options',
            status: 'production',
        },
        {
            label: 'Title',
            icon: 'docs',
            href: '/dev/ds/primitives/title',
            description:
                'Knerd display font with filled/outline double-render effect. DEAD IN PRODUCT — only rendered by MarketingHero (marketing pages); the wallet app never uses it.',
            status: 'unused',
        },
    ],
    patterns: [
        { label: 'Modal', icon: 'link', href: '/dev/ds/patterns/modal' },
        { label: 'Drawer', icon: 'link', href: '/dev/ds/patterns/drawer' },
        { label: 'Navigation', icon: 'link', href: '/dev/ds/patterns/navigation' },
        { label: 'Loading', icon: 'processing', href: '/dev/ds/patterns/loading' },
        { label: 'Feedback', icon: 'meter', href: '/dev/ds/patterns/feedback' },
        { label: 'Copy & Share', icon: 'copy', href: '/dev/ds/patterns/copy-share' },
        { label: 'Layouts', icon: 'switch', href: '/dev/ds/patterns/layouts' },
        { label: 'Cards (Global)', icon: 'docs', href: '/dev/ds/patterns/cards-global' },
        { label: 'AmountInput', icon: 'dollar', href: '/dev/ds/patterns/amount-input' },
        { label: 'Slider', icon: 'meter', href: '/dev/ds/patterns/slider' },
    ],
    audit: [
        { label: 'Code Audit', icon: 'docs', href: '/dev/ds/audit' },
        { label: 'App Divergences', icon: 'search', href: '/dev/ds/audit/app' },
        { label: 'Big Components', icon: 'switch', href: '/dev/ds/audit/components' },
    ],
    // Playground items are standalone harnesses that live under /dev (not /dev/ds), so
    // clicking one leaves the doc-site chrome. The /dev/ds/playground index links to them.
    playground: [
        { label: 'Shake & Confetti', icon: 'gift', href: '/dev/shake-test' },
        { label: 'Perk Success', icon: 'check-circle', href: '/dev/perk-success-test' },
        { label: 'Share Builder', icon: 'copy', href: '/dev/share-builder' },
        { label: 'Virtual Accounts', icon: 'bank', href: '/dev/virtual-accounts' },
    ],
}
