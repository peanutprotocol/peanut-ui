import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import Modal from '../Modal'
import { type IconName } from '../Icons/Icon'
import ActionModal from '../ActionModal'
import { useRouter } from 'next/navigation'
import { useModalsContext } from '@/context/ModalsContext'
import { type ButtonVariant } from '@/components/0_Bruddle/Button'
import VerificationFrameHeader from '../VerificationFrameHeader'
import { isAndroidNativeBridge } from '@/utils/capacitor'

/**
 * Why the wrapper closed:
 *   - `manual`       — the user backed out
 *   - `completed`    — the embedded flow reported completion (postMessage)
 *   - `tos_accepted` — Bridge's iframe reported a signed agreement (postMessage)
 *   - `returned`     — the user left the provider's page without it reporting
 *                      anything: the android system-browser tab closed, or the
 *                      page moved its own frame to another address. Carries NO
 *                      acceptance claim; the caller must ask the provider
 */
export type IframeCloseSource = 'manual' | 'completed' | 'tos_accepted' | 'returned'

export type IFrameWrapperProps = {
    src: string
    visible: boolean
    onClose: (source?: IframeCloseSource) => void
    closeConfirmMessage?: string
}

const IframeWrapper = ({ src, visible, onClose, closeConfirmMessage }: IFrameWrapperProps) => {
    const t = useTranslations('global')
    const enableConfirmationPrompt = closeConfirmMessage !== undefined
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false)
    const [modalVariant, setModalVariant] = useState<'stop-verification' | 'trouble'>('trouble')
    const [copied, setCopied] = useState(false)
    const iframeRef = useRef<HTMLIFrameElement | null>(null)
    // Per mounted frame: how many documents it loaded, and whether it already
    // closed the wrapper. A new frame (another src, or the modal reopening)
    // starts over.
    const frameLoadsRef = useRef(0)
    const frameClosedRef = useRef(false)
    const attachFrame = useCallback((frame: HTMLIFrameElement | null) => {
        iframeRef.current = frame
        frameLoadsRef.current = 0
        frameClosedRef.current = false
    }, [])
    const router = useRouter()
    const { setIsSupportModalOpen } = useModalsContext()

    /*
     * Android's Capacitor WebView cannot host a third-party subframe:
     * BridgeWebViewClient.shouldOverrideUrlLoading hands EVERY navigation to
     * Bridge.launchIntent — it never checks request.isForMainFrame() — which
     * cancels the load for any host outside the app origin that isn't in
     * server.allowNavigation. The frame paints pure white and the provider
     * never records an acceptance. iOS gates the same detour on
     * targetFrame.isMainFrame, so only Android needs the system-browser
     * detour. Coming back from that tab means "the user returned", not "the
     * user accepted" — hence a `returned` source the caller resolves against
     * the provider rather than a fabricated `tos_accepted`.
     */
    const [useSystemBrowser] = useState(isAndroidNativeBridge)
    const onCloseRef = useRef(onClose)
    useEffect(() => {
        onCloseRef.current = onClose
    })

    useEffect(() => {
        if (!useSystemBrowser || !visible) return
        let disposed = false
        let remove: (() => void) | undefined
        void import('@capacitor/browser')
            .then(({ Browser }) =>
                // Listener first: a tab the user dismisses immediately must not
                // close before we are listening, or the flow hangs forever.
                Browser.addListener('browserFinished', () => onCloseRef.current('returned')).then((handle) => {
                    // Cleanup can run while the dynamic import / listener
                    // registration is still in flight; a late arrival must both
                    // drop its listener AND skip the open, or a fast unmount
                    // pops the tab after its owning flow has closed.
                    if (disposed) {
                        handle.remove()
                        return
                    }
                    remove = () => handle.remove()
                    return Browser.open({ url: src })
                })
            )
            .catch((error) => {
                console.error('[iframe-wrapper] system browser open failed', error)
                onCloseRef.current('manual')
            })
        return () => {
            disposed = true
            remove?.()
        }
    }, [useSystemBrowser, visible, src])

    const handleCopy = (textToCopy: string) => {
        navigator.clipboard.writeText(textToCopy).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    const modalDetails = useMemo(() => {
        if (modalVariant === 'trouble') {
            return {
                title: t('iframeWrapper.troubleTitle'),
                description: (
                    <p>
                        {t('iframeWrapper.troubleDescriptionLine1')}
                        <br />
                        {t('iframeWrapper.troubleDescriptionLine2')}
                    </p>
                ),
                tone: 'info' as const,
                icon: 'question-mark' as IconName,
                ctas: [
                    {
                        text: t('iframeWrapper.copyLink'),
                        icon: copied ? 'check' : ('copy' as IconName),
                        onClick: () => {
                            handleCopy(src)
                        },
                        variant: 'primary' as ButtonVariant,
                        shadowSize: '4' as const,
                    },
                    {
                        text: t('iframeWrapper.chatWithSupport'),
                        icon: 'peanut-support' as IconName,
                        onClick: () => setIsSupportModalOpen(true),
                        variant: 'secondary' as ButtonVariant,
                        className: 'w-full',
                    },
                ],
                tertiaryCta: { text: t('iframeWrapper.cancel'), onClick: () => setIsHelpModalOpen(false) },
            }
        }

        return {
            title: t('iframeWrapper.exitTitle'),
            description: t('iframeWrapper.exitDescription'),
            tone: 'attention' as const,
            icon: 'alert' as IconName,
            ctas: [
                {
                    text: t('iframeWrapper.exit'),
                    onClick: () => {
                        setIsHelpModalOpen(false)
                        onClose('manual')
                    },
                    variant: 'primary' as ButtonVariant,
                    shadowSize: '4' as const,
                },
            ],
            tertiaryCta: { text: t('iframeWrapper.continueVerifying'), onClick: () => setIsHelpModalOpen(false) },
        }
    }, [modalVariant, copied, src, router, t])

    // track completed event from iframe and close the modal
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            // React only to messages from OUR iframe. Several surfaces keep a
            // wrapper mounted after a manual close (e.g. the multi-phase KYC
            // flow's ToS iframe), and a sibling iframe's completion event would
            // otherwise fire BOTH handlers — double ToS confirms + phantom flow
            // transitions. Matching on the message SOURCE (not `visible`) keeps
            // that protection — even against a sibling that is visible at the
            // same time — without dropping a completion that lands in the
            // instant the modal is hiding: the acceptance already happened at
            // Bridge, and never confirming it strands a stale task.
            if (!event.source || event.source !== iframeRef.current?.contentWindow) return
            // one close per frame: a page that also moved its frame away
            // already reported `returned`
            if (frameClosedRef.current) return
            const data = event.data
            if (data?.name === 'complete' && data?.metadata?.status === 'completed') {
                frameClosedRef.current = true
                onClose('completed')
            } else if (data?.signedAgreementId) {
                // @dev note: kinda hacky, but tos modal takes too long to close using websocket, so we use the signedAgreementId to close it
                // persona fires this event when the user clicks the "accept" button within the iframe
                frameClosedRef.current = true
                onClose('tos_accepted')
            }
        }

        window.addEventListener('message', handleMessage)
        return () => window.removeEventListener('message', handleMessage)
    }, [onClose, visible])

    /*
     * The provider's page is the frame's first load. A later load means the
     * page moved its own frame somewhere else: Bridge's ToS page does that
     * instead of posting `signedAgreementId` when its link carries a
     * `redirect_uri`, and peanut.me then refuses to render inside the native
     * app (a blank frame). Nothing in that frame can finish the flow, so close
     * it and let the caller ask the provider what happened (TASK-23881).
     */
    const handleFrameLoad = () => {
        frameLoadsRef.current += 1
        if (frameLoadsRef.current < 2 || frameClosedRef.current) return
        frameClosedRef.current = true
        onCloseRef.current('returned')
    }

    if (useSystemBrowser) return null

    return (
        <Modal
            visible={visible}
            onClose={() => {
                if (!enableConfirmationPrompt) {
                    onClose('manual')
                    return
                }
                if (src.includes('tos')) {
                    onClose('manual')
                    return
                }
            }}
            classWrap="h-full w-full !max-w-none sm:!max-w-[600px] border-none sm:m-auto m-0"
            classOverlay={`bg-black/50 ${isHelpModalOpen ? 'pointer-events-none' : ''}`}
            video={false}
            className={`z-[100] !p-0 md:!p-6 ${isHelpModalOpen ? 'pointer-events-none' : ''}`}
            classButtonClose="hidden"
            preventClose={true}
            hideOverlay={false}
        >
            {/* pb-safe-bottom: the frame is full height now, so the provider's bottom
                submit button would otherwise sit under the home indicator */}
            <div className="flex h-full flex-col pt-safe-top pb-safe-bottom">
                <VerificationFrameHeader
                    onSupport={() => {
                        setModalVariant('trouble')
                        setIsHelpModalOpen(true)
                    }}
                    onClose={() => {
                        setModalVariant('stop-verification')
                        setIsHelpModalOpen(true)
                    }}
                />
                <iframe
                    key={src}
                    ref={attachFrame}
                    src={src}
                    onLoad={handleFrameLoad}
                    allow="camera *; microphone *; fullscreen *"
                    className="w-full flex-1 rounded-sm border-0"
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation allow-media-devices"
                />
            </div>
            <ActionModal
                visible={isHelpModalOpen}
                onClose={() => setIsHelpModalOpen(false)}
                title={modalDetails.title}
                description={modalDetails.description}
                tone={modalDetails.tone}
                icon={modalDetails.icon}
                modalPanelClassName="pointer-events-auto mx-0 max-w-full"
                ctaClassName="grid grid-cols-1 gap-3"
                contentContainerClassName="px-6 py-6"
                modalClassName="!z-[10001] pointer-events-auto"
                preventClose={true}
                ctas={modalDetails.ctas}
                tertiaryCta={modalDetails.tertiaryCta}
            />
        </Modal>
    )
}

export default IframeWrapper
