'use client'

import React from 'react'
import Link from 'next/link'
import { twMerge } from '@/utils/tw'
import { Icon } from '../Global/Icons/Icon'

interface LinkButtonProps {
    /** Link text. */
    children: React.ReactNode
    /** Renders a Next.js <Link>. Omit to render a <button> with onClick. */
    href?: string
    onClick?: () => void
    /** Shows the trailing arrow-up-right icon. */
    icon?: boolean
    disabled?: boolean
    /** Opens href in a new tab. */
    external?: boolean
    className?: string
    'data-testid'?: string
}

/**
 * Standalone link button from the figma link board (17980:17351): Body/XS
 * underlined, foreground/secondary at rest, foreground/primary on hover,
 * optional trailing icon. Covers standalone navigation links AND underlined
 * text actions (action-link node 17980-17352, same family — ruled 2026-09-02).
 * Never embed it inline in a sentence (inline links just underline the
 * surrounding text).
 */
export const LinkButton = ({
    children,
    href,
    onClick,
    icon,
    disabled,
    external,
    className,
    ...props
}: LinkButtonProps) => {
    const classes = twMerge(
        // after: pseudo-element extends the 16px text row to a 44px hit area.
        // that hit area extends 14px past each edge — keep stacked LinkButtons
        // at least ~28px apart so hit areas do not overlap.
        'relative inline-flex items-center gap-1 rounded text-body-xs text-foreground-secondary underline transition-colors duration-instant after:absolute after:inset-x-0 after:-inset-y-3.5 hover:text-foreground-primary active:text-foreground-primary focus-visible:outline-2 focus-visible:outline-action-focus',
        disabled && 'pointer-events-none opacity-40',
        className
    )
    const content = (
        <>
            {children}
            {icon && <Icon name="arrow-up-right" size={14} className="shrink-0" />}
        </>
    )
    if (href && !disabled) {
        return (
            <Link
                href={href}
                onClick={onClick}
                className={classes}
                {...(external && { target: '_blank', rel: 'noopener noreferrer' })}
                {...props}
            >
                {content}
            </Link>
        )
    }
    return (
        <button type="button" onClick={onClick} disabled={disabled} className={classes} {...props}>
            {content}
        </button>
    )
}
