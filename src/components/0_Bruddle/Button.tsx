'use client'
import React, { forwardRef, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { twMerge } from '@/utils/tw'
import { Icon, type IconName } from '../Global/Icons/Icon'
import Loading from '../Global/Loading'
import { useAppHaptic } from '@/hooks/useAppHaptic'
import { useLongPress } from '@/hooks/useLongPress'

export type ButtonVariant =
    | 'purple'
    | 'stroke'
    | 'transparent-light'
    | 'transparent-dark'
    | 'transparent'
    | 'primary-soft'
export type ButtonSize = 'small' | 'medium' | 'large'
type ButtonShape = 'default' | 'square'
type ShadowSize = '3' | '4' | '6' | '8'

interface ButtonVisualProps {
    variant?: ButtonVariant
    size?: ButtonSize
    shape?: ButtonShape
    shadowSize?: ShadowSize
    loading?: boolean
    icon?: IconName | React.ReactNode
    iconPosition?: 'left' | 'right'
    iconClassName?: string
    iconSize?: number
    iconContainerClassName?: HTMLDivElement['className']
    disableHaptics?: boolean
}

/**
 * Primary button component. Styled to the figma button board (17802:61527):
 * pill shape, sizes l=48/m=44 (default)/s=40px, primary + stroke carry the
 * 4px shadow by default.
 *
 * Navigation split (ruled): underlined text link -> `LinkButton`;
 * button-looking navigation -> `Button` with `href` (link mode). Link mode
 * renders ONE anchor element with the exact button classes, press state and
 * haptics — never wrap a Button in a <Link> (nested interactive) and never
 * hand-roll `.btn` classes on an anchor.
 *
 * @prop variant - Visual style. 'purple' = board primary, 'stroke' = board
 *   secondary, 'transparent' = board ghost. Others are legacy.
 * @prop size - Omit for medium (44px). 'large' is 48px, 'small' is 40px.
 * @prop shadowSize - Shadow depth override; '4' is already the default on
 *   purple/stroke, so passing it is a no-op kept for compatibility.
 * @prop longPress - Hold-to-confirm behavior with progress bar animation.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, ButtonVisualProps {
    longPress?: {
        duration?: number // Duration in milliseconds (default: 2000)
        onLongPress?: () => void
        onLongPressStart?: () => void
        onLongPressEnd?: () => void
    }
    /** link-mode props — typed `never` here so the two prop sets cannot mix */
    href?: never
    external?: never
    download?: never
    plainAnchor?: never
    prefetch?: never
}

/**
 * Link mode: `href` set. Renders one anchor — next/link for internal routes,
 * a plain <a> for external/scheme hrefs, downloads, or `plainAnchor`.
 */
export interface ButtonLinkProps
    extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>, ButtonVisualProps {
    href: string
    /** open in a new tab: plain <a> with target="_blank" rel="noopener noreferrer" */
    external?: boolean
    /** force a plain <a> for an internal route — for surfaces that must
     *  navigate with a full page load and work before hydration (404 recovery) */
    plainAnchor?: boolean
    /** disabled link: the anchor keeps the disabled visuals but drops its href
     *  and gets aria-disabled — nothing to navigate, hydrated or not */
    disabled?: boolean
    /** forwarded to next/link — internal routes only. `false` keeps a link out
     *  of the viewport prefetch (marquees and other link-dense surfaces) */
    prefetch?: boolean
    /** hold-to-confirm is button-only */
    longPress?: never
}

const buttonVariants: Record<ButtonVariant, string> = {
    purple: 'btn-purple',
    stroke: 'btn-stroke',
    'transparent-light': 'btn-transparent-light',
    'transparent-dark': 'btn-transparent-dark',
    'primary-soft': 'bg-white active:bg-action-primary',
    transparent:
        'bg-transparent border-none hover:bg-transparent active:bg-transparent! focus:bg-transparent disabled:bg-transparent disabled:hover:bg-transparent hover:text-action-ghost-hover hover:fill-action-ghost-hover active:text-action-ghost-hover active:fill-action-ghost-hover',
}

const buttonSizes: Record<ButtonSize, string> = {
    small: 'btn-small',
    medium: 'btn-medium',
    large: 'btn-large',
}

// board 17802:61527 icon per button size: S = 16, M = 20, L = 24. 18 was off
// the 16/20/24 icon scale entirely and matched no board row.
const buttonIconSizes: Record<ButtonSize, number> = {
    small: 16,
    medium: 20,
    large: 24,
}

const buttonShadows: Record<ShadowSize, string> = {
    '3': 'btn-shadow-primary-3',
    '4': 'btn-shadow-primary-4',
    '6': 'btn-shadow-primary-6',
    '8': 'btn-shadow-primary-8',
}

const ButtonImpl = forwardRef<HTMLButtonElement, ButtonProps | ButtonLinkProps>(
    (
        {
            children,
            className,
            loading,
            variant = 'purple',
            size,
            shape,
            shadowSize,
            icon,
            iconPosition = 'left',
            iconSize,
            iconClassName,
            iconContainerClassName,
            longPress,
            onClick,
            disableHaptics,
            disabled,
            href,
            external,
            download,
            plainAnchor,
            prefetch,
            ...props
        },
        ref
    ) => {
        const localRef = useRef<HTMLButtonElement>(null)
        const buttonRef = (ref as React.RefObject<HTMLButtonElement>) || localRef

        const { triggerHaptic } = useAppHaptic()
        const { isLongPressed, pressProgress, handlers: longPressHandlers } = useLongPress(longPress)

        useEffect(() => {
            if (!buttonRef.current) return
            buttonRef.current.setAttribute('translate', 'no')
            buttonRef.current.classList.add('notranslate')
        }, [])

        const handleClick = useCallback(
            (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
                if (longPress && !isLongPressed) {
                    return
                }

                if (!disableHaptics) {
                    triggerHaptic()
                }

                ;(onClick as React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement> | undefined)?.(e)
            },
            [longPress, isLongPressed, onClick, disableHaptics, triggerHaptic]
        )

        // press translate exists to drop the button into its own shadow (design.md
        // "button press translate") — shadowless buttons must not jump.
        // ponytail: string-sniffing className for shadow-none; misses responsive
        // variants like sm:shadow-none — none exist today.
        const hasShadow =
            (shadowSize !== undefined || variant === 'purple' || variant === 'stroke') &&
            !/(?:^|\s)shadow-none(?:\s|$)/.test(className ?? '')

        const isLink = href !== undefined
        const linkDisabled = isLink && disabled

        const buttonClasses = twMerge(
            // static pressed-state classes: the old `translate-y-[${shadowSize}px]`
            // template never generated a real class under the jit scanner
            'btn w-full flex items-center gap-2 transition-all duration-instant notranslate',
            hasShadow && 'active:translate-x-1 active:translate-y-1 active:shadow-none',
            buttonVariants[variant],
            variant === 'transparent' && disabled && 'disabled:bg-transparent disabled:border-transparent',
            // anchors never match :disabled, so a disabled link paints the
            // button's disabled look explicitly: 40% opacity (.btn), the 1px
            // residual shadow (.btn-purple/.btn-stroke), no hover/press
            linkDisabled && 'pointer-events-none opacity-40',
            linkDisabled &&
                (variant === 'purple' || variant === 'stroke') &&
                'shadow-[0.0625rem_0.0625rem_0_var(--color-shadow-primary)]',
            size && buttonSizes[size],
            // board icon/label gap: S is XS/4, L and M are S/8. It has to sit
            // here rather than in `.btn-small`, because @layer components loses
            // to the base `gap-2` utility — twMerge is what resolves it.
            size === 'small' && 'gap-1',
            shape === 'square' && 'btn-square',
            shadowSize && buttonShadows[shadowSize],
            // loading replaces the icon slot (the Loading spinner is a border-animated div, unaffected)
            loading && '[&_svg]:hidden [&_img]:hidden',

            className
        )

        // no `size` means medium (`.btn` is h-11), so the fallback is medium's icon
        const resolvedIconSize = iconSize ?? (size && buttonIconSizes[size]) ?? buttonIconSizes.medium

        const renderIcon = () => {
            if (!icon || loading) return null
            return (
                <div className={twMerge('flex size-6 items-center justify-center', iconContainerClassName)}>
                    {typeof icon === 'string' ? (
                        <Icon size={resolvedIconSize} name={icon as IconName} className={iconClassName} />
                    ) : (
                        icon
                    )}
                </div>
            )
        }

        // Use children as display text (no text changes for long press)
        const displayText = children

        const content = (
            <>
                {loading && <Loading />}
                {iconPosition === 'left' && renderIcon()}
                {displayText}
                {iconPosition === 'right' && renderIcon()}
            </>
        )

        if (isLink) {
            const anchorRef = buttonRef as unknown as React.RefObject<HTMLAnchorElement>
            const anchorProps = props as React.AnchorHTMLAttributes<HTMLAnchorElement>
            const linkClasses = twMerge(buttonClasses, 'notranslate', 'no-underline')

            if (disabled) {
                // disabled link: same anchor element, href dropped — nothing to
                // navigate even before hydration; aria-disabled + role keep the
                // semantics without the focusable-but-dead tab stop
                return (
                    <a
                        className={linkClasses}
                        ref={anchorRef}
                        translate="no"
                        role="link"
                        aria-disabled="true"
                        {...anchorProps}
                    >
                        {content}
                    </a>
                )
            }

            // plain <a> when the url leaves the app (scheme hrefs like https:
            // or mailto:), carries a download, or the caller forces a full-load
            // native anchor; next/link handles internal routes (client nav)
            const isSchemeHref = /^[a-z][a-z0-9+.-]*:|^\/\//i.test(href)
            if (external || plainAnchor || isSchemeHref || download !== undefined) {
                return (
                    <a
                        className={linkClasses}
                        ref={anchorRef}
                        translate="no"
                        href={href}
                        download={download}
                        onClick={handleClick}
                        {...(external && { target: '_blank', rel: 'noopener noreferrer' })}
                        {...anchorProps}
                    >
                        {content}
                    </a>
                )
            }

            return (
                <Link
                    className={linkClasses}
                    ref={anchorRef}
                    translate="no"
                    href={href}
                    prefetch={prefetch}
                    onClick={handleClick}
                    {...anchorProps}
                >
                    {content}
                </Link>
            )
        }

        return (
            <button
                className={twMerge(buttonClasses, 'notranslate', longPress && 'relative overflow-hidden')}
                ref={buttonRef}
                translate="no"
                disabled={disabled}
                onClick={handleClick}
                onMouseDown={longPress ? longPressHandlers.onMouseDown : undefined}
                onMouseUp={longPress ? longPressHandlers.onMouseUp : undefined}
                onMouseLeave={longPress ? longPressHandlers.onMouseLeave : undefined}
                onTouchStart={longPress ? longPressHandlers.onTouchStart : undefined}
                onTouchEnd={longPress ? longPressHandlers.onTouchEnd : undefined}
                onTouchCancel={longPress ? longPressHandlers.onTouchCancel : undefined}
                {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
            >
                {/* Progress bar for long press */}
                {longPress && pressProgress > 0 && (
                    <div
                        className="absolute inset-0 bg-gradient-to-r from-purple-400 to-purple-600 opacity-30 transition-all duration-instant ease-out"
                        style={{
                            width: `${pressProgress}%`,
                        }}
                    />
                )}

                {content}
            </button>
        )
    }
)

ButtonImpl.displayName = 'Button'

// mode-sensitive ref typing: the impl forwards one ref either way (typed
// loosely inside); this overload cast is what makes `ref` follow the mode —
// button mode takes Ref<HTMLButtonElement>, link mode (href) takes
// Ref<HTMLAnchorElement> — and rejects the wrong pairing at the call site.
export const Button = ButtonImpl as unknown as {
    (props: ButtonProps & React.RefAttributes<HTMLButtonElement>): React.ReactElement | null
    (props: ButtonLinkProps & React.RefAttributes<HTMLAnchorElement>): React.ReactElement | null
    displayName?: string
}
