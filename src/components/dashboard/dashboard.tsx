import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { getPublicClient, PublicClient } from '@wagmi/core'

import { useAtom } from 'jotai'
import { useRouter } from 'next/navigation'
import peanut from '@squirrel-labs/peanut-sdk'
import * as global_components from '@/components/global'
import * as utils from '@/utils'
import * as interfaces from '@/interfaces'
import * as store from '@/store'
import { providers } from 'ethers'
import { HttpTransport } from 'viem'
import { CSVLink } from 'react-csv'
import { isMobile } from 'react-device-detect'

interface IDashboardItemProps {
    hash: string
    chainId: number
    amount: string
    token: string
    date: string
    claimed: boolean
    link: string
}

export function Dashboard() {
    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)
    const { address, isConnected } = useAccount()
    const router = useRouter()
    const [localStorageData, setLocalStorageData] = useState<interfaces.ILocalStorageItem[]>([])
    const [dashboardData, setDashboardData] = useState<IDashboardItemProps[]>([])
    const [isLoading, setIsLoading] = useState<boolean>(true)

    function publicClientToProvider(publicClient: PublicClient) {
        const { chain, transport } = publicClient
        const network = {
            chainId: chain.id,
            name: chain.name,
            ensAddress: chain.contracts?.ensRegistry?.address,
        }

        if (transport.type === 'fallback')
            return new providers.FallbackProvider(
                (transport.transports as ReturnType<HttpTransport>[]).map(
                    ({ value }) => new providers.JsonRpcProvider(value?.url, network)
                )
            )
        return new providers.JsonRpcProvider(transport.url, network)
    }

    function getEthersProvider({ chainId }: { chainId?: number } = {}) {
        const publicClient = getPublicClient({ chainId })
        return publicClientToProvider(publicClient)
    }

    const fetchLinkDetails = async (localStorageData: interfaces.ILocalStorageItem[]) => {
        localStorageData.forEach(async (item) => {
            const provider = getEthersProvider({ chainId: Number(Number(item.link.match(/c=(\d+)/)?.[1])) })
            const linkDetails: interfaces.ILinkDetails = await peanut.getLinkDetails(provider, item.link, true)
            const x: IDashboardItemProps = {
                hash: item.hash,
                chainId: Number(item.link.match(/c=(\d+)/)?.[1]),
                amount: linkDetails.tokenAmount,
                token: linkDetails.tokenSymbol,
                date:
                    linkDetails.depositDate == null
                        ? 'Unavailable'
                        : new Date(linkDetails.depositDate).toLocaleString(),
                claimed: Number(linkDetails.tokenAmount) <= 0,
                link: item.link,
            }

            setDashboardData((prev) => [...prev, x])
        })

        setIsLoading(false)
    }

    useEffect(() => {
        if (address) {
            const data = utils.getAllLinksFromLocalStorage({
                address: address.toString(),
            })
            data && setLocalStorageData(data)
        }
        router.prefetch('/')
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
                                router.push('/')
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
                        isMobile ? (
                            <table className="w-full min-w-full table-auto border-spacing-y-4">
                                <thead className="bg-black text-white">
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
                                        <tr key={item.hash ?? Math.random()}>
                                            <td className="brutalborder-bottom h-8 cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap break-all px-1">
                                                {
                                                    chainDetails.find(
                                                        (chain) => chain.chainId.toString() === item.chainId.toString()
                                                    )?.name
                                                }
                                            </td>

                                            <td className="brutalborder-bottom h-8  cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap break-all px-1">
                                                {Number(item.amount) > 0 ? item.amount : 'Claimed'}{' '}
                                                {Number(item.amount) > 0 && item.token}
                                            </td>
                                            <td
                                                className="brutalborder-bottom h-8 cursor-pointer px-1"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(item.link)
                                                }}
                                            >
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    x-show="!linkCopied"
                                                    stroke-width="1.5"
                                                    stroke="currentColor"
                                                    className="inline h-5 w-5"
                                                >
                                                    <path
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                        d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"
                                                    />
                                                </svg>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <table className=" w-full min-w-full table-auto border-spacing-y-4  ">
                                <thead className="bg-black text-white ">
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
                                        <tr key={item.hash ?? Math.random()}>
                                            <td className="brutalborder-bottom  h-8 cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap break-all px-1">
                                                {
                                                    chainDetails.find(
                                                        (chain) => chain.chainId.toString() === item.chainId.toString()
                                                    )?.name
                                                }
                                            </td>
                                            <td className="brutalborder-bottom h-8 cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap break-all px-1">
                                                {Number(item.amount) > 0 ? item.amount : 'Claimed'}
                                            </td>
                                            <td className="brutalborder-bottom h-8  cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap break-all px-1">
                                                {item.token}
                                            </td>
                                            <td className="brutalborder-bottom h-8 cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap break-all px-1">
                                                {item.date}
                                            </td>

                                            <td
                                                className="brutalborder-bottom h-8 cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap break-all px-1"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(item.link)
                                                }}
                                            >
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    x-show="!linkCopied"
                                                    stroke-width="1.5"
                                                    stroke="currentColor"
                                                    className="inline h-5 w-5"
                                                >
                                                    <path
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                        d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"
                                                    />
                                                </svg>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )
                    ) : (
                        <div>
                            {' '}
                            You have not created any links yet. Click{' '}
                            <span
                                className="cursor-pointer underline"
                                onClick={() => {
                                    router.push('/')
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
