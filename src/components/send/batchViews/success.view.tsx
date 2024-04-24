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
        () => chainDetails.find((detail) => detail.chainId === chainId)?.explorers[0].url + '/tx/' + txHash,
        [txHash, chainId]
    )

    useEffect(() => {
        if (copiedAll) {
            setTimeout(() => {
                setCopiedAll(false)
            }, 3000)
        }
        setClaimLink([
            'http://localhost:3000/claim?c=137&v=v4.4&i=72&t=ui#p=vvM3gfpJVZpgf8yx',
            'http://localhost:3000/claim?c=137&v=v4.4&i=73&t=ui#p=iSSHr6HMCvWjZUR7',
            'http://localhost:3000/claim?c=137&v=v4.4&i=74&t=ui#p=N9XjS7DbplWThg03',
            'http://localhost:3000/claim?c=137&v=v4.4&i=75&t=ui#p=IK7sb3TmranXimjo',
            'http://localhost:3000/claim?c=137&v=v4.4&i=76&t=ui#p=hhu4k6zfEbZrZkxY',
            'http://localhost:3000/claim?c=137&v=v4.4&i=77&t=ui#p=xwvRHJEfipaU1axt',
            'http://localhost:3000/claim?c=137&v=v4.4&i=78&t=ui#p=6BwOLE6XO1LLAzwI',
            'http://localhost:3000/claim?c=137&v=v4.4&i=79&t=ui#p=yI99JxMKrLSCULOu',
            'http://localhost:3000/claim?c=137&v=v4.4&i=80&t=ui#p=Xh3hfvjXk63W3k0d',
            'http://localhost:3000/claim?c=137&v=v4.4&i=81&t=ui#p=Qb5VnxgmskgA9jXc',
            'http://localhost:3000/claim?c=137&v=v4.4&i=82&t=ui#p=baRqiECz2vh9ln0F',
            'http://localhost:3000/claim?c=137&v=v4.4&i=83&t=ui#p=5O3NoMu4FIxXKpgq',
            'http://localhost:3000/claim?c=137&v=v4.4&i=84&t=ui#p=cVkmZkuSR7Yki56I',
            'http://localhost:3000/claim?c=137&v=v4.4&i=85&t=ui#p=TbNuaYQW7BeiF4uP',
            'http://localhost:3000/claim?c=137&v=v4.4&i=86&t=ui#p=nclwhlrvKGFM0lJO',
            'http://localhost:3000/claim?c=137&v=v4.4&i=87&t=ui#p=mXBo5Uyj9WrRoYRe',
            'http://localhost:3000/claim?c=137&v=v4.4&i=88&t=ui#p=pKQsUrpEdO3s8F1r',
            'http://localhost:3000/claim?c=137&v=v4.4&i=89&t=ui#p=rw0Ie72xxTdDNaVu',
            'http://localhost:3000/claim?c=137&v=v4.4&i=90&t=ui#p=KE4a4tdFKtjolZPQ',
            'http://localhost:3000/claim?c=137&v=v4.4&i=91&t=ui#p=3BhQiG8eSrKMiUAt',
        ])
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
                <div
                    className="flex cursor-pointer items-center justify-center"
                    onClick={() => {
                        setIsDropdownOpen(!isDropdownOpen)
                    }}
                >
                    <div className="cursor-pointer border-none bg-white text-sm  ">More Info and QR code </div>
                    <img
                        style={{
                            transform: isDropdownOpen ? 'scaleY(-1)' : 'none',
                            transition: 'transform 0.3s ease-in-out',
                        }}
                        src={dropdown_svg.src}
                        alt=""
                        className={'h-6 '}
                    />
                </div>
                <div className={' mt-8 flex flex-col items-center  justify-center gap-6 '}>
                    {!copiedAll ? (
                        <div className="text-m border-none bg-white ">
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

                {isDropdownOpen && (
                    <div>
                        <div className="h-42 w-42 mx-auto mb-6 mt-4">
                            <div
                                style={{
                                    height: 'auto',
                                    margin: '0 auto',
                                    maxWidth: 192,
                                    width: '100%',
                                }}
                            >
                                <QRCode
                                    size={256}
                                    style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                                    value={claimLink[0]}
                                    viewBox={`0 0 256 256`}
                                />
                            </div>
                        </div>
                        <p className="tx-sm">
                            <a
                                href={explorerUrlWithTx ?? ''}
                                target="_blank"
                                className="cursor-pointer text-center text-sm text-black underline "
                            >
                                Your transaction hash
                            </a>
                        </p>
                        <p className="text-m mt-4" id="to_address-description">
                            {' '}
                            Want to do it again? click{' '}
                            <a
                                onClick={() => {
                                    onCustomScreen('INITIAL')
                                }}
                                target="_blank"
                                className="cursor-pointer text-black underline"
                            >
                                here
                            </a>{' '}
                            to go back home!
                        </p>
                    </div>
                )}
            </div>

            <global_components.PeanutMan type="presenting" />
        </>
    )
}
