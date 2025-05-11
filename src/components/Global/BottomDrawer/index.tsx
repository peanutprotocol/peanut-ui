import React, { ReactNode, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type DrawerPosition = 'collapsed' | 'half' | 'expanded'

interface BottomDrawerProps {
    children: ReactNode
    isOpen: boolean
    onClose?: () => void
    initialPosition?: DrawerPosition
    handleTitle?: string
    handleSubtitle?: string
    collapsedHeight?: number
    halfHeight?: number
    expandedHeight?: number
    onPositionChange?: (position: DrawerPosition) => void
    preventScroll?: boolean
}

const BottomDrawer: React.FC<BottomDrawerProps> = ({
    children,
    isOpen,
    onClose,
    initialPosition = 'half',
    handleTitle = '',
    handleSubtitle = '',
    collapsedHeight = 15,
    halfHeight = 50,
    expandedHeight = 90,
    onPositionChange = () => {},
    preventScroll = true,
}) => {
    const [position, setPosition] = useState<DrawerPosition>(initialPosition)
    const [isDragging, setIsDragging] = useState<boolean>(false)
    const [startY, setStartY] = useState<number>(0)
    const [currentY, setCurrentY] = useState<number>(0)
    const [portalElement, setPortalElement] = useState<HTMLElement | null>(null)
    const [userMovedDrawer, setUserMovedDrawer] = useState<boolean>(false)
    const sheetRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)
    const overlayRef = useRef<HTMLDivElement>(null)

    // reset position when drawer is opened
    useEffect(() => {
        if (isOpen) {
            setPosition(initialPosition)
            setUserMovedDrawer(false)
        }
    }, [isOpen, initialPosition])

    // Create portal element on mount
    useEffect(() => {
        // Find or create the portal root element
        let element = document.getElementById('drawer-portal-root')
        if (!element) {
            element = document.createElement('div')
            element.id = 'drawer-portal-root'
            document.body.appendChild(element)
        }
        setPortalElement(element)

        // Cleanup on unmount
        return () => {
            if (element && element.parentNode && element.childNodes.length === 0) {
                element.parentNode.removeChild(element)
            }
        }
    }, [])

    // Manage body scroll when drawer is open
    useEffect(() => {
        if (preventScroll && isOpen && position === 'expanded') {
            // Only prevent scroll when fully expanded
            // Store the current scroll position
            const scrollY = window.scrollY
            document.body.style.position = 'fixed'
            document.body.style.top = `-${scrollY}px`
            document.body.style.width = '100%'

            return () => {
                // Restore the scroll position
                const originalScrollY = document.body.style.top
                document.body.style.position = ''
                document.body.style.top = ''
                document.body.style.width = ''
                window.scrollTo(0, parseInt(originalScrollY || '0', 10) * -1)
            }
        }
    }, [preventScroll, isOpen, position])

    // Handle position changes
    useEffect(() => {
        // Notify parent component when position changes
        onPositionChange(position)

        // track if user has moved drawer from initial position
        if (position !== initialPosition && initialPosition === 'collapsed' && !userMovedDrawer) {
            setUserMovedDrawer(true)
        }

        // Adjust height based on content in any position
        if (contentRef.current && sheetRef.current) {
            // Small delay to ensure content is rendered
            setTimeout(() => {
                if (sheetRef.current) {
                    // If in expanded mode or if content is smaller than half-height requested
                    const contentHeight = (contentRef.current?.scrollHeight ?? 0) + 150
                    const viewportHeight = window.innerHeight
                    const contentHeightPercent = (contentHeight / viewportHeight) * 100

                    // In expanded position or if content height is less than expected height for position
                    if (position === 'expanded' || (position === 'half' && contentHeightPercent < halfHeight)) {
                        sheetRef.current.style.height = calculateHeight()
                    }
                }
            }, 50)
        }
    }, [position, onPositionChange, initialPosition, userMovedDrawer])

    // Handle close when swiping down from collapsed position
    const handleClose = () => {
        if (onClose) {
            onClose()
        }
    }

    // Get height percentage based on current position
    const getHeightPercentage = (): number => {
        switch (position) {
            case 'collapsed':
                return collapsedHeight
            case 'half':
                return halfHeight
            case 'expanded':
                return expandedHeight
            default:
                return halfHeight
        }
    }

    // Calculate current height including drag offset
    const calculateHeight = (): string => {
        const baseHeight = getHeightPercentage()

        // Get content height limit
        const contentHeightLimit = contentRef.current
            ? ((contentRef.current.scrollHeight + 150) / window.innerHeight) * 100
            : expandedHeight

        // Use the smaller of expandedHeight and contentHeightLimit as maximum height
        const maxHeight = Math.min(expandedHeight, contentHeightLimit)

        if (!isDragging) {
            // If in expanded mode, use content height
            if (position === 'expanded') {
                return `${maxHeight}vh`
            }
            // Otherwise use standard height but cap at content height
            return `${Math.min(baseHeight, maxHeight)}vh`
        }

        // Calculate drag offset as percentage of viewport height
        const dragOffset = ((startY - currentY) / window.innerHeight) * 100
        const newHeight = baseHeight + dragOffset

        // Constrain between minimum and maximum heights
        return `${Math.max(collapsedHeight, Math.min(maxHeight, newHeight))}vh`
    }

    // Calculate content-aware height to ensure no extra whitespace
    const calculateContentHeight = (): string => {
        if (!contentRef.current) return `${expandedHeight}vh`

        // Calculate the actual content height plus the drag handle height
        const contentHeight = contentRef.current.scrollHeight + 150 // 150px accounts for the drag handle
        const viewportHeight = window.innerHeight
        const contentHeightPercent = (contentHeight / viewportHeight) * 100

        // Cap at the maximum expanded height
        return `${Math.min(contentHeightPercent, expandedHeight)}vh`
    }

    // Handle the end of drag and determine new position
    const handleDragEnd = (): void => {
        if (!isDragging) {
            setIsDragging(false)
            return
        }

        const dragDistance = startY - currentY
        const dragPercentage = (dragDistance / window.innerHeight) * 100
        const absoluteDragDistance = Math.abs(dragDistance)

        let newTargetPosition = position
        let shouldCloseDrawer = false

        // thresholds for different drag actions
        const significantUpwardDragThreshold = 10
        const significantDownwardDragThreshold = -10
        const directCloseDragDistancePx = 50
        const closeFromCollapsedDragDistancePx = 20
        const veryLargeDragToClosePx = window.innerHeight * 0.3

        // 1. check for closing the drawer
        if (initialPosition === 'expanded' || initialPosition === 'half') {
            if (dragDistance < 0 && absoluteDragDistance > directCloseDragDistancePx) {
                shouldCloseDrawer = true
            }
        } else if (position === 'collapsed') {
            if (userMovedDrawer) {
                if (dragDistance < 0 && absoluteDragDistance > closeFromCollapsedDragDistancePx) {
                    shouldCloseDrawer = true
                }
            } else {
                if (dragDistance < 0 && absoluteDragDistance > veryLargeDragToClosePx) {
                    shouldCloseDrawer = true
                }
            }
        }

        // 2. if not closing, determine position change for significant drags
        if (!shouldCloseDrawer) {
            if (dragPercentage > significantUpwardDragThreshold) {
                if (position === 'collapsed') newTargetPosition = 'half'
                else if (position === 'half') newTargetPosition = 'expanded'
            } else if (dragPercentage < significantDownwardDragThreshold) {
                if (position === 'expanded') newTargetPosition = 'half'
                else if (position === 'half') newTargetPosition = 'collapsed'
            } else {
                const currentBaseHeightVh = getHeightPercentage()
                const projectedVh = currentBaseHeightVh - (dragDistance / window.innerHeight) * 100

                const distToCollapsed = Math.abs(projectedVh - collapsedHeight)
                const distToHalf = Math.abs(projectedVh - halfHeight)
                const distToExpanded = Math.abs(projectedVh - expandedHeight)

                if (distToCollapsed <= distToHalf && distToCollapsed <= distToExpanded) {
                    newTargetPosition = 'collapsed'
                } else if (distToHalf <= distToCollapsed && distToHalf <= distToExpanded) {
                    newTargetPosition = 'half'
                } else {
                    newTargetPosition = 'expanded'
                }

                if (
                    newTargetPosition === 'collapsed' &&
                    position === 'collapsed' &&
                    dragDistance < 0 &&
                    absoluteDragDistance > closeFromCollapsedDragDistancePx
                ) {
                    if (initialPosition !== 'collapsed' || userMovedDrawer) {
                        shouldCloseDrawer = true
                    }
                }
            }
        }

        // apply actions: close or change position
        if (shouldCloseDrawer) {
            handleClose()
        } else if (newTargetPosition !== position) {
            setPosition(newTargetPosition)
            if (initialPosition === 'collapsed' && newTargetPosition !== 'collapsed' && !userMovedDrawer) {
                setUserMovedDrawer(true)
            }
        }

        setIsDragging(false)
    }

    // Touch event handlers
    const handleTouchStart = (e: React.TouchEvent): void => {
        setIsDragging(true)
        setStartY(e.touches[0].clientY)
        setCurrentY(e.touches[0].clientY)
    }

    const handleTouchMove = (e: React.TouchEvent): void => {
        if (isDragging) {
            setCurrentY(e.touches[0].clientY)
        }
    }

    // Mouse event handlers
    const handleMouseDown = (e: React.MouseEvent): void => {
        setIsDragging(true)
        setStartY(e.clientY)
        setCurrentY(e.clientY)
    }

    const handleMouseMove = (e: MouseEvent): void => {
        if (isDragging) {
            setCurrentY(e.clientY)
        }
    }

    // Clean up event listeners
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', handleDragEnd)
            window.addEventListener('touchmove', handleTouchMove as any)
            window.addEventListener('touchend', handleDragEnd as any)
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleDragEnd)
            window.removeEventListener('touchmove', handleTouchMove as any)
            window.removeEventListener('touchend', handleDragEnd as any)
        }
    }, [isDragging, handleDragEnd])

    // Handle overlay click to close drawer
    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === overlayRef.current) {
            // if initial position was collapsed and user opened it,
            // clicking overlay should return it to collapsed state.
            if (initialPosition === 'collapsed' && (position === 'half' || position === 'expanded')) {
                setPosition('collapsed')
                setUserMovedDrawer(false)
            } else {
                // default behavior for other cases (e.g., initialPosition was half/expanded,
                onClose?.()
            }
        }
    }

    // Calculate overlay opacity based on position
    const calculateOverlayOpacity = (): number => {
        if (position === 'expanded') return 0.5
        if (position === 'half') return 0.3
        return 0
    }

    // Only render if portal element exists and drawer is open
    if (!portalElement || !isOpen) return null

    // Render drawer through portal
    return createPortal(
        <div
            className="fixed inset-0 z-50"
            style={{ pointerEvents: position === 'collapsed' && !isDragging ? 'none' : 'auto' }}
        >
            {/* Backdrop overlay */}
            <div
                ref={overlayRef}
                className="absolute inset-0 bg-black transition-opacity duration-300"
                style={{
                    opacity: calculateOverlayOpacity(),
                    transition: isDragging ? 'none' : 'opacity 0.3s ease-out',
                    pointerEvents: position === 'collapsed' ? 'none' : 'auto', // allow clicks through overlay when collapsed
                }}
                onClick={handleOverlayClick}
            />

            {/* Bottom sheet/drawer */}
            <div
                ref={sheetRef}
                className={`absolute bottom-0 left-0 right-0 z-10 w-full overflow-hidden rounded-t-3xl bg-grey-3 shadow-lg transition-all duration-300 ease-out`}
                style={{
                    height: calculateHeight(),
                    transition: isDragging ? 'none' : 'height 0.3s ease-out',
                    pointerEvents: 'auto', // Always allow interaction with the drawer itself
                }}
            >
                {/* Drag handle */}
                <div
                    className="mx-auto cursor-grab touch-none px-6 pb-2 pt-2 md:max-w-2xl"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleDragEnd}
                    onMouseDown={handleMouseDown}
                    style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                >
                    <div className="mx-auto mb-4 mt-2 h-2 w-8 rounded-full bg-black"></div>
                    <div className="mb-8 space-y-1">
                        {handleTitle && <h2 className="text-lg font-extrabold">{handleTitle}</h2>}
                        {handleSubtitle && <h2 className="mb-8">{handleSubtitle}</h2>}
                    </div>
                </div>

                {/* Content area */}
                <div
                    ref={contentRef}
                    className="mx-auto overflow-y-auto px-6 pb-6 md:max-w-2xl "
                    style={{
                        maxHeight: `calc(${
                            position === 'expanded' ? calculateContentHeight().replace('vh', '') : expandedHeight
                        }vh - 70px)`,
                    }}
                >
                    {children}
                </div>
                <div
                    className={`pointer-events-none absolute bottom-0 left-0 right-0 items-center pb-4 text-center transition-all duration-300 ease-in-out ${
                        position === 'expanded' ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
                    }`}
                ></div>
            </div>
        </div>,
        portalElement
    )
}

export default BottomDrawer
