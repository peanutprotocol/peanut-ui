'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useModalsContext } from '@/context/ModalsContext'
import { useCrispUserData } from '@/hooks/useCrispUserData'
import { useCrispTokenId } from '@/hooks/useCrispTokenId'
import { useCrispProxyUrl } from '@/hooks/useCrispProxyUrl'
import PeanutLoading from '../PeanutLoading'

const DISMISS_THRESHOLD = 100

const SupportDrawer = () => {
    const { isSupportModalOpen, setIsSupportModalOpen, supportPrefilledMessage: prefilledMessage } = useModalsContext()
    const userData = useCrispUserData()
    const crispTokenId = useCrispTokenId()
    const [isCrispReady, setIsCrispReady] = useState(false)

    const crispProxyUrl = useCrispProxyUrl(userData, prefilledMessage, crispTokenId)

    // drag-to-dismiss state
    const panelRef = useRef<HTMLDivElement>(null)
    const dragStartY = useRef<number | null>(null)
    const [dragOffset, setDragOffset] = useState(0)
    const isDragging = dragStartY.current !== null

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        dragStartY.current = e.touches[0].clientY
    }, [])

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (dragStartY.current === null) return
        const delta = e.touches[0].clientY - dragStartY.current
        // only allow dragging downward
        setDragOffset(Math.max(0, delta))
    }, [])

    const handleTouchEnd = useCallback(() => {
        if (dragOffset > DISMISS_THRESHOLD) {
            setIsSupportModalOpen(false)
        }
        dragStartY.current = null
        setDragOffset(0)
    }, [dragOffset, setIsSupportModalOpen])

    // listen for crisp ready once — persists across open/close cycles
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return

            if (event.data.type === 'CRISP_READY') {
                setIsCrispReady(true)
            }
        }

        window.addEventListener('message', handleMessage)
        return () => window.removeEventListener('message', handleMessage)
    }, [])

    // close on escape
    useEffect(() => {
        if (!isSupportModalOpen) return
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsSupportModalOpen(false)
        }
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [isSupportModalOpen, setIsSupportModalOpen])

    return (
        <>
            {/* backdrop */}
            <div
                className={`fixed inset-0 z-[999998] bg-black/80 transition-opacity duration-300 ${
                    isSupportModalOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
                onClick={() => setIsSupportModalOpen(false)}
                aria-hidden="true"
            />

            {/* slide-up panel — always mounted so the iframe never unmounts */}
            <div
                ref={panelRef}
                role="dialog"
                aria-label="Support"
                aria-modal={isSupportModalOpen}
                className={`fixed inset-x-0 bottom-0 z-[999999] flex max-h-[85vh] flex-col rounded-t-[10px] border bg-background pt-4 ${
                    isSupportModalOpen ? 'translate-y-0' : 'pointer-events-none translate-y-full'
                }`}
                style={{
                    transform: isSupportModalOpen ? `translateY(${dragOffset}px)` : 'translateY(100%)',
                    transition: isDragging ? 'none' : 'transform 300ms ease-out',
                }}
            >
                {/* drag handle */}
                <div
                    className="flex cursor-grab items-center justify-center pb-4 active:cursor-grabbing"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className="h-1.5 w-10 rounded-full bg-black" />
                </div>

                <div className="flex w-full justify-center">
                    <div className="relative h-[80vh] w-full overflow-auto md:max-w-xl">
                        {!isCrispReady && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
                                <PeanutLoading />
                            </div>
                        )}
                        <iframe
                            src={crispProxyUrl}
                            className="h-full w-full"
                            allow="storage-access *"
                            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-storage-access-by-user-activation"
                            title="Support Chat"
                            tabIndex={isSupportModalOpen ? 0 : -1}
                        />
                    </div>
                </div>
            </div>
        </>
    )
}

export default SupportDrawer
