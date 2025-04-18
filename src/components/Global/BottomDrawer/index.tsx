import React, { ReactNode, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type DrawerPosition = 'collapsed' | 'half' | 'expanded'

interface BottomDrawerProps {
    children: ReactNode
    isOpen: boolean
    onClose?: () => void
    initialPosition?: DrawerPosition
    handleTitle?: string
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
    const sheetRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)
    const overlayRef = useRef<HTMLDivElement>(null)

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
        if (preventScroll && position === 'expanded') {
            // Only prevent scroll when fully expanded
            // Store the current scroll position
            const scrollY = window.scrollY
            document.body.style.position = 'fixed'
            document.body.style.top = `-${scrollY}px`
            document.body.style.width = '100%'

            return () => {
                // Restore the scroll position
                const scrollY = document.body.style.top
                document.body.style.position = ''
                document.body.style.top = ''
                document.body.style.width = ''
                window.scrollTo(0, parseInt(scrollY || '0') * -1)
            }
        }
    }, [preventScroll, position])

    // Handle position changes
    useEffect(() => {
        // Notify parent component when position changes
        onPositionChange(position)

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
    }, [position, onPositionChange])

    // Handle close when swiping down from collapsed position
    const handleClose = () => {
        if (position === 'collapsed') {
            onClose?.()
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
        if (!isDragging) return

        const dragDistance = startY - currentY
        const dragPercentage = (dragDistance / window.innerHeight) * 100

        // Get content height for comparison
        const contentHeightLimit = contentRef.current
            ? ((contentRef.current.scrollHeight + 150) / window.innerHeight) * 100
            : expandedHeight

        // Check if drawer is already at content height
        const currentDrawerHeight = sheetRef.current?.style.height ? parseFloat(sheetRef.current.style.height) : 0

        const currentHeightPercent = (currentDrawerHeight / window.innerHeight) * 100
        const isAtContentMax = Math.abs(currentHeightPercent - contentHeightLimit) < 5 // Within 5% margin

        // Determine new position based on drag direction and distance
        if (dragPercentage > 10) {
            // Dragged significantly upward
            if (position === 'collapsed') {
                setPosition('half')
            } else if (position === 'half') {
                // Only go to expanded if content height is greater than half height
                if (contentHeightLimit > halfHeight) {
                    setPosition('expanded')
                }
            }
        } else if (dragPercentage < -10 || isAtContentMax) {
            // Dragged significantly downward OR we're at content max (allow direct collapse)
            if (position === 'expanded' || isAtContentMax) {
                setPosition('half')
            } else if (position === 'half') {
                setPosition('collapsed')
            } else if (position === 'collapsed') {
                handleClose()
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
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleDragEnd)
        }
    }, [isDragging])

    // Handle overlay click to close drawer
    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === overlayRef.current) {
            onClose?.()
        }
    }

    // Calculate overlay opacity based on position
    const calculateOverlayOpacity = (): number => {
        if (position === 'expanded') return 0.5
        if (position === 'half') return 0.3
        return 0.1
    }

    // Determine if the overlay should block interactions
    const shouldBlockInteractions = (): boolean => {
        // Only block background interactions when drawer is expanded
        return position === 'expanded'
    }

    // Only render if portal element exists and drawer is open
    if (!portalElement || !isOpen) return null

    // Render drawer through portal
    return createPortal(
        <div
            className="fixed inset-0 z-50"
            style={{ pointerEvents: 'none' }} // Default to not capturing any events
        >
            {/* Backdrop overlay */}
            <div
                ref={overlayRef}
                className="absolute inset-0 bg-black transition-opacity duration-300"
                style={{
                    opacity: calculateOverlayOpacity(),
                    transition: isDragging ? 'none' : 'opacity 0.3s ease-out',
                    pointerEvents: shouldBlockInteractions() ? 'auto' : 'none',
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
                    className="cursor-grab touch-none px-6 pb-2 pt-2"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleDragEnd}
                    onMouseDown={handleMouseDown}
                    style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                >
                    <div className="mx-auto mb-4 mt-2 h-2 w-8 rounded-full bg-black"></div>
                    {handleTitle && <h2 className="mb-8 text-2xl font-extrabold">{handleTitle}</h2>}
                </div>

                {/* Content area */}
                <div
                    ref={contentRef}
                    className="overflow-y-auto px-6 pb-6"
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
