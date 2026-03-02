import type { IconName } from '@/components/Global/Icons/Icon'

export interface NavItem {
    label: string
    href: string
    icon: IconName
}

export const TIERS = [
    { label: 'Foundations', href: '/dev/ds/foundations', icon: 'bulb' as IconName },
    { label: 'Primitives', href: '/dev/ds/primitives', icon: 'switch' as IconName },
    { label: 'Patterns', href: '/dev/ds/patterns', icon: 'docs' as IconName },
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
        { label: 'Button', icon: 'switch', href: '/dev/ds/primitives/button' },
        { label: 'Card', icon: 'docs', href: '/dev/ds/primitives/card' },
        { label: 'BaseInput', icon: 'clip', href: '/dev/ds/primitives/base-input' },
        { label: 'BaseSelect', icon: 'clip', href: '/dev/ds/primitives/base-select' },
        { label: 'Checkbox', icon: 'check', href: '/dev/ds/primitives/checkbox' },
        { label: 'Toast', icon: 'bell', href: '/dev/ds/primitives/toast' },
        { label: 'Divider', icon: 'minus-circle', href: '/dev/ds/primitives/divider' },
        { label: 'Title', icon: 'docs', href: '/dev/ds/primitives/title' },
        { label: 'PageContainer', icon: 'docs', href: '/dev/ds/primitives/page-container' },
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
    ],
    playground: [
        { label: 'Shake & Confetti', icon: 'gift', href: '/dev/ds/playground/shake-test' },
        { label: 'Perk Success', icon: 'check-circle', href: '/dev/ds/playground/perk-success' },
    ],
}
