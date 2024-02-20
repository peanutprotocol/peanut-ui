'use client'

import React, { useState, useEffect } from 'react'

import x_svg from '@/assets/icons/x-icon.svg'
import telegram_svg from '@/assets/icons/telegram-icon.svg'
import mail_svg from '@/assets/icons/mail-icon.svg'
import whatsapp_icon from '@/assets/icons/whatsapp-icon.svg'
export function socialsComponent({ message }: { message: string }) {
    const [encodedMessage, setEncodedMessage] = useState('')

    useEffect(() => {
        setEncodedMessage(encodeURIComponent(message))
    }, [message])

    return (
        <div className={'flex flex-row gap-2'}>
            <a href={`https://t.me/share/url?url=&text=${encodedMessage}`} target="_blank">
                <img src={telegram_svg.src} className={'h-8 w-8'} />
            </a>
            <a href={`https://wa.me/?text=${encodedMessage}`} target="_blank">
                <img src={whatsapp_icon.src} className={'h-8 w-8'} />
            </a>
            <a href={`mailto:?subject=Peanut%Raffle&body=${encodedMessage}`}>
                <img src={mail_svg.src} className={'h-8 w-8'} />
            </a>
            <a href={`https://twitter.com/intent/tweet?text=${encodedMessage}`} target="_blank">
                <img src={x_svg.src} className={'h-8 w-8'} />
            </a>
        </div>
    )
}
