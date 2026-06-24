'use client'

import { resolveEns } from '@/app/actions/ens'
import { Button } from '@/components/0_Bruddle/Button'
import Checkbox from '@/components/0_Bruddle/Checkbox'
import { useToast } from '@/components/0_Bruddle/Toast'
import Modal from '@/components/Global/Modal'
import QRBottomDrawer from '@/components/Global/QRBottomDrawer'
import QRScanner from '@/components/Global/QRScanner'
import { EQrType, NAME_BY_QR_TYPE, parseEip681, recognizeQr } from '@/components/Global/DirectSendQR/utils'
import { useAuth } from '@/context/authContext'
import { useModalsContext } from '@/context/ModalsContext'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { BASE_URL } from '@/constants/general.consts'
import { serverFetch } from '@/utils/api-fetch'
import { openExternalUrl } from '@/utils/capacitor'
import { pixKeyToQrPayUrl } from '@/utils/pix.utils'
import { extractPaymentValue } from '@/utils/clipboard-extract.utils'
import { recipientPayUrl, qrClaimUrl } from '@/utils/native-routes'
import * as Sentry from '@sentry/nextjs'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import { useState, type ChangeEvent } from 'react'
import { useHaptic } from 'use-haptic'

enum EModalType {
    QR_NOT_SUPPORTED = 'QR_NOT_SUPPORTED',
    WILL_BE_NOTIFIED = 'WILL_BE_NOTIFIED',
    DIRECT_SEND = 'DIRECT_SEND',
    EXTERNAL_URL = 'EXTERNAL_URL',
    UNRECOGNIZED = 'UNRECOGNIZED',
}

interface ModalContentProps {
    setModalContent: React.Dispatch<React.SetStateAction<EModalType | undefined>>
    qrType: EQrType
    setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>
    redirectTo: string | undefined
}

function NotSupportedContent({ setModalContent, qrType }: ModalContentProps) {
    return (
        <div className="flex flex-col justify-center p-6">
            <span className="text-sm">We're working on an integration.</span>
            <span className="text-sm">Get notified when it goes live!</span>
            <Button
                onClick={() => {
                    setModalContent(EModalType.WILL_BE_NOTIFIED)
                    posthog.capture(ANALYTICS_EVENTS.QR_NOTIFY_ME_CLICKED, { qr_type: qrType })
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
            <span className="text-sm">Peanut supports cross-chain payments.</span>
            <span className="text-sm">Please confirm the payment details before sending</span>
            <Checkbox
                value={userAcknowledged}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setUserAcknowledged(e.target.checked)
                }}
                className="mt-4"
                label="I understand and will confirm payment details."
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
                        if (redirectTo) openExternalUrl(redirectTo)
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

function getModalTitle(modalContent: EModalType | undefined, qrType: EQrType | undefined): string | undefined {
    if (modalContent === EModalType.UNRECOGNIZED) return 'Unrecognized QR code'
    if (!modalContent || !qrType) return undefined
    switch (modalContent) {
        case EModalType.QR_NOT_SUPPORTED:
            return `${NAME_BY_QR_TYPE[qrType]} not supported yet.`
        case EModalType.WILL_BE_NOTIFIED:
            return "You're on the list!"
        case EModalType.DIRECT_SEND:
            return 'ℹ️ Payment Confirmation'
        case EModalType.EXTERNAL_URL:
            return 'This is an external link!'
    }
}

const MODAL_CONTENTS: Record<EModalType, React.ComponentType<ModalContentProps>> = {
    [EModalType.QR_NOT_SUPPORTED]: NotSupportedContent,
    [EModalType.WILL_BE_NOTIFIED]: WillBeNotifiedContent,
    [EModalType.DIRECT_SEND]: DirectSendContent,
    [EModalType.EXTERNAL_URL]: ExternalUrlContent,
    [EModalType.UNRECOGNIZED]: UnrecognizedContent,
}

export default function QRScannerOverlay() {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [qrType, setQrType] = useState<EQrType | undefined>(undefined)
    const [redirectTo, setRedirectTo] = useState<string | undefined>(undefined)
    const [modalContent, setModalContent] = useState<EModalType | undefined>(undefined)
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const toast = useToast()
    const { user } = useAuth()
    const payUserUrl = user?.user.username ? `${BASE_URL}/pay/${user.user.username}` : ''
    const { triggerHaptic } = useHaptic()
    const { isQRScannerOpen, setIsQRScannerOpen } = useModalsContext()

    const showModal = (type: EModalType) => {
        setModalContent(type)
        setIsModalOpen(true)
        setIsQRScannerOpen(false)
    }

    const processQRCode = async (data: string): Promise<{ success: boolean; error?: string }> => {
        triggerHaptic()

        let redirectUrl: string | undefined = undefined
        let toConfirmUrl: string | undefined = undefined
        const normalized = data.toLowerCase()
        const recognized = recognizeQr(normalized)

        const getLogData = () => {
            if (recognized === EQrType.PIX_KEY) {
                const trimmed = data.trim()
                if (trimmed.startsWith('+') || /^55\d/.test(trimmed)) return 'pix:phone'
                if (/^\d{11}$/.test(trimmed)) return 'pix:cpf'
                if (/^\d{14}$/.test(trimmed)) return 'pix:cnpj'
                if (trimmed.includes('@')) return 'pix:email'
                if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(trimmed)) return 'pix:uuid'
                return 'pix:unknown'
            }
            if (recognized === EQrType.PEANUT_URL && normalized.includes('/claim')) {
                return 'peanut:claim-link'
            }
            return data
        }
        posthog.capture(ANALYTICS_EVENTS.QR_SCANNED, { qr_type: recognized, data: getLogData() })
        if (!recognized) {
            // Pasted text is often prose with an address embedded ("...0xabc... is
            // the Arbitrum address..."). Pull a valid EVM address out and re-process
            // it as a clean value before giving up. One level of recursion only —
            // the extracted value is a bare address, which recognizeQr matches.
            const embeddedAddress = extractPaymentValue(data, 'evmAddress')
            if (embeddedAddress && embeddedAddress.toLowerCase() !== normalized) {
                return processQRCode(embeddedAddress)
            }
            showModal(EModalType.UNRECOGNIZED)
            return { success: true }
        }
        setQrType(recognized as EQrType)
        switch (recognized) {
            case EQrType.PEANUT_URL:
                {
                    let path = data.replace(/^https?:\/\/(www\.)?/, '').replace(/^[^/]+/, '')

                    if (!path.startsWith('/')) {
                        path = '/' + path
                    }

                    if (path.startsWith('/qr/')) {
                        const redirectQrCode = path.substring(4)

                        try {
                            const response = await serverFetch(`/qr/${redirectQrCode}`, {
                                method: 'GET',
                            })
                            const lookup = await response.json()

                            if (lookup.claimed && lookup.redirectUrl) {
                                redirectUrl = lookup.redirectUrl
                            } else {
                                redirectUrl = qrClaimUrl(redirectQrCode)
                            }
                        } catch (error) {
                            console.error('Error checking redirect QR:', error)
                            redirectUrl = qrClaimUrl(redirectQrCode)
                        }
                    } else {
                        redirectUrl = path
                    }
                }
                break
            case EQrType.EVM_ADDRESS:
                {
                    // recipientPayUrl → web: /<addr> ([...recipient]); native: /send?recipient=<addr>
                    toConfirmUrl = recipientPayUrl(normalized)
                }
                break
            case EQrType.EIP_681:
                {
                    try {
                        const { address, chainId, amount, tokenSymbol } = parseEip681(normalized)
                        // build the recipient PATH (no leading slash), then route it
                        // through recipientPayUrl for native query-param compatibility.
                        let path = address
                        if (chainId) {
                            path += `@${chainId}`
                            if (tokenSymbol) {
                                path += `/`
                                if (amount) {
                                    path += `${amount}`
                                }
                                path += `${tokenSymbol}`
                            }
                        }
                        toConfirmUrl = recipientPayUrl(path)
                    } catch (error) {
                        toast.error('Error parsing EIP-681 URL')
                        Sentry.captureException(error)
                    }
                }
                break
            case EQrType.ENS_NAME: {
                const resolvedAddress = await resolveEns(normalized)
                if (resolvedAddress) {
                    toConfirmUrl = recipientPayUrl(normalized)
                } else {
                    showModal(EModalType.UNRECOGNIZED)
                    return { success: true }
                }
                break
            }
            case EQrType.MERCADO_PAGO:
            case EQrType.ARGENTINA_QR3:
            case EQrType.PIX:
                {
                    const timestamp = Date.now()
                    redirectUrl = `/qr-pay?qrCode=${encodeURIComponent(data)}&t=${timestamp}&type=${recognized}`
                }
                break
            case EQrType.PIX_KEY:
                {
                    const url = pixKeyToQrPayUrl(data)
                    if (url) {
                        redirectUrl = url
                    } else {
                        showModal(EModalType.UNRECOGNIZED)
                        return { success: true }
                    }
                }
                break
            case EQrType.BITCOIN_ONCHAIN:
            case EQrType.BITCOIN_INVOICE:
            case EQrType.TRON_ADDRESS:
            case EQrType.SOLANA_ADDRESS:
            case EQrType.XRP_ADDRESS: {
                showModal(EModalType.QR_NOT_SUPPORTED)
                return { success: true }
            }
            case EQrType.URL: {
                setRedirectTo(data)
                showModal(EModalType.EXTERNAL_URL)
                return { success: true }
            }
            default:
                showModal(EModalType.UNRECOGNIZED)
                break
        }

        if (redirectUrl) {
            const currentSearchParams = searchParams.toString()
            let currentFullPath = pathname
            currentFullPath = currentSearchParams ? `${currentFullPath}?${currentSearchParams}` : currentFullPath
            currentFullPath += window.location.hash

            if (
                currentFullPath === redirectUrl ||
                (redirectUrl.startsWith('/') && currentFullPath === redirectUrl.substring(1))
            ) {
                setIsQRScannerOpen(false)
            } else {
                router.push(redirectUrl)
                setIsQRScannerOpen(false)
            }
            return { success: true }
        }

        if (toConfirmUrl) {
            setRedirectTo(toConfirmUrl)
            showModal(EModalType.DIRECT_SEND)
            return { success: true }
        }

        setIsQRScannerOpen(false)

        return {
            success: false,
            error: 'QR not recognized as Peanut URL',
        }
    }

    const modalTitle = getModalTitle(modalContent, qrType)

    return (
        <>
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
                    {/* z-[60] keeps this drawer above the QRScanner portal (z-50) */}
                    <QRBottomDrawer
                        url={payUserUrl}
                        collapsedTitle="My QR"
                        expandedTitle="Show QR to Get Paid"
                        text="Let others scan this to pay you"
                        buttonText="Share your profile"
                        className="z-[60]"
                    />
                </>
            )}
        </>
    )
}
