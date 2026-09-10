'use client'

import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '@/components/Global/Icons/Icon'

interface InfoTooltipProps {
    label: string
    children: React.ReactNode
}

export default function InfoTooltip({ label, children }: InfoTooltipProps) {
    const id = useId()
    const anchorRef = useRef<HTMLButtonElement>(null)
    const tooltipRef = useRef<HTMLSpanElement>(null)
    const [hovered, setHovered] = useState(false)
    const [focused, setFocused] = useState(false)
    const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
    const open = hovered || focused

    const updatePosition = useCallback(() => {
        const anchor = anchorRef.current
        const tooltip = tooltipRef.current
        if (!anchor || !tooltip) return
        const anchorBounds = anchor.getBoundingClientRect()
        const tooltipBounds = tooltip.getBoundingClientRect()
        const gutter = 8
        const left = Math.min(
            window.innerWidth - tooltipBounds.width - gutter,
            Math.max(gutter, anchorBounds.left + anchorBounds.width / 2 - tooltipBounds.width / 2)
        )
        const below = anchorBounds.bottom + gutter
        const top =
            below + tooltipBounds.height <= window.innerHeight - gutter
                ? below
                : Math.max(gutter, anchorBounds.top - tooltipBounds.height - gutter)
        setPosition({ left, top })
    }, [])

    useLayoutEffect(() => {
        if (!open) {
            setPosition(null)
            return
        }
        updatePosition()
        window.addEventListener('resize', updatePosition)
        window.addEventListener('scroll', updatePosition, true)
        return () => {
            window.removeEventListener('resize', updatePosition)
            window.removeEventListener('scroll', updatePosition, true)
        }
    }, [open, updatePosition])

    return (
        <span className="inline-flex">
            <button
                ref={anchorRef}
                type="button"
                aria-label={`About ${label}`}
                aria-describedby={open ? id : undefined}
                className="rounded-full text-grey-1 outline-none hover:text-n-1 focus-visible:ring-2 focus-visible:ring-purple-1"
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={(event) => {
                    if (event.key !== 'Escape') return
                    event.preventDefault()
                    setHovered(false)
                    setFocused(false)
                }}
            >
                <Icon name="info" size={14} />
            </button>
            {open &&
                createPortal(
                    <span
                        ref={tooltipRef}
                        id={id}
                        role="tooltip"
                        className="ph-no-capture pointer-events-none fixed z-[100] w-56 rounded-sm border border-n-1 bg-white p-2 text-left text-xs font-normal text-n-1 shadow-[3px_3px_0_#000]"
                        data-private="true"
                        data-sentry-mask
                        style={{
                            left: position?.left ?? 0,
                            top: position?.top ?? 0,
                            visibility: position ? 'visible' : 'hidden',
                        }}
                    >
                        {children}
                    </span>,
                    document.body
                )}
        </span>
    )
}
