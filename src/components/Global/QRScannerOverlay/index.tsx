'use client'

import { resolveEns } from '@/app/actions/ens'
import { useToast } from '@/components/0_Bruddle/Toast'
import ActionModal, {
    type ActionModalButtonProps,
    type ActionModalCheckboxProps,
    type ActionModalTone,
} from '@/components/Global/ActionModal'
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
import { recipientPayUrl, qrClaimUrl, deepLinkToNativePath } from '@/utils/native-routes'
import * as Sentry from '@sentry/nextjs'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import { useEffect, useState } from 'react'
import { useAppHaptic } from '@/hooks/useAppHaptic'

enum EModalType {
    QR_NOT_SUPPORTED = 'QR_NOT_SUPPORTED',
    WILL_BE_NOTIFIED = 'WILL_BE_NOTIFIED',
    DIRECT_SEND = 'DIRECT_SEND',
    EXTERNAL_URL = 'EXTERNAL_URL',
    UNRECOGNIZED = 'UNRECOGNIZED',
    PIX_RECURRING = 'PIX_RECURRING',
}

interface QrResultModalProps {
    visible: boolean
    modalContent: EModalType | undefined
    qrType: EQrType | undefined
    redirectTo: string | undefined
    onClose: () => void
    onNotifyMe: () => void
}

interface QrResultModalContent {
    tone: ActionModalTone
    title: string
    description: React.ReactNode
    ctas: ActionModalButtonProps[]
    checkbox?: ActionModalCheckboxProps
}

function QrResultModal({ visible, modalContent, qrType, redirectTo, onClose, onNotifyMe }: QrResultModalProps) {
    const t = useTranslations('global')
    const tCommon = useTranslations('common')
    const toast = useToast()
    const router = useRouter()
    const [acknowledged, setAcknowledged] = useState(false)

    // every scan starts unacknowledged
    useEffect(() => {
        if (visible) setAcknowledged(false)
    }, [visible, modalContent])

    if (!modalContent) return null

    const qrName = (qrType && NAME_BY_QR_TYPE[qrType]) ?? ''
    const closeAfterNavigation = () => setTimeout(onClose, 750)
    // Anything but http(s) is refused rather than forwarded. openExternalUrl falls
    // back to window.open/location.assign off-native, so a scanned `javascript:`
    // or `data:` payload would run as the app origin — and the URL regex that
    // classifies a scan as EQrType.URL admits schemed payloads.
    const externalUrl = (() => {
        if (!redirectTo) return undefined
        // scheme-less QR payloads ("example.com/x") make Browser.open throw —
        // the tap died silently.
        const candidate = /^[a-z][a-z0-9+.-]*:/i.test(redirectTo) ? redirectTo : `https://${redirectTo}`
        return /^https?:\/\//i.test(candidate) ? candidate : undefined
    })()

    const unrecognizedContent: QrResultModalContent = {
        tone: 'error',
        title: t('qrScannerOverlay.titleUnrecognized'),
        description: t('qrScannerOverlay.unrecognized'),
        ctas: [{ text: t('qrScannerOverlay.okay'), shadowSize: '4', onClick: onClose }],
    }
    const openExternal = async () => {
        if (externalUrl) {
            try {
                await openExternalUrl(externalUrl)
            } catch {
                toast.error(tCommon('somethingWentWrong'))
            }
        }
        closeAfterNavigation()
    }

    const contents: Record<EModalType, QrResultModalContent> = {
        [EModalType.QR_NOT_SUPPORTED]: {
            tone: 'info',
            title: t('qrScannerOverlay.titleNotSupported', { qrName }),
            description: (
                <>
                    <p>{t('qrScannerOverlay.notSupportedWorking')}</p>
                    <p>{t('qrScannerOverlay.notSupportedGetNotified')}</p>
                </>
            ),
            ctas: [{ text: t('qrScannerOverlay.getNotifiedCta'), shadowSize: '4', onClick: onNotifyMe }],
        },
        [EModalType.WILL_BE_NOTIFIED]: {
            tone: 'success',
            title: t('qrScannerOverlay.titleWillBeNotified'),
            description: t('qrScannerOverlay.willBeNotified', { qrName }),
            ctas: [{ text: tCommon('close'), variant: 'stroke', onClick: onClose }],
        },
        [EModalType.DIRECT_SEND]: {
            tone: 'info',
            title: t('qrScannerOverlay.titleDirectSend'),
            description: (
                <>
                    <p>{t('qrScannerOverlay.directSendCrossChain')}</p>
                    <p>{t('qrScannerOverlay.directSendConfirm')}</p>
                </>
            ),
            checkbox: {
                text: t('qrScannerOverlay.directSendAcknowledge'),
                checked: acknowledged,
                onChange: setAcknowledged,
            },
            ctas: [
                {
                    text: t('qrScannerOverlay.continue'),
                    shadowSize: '4',
                    disabled: !acknowledged,
                    onClick: () => {
                        router.push(redirectTo!)
                        closeAfterNavigation()
                    },
                },
            ],
        },
        // A payload that is not an http(s) link is not one the user can be asked
        // to trust, so it is reported as unrecognised instead of offered.
        [EModalType.EXTERNAL_URL]: externalUrl
            ? {
                  tone: 'warning',
                  title: t('qrScannerOverlay.titleExternalUrl'),
                  description: (
                      <>
                          <p>{t('qrScannerOverlay.externalUrlIntro')}</p>
                          <p className="font-bold break-all">{externalUrl}</p>
                          <p>{t('qrScannerOverlay.externalUrlTrust')}</p>
                      </>
                  ),
                  ctas: [
                      { text: t('qrScannerOverlay.openLink'), shadowSize: '4', onClick: () => void openExternal() },
                      { text: tCommon('close'), variant: 'stroke', onClick: onClose },
                  ],
              }
            : unrecognizedContent,
        [EModalType.UNRECOGNIZED]: unrecognizedContent,
        [EModalType.PIX_RECURRING]: {
            tone: 'info',
            title: t('qrScannerOverlay.titlePixRecurring'),
            description: (
                <>
                    <p>{t('qrScannerOverlay.pixRecurringIntro')}</p>
                    <p>{t('qrScannerOverlay.pixRecurringBody')}</p>
                </>
            ),
            ctas: [{ text: t('qrScannerOverlay.okay'), shadowSize: '4', onClick: onClose }],
        },
    }

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            preventClose={modalContent !== EModalType.QR_NOT_SUPPORTED}
            hideModalCloseButton
            {...contents[modalContent]}
        />
    )
}

export default function QRScannerOverlay() {
    const t = useTranslations('global')
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
    const { triggerHaptic } = useAppHaptic()
    const { isQRScannerOpen, setIsQRScannerOpen } = useModalsContext()

    // Remounts the result modal per scan so its acknowledgement starts unticked
    // on the first paint, not after an effect.
    const [scanSeq, setScanSeq] = useState(0)
    const showModal = (type: EModalType) => {
        setScanSeq((seq) => seq + 1)
        setModalContent(type)
        setIsModalOpen(true)
        setIsQRScannerOpen(false)
    }

    const processQRCode = async (data: string): Promise<{ success: boolean; error?: string }> => {
        triggerHaptic()

        let redirectUrl: string | undefined = undefined
        let toConfirmUrl: string | undefined = undefined
        const normalized = data.toLowerCase()
        // Recognize the RAW scan: in base58 the case IS the address (a lowercase l
        // is not a Solana character, and Tron anchors on an uppercase T), so
        // lowercasing first lost ~half of all Solana and every Tron address.
        // Retry lowercased only when the payload is all-uppercase — QR alphanumeric
        // mode encodes uppercase only, so that case came from the encoder. Any
        // lowercase letter means the case is the user's, and a mixed-case EIP-55
        // checksum must stay rejectable instead of laundered into a payable address.
        const recognized = recognizeQr(data) ?? (data === data.toUpperCase() ? recognizeQr(normalized) : null)

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
                                // The server sends an absolute peanut.me URL —
                                // pushed raw it left the app (Safari on iOS, a
                                // /setup bounce on Android). Map it in-app.
                                redirectUrl = deepLinkToNativePath(lookup.redirectUrl) ?? qrClaimUrl(redirectQrCode)
                            } else {
                                redirectUrl = qrClaimUrl(redirectQrCode)
                            }
                        } catch (error) {
                            console.error('Error checking redirect QR:', error)
                            redirectUrl = qrClaimUrl(redirectQrCode)
                        }
                    } else {
                        // An IRL request QR is `/<recipient>/<amount><token>?id=<uuid>`,
                        // which on native resolves to a route the static export doesn't
                        // ship — the router falls back to a full page load and the
                        // WebView lands on a localhost error page. Reuse the deep-link
                        // mapper so a scanned link routes exactly like the same link
                        // opened from a notification or an App Link.
                        redirectUrl = deepLinkToNativePath(path) ?? path
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
                        toast.error(t('qrScannerOverlay.eip681ParseError'))
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
            case EQrType.PIX_RECURRING: {
                showModal(EModalType.PIX_RECURRING)
                return { success: true }
            }
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
            error: t('qrScannerOverlay.notPeanutUrl'),
        }
    }

    return (
        <>
            <QrResultModal
                key={scanSeq}
                visible={isModalOpen && !!modalContent}
                modalContent={modalContent}
                qrType={qrType}
                redirectTo={redirectTo}
                onClose={() => setIsModalOpen(false)}
                onNotifyMe={() => {
                    setModalContent(EModalType.WILL_BE_NOTIFIED)
                    posthog.capture(ANALYTICS_EVENTS.QR_NOTIFY_ME_CLICKED, { qr_type: qrType })
                }}
            />

            {isQRScannerOpen && (
                <>
                    <QRScanner onScan={processQRCode} onClose={() => setIsQRScannerOpen(false)} isOpen={true} />
                    {/* z-[60] keeps this drawer above the QRScanner portal (z-50) */}
                    <QRBottomDrawer
                        url={payUserUrl}
                        collapsedTitle={t('qrScannerOverlay.myQrCollapsedTitle')}
                        expandedTitle={t('qrScannerOverlay.myQrExpandedTitle')}
                        text={t('qrScannerOverlay.myQrText')}
                        buttonText={t('qrScannerOverlay.myQrButtonText')}
                        className="z-[60]"
                    />
                </>
            )}
        </>
    )
}
