'use client'

import Header from '@/components/Global/Header'
import Footer from '@/components/Global/Footer'
import ToggleTheme from '@/components/Global/ToggleTheme'
import { useState, useEffect } from 'react'
import { Roboto_Flex } from 'next/font/google'
import * as utils from '@/utils'
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
    const [accessCode, setAccessCode] = useState('')
    const [accessCodeVisible, setAccessCodeVisible] = useState(true)
    const [validAccessCode, setValidAccessCode] = useState(true)

    useEffect(() => {
        setIsReady(true)
    }, [])

    useEffect(() => {
        const accessCode = utils.getPeanutAccessCode()
        if (
            accessCode &&
            accessCode.accessCode.toLowerCase() === process.env.NEXT_PUBLIC_PEANUT_ACCESS_CODE?.toLowerCase()
        ) {
            setAccessCodeVisible(false)
            setAccessCode(accessCode.accessCode.toLowerCase())
        }
    }, [])

    const handleSubmit = () => {
        if (accessCode && accessCode.toLowerCase() === process.env.NEXT_PUBLIC_PEANUT_ACCESS_CODE?.toLowerCase()) {
            setAccessCodeVisible(false)
            utils.updatePeanutAccessCode(accessCode.toLowerCase())
        } else {
            setValidAccessCode(false)
        }
    }

    useEffect(() => {
        if (accessCode.length > 0) {
            setValidAccessCode(true)
        }
    }, [accessCode])

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
                        <div className="flex grow justify-center">
                            <div
                                className={`4xl:max-w-full flex grow flex-col justify-center pb-2 pt-6 sm:mx-auto sm:px-16 md:px-5 lg:px-6 2xl:px-8 ${className}`}
                                style={{ flexGrow: 1 }}
                            >
                                {children}
                            </div>
                        </div>
                        <Footer />
                        <Modal
                            visible={accessCodeVisible}
                            onClose={() => {
                                console.log('nope :)')
                            }}
                            classNameWrapperDiv="px-5 pb-7 pt-8"
                            title="Input Access Code"
                            classButtonClose="hidden"
                            className="z-50"
                        >
                            <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-center">
                                <label className="text-h6">
                                    Welcome to the closed alpha. If you have an access code, input in into the form
                                    below and click submit. If not, reach out to us and we might give you one :){' '}
                                </label>
                                <input
                                    className={`w-full border border-n-1 px-4 py-2 focus:outline-none ${accessCode.length > 0 && !validAccessCode ? 'border-red' : ''}`}
                                    value={accessCode}
                                    onChange={(e) => {
                                        setAccessCode(e.target.value)
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleSubmit()
                                        }
                                    }}
                                />

                                <button className="btn-purple btn-xl" onClick={handleSubmit}>
                                    submit
                                </button>
                            </div>
                        </Modal>
                    </div>
                </div>
            </>
        )
    )
}

export default Layout
