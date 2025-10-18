'use client'
import React, { type FC, useEffect, useState } from 'react'
import Image from 'next/image'
import { PEANUT_LOGO_BLACK, PEANUTMAN_LOGO } from '@/assets'
import Modal from '../Modal'
import { Button } from '@/components/0_Bruddle'
import chillPeanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'

const NoMoreJailModal = () => {
    const [isOpen, setisOpen] = useState(false)

    const onClose = () => {
        setisOpen(false)
        sessionStorage.removeItem('showNoMoreJailModal')
    }

    useEffect(() => {
        const showNoMoreJailModal = sessionStorage.getItem('showNoMoreJailModal')
        if (showNoMoreJailModal === 'true') {
            setisOpen(true)
        }
    }, [])

    return (
        <Modal
            hideOverlay
            visible={isOpen}
            onClose={onClose}
            className="items-center rounded-none md:mx-auto md:max-w-md"
            classWrap="sm:m-auto sm:self-center self-center m-4 bg-background rounded-none border-0"
        >
            {/* Main content container */}
            <div className="relative z-10 w-full rounded-md bg-white px-6 py-6">
                <div className="space-y-4">
                    <div className="space-y-3 text-center">
                        <div className="w-full space-y-2">
                            <h3 className={'text-xl font-extrabold text-black dark:text-white'}>
                                No more Peanut jail!
                            </h3>

                            <div className="text-sm text-grey-1 dark:text-white">
                                <p>
                                    You’re now part of Peanut!
                                    <br />
                                    Explore, pay, and invite your friends.
                                </p>
                            </div>
                        </div>
                    </div>

                    <Button className="w-full" shadowSize="4" variant="purple" onClick={onClose}>
                        <div>Start using</div>
                        <div className="flex items-center gap-1">
                            <Image src={PEANUTMAN_LOGO} alt="Peanut Logo" className="size-5" />
                            <Image src={PEANUT_LOGO_BLACK} alt="Peanut Logo" />
                        </div>
                    </Button>
                </div>
            </div>

            {/* Peanutman animation */}
            <div className="absolute left-0 top-7 flex w-full justify-center" style={{ transform: 'translateY(-80%)' }}>
                <div className="relative h-42 w-[90%] md:h-52">
                    <Image src={chillPeanutAnim.src} alt="Peanut Man" className="object-contain" fill />
                </div>
            </div>
        </Modal>
    )
}

export default NoMoreJailModal
