import { Menu, Transition } from '@headlessui/react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '../Icon'

interface MoreInfoProps {
    text: string | React.ReactNode
    html?: boolean
}

const MoreInfo = ({ text, html = false }: MoreInfoProps) => {
    const buttonRef = useRef<HTMLButtonElement>(null)
    const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        return () => setMounted(false)
    }, [])

    useEffect(() => {
        const calculatePosition = () => {
            if (!buttonRef.current) return

            const buttonRect = buttonRef.current.getBoundingClientRect()
            const viewportWidth = window.innerWidth
            const tooltipWidth = 240 // Fixed width for tooltip
            const SCREEN_PADDING = 16

            // Calculate horizontal position
            let left = buttonRect.left + buttonRect.width / 2 - tooltipWidth / 2
            left = Math.min(Math.max(SCREEN_PADDING, left), viewportWidth - tooltipWidth - SCREEN_PADDING)

            // Calculate vertical position
            const spaceBelow = window.innerHeight - buttonRect.bottom
            const spaceAbove = buttonRect.top
            const showBelow = spaceBelow >= 100 || spaceBelow > spaceAbove

            const newStyle: React.CSSProperties = {
                position: 'fixed',
                left: `${left}px`,
                width: `${tooltipWidth}px`,
                zIndex: 9999,
            }

            if (showBelow) {
                newStyle.top = `${buttonRect.bottom + 8}px`
            } else {
                newStyle.bottom = `${window.innerHeight - buttonRect.top + 8}px`
            }

            setTooltipStyle(newStyle)
        }

        calculatePosition()

        window.addEventListener('resize', calculatePosition)
        window.addEventListener('scroll', calculatePosition, true)

        return () => {
            window.removeEventListener('resize', calculatePosition)
            window.removeEventListener('scroll', calculatePosition, true)
        }
    }, [text])

    const renderTooltip = (show: boolean) => {
        if (!mounted) return null

        return createPortal(
            <Transition
                show={show}
                enter="transition-opacity duration-150 ease-out"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="transition-opacity duration-100 ease-out"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
            >
                <div
                    style={tooltipStyle}
                    className="whitespace-pre-line rounded border border-n-1 bg-white px-3 py-2 shadow-lg"
                >
                    <div className="block text-h8 font-normal text-black">
                        {html ? <div dangerouslySetInnerHTML={{ __html: text as string }} /> : <div>{text}</div>}
                    </div>
                </div>
            </Transition>,
            document.body
        )
    }

    return (
        <Menu as="div" className="inline-flex items-center">
            {({ open }) => (
                <>
                    <Menu.Button ref={buttonRef} className="inline-flex items-center justify-center p-0.5">
                        <Icon name="info" className="h-4 w-4 transition-transform dark:fill-white" />
                    </Menu.Button>
                    {renderTooltip(open)}
                </>
            )}
        </Menu>
    )
}

export default MoreInfo
