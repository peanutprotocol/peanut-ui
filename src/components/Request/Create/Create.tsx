'use client'

import PageContainer from '@/components/0_Bruddle/PageContainer'
import { useWallet } from '@/hooks/wallet/useWallet'
import { IAttachmentOptions } from '@/redux/types/send-flow.types'
import { useRouter } from 'next/navigation'
import { createElement, useEffect, useState } from 'react'
import * as _consts from './Create.consts'

export const CreateRequestLink = () => {
    const router = useRouter()
    const [step, setStep] = useState<_consts.ICreateScreenState>(_consts.INIT_VIEW_STATE)
    const [tokenValue, setTokenValue] = useState<undefined | string>(undefined)
    const [usdValue, setUsdValue] = useState<undefined | string>(undefined)
    const [link, setLink] = useState<string>('')
    const [attachmentOptions, setAttachmentOptions] = useState<IAttachmentOptions>({
        message: '',
        fileUrl: '',
        rawFile: undefined,
    })
    const [recipientAddress, setRecipientAddress] = useState<string | undefined>(undefined)

    const { address } = useWallet()

    const handleOnNext = () => {
        if (step.idx === _consts.CREATE_SCREEN_FLOW.length - 1) return
        const newIdx = step.idx + 1
        setStep(() => ({
            screen: _consts.CREATE_SCREEN_FLOW[newIdx],
            idx: newIdx,
        }))
    }

    const handleOnPrev = () => {
        if (step.idx === 0) {
            return router.push('/')
        }
        const newIdx = step.idx - 1
        setStep(() => ({
            screen: _consts.CREATE_SCREEN_FLOW[newIdx],
            idx: newIdx,
        }))
    }

    useEffect(() => {
        if (address) setRecipientAddress(address)
    }, [address])

    return (
        <PageContainer>
            {createElement(_consts.CREATE_SCREEN_MAP[step.screen].comp, {
                onNext: handleOnNext,
                onPrev: handleOnPrev,
                link,
                setLink,
                attachmentOptions,
                setAttachmentOptions,
                tokenValue,
                setTokenValue,
                usdValue,
                setUsdValue,
                recipientAddress,
                setRecipientAddress,
            } as _consts.ICreateScreenProps)}
        </PageContainer>
    )
}
