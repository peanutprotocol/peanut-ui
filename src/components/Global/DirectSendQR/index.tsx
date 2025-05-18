'use client'
import { resolveEns } from '@/app/actions/ens'
import { Button } from '@/components/0_Bruddle'
import Checkbox from '@/components/0_Bruddle/Checkbox'
import { useToast } from '@/components/0_Bruddle/Toast'
import Modal from '@/components/Global/Modal'
import QRBottomDrawer from '@/components/Global/QRBottomDrawer'
import QRScanner from '@/components/Global/QRScanner'
import { useAuth } from '@/context/authContext'
import { usePush } from '@/context/pushProvider'
import { useAppDispatch } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { hitUserMetric } from '@/utils/metrics.utils'
import * as Sentry from '@sentry/nextjs'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, type ChangeEvent } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon, IconName } from '../Icons/Icon'
import { EQrType, NAME_BY_QR_TYPE, parseEip681, recognizeQr } from './utils'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL!

enum EModalType {
    QR_NOT_SUPPORTED = 'QR_NOT_SUPPORTED',
    WILL_BE_NOTIFIED = 'WILL_BE_NOTIFIED',
    DIRECT_SEND = 'DIRECT_SEND',
    EXTERNAL_URL = 'EXTERNAL_URL',
    UNRECOGNIZED = 'UNRECOGNIZED',
}

type ModalType = `${EModalType}`

interface ModalContentProps {
    setModalContent: React.Dispatch<React.SetStateAction<ModalType | undefined>>
    qrType: EQrType
    setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>
    redirectTo: string | undefined
}

const MODAL_CONTENTS: Record<ModalType, React.ComponentType<ModalContentProps>> = {
    [EModalType.QR_NOT_SUPPORTED]: NotSupportedContent,
    [EModalType.WILL_BE_NOTIFIED]: WillBeNotifiedContent,
    [EModalType.DIRECT_SEND]: DirectSendContent,
    [EModalType.EXTERNAL_URL]: ExternalUrlContent,
    [EModalType.UNRECOGNIZED]: UnrecognizedContent,
}

function NotSupportedContent({ setModalContent, qrType }: ModalContentProps) {
    const pushNotifications = usePush()
    const { user } = useAuth()
    return (
        <div className="flex flex-col justify-center p-6">
            <span className="text-sm">We're working on an integration.</span>
            <span className="text-sm">Get notified when it goes live!</span>
            <Button
                onClick={() => {
                    if (pushNotifications.isSupported && !pushNotifications.isSubscribed) {
                        pushNotifications.subscribe().then(() => {
                            setModalContent(EModalType.WILL_BE_NOTIFIED)
                            return
                        })
                    } else {
                        setModalContent(EModalType.WILL_BE_NOTIFIED)
                    }
                    hitUserMetric(user!.user.userId, 'qr-notify-me', { qrType })
                }}
                className="mt-4 w-full"
                shadowType="primary"
                shadowSize="4"
            >
                Get notified!
            </Button>
        </div>
    )
}

function WillBeNotifiedContent({ qrType, setIsModalOpen }: ModalContentProps) {
    return (
        <div className="flex flex-col justify-center p-6">
            <span className="text-sm">We'll let you know as soon as {NAME_BY_QR_TYPE[qrType]} is supported.</span>
            <Button
                onClick={() => setIsModalOpen(false)}
                className="mt-4 w-full"
                variant="primary-soft"
                shadowType="primary"
                shadowSize="4"
            >
                Close
            </Button>
        </div>
    )
}

function DirectSendContent({ redirectTo, setIsModalOpen }: ModalContentProps) {
    const [userAcknowledged, setUserAcknowledged] = useState(false)
    const router = useRouter()
    return (
        <div className="flex flex-col justify-center p-6">
            <span className="text-sm">Peanut only supports USDC on Arbitrum.</span>
            <span className="text-sm">Please confirm with the recipient that they accept USDC on Arbitrum</span>
            <Checkbox
                value={userAcknowledged}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setUserAcknowledged(e.target.checked)
                }}
                className="mt-4"
                label="Got it, USDC on Arbitrum only."
            />
            <Button
                onClick={() => {
                    router.push(redirectTo!)
                    setTimeout(() => {
                        setIsModalOpen(false)
                    }, 750)
                }}
                disabled={!userAcknowledged}
                className="mt-4 w-full"
                shadowType="primary"
                shadowSize="4"
            >
                Continue
            </Button>
        </div>
    )
}

function ExternalUrlContent({ redirectTo, setIsModalOpen }: ModalContentProps) {
    return (
        <div className="flex flex-col justify-center p-6">
            <span className="text-sm">Peanut doesn't support this QR but you can open it with your browser. </span>
            <span className="text-sm">Make sure you trust this website!</span>
            <div className="flex items-center justify-center gap-2">
                <Button
                    onClick={() => {
                        window.open(redirectTo, '_system')
                        setTimeout(() => {
                            setIsModalOpen(false)
                        }, 750)
                    }}
                    className="mt-4 w-full"
                    shadowType="primary"
                    shadowSize="4"
                >
                    Open link
                </Button>
                <Button
                    onClick={() => setIsModalOpen(false)}
                    className="mt-4 w-full"
                    variant="primary-soft"
                    shadowType="primary"
                    shadowSize="4"
                >
                    Close
                </Button>
            </div>
        </div>
    )
}

function UnrecognizedContent({ setIsModalOpen }: ModalContentProps) {
    return (
        <div className="flex flex-col justify-center p-6">
            <span className="text-sm">Sorry, this QR code couldn't be recognized.</span>
            <Button onClick={() => setIsModalOpen(false)} className="mt-4 w-full" shadowType="primary" shadowSize="4">
                Okay
            </Button>
        </div>
    )
}

export default function DirectSendQr({
    icon = 'qr-code',
    className = '',
    ctaTitle,
    iconClassName,
}: {
    className?: string
    ctaTitle?: string
    icon?: IconName
    iconClassName?: string
}) {
    const [isQRScannerOpen, setIsQRScannerOpen] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [qrType, setQrType] = useState<EQrType | undefined>(undefined)
    const [redirectTo, setRedirectTo] = useState<string | undefined>(undefined)
    const [modalContent, setModalContent] = useState<ModalType | undefined>(undefined)
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const dispatch = useAppDispatch()
    const toast = useToast()
    const { user } = useAuth()
    const profileUrl = useMemo(() => {
        if (!user?.user.username) return ''
        return `${BASE_URL}/${user.user.username}`
    }, [user?.user.username])

    const processQRCode = async (data: string): Promise<{ success: boolean; error?: string }> => {
        // reset payment state before processing new QR
        dispatch(paymentActions.resetPaymentState())

        let redirectUrl: string | undefined = undefined
        let toConfirmUrl: string | undefined = undefined
        const originalData = data
        data = data.toLowerCase()
        const qrType = recognizeQr(data)
        hitUserMetric(user!.user.userId, 'scan-qr', { qrType, data: originalData })
        setQrType(qrType as EQrType)
        switch (qrType) {
            case EQrType.PEANUT_URL:
                {
                    let path = originalData
                    path = path.substring(BASE_URL.length)
                    if (!path.startsWith('/')) {
                        path = '/' + path
                    }
                    redirectUrl = path
                }
                break
            case EQrType.PINTA_MERCHANT:
                {
                    redirectUrl = `/${data}@polygon/PNT`
                }
                break
            case EQrType.EVM_ADDRESS:
                {
                    toConfirmUrl = `/${data}@arbitrum/usdc`
                }
                break
            case EQrType.EIP_681:
                {
                    try {
                        const { address } = parseEip681(data)
                        if (address) {
                            toConfirmUrl = `/${address}@arbitrum/usdc`
                        }
                    } catch (error) {
                        toast.error('Error parsing EIP-681 URL')
                        Sentry.captureException(error)
                    }
                }
                break
            case EQrType.ENS_NAME:
                {
                    const resolvedAddress = await resolveEns(data)
                    if (!!resolvedAddress) {
                        toConfirmUrl = `/${data}@arbitrum/usdc`
                    }
                }
                break
            case EQrType.MERCADO_PAGO:
            case EQrType.BITCOIN_ONCHAIN:
            case EQrType.BITCOIN_INVOICE:
            case EQrType.PIX:
            case EQrType.TRON_ADDRESS:
            case EQrType.SOLANA_ADDRESS:
            case EQrType.XRP_ADDRESS: {
                setModalContent(EModalType.QR_NOT_SUPPORTED)
                setIsModalOpen(true)
                setIsQRScannerOpen(false)
                return { success: true }
            }
            case EQrType.URL: {
                setRedirectTo(originalData)
                setModalContent(EModalType.EXTERNAL_URL)
                setIsModalOpen(true)
                setIsQRScannerOpen(false)
                return { success: true }
            }
            default:
                {
                    setModalContent(EModalType.UNRECOGNIZED)
                    setIsModalOpen(true)
                    setIsQRScannerOpen(false)
                }
                break
        }

        if (redirectUrl) {
            dispatch(paymentActions.setView('INITIAL'))

            const currentSearchParams = searchParams.toString()
            let currentFullPath = pathname
            currentFullPath = currentSearchParams ? `${currentFullPath}?${currentSearchParams}` : currentFullPath
            currentFullPath += window.location.hash

            if (
                currentFullPath === redirectUrl ||
                (redirectUrl.startsWith('/') && currentFullPath === redirectUrl.substring(1))
            ) {
                // We're already at this location, just close the scanner
                setIsQRScannerOpen(false)
            } else {
                router.push(redirectUrl)
                setIsQRScannerOpen(false)
            }
            return { success: true }
        }

        if (toConfirmUrl) {
            dispatch(paymentActions.setView('INITIAL'))
            setModalContent(EModalType.DIRECT_SEND)
            setIsModalOpen(true)
            setIsQRScannerOpen(false)
            setRedirectTo(toConfirmUrl)
            return { success: true }
        }

        // close the scanner and show the error toast
        setIsQRScannerOpen(false)

        return {
            success: false,
            error: 'QR not recognized as Peanut URL',
        }
    }

    const modalTitle = useMemo(() => {
        let title: string | undefined
        if (modalContent && qrType) {
            switch (modalContent) {
                case EModalType.QR_NOT_SUPPORTED:
                    {
                        const qrTypeName = NAME_BY_QR_TYPE[qrType]
                        title = `${qrTypeName} not supported yet.`
                    }
                    break
                case EModalType.WILL_BE_NOTIFIED:
                    {
                        title = "You're on the list!"
                    }
                    break
                case EModalType.DIRECT_SEND:
                    {
                        title = 'ℹ️ Only USDC on Arbitrum'
                    }
                    break
                case EModalType.EXTERNAL_URL:
                    {
                        title = 'This is an external link!'
                    }
                    break
            }
        } else if (modalContent === EModalType.UNRECOGNIZED) {
            title = 'Unrecognized QR code'
        }
        return title
    }, [modalContent, qrType])

    return (
        <>
            <Button
                onClick={() => setIsQRScannerOpen(true)}
                variant="purple"
                shadowSize="4"
                shadowType="primary"
                className={twMerge(
                    'mx-auto h-20 w-20 cursor-pointer justify-center rounded-full p-0 hover:bg-primary-1/100',
                    className
                )}
            >
                <Icon name={icon} className={twMerge('custom-size', iconClassName)} />
                {ctaTitle && ctaTitle}
            </Button>

            <Modal
                title={modalTitle}
                visible={isModalOpen && !!modalContent}
                onClose={() => setIsModalOpen(false)}
                initialFocus={undefined}
                preventClose={modalContent !== EModalType.QR_NOT_SUPPORTED}
                className="items-center rounded-none"
                classWrap="sm:m-auto sm:self-center self-center m-4 bg-background rounded-none border-0"
                classButtonClose="hidden"
            >
                {modalContent &&
                    (() => {
                        const ModalComponent = MODAL_CONTENTS[modalContent]
                        return (
                            <ModalComponent
                                setModalContent={setModalContent}
                                qrType={qrType!}
                                setIsModalOpen={setIsModalOpen}
                                redirectTo={redirectTo}
                            />
                        )
                    })()}
            </Modal>
            {isQRScannerOpen && (
                <>
                    <QRScanner onScan={processQRCode} onClose={() => setIsQRScannerOpen(false)} isOpen={true} />
                    <QRBottomDrawer
                        url={profileUrl}
                        collapsedTitle="My QR"
                        expandedTitle="Show QR to Get Paid"
                        text="Let others scan this to pay you"
                        buttonText="Share your profile"
                    />
                </>
            )}
        </>
    )
}
