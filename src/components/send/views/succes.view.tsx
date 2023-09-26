import { useEffect, useMemo, useState } from 'react'
import QRCode from 'react-qr-code'

import dropdown_svg from '@/assets/dropdown.svg'

import * as _consts from '../send.consts'
import { useAtom } from 'jotai'
import * as store from '@/store/store'
import * as global_components from '@/components/global'

const linkss = [
    'http://localhost:3000/claim#?c=5&v=v4&i=73&p=pCPss4a0WiRgbiDo&t=ui',
    'http://localhost:3000/claim#?c=5&v=v4&i=74&p=2ldLR8WHSR4ivkPs&t=ui',
    'http://localhost:3000/claim#?c=5&v=v4&i=75&p=o5BmA0Xoe5AKzXm1&t=ui',
    'http://localhost:3000/claim#?c=5&v=v4&i=76&p=5825iSMUmio1SMSs&t=ui',
    'http://localhost:3000/claim#?c=5&v=v4&i=77&p=xMhU49Y4YCFEHDAZ&t=ui',
    'http://localhost:3000/claim#?c=5&v=v4&i=78&p=hfn0ziQZtgiIj2bI&t=ui',
    'http://localhost:3000/claim#?c=5&v=v4&i=79&p=ngfZ7Npk497O9Ood&t=ui',
    'http://localhost:3000/claim#?c=5&v=v4&i=80&p=Z5q412r2w7POlzW1&t=ui',
    'http://localhost:3000/claim#?c=5&v=v4&i=81&p=4YF9JCQyLahbw8rA&t=ui',
    'http://localhost:3000/claim#?c=5&v=v4&i=82&p=ZbOBBU3mS44E8pVV&t=ui',
]

export function SendSuccessView({ onCustomScreen, claimLink, txHash, chainId }: _consts.ISendScreenProps) {
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
    })

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

                {claimLink.length == 1 ? (
                    <div className="brutalborder relative mt-4 flex w-4/5 items-center bg-black py-1 text-white ">
                        <div className="flex w-[90%] items-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all bg-black p-2 text-lg font-normal text-white">
                            {claimLink}
                        </div>
                        <div
                            className="min-w-32 absolute right-0 top-0 flex h-full cursor-pointer items-center justify-center border-none bg-white px-1 text-black md:px-4"
                            onClick={() => {
                                navigator.clipboard.writeText(claimLink[0])
                                setIsCopied(true)
                            }}
                        >
                            {isCopied ? (
                                <div className="flex h-full cursor-pointer items-center border-none bg-white text-base font-bold ">
                                    <span className="tooltiptext inline w-full justify-center" id="myTooltip">
                                        {' '}
                                        copied!{' '}
                                    </span>
                                </div>
                            ) : (
                                <button className="h-full cursor-pointer gap-2 border-none bg-white p-0 text-base font-bold ">
                                    <label className="cursor-pointer text-black">COPY</label>
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <ul className="brutalscroll max-h-[360px] w-4/5 flex-col items-center justify-center overflow-x-hidden overflow-y-scroll p-2">
                        {claimLink.map((link, index) => (
                            <li
                                className="brutalborder relative mb-4 flex w-full items-center bg-black py-1 text-white"
                                key={index}
                            >
                                <div className="flex w-[90%] items-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all bg-black p-2 text-lg font-normal text-white">
                                    {link}
                                </div>

                                <div
                                    className="min-w-32 absolute right-0 top-0 flex h-full cursor-pointer items-center justify-center border-none bg-white px-1 text-black md:px-4"
                                    onClick={() => {
                                        navigator.clipboard.writeText(link)
                                        setCopiedLink([link])
                                    }}
                                >
                                    {copiedLink?.includes(link) ? (
                                        <div className="flex h-full items-center border-none bg-white text-base font-bold">
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
                )}

                {claimLink.length == 1 ? (
                    <div
                        className="mt-2 flex cursor-pointer items-center justify-center"
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
                ) : !copiedAll ? (
                    <div className="text-m border-none bg-white ">
                        Click{' '}
                        <span
                            className="cursor-pointer text-black underline"
                            onClick={() => {
                                navigator.clipboard.writeText(claimLink.join('\n'))
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
                                    value={typeof claimLink === 'string' ? claimLink : ''}
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
                    </div>
                )}

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

                <p className="mt-4 text-xs" id="to_address-description">
                    {' '}
                    Thoughts? Feedback? Use cases? Memes? Hit us up on{' '}
                    <a
                        href="https://discord.gg/BX9Ak7AW28"
                        target="_blank"
                        className="cursor-pointer text-black underline"
                    >
                        Discord
                    </a>
                    !
                </p>
            </div>

            <global_components.PeanutMan type="presenting" />
        </>
    )
}
