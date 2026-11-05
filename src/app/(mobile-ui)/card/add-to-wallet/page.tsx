'use client'
import { type FC, useEffect } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { PUSH_PROMPT_TRIGGERS } from '@/constants/push-prompt.consts'
import { offerPushPrompt } from '@/hooks/useNotifications'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import AddToWalletCarousel from '@/components/Card/AddToWalletCarousel'
import { walletPlatformFromUserAgent } from '@/utils/wallet-platform'
import { useSafeBack } from '@/hooks/useSafeBack'

const AddToWalletPage: FC = () => {
    const onBack = useSafeBack('/card')
    // Done must not leave the finished tutorial in history. The only in-app entry is the
    // link on /card, so backing out lands there; `replace` covers the cold-deep-link
    // fallback, where pushing /card would strand the tutorial one Back away.
    const onDone = useSafeBack('/card', { replace: true })
    // Once per view, with the OS read here: reading it from useWalletPlatform's
    // state sent a second event when that state resolved from 'other'. `os`,
    // not `platform`, which is the super property for the device.
    useEffect(() => {
        posthog.capture(ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_VIEWED, {
            os: walletPlatformFromUserAgent(navigator.userAgent),
        })
    }, [])
    useEffect(() => {
        void offerPushPrompt(PUSH_PROMPT_TRIGGERS.CARD_READY)
    }, [])
    return (
        <PageContainer>
            <AddToWalletCarousel onDone={onDone} onPrev={onBack} />
        </PageContainer>
    )
}

export default AddToWalletPage
