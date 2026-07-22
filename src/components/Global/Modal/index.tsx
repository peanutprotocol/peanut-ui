import { Dialog, DialogBackdrop, DialogPanel, Transition } from '@headlessui/react'
import { Fragment, useRef } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon } from '../Icons/Icon'

type ModalProps = {
    className?: string
    classWrap?: string
    classOverlay?: string
    classButtonClose?: string
    title?: string
    visible: boolean
    onClose: () => void
    initialFocus?: React.MutableRefObject<HTMLElement | null>
    children: React.ReactNode
    video?: boolean
    hideOverlay?: boolean
    classNameWrapperDiv?: string
    preventClose?: boolean
}

const Modal = ({
    className,
    classWrap,
    classOverlay,
    classButtonClose,
    title,
    visible,
    onClose,
    initialFocus,
    children,
    video,
    hideOverlay,
    classNameWrapperDiv,
    preventClose = false,
}: ModalProps) => {
    let dialogRef = useRef(null)

    return (
        <Transition show={visible} as={Fragment}>
            <Dialog
                ref={dialogRef}
                initialFocus={initialFocus ?? dialogRef}
                className={`fixed inset-0 z-20 flex items-center overflow-auto scroll-smooth md:p-6 md:px-4 ${className}`}
                onClose={() => {
                    if (!preventClose) {
                        onClose()
                    }
                }}
            >
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    {/* In @headlessui/react v2, `DialogBackdrop` is purely
                     * visual — clicks on it do NOT call the Dialog's onClose,
                     * which is the v1→v2 regression Konrad flagged (M1-M2
                     * readiness: badge modal click-outside does nothing).
                     * Wire it explicitly here, gated by `preventClose` so
                     * destructive-confirmation modals still keep the gate. */}
                    <DialogBackdrop
                        className={`fixed inset-0 bottom-0  bg-n-1/85 sm:self-auto ${classOverlay}`}
                        onClick={() => {
                            if (!preventClose) onClose()
                        }}
                    />
                </Transition.Child>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom={`opacity-0 ${!video && 'scale-95'}`}
                    enterTo={`opacity-100 ${!video && 'scale-100'}`}
                    leave="ease-in duration-200"
                    leaveFrom={`opacity-100 ${!video && 'scale-100'}`}
                    leaveTo={`opacity-0 ${!video && 'scale-95'}`}
                >
                    <DialogPanel
                        className={twMerge(
                            // transform-gpu + will-change promote the panel to its own
                            // compositor layer up front, so the scale/opacity enter tween
                            // doesn't hitch on first-frame rasterization (Android WebView)
                            `relative bottom-0 z-10 mx-0 w-full max-w-[26rem] transform-gpu self-end rounded-md border-0 bg-white outline-none will-change-transform dark:bg-n-1 sm:m-auto sm:self-auto ${
                                video
                                    ? 'static aspect-video max-w-[64rem] overflow-hidden bg-n-1 shadow-[0_2.5rem_8rem_rgba(0,0,0,0.5)] dark:border-transparent'
                                    : ''
                            } ${classWrap}`
                        )}
                    >
                        {!hideOverlay ? (
                            <>
                                {title ? (
                                    <>
                                        <div
                                            className={
                                                'border-b border-n-1 px-5 py-4 text-start text-h6 dark:border-white'
                                            }
                                        >
                                            {title}
                                        </div>
                                        <div className={classNameWrapperDiv}>{children}</div>
                                    </>
                                ) : (
                                    children
                                )}

                                <button
                                    className={twMerge(
                                        `absolute right-2 top-2 p-2 text-0 hover:fill-primary-1 dark:fill-white dark:hover:fill-primary-1 ${
                                            video ? 'absolute right-3 top-3 h-14 w-14 fill-white' : ''
                                        } ${classButtonClose}`
                                    )}
                                    onClick={onClose}
                                >
                                    <Icon name="cancel" size={24} className="transition-colors" />
                                </button>
                            </>
                        ) : (
                            <> {children}</>
                        )}
                    </DialogPanel>
                </Transition.Child>
            </Dialog>
        </Transition>
    )
}

export default Modal
