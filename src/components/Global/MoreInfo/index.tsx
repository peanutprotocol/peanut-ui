import { Menu, Transition } from '@headlessui/react'
import { useEffect, useRef, useState } from 'react'
import Icon from '../Icon'

interface MoreInfoProps {
    text: string
    html?: boolean
}

const MoreInfo = ({ text, html = false }: MoreInfoProps) => {
    const [position, setPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('top')
    const buttonRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        const updatePosition = () => {
            if (!buttonRef.current) return

            const rect = buttonRef.current.getBoundingClientRect()
            const SCREEN_PADDING = 16 // Minimum space from screen edges

            const spaceTop = rect.top - SCREEN_PADDING
            const spaceBottom = window.innerHeight - rect.bottom - SCREEN_PADDING
            const spaceLeft = rect.left - SCREEN_PADDING
            const spaceRight = window.innerWidth - rect.right - SCREEN_PADDING

            // On mobile (or narrow screens), prefer top/bottom positioning
            if (window.innerWidth < 640) {
                setPosition(spaceBottom > spaceTop ? 'bottom' : 'top')
                return
            }

            // For larger screens, find the direction with most space
            const spaces = [
                { dir: 'top' as const, space: spaceTop },
                { dir: 'bottom' as const, space: spaceBottom },
                { dir: 'left' as const, space: spaceLeft },
                { dir: 'right' as const, space: spaceRight },
            ]

            const bestPosition = spaces.reduce((prev, curr) => (curr.space > prev.space ? curr : prev))
            setPosition(bestPosition.dir)
        }

        updatePosition()
        window.addEventListener('resize', updatePosition)
        window.addEventListener('scroll', updatePosition)

        return () => {
            window.removeEventListener('resize', updatePosition)
            window.removeEventListener('scroll', updatePosition)
        }
    }, [])

    const getMenuStyles = () => {
        const isMobile = window.innerWidth < 640
        // Add padding to account for shadow
        const baseStyles = 'max-w-[calc(100vw-2.5rem)]' // Increased from 2rem to 2.5rem

        switch (position) {
            case 'top':
                return `${baseStyles} ${isMobile ? 'bottom-full left-0' : 'bottom-full left-1/2 -translate-x-1/2'} mb-2` // Increased from mb-1
            case 'bottom':
                return `${baseStyles} ${isMobile ? 'top-full left-0' : 'top-full left-1/2 -translate-x-1/2'} mt-2` // Increased from mt-1
            case 'left':
                return `${baseStyles} right-full top-1/2 -translate-y-1/2 mr-2` // Increased from mr-1
            case 'right':
                return `${baseStyles} left-full top-1/2 -translate-y-1/2 ml-2` // Increased from ml-1
            default:
                return `${baseStyles} ${isMobile ? 'bottom-full left-0' : 'bottom-full left-1/2 -translate-x-1/2'} mb-2`
        }
    }

    return (
        <Menu className="relative inline-block" as="div">
            <>
                <Menu.Button ref={buttonRef} className="flex items-center justify-center">
                    <Icon name={'info'} className="transition-transform dark:fill-white" />
                </Menu.Button>
                <Transition
                    enter="transition-opacity duration-150 ease-out"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="transition-opacity duration-100 ease-out"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <Menu.Items
                        className={`absolute z-30 min-w-[240px] whitespace-pre-line border border-n-1 bg-white px-3 py-2 shadow-lg ${getMenuStyles()}`}
                    >
                        <Menu.Item as={'div'} className="block text-h8 font-normal text-black">
                            {html ? <div dangerouslySetInnerHTML={{ __html: text }} /> : <label>{text}</label>}
                        </Menu.Item>
                    </Menu.Items>
                </Transition>
            </>
        </Menu>
    )
}

export default MoreInfo
