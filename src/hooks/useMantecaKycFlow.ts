import { useCallback, useEffect, useState } from 'react'
import type { IFrameWrapperProps } from '@/components/Global/IframeWrapper'
import { mantecaApi } from '@/services/manteca'
import { useAuth } from '@/context/authContext'
import { type CountryData, MantecaSupportedExchanges } from '@/components/AddMoney/consts'
import { MantecaKycStatus } from '@/interfaces'
import { useWebSocket } from './useWebSocket'
import { BASE_URL } from '@/constants/general.consts'

type UseMantecaKycFlowOptions = {
    onClose?: () => void
    onSuccess?: () => void
    onManualClose?: () => void
    country?: CountryData
}

export const useMantecaKycFlow = ({ onClose, onSuccess, onManualClose, country }: UseMantecaKycFlowOptions) => {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [iframeOptions, setIframeOptions] = useState<Omit<IFrameWrapperProps, 'onClose'>>({
        src: '',
        visible: false,
        closeConfirmMessage: undefined,
    })
    const { user, fetchUser } = useAuth()
    const [isMantecaKycRequired, setNeedsMantecaKyc] = useState<boolean>(false)

    const userKycVerifications = user?.user?.kycVerifications

    const handleIframeClose = useCallback(
        async (source?: 'manual' | 'completed' | 'tos_accepted') => {
            setIframeOptions((prev) => ({ ...prev, visible: false }))
            await fetchUser()
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

    useWebSocket({
        username: user?.user.username ?? undefined,
        autoConnect: true,
        onMantecaKycStatusUpdate: async (status) => {
            if (status === MantecaKycStatus.ACTIVE || status === 'WIDGET_FINISHED') {
                await handleIframeClose('completed')
            }
        },
    })

    useEffect(() => {
        // determine if manteca kyc is required based on geo data available in kycVerifications
        const selectedGeo = country?.id

        if (selectedGeo && Array.isArray(userKycVerifications) && userKycVerifications.length > 0) {
            const isuserActiveForSelectedGeo = userKycVerifications.some(
                (v) =>
                    v.provider === 'MANTECA' &&
                    (v.mantecaGeo || '').toUpperCase() === selectedGeo.toUpperCase() &&
                    v.status === MantecaKycStatus.ACTIVE
            )
            setNeedsMantecaKyc(!isuserActiveForSelectedGeo)
            return
        }

        // if no verifications data available, keep as null (undetermined)
        // only set to true if we have user data but no matching verification
        if (user && userKycVerifications !== undefined) {
            setNeedsMantecaKyc(true)
        }
    }, [userKycVerifications, country?.id, user])

    const openMantecaKyc = useCallback(async (countryParam?: CountryData) => {
        setIsLoading(true)
        setError(null)
        try {
            const exchange = countryParam?.id
                ? MantecaSupportedExchanges[countryParam.id as keyof typeof MantecaSupportedExchanges]
                : MantecaSupportedExchanges.AR
            const returnUrl = BASE_URL + '/kyc/success'
            const { url } = await mantecaApi.initiateOnboarding({ returnUrl, exchange })
            setIframeOptions({
                src: url,
                visible: true,
            })
            return { success: true as const }
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Failed to initiate onboarding'
            setError(message)
            return { success: false as const, error: message }
        } finally {
            setIsLoading(false)
        }
    }, [])

    return {
        isLoading,
        error,
        iframeOptions,
        openMantecaKyc,
        handleIframeClose,
        isMantecaKycRequired,
    }
}
