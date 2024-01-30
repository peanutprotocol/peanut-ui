'use client'

import { createElement, useEffect, useState } from 'react'

import peanutman_logo from '@/assets/peanutman-logo.svg'
import peanutman_redpacket from '@/assets/peanutman-redpacket.svg'
import * as global_components from '@/components/global'

import * as views from './views'
import * as _consts from './win.consts'

export function Win() {
    const [winState, setWinState] = useState<_consts.winState>('LOADING')
    const [winScreen, setWinScreen] = useState<_consts.IWinScreenState>(_consts.INIT_VIEW)
    const [raffleLink, setRaffleLink] = useState<string>('')
    const [raffleDetails, setRaffleDetails] = useState<any>({})

    const handleOnNext = () => {
        console.log('handleOnNext')
        const newIdx = winScreen.idx + 1
        setWinScreen(() => ({
            screen: _consts.WIN_SCREEN_FLOW[newIdx],
            idx: newIdx,
        }))
    }

    const handleOnCustom = (screen: _consts.Screens) => {
        setWinScreen(() => ({
            screen: screen,
            idx: _consts.WIN_SCREEN_FLOW.indexOf(screen),
        }))
    }

    const checkLink = async (link: string) => {
        try {
            setRaffleLink(link)
            setWinState('WIN')
        } catch (error) {}
    }

    useEffect(() => {
        const pageUrl = typeof window !== 'undefined' ? window.location.href : ''
        if (pageUrl) {
            checkLink(pageUrl)
        }
    }, [])

    return (
        <global_components.CardWrapper pt=" pt-16 " redPacket>
            {winState === 'LOADING' && (
                <div className="animate-spin">
                    <img src={peanutman_redpacket.src} alt="logo" className="h-8 sm:h-16" />
                    <span className="sr-only">Loading...</span>
                </div>
            )}
            {winState === 'NOT_FOUND' && <views.WinLinkNotFound />}
            {winState === 'EMPTY' && <views.WinLinkEmpty />}

            {winState === 'WIN' &&
                createElement(_consts.WIN_SCREEN_MAP[winScreen.screen].comp, {
                    onNextScreen: handleOnNext,
                    onCustomScreen: handleOnCustom,
                    raffleLink,
                    setRaffleLink,
                    raffleDetails,
                    setRaffleDetails,
                })}
        </global_components.CardWrapper>
    )
}
