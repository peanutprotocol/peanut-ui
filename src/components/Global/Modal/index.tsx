import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { twMerge } from 'tailwind-merge'
import Icon from '@/components/Global/Icon'

type ModalProps = {
    className?: string
    classWrap?: string
    classOverlay?: string
    classButtonClose?: string
    title?: string
    visible: boolean
    onClose: () => void
    initialFocus?: any
    children: React.ReactNode
    video?: boolean
    hideOverlay?: boolean
    classNameWrapperDiv?: string
    showPrev?: boolean
    onPrev?: () => void
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
    showPrev,
    onPrev,
}: ModalProps) => {
    return (
        <Transition show={visible} as={Fragment}>
            <Dialog
                initialFocus={initialFocus}
                className={`fixed inset-0 z-20 flex items-center overflow-auto scroll-smooth md:p-6 md:px-4 ${className}`}
                onClose={onClose}
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
                    <div
                        className={`fixed inset-0 bottom-0  bg-n-1/85 sm:self-auto ${classOverlay}`}
                        aria-hidden="true"
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
                    <Dialog.Panel
                        className={twMerge(
                            `border-rounded relative bottom-0 z-10 mx-0 max-h-[] w-full max-w-[26rem] self-end bg-white dark:bg-n-1 sm:m-auto sm:self-auto ${
                                video
                                    ? 'static aspect-video max-w-[64rem] overflow-hidden bg-n-1 shadow-[0_2.5rem_8rem_rgba(0,0,0,0.5)] dark:border-transparent'
                                    : ''
                            } ${classWrap}`
                        )}
                    >
                        {!hideOverlay ? (
                            <>
                                {showPrev && (
                                    <button
                                        className={twMerge(
                                            ` absolute left-5 top-4.5 text-0 outline-none hover:fill-purple-1 dark:fill-white dark:hover:fill-purple-1 `
                                        )}
                                        onClick={onPrev}
                                    >
                                        <Icon className="fill-inherit transition-colors" name="arrow-prev" />
                                    </button>
                                )}
                                {title ? (
                                    <>
                                        <div
                                            className={`border-b border-n-1 px-5 py-4 text-h6 dark:border-white ${showPrev ? 'text-center' : 'text-start'}`}
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
                                        `absolute right-4 top-4 text-0 outline-none hover:fill-purple-1 dark:fill-white dark:hover:fill-purple-1 ${
                                            video ? 'absolute right-5 top-5 h-10 w-10 fill-white' : ''
                                        } ${classButtonClose}`
                                    )}
                                    onClick={onClose}
                                >
                                    <Icon className="h-6 w-6 fill-inherit transition-colors" name="close" />
                                </button>
                            </>
                        ) : (
                            <> {children}</>
                        )}
                    </Dialog.Panel>
                </Transition.Child>
            </Dialog>
        </Transition>
    )
}

export default Modal
