import { useCallback, useEffect, useState } from 'react'
import type { IFrameWrapperProps } from '@/components/Global/IframeWrapper'
import { mantecaApi } from '@/services/manteca'
import { useAuth } from '@/context/authContext'

type UseMantecaKycFlowOptions = {
    onClose?: () => void
    onSuccess?: () => void
    onManualClose?: () => void
}

export const useMantecaKycFlow = ({ onClose, onSuccess, onManualClose }: UseMantecaKycFlowOptions = {}) => {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [iframeOptions, setIframeOptions] = useState<Omit<IFrameWrapperProps, 'onClose'>>({
        src: '',
        visible: false,
        closeConfirmMessage: undefined,
    })
    const { user } = useAuth()
    const [isMantecaKycRequired, setNeedsMantecaKyc] = useState<boolean>(
        !user?.user?.mantecaKycStatus || user.user.mantecaKycStatus !== 'ACTIVE'
    )

    useEffect(() => {
        setNeedsMantecaKyc(!user?.user?.mantecaKycStatus || user.user.mantecaKycStatus !== 'ACTIVE')
    }, [user?.user?.mantecaKycStatus])

    const openMantecaKyc = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const { url } = await mantecaApi.initiateOnboarding({ returnUrl: window.location.href })
            setIframeOptions({
                src: url,
                visible: true,
            })
            return { success: true as const }
        } catch (e: any) {
            setError(e?.message ?? 'Failed to initiate onboarding')
            return { success: false as const, error: e?.message as string }
        } finally {
            setIsLoading(false)
        }
    }, [])

    const handleIframeClose = useCallback(
        (source?: 'manual' | 'completed' | 'tos_accepted') => {
            setIframeOptions((prev) => ({ ...prev, visible: false }))
            if (source === 'completed') {
                onSuccess?.()
                return
            }
            if (source === 'manual') {
                onManualClose?.()
                return
            }
            onClose?.()
        },
        [onClose, onSuccess, onManualClose]
    )

    return {
        isLoading,
        error,
        iframeOptions,
        openMantecaKyc,
        handleIframeClose,
        isMantecaKycRequired,
    }
}
