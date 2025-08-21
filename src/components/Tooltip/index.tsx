'use client'

import React, { useState, useRef, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { twMerge } from 'tailwind-merge'
import { TooltipContent, TooltipPosition } from './TooltipContent'

interface TooltipProps {
    content: string | React.ReactNode
    children: React.ReactNode
    position?: TooltipPosition
    className?: string
    contentClassName?: string
    disabled?: boolean
}

export const Tooltip = ({
    content,
    children,
    position = 'top',
    className = '',
    contentClassName = '',
    disabled = false,
}: TooltipProps) => {
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
                className={twMerge('inline-block', className)}
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
                onFocus={showTooltip}
                onBlur={hideTooltip}
            >
                {children}
            </div>
            {isMounted &&
                visible &&
                ReactDOM.createPortal(
                    <TooltipContent
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
