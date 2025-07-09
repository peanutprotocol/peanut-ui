'use client'

import Footer from '@/components/Global/Footer'
import { MigrationBanner } from '@/components/Global/MigrationBanner'
import { useFooterVisibility } from '@/context/footerVisibility'
import { Widget } from '@typeform/embed-react'
import { Roboto_Flex } from 'next/font/google'
import { usePathname } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Modal from '../Modal'
type LayoutProps = {
    children: React.ReactNode
    className?: string
}

const roboto = Roboto_Flex({
    weight: ['400', '500', '700', '800'],
    subsets: ['latin'],
    display: 'block',
    variable: '--font-roboto',
})

const Layout = ({ children, className }: LayoutProps) => {
    const [isReady, setIsReady] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const path = usePathname()

    const isTryNow = path === '/pay'

    useEffect(() => {
        setIsReady(true)
    }, [])

    return (
        isReady && (
            <>
                <style jsx global>{`
                    html {
                        font-family: ${roboto.style.fontFamily};
                    }
                `}</style>
                <div className={twMerge('relative bg-background', isTryNow && 'bg-pink-1')}>
                    <div className="flex min-h-screen flex-col ">
                        <MigrationBanner className="h-[20vh] min-h-[120px]" />
                        <div className="flex grow justify-center">
                            <div
                                className={`4xl:max-w-full flex grow flex-col justify-center pb-2 pt-6 sm:mx-auto sm:px-16 md:px-5 lg:px-6 2xl:px-8 ${className}`}
                                style={{ flexGrow: 1 }}
                            >
                                {children}
                            </div>
                        </div>
                        <FooterVisibilityObserver />
                        <MigrationBanner className="h-[20vh] min-h-[120px]" />
                        <Footer />
                        <Modal
                            visible={showModal}
                            onClose={() => {
                                setShowModal(false)
                            }}
                            classNameWrapperDiv="px-5 pb-7 pt-8"
                            classButtonClose="hidden"
                            className="z-50"
                        >
                            <Widget
                                id="lTEp058W"
                                style={{ width: '100%', height: '400px' }}
                                className="center-xy items-center self-center"
                                onSubmit={() => {
                                    setShowModal(false)
                                }}
                            />
                        </Modal>{' '}
                    </div>
                </div>
            </>
        )
    )
}

// Observer Component to detect Footer visibility
const FooterVisibilityObserver: React.FC = () => {
    const footerRef = useRef<HTMLDivElement>(null)
    const { setIsFooterVisible } = useFooterVisibility()

    useEffect(() => {
        const observerOptions = {
            root: null, // relative to viewport
            rootMargin: '0px',
            threshold: 0.1, // 10% of the footer is visible
        }

        const observerCallback: IntersectionObserverCallback = (entries) => {
            entries.forEach((entry) => {
                setIsFooterVisible(entry.isIntersecting)
            })
        }

        const observer = new IntersectionObserver(observerCallback, observerOptions)
        if (footerRef.current) {
            observer.observe(footerRef.current)
        }

        return () => {
            if (footerRef.current) {
                observer.unobserve(footerRef.current)
            }
        }
    }, [setIsFooterVisible])

    return <div ref={footerRef}></div>
}

export default Layout
