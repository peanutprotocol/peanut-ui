import { type IconName } from '@/components/Global/Icons/Icon'

// shared shape of the landing hero CTA buttons (hero.tsx renders them,
// LandingPageClient builds them from the content system / migration override)
export type CTAButton = {
    label: string
    href: string
    isExternal?: boolean
    subtext?: string
    icon?: IconName
    onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
}
