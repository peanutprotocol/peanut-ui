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
                                className={`4xl:max-w-full flex grow flex-col pb-2 pt-6 sm:mx-auto sm:px-16 md:px-5 lg:px-6 2xl:px-8 ${className}`}
                            >
                                {children}
                            </div>
                        </div>
                        <Footer />
                    </div>
                </div>
            </>
        )
    )
}

export default Layout
