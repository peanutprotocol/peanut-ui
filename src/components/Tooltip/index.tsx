'use client'

import React, { useState, useRef, useEffect, useId } from 'react'
import ReactDOM from 'react-dom'
import { twMerge } from '@/utils/tw'
import { TooltipContent, type TooltipPosition } from './TooltipContent'

interface TooltipProps {
    content: string | React.ReactNode
    children: React.ReactNode
    position?: TooltipPosition
    className?: string
    contentClassName?: string
    disabled?: boolean
    id?: string
}

export const Tooltip = ({
    content,
    children,
    position = 'top',
    className = '',
    contentClassName = '',
    disabled = false,
    id,
}: TooltipProps) => {
    const generatedId = useId()
    const tooltipId = `${id ?? 'tooltip'}-${generatedId}`
    const [visible, setVisible] = useState(false)
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, height: 0 })
    const triggerRef = useRef<HTMLDivElement>(null)
    const [isMounted, setIsMounted] = useState(false)
    const [dynamicPosition, setDynamicPosition] = useState(position)

    const updateTooltipPosition = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect()
            setCoords({
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
            })
        }
    }

    useEffect(() => {
        setIsMounted(true)
    }, [])

    useEffect(() => {
        if (visible) {
            setDynamicPosition(position)
            window.addEventListener('resize', updateTooltipPosition)
            window.addEventListener('scroll', updateTooltipPosition, true)
        } else {
            window.removeEventListener('resize', updateTooltipPosition)
            window.removeEventListener('scroll', updateTooltipPosition, true)
        }
        return () => {
            window.removeEventListener('resize', updateTooltipPosition)
            window.removeEventListener('scroll', updateTooltipPosition, true)
        }
    }, [visible, position])

    const showTooltip = () => {
        if (!disabled) {
            setVisible(true)
            // We need to delay the position update slightly to ensure the trigger ref is in its final place.
            setTimeout(updateTooltipPosition, 0)
        }
    }

    const hideTooltip = () => setVisible(false)

    return (
        <>
            <div
                ref={triggerRef}
                tabIndex={disabled ? undefined : 0}
                aria-describedby={visible ? tooltipId : undefined}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                        event.stopPropagation()
                        hideTooltip()
                    }
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        showTooltip()
                    }
                }}
                className={twMerge('inline-block cursor-pointer', className)}
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
                onFocus={showTooltip}
                onBlur={hideTooltip}
                onClick={(e) => {
                    e.stopPropagation()
                    if (visible) {
                        hideTooltip()
                    } else {
                        showTooltip()
                    }
                }}
            >
                {children}
            </div>
            {isMounted &&
                visible &&
                ReactDOM.createPortal(
                    <TooltipContent
                        id={tooltipId}
                        content={content}
                        position={dynamicPosition}
                        coords={coords}
                        contentClassName={contentClassName}
                        updatePosition={setDynamicPosition}
                        initialPosition={position}
                    />,
                    document.body
                )}
        </>
    )
}
