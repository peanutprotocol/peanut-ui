'use client'
import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { CSVLink } from 'react-csv'
import { isMobile } from 'react-device-detect'
import { useAtom } from 'jotai'
import { useRouter } from 'next/navigation'
import peanut from '@squirrel-labs/peanut-sdk'

import * as global_components from '@/components/global'
import * as utils from '@/utils'
import * as interfaces from '@/interfaces'
import * as store from '@/store'
import * as hooks from '@/hooks'
import * as consts from '@/consts'

import redpacket_svg from '@/assets/red-packet.svg'

interface IDashboardItemProps {
    hash: string
    chainId: string
    amount: string
    token: string
    date: string
    claimed: boolean
    link: string
    copied: boolean
    type: 'normal' | 'raffle'
}

export function Dashboard() {
    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)
    const { address, isConnected } = useAccount()
    const router = useRouter()
    const [localStorageData, setLocalStorageData] = useState<interfaces.ILocalStorageItem[]>([])
    const [dashboardData, setDashboardData] = useState<IDashboardItemProps[]>([])
    const [copiedLink, setCopiedLink] = useState<string[]>()
    const gaEventTracker = hooks.useAnalyticsEventTracker('dashboard-component')

    const fetchLinkDetails = async (localStorageData: interfaces.ILocalStorageItem[]) => {
        try {
            let details: IDashboardItemProps[] = []

            await Promise.all(
                localStorageData.map(async (item) => {
                    try {
                        let res = await peanut.getLinkDetails({ link: item.link })
                        let type: 'normal' | 'raffle' = 'normal'

                        if (item.link.includes('packet')) {
                            return // skip packet links

                            // const raffleInfo = await peanut.getRaffleInfo({
                            //     link: item.link,
                            //     baseUrl: `${consts.next_proxy_url}/get-raffle-info`,
                            //     APIKey: 'doesnt-matter',
                            // })
                            // // can't calculate total amount since raffle links may contain different tokens
                            // const totalTokenAmount = 0
                            // res.tokenAmount = totalTokenAmount.toString()
                            // res.claimed = raffleInfo.isActive
                            // type = 'raffle'
                        } else {
                        }
                        const x: IDashboardItemProps = {
                            hash: item.idx ? item.hash + item.idx : item.hash,
                            chainId: item.link.match(/c=(\d+)/)?.[1] ?? '1',
                            amount: res?.tokenAmount ?? '',
                            token: res?.tokenSymbol,
                            date: res?.depositDate ? new Date(res.depositDate).toLocaleString() : 'Unavailable',
                            claimed: res?.claimed ?? false,
                            link: item.link,
                            copied: false,
                            type,
                        }

                        details.push(x)
                    } catch (error) {
                        console.error(error)
                    }
                })
            )

            details.sort((a, b) => {
                const parseDate = (dateStr: string) => {
                    if (dateStr === 'Unavailable' || dateStr === 'undefined') {
                        return new Date('1000-12-31T23:59:59Z')
                    }

                    const dateTimeRegex = /(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})/
                    const match = dateStr.match(dateTimeRegex)
                    if (match) {
                        return new Date(`${match[3]}-${match[2]}-${match[1]}T${match[4]}:${match[5]}:${match[6]}Z`)
                    } else {
                        return new Date('1000-12-31T23:59:59Z')
                    }
                }

                const dateA = parseDate(a.date)
                const dateB = parseDate(b.date)
                return dateB.getTime() - dateA.getTime()
            })

            setDashboardData(details)
        } catch (error) {
            console.log(error)
        }
    }

    useEffect(() => {
        if (address) {
            const data = utils.getAllLinksFromLocalStorage({
                address: address.toString(),
            })

            const filteredData = data?.filter((item) => {
                return !item.address.includes('saving temp link without depositindex for address')
            })

            data && setLocalStorageData(filteredData ?? [])
        }
        router.prefetch('/send')
    }, [address])

    useEffect(() => {
        if (localStorageData.length > 0 && dashboardData.length === 0) {
            fetchLinkDetails(localStorageData)
        }
    }, [localStorageData])

    return (
        <global_components.CardWrapper>
            <div className="flex w-full flex-col gap-2">
                <div className="align-center flex w-full flex-col justify-between sm:flex-row ">
                    <div className="text-center text-xl font-bold">A list of all the links you have created.</div>
                    <div className="mt-4 flex justify-between sm:ml-16 sm:mt-0 sm:flex-none ">
                        {isConnected && localStorageData.length > 0 && (
                            <CSVLink
                                className="brutalborder mr-2 inline-flex cursor-pointer items-center justify-center bg-black px-4 py-2 text-sm font-medium text-white no-underline hover:bg-white hover:text-black sm:w-auto"
                                data={dashboardData}
                                filename={'links.csv'}
                            >
                                DOWNLOAD CSV
                            </CSVLink>
                        )}

                        <button
                            type="button"
                            className="brutalborder inline-flex cursor-pointer items-center justify-center bg-black px-4 py-2 text-sm font-medium text-white hover:bg-white hover:text-black sm:w-auto"
                            onClick={() => {
                                router.push('/send')
                            }}
                        >
                            CREATE
                            <svg
                                className="-mr-0.5 ml-2 h-4 w-4"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 -2 15 20"
                                fill="currentColor"
                                aria-hidden="true"
                            >
                                <path d="M10 3a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V4a1 1 0 011-1z" />
                            </svg>
                        </button>
                    </div>
                </div>
                {isConnected ? (
                    localStorageData.length > 0 ? (
                        dashboardData.length > 0 ? (
                            isMobile ? (
                                <div className="max-h-[420px] overflow-y-auto">
                                    <table className="w-full min-w-full table-auto border-spacing-x-0 border-spacing-y-4 ">
                                        <thead className="sticky top-0 bg-black text-white">
                                            <tr>
                                                <th scope="col" className="px-1 py-3.5 pl-3 text-left font-semibold">
                                                    Chain
                                                </th>
                                                <th scope="col" className="px-1 py-3.5 text-left font-semibold">
                                                    Amount
                                                </th>
                                                <th scope="col" className="relative px-1 py-3.5">
                                                    <span className="sr-only">Copy</span>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dashboardData.map((item) => (
                                                <tr key={Math.random()}>
                                                    <td className="brutalborder-bottom h-8 cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap break-all px-1">
                                                        {
                                                            chainDetails.find(
                                                                (chain) =>
                                                                    chain.chainId.toString() === item.chainId.toString()
                                                            )?.name
                                                        }
                                                    </td>

                                                    <td className="brutalborder-bottom h-8  cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap break-all px-1">
                                                        {Number(item.amount) > 0
                                                            ? utils.formatTokenAmount(Number(item.amount))
                                                            : 'Claimed'}{' '}
                                                        {Number(item.amount) > 0 && item.token}
                                                    </td>
                                                    <td
                                                        className="brutalborder-bottom h-8 cursor-pointer px-1"
                                                        onClick={() => {
                                                            gaEventTracker('link-copied', '')
                                                            navigator.clipboard.writeText(item.link)
                                                            setCopiedLink([item.link])
                                                        }}
                                                    >
                                                        {Number(item.amount) > 0 ? (
                                                            <svg
                                                                xmlns="http://www.w3.org/2000/svg"
                                                                fill="none"
                                                                viewBox="0 0 24 24"
                                                                x-show="!linkCopied"
                                                                stroke="currentColor"
                                                                className="inline h-5 w-5"
                                                            >
                                                                <path d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                                                            </svg>
                                                        ) : (
                                                            ''
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="max-h-[360px] overflow-y-auto">
                                    <table className="w-full border-spacing-x-0 border-spacing-y-2">
                                        <thead className="sticky top-0 z-10 bg-black text-white">
                                            <tr>
                                                <th scope="col" className="px-1 py-3.5 pl-3 text-left font-semibold ">
                                                    Chain
                                                </th>
                                                <th scope="col" className="px-1 py-3.5 text-left font-semibold ">
                                                    Amount
                                                </th>
                                                <th scope="col" className="px-1 py-3.5 text-left font-semibold ">
                                                    Token
                                                </th>
                                                <th scope="col" className="px-1 py-3.5 text-left font-semibold ">
                                                    Date
                                                </th>

                                                <th scope="col" className="relative px-1 py-3.5 ">
                                                    <span className="sr-only">Copy</span>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 bg-white">
                                            {dashboardData.map((item) => (
                                                <tr
                                                    key={item.hash ?? Math.random()}
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(item.link)
                                                        setCopiedLink([item.link])
                                                        gaEventTracker('link-copied', '')
                                                    }}
                                                    className="relative cursor-pointer"
                                                >
                                                    <td className="brutalborder-bottom  h-8 cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap break-all px-1">
                                                        {
                                                            chainDetails.find(
                                                                (chain) =>
                                                                    chain.chainId.toString() === item.chainId.toString()
                                                            )?.name
                                                        }
                                                    </td>
                                                    <td className="brutalborder-bottom h-8 cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap break-all px-1">
                                                        {Number(item.amount) > 0
                                                            ? utils.formatTokenAmount(Number(item.amount))
                                                            : 'Claimed'}{' '}
                                                    </td>
                                                    <td className="brutalborder-bottom h-8  cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap break-all px-1">
                                                        {item.token}
                                                    </td>
                                                    <td className="brutalborder-bottom h-8 cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap break-all px-1">
                                                        {item.date}
                                                    </td>

                                                    <td
                                                        className="brutalborder-bottom relative h-8 w-[68px] cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap break-all px-1" // Adjust the width to accommodate the image
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(item.link)
                                                            setCopiedLink([item.link])
                                                            gaEventTracker('link-copied', '')
                                                        }}
                                                    >
                                                        {item.claimed
                                                            ? 'Claimed'
                                                            : Number(item.amount) > 0
                                                              ? copiedLink?.includes(item.link)
                                                                  ? 'Copied'
                                                                  : 'Copy'
                                                              : ''}
                                                        {/* {item.type === 'raffle' && (
                                                            <img
                                                                src={redpacket_svg.src} // Specify the path to your image
                                                                alt="Raffle Image"
                                                                className=" absolute -right-0 top-0 h-4 w-4" // Position it absolutely to the top right
                                                            />
                                                        )} */}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        ) : (
                            <div className="flex h-full w-full items-center justify-center">
                                <svg
                                    aria-hidden="true"
                                    className="inline h-6 w-6 animate-spin fill-white text-black dark:text-black"
                                    viewBox="0 0 100 101"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                                        fill="currentColor"
                                    />
                                    <path
                                        d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                                        fill="currentFill"
                                    />
                                </svg>
                                <span className="sr-only">Loading...</span>
                            </div>
                        )
                    ) : (
                        <div>
                            {' '}
                            You have not created any links yet. Click{' '}
                            <span
                                className="cursor-pointer underline"
                                onClick={() => {
                                    router.push('/send')
                                }}
                            >
                                here
                            </span>{' '}
                            to make your first one!
                        </div>
                    )
                ) : (
                    <div>Connect your wallet to view your links.</div>
                )}
            </div>
        </global_components.CardWrapper>
    )
}
