'use client'

import Header from '@/components/Global/Header'
import Footer from '@/components/Global/Footer'
import ToggleTheme from '@/components/Global/ToggleTheme'
import { useState, useEffect } from 'react'
import { Roboto_Flex } from 'next/font/google'

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
                <div className="relative">
                    <div className="flex min-h-screen flex-col ">
                        <Header />
                        <div className="flex grow">
                            <div
                                className={`flex grow flex-col pb-2 pt-6 4xl:max-w-full 2xl:px-8 lg:px-6 md:px-5 sm:mx-auto sm:px-16 ${className}`}
                            >
                                {children}
                            </div>
                        </div>
                        <Footer />
                        <div className="absolute bottom-[6px] right-[6px]">
                            <ToggleTheme />
                        </div>
                    </div>
                </div>
            </>
        )
    )
}

export default Layout
