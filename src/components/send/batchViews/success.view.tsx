import * as _consts from '../send.consts'
import * as utils from '@/utils'
import * as store from '@/store/store'
import * as global_components from '@/components/global'
import { useAtom } from 'jotai'
import { useState, useMemo, useEffect } from 'react'
import QRCode from 'react-qr-code'
import dropdown_svg from '@/assets/icons/dropdown.svg'

export function BatchSuccessView({
    onCustomScreen,
    claimLink,
    setClaimLink,
    txHash,
    chainId,
}: _consts.ISendScreenProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [loadingText, setLoadingText] = useState('')
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [isCopied, setIsCopied] = useState(false)
    const [copiedLink, setCopiedLink] = useState<string[]>()
    const [copiedAll, setCopiedAll] = useState(false)
    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)
    const explorerUrlWithTx = useMemo(
        () => utils.getExplorerUrl(chainDetails, chainId) + '/tx/' + txHash,
        [txHash, chainId]
    )

    useEffect(() => {
        if (copiedAll) {
            setTimeout(() => {
                setCopiedAll(false)
            }, 3000)
        }
    }, [])

    return (
        <>
            <div className="flex w-full flex-col items-center text-center ">
                <h2 className="title-font text-5xl font-black text-black">Yay!</h2>
                {claimLink.length == 1 ? (
                    <p className="mt-2 self-center text-lg">
                        Send this link to your friend so they can claim their funds.
                    </p>
                ) : (
                    <p className="mt-2 self-center text-lg">Here are the links you created.</p>
                )}

                <ul className="brutalscroll max-h-[360px] w-4/5 flex-col items-center justify-center gap-4 space-y-4 overflow-x-hidden overflow-y-scroll p-2">
                    {claimLink &&
                        claimLink.map((link, index) => (
                            <li
                                className="brutalborder relative flex w-full items-center bg-black py-1 text-white"
                                key={index}
                            >
                                <div className="flex w-[90%] items-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all bg-black p-2 text-lg font-normal text-white">
                                    {link}
                                </div>

                                <div
                                    className="absolute right-0 top-0 flex h-full min-w-6    cursor-pointer items-center justify-center border-none bg-white px-1 text-black sm:min-w-32 md:px-4"
                                    onClick={() => {
                                        utils.copyTextToClipboardWithFallback(link)
                                        setCopiedLink([link])
                                    }}
                                >
                                    {copiedLink?.includes(link) ? (
                                        <div className="flex h-full cursor-pointer items-center border-none bg-white text-base font-bold">
                                            <span className="tooltiptext inline w-full justify-center" id="myTooltip">
                                                Copied!
                                            </span>
                                        </div>
                                    ) : (
                                        <button className="h-full cursor-pointer gap-2 border-none bg-white p-0 text-base font-bold">
                                            <label className="cursor-pointer text-black">COPY</label>
                                        </button>
                                    )}
                                </div>
                            </li>
                        ))}
                </ul>
                <div className="mb-4 mt-0">
                    <p className="tx-sm my-0">
                        <a
                            href={explorerUrlWithTx ?? ''}
                            target="_blank"
                            className="cursor-pointer text-center text-sm text-black underline "
                        >
                            Your transaction hash
                        </a>
                    </p>
                </div>
                <div className={' flex flex-col items-center  justify-center gap-6 '}>
                    {!copiedAll ? (
                        <div className="border-none bg-white text-lg ">
                            Click{' '}
                            <span
                                className="cursor-pointer text-black underline"
                                onClick={() => {
                                    utils.copyTextToClipboardWithFallback(claimLink.join('\n'))
                                    setCopiedLink(claimLink)
                                    setCopiedAll(true)
                                }}
                            >
                                here
                            </span>{' '}
                            to copy all links{' '}
                        </div>
                    ) : (
                        <div className="text-m border-none bg-white ">Copied all links to clipboard!</div>
                    )}
                </div>
            </div>

            <global_components.PeanutMan type="presenting" />
        </>
    )
}
