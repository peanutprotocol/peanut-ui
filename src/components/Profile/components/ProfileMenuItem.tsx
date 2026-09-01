import StatusBadge from '@/components/Global/Badges/StatusBadge'
import Card from '@/components/Global/Card'
import { type CardPosition } from '@/components/Global/Card/card.utils'
import { localizeDocsHref } from '@/components/Global/DocsLink'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import NavigationArrow from '@/components/Global/NavigationArrow'
import { Tooltip } from '@/components/Tooltip'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import React from 'react'
import { type SVGProps } from 'react'

interface ProfileMenuItemProps {
    icon: IconName | React.ReactNode
    iconClassName?: SVGProps<SVGSVGElement>['className']
    label: string
    href?: string
    onClick?: () => void
    position?: CardPosition
    comingSoon?: boolean
    isExternalLink?: boolean
    /** web-only content (help center, legal). Localizes the href and navigates
     * SAME-TAB so the marketing pages' HeroBackNav can return via history
     * (a new tab starts with none and its back button falls to `/`). In
     * Capacitor the useNativeAppLinks click interceptor reroutes the tap to
     * the in-app browser, so the missing native route never 404s. */
    isDocsLink?: boolean
    endIcon?: IconName
    endIconClassName?: string
    endText?: string
    showTooltip?: boolean
    toolTipText?: string
    badge?: string
}

const ProfileMenuItem: React.FC<ProfileMenuItemProps> = ({
    icon,
    iconClassName,
    label,
    href,
    onClick,
    position = 'middle',
    comingSoon = false,
    isExternalLink,
    isDocsLink,
    endIcon,
    endIconClassName,
    endText,
    showTooltip = false,
    toolTipText,
    badge,
}) => {
    const locale = useLocale()
    const content = (
        <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
                {typeof icon === 'string' ? (
                    <Icon name={icon as IconName} size={20} fill="black" className={iconClassName} />
                ) : (
                    <div className="flex size-5 items-center justify-center">{icon}</div>
                )}
                <label className="text-body-m text-foreground-primary">{label}</label>
                {badge && <StatusBadge status="custom" customText={badge} />}
                {showTooltip && (
                    <Tooltip content={toolTipText}>
                        <Icon name="info" size={16} fill="black" />
                    </Tooltip>
                )}
            </div>

            <div className="flex items-center gap-1">
                {endText && <span className="text-body-s text-foreground-secondary">{endText}</span>}
                {comingSoon ? (
                    <StatusBadge status="soon" size="medium" />
                ) : endIcon ? (
                    <Icon name={endIcon} size={24} fill="black" className={endIconClassName} />
                ) : (
                    <NavigationArrow size={24} className="fill-black" />
                )}
            </div>
        </div>
    )

    if (comingSoon || !href) {
        return (
            <Card position={position} className="bg-background-disabled p-4">
                {content}
            </Card>
        )
    }

    if (isDocsLink) {
        return (
            <Link href={localizeDocsHref(href, locale)} className="block">
                <Card position={position} className="p-4 active:bg-background-disabled">
                    {content}
                </Card>
            </Link>
        )
    }

    if (onClick) {
        return (
            <Card position={position} onClick={onClick} className="cursor-pointer p-4 active:bg-background-disabled">
                {content}
            </Card>
        )
    }

    return (
        <Link
            href={href}
            className="block"
            target={isExternalLink ? '_blank' : undefined}
            rel={isExternalLink ? 'noopener noreferrer' : undefined}
        >
            <Card position={position} onClick={onClick} className="p-4 active:bg-background-disabled">
                {content}
            </Card>
        </Link>
    )
}

export default ProfileMenuItem
