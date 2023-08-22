import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { useAtom } from 'jotai'
import { useRouter } from 'next/navigation'
import peanut from '@squirrel-labs/peanut-sdk'
import * as global_components from '@/components/global'
import * as utils from '@/utils'
import * as interfaces from '@/interfaces'
import * as store from '@/store'

const x = [
    {
        address: '0xB6f42695E43712B091F398fe61562F0FDF44c973',
        hash: '0x89d89ecfcb21cfbe0f7f8494a7d5c57e1f7da3277d32ad4b7ef625af01d471e41',
        link: 'https://peanut.to/claim?c=137&v=v3&i=1474&p=9hRitgdKmqM7iXrf&t=sdk\n\n',
    },
    {
        address: '0xB6f42695E43712B091F398fe61562F0FDF44c973',
        hash: 'sdfzeesfqsf',
        link: 'xxxxxxdfsqdfqsesfqsdf',
    },
    {
        address: '0xB6f42695E43712B091F398fe61562F0FDF44c973',
        hash: 'undefined',
        link: 'https://peanut.to/claim#?c=200101&v=v3&i=0&p=LmU7oQXLIW5VTH49&t=sdk',
    },
    {
        address: '0xB6f42695E43712B091F398fe61562F0FDF44c973',
        hash: '0x89d89ecfcb21cfbe0f7f8494a7d5c57e1f7da3277d32ad4b7ef625af01d471e4',
        link: 'https://peanut.to/claim?c=137&v=v3&i=1474&p=9hRitgdKmqM7iXrf&t=sdk\n\n',
    },
]

interface IDashboardItemProps {
    hash: string
    chainId: number
    amount: string
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
        setDashboardData([])
        if (localStorageData.length > 0) {
            localStorageData.forEach((item) => {
                const x: IDashboardItemProps = {
                    hash: item.hash,
                    chainId: Number(item.link.match(/c=(\d+)/)?.[1]),
                    amount: '0',
                    date: '0',
                    claimed: true,
                    link: item.link,
                }

                setDashboardData((prev) => [...prev, x])
            })
        }
    }, [localStorageData])

    useEffect(() => {
        console.log(dashboardData)
    }, [dashboardData])

    return (
        <global_components.CardWrapper>
            <div className="flex flex-col gap-2">
                <div className="align-center flex w-full justify-between">
                    <div className="text-center text-xl font-bold">A list of all the links you have created.</div>
                    <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
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
                    <table className=" w-full table-fixed border-separate border-spacing-y-4 border-2 border-white ">
                        <thead className="bg-black text-white ">
                            <tr>
                                <th className="w-1/4 py-2">Chain</th>
                                <th className="w-1/4 py-2">Amount</th>
                                <th className="w-1/4 py-2">Date</th>
                                <th className="w-1/4 py-2">Claimed</th>
                                <th className="w-1/4 py-2">Copy</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dashboardData.map((item) => (
                                <tr key={item.hash ?? Math.random()}>
                                    <td className="brutalborder-bottom h-8 cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap break-all">
                                        {
                                            chainDetails.find(
                                                (chain) => chain.chainId.toString() === item.chainId.toString()
                                            )?.name
                                        }
                                    </td>
                                    <td className="brutalborder-bottom h-8 cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap break-all">
                                        {item.amount}
                                    </td>
                                    <td className="brutalborder-bottom h-8 cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap break-all">
                                        {item.date}
                                    </td>
                                    <td className="brutalborder-bottom h-8 cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap break-all">
                                        <input
                                            type={'checkbox'}
                                            className='className="h-4 text-indigo-600 focus:ring-indigo-600" w-4 rounded border-gray-300'
                                            checked={item.claimed}
                                        />
                                    </td>
                                    <td
                                        className="brutalborder-bottom h-8 cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap break-all"
                                        onClick={() => {
                                            navigator.clipboard.writeText(item.link)
                                        }}
                                    >
                                        Copy
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    'Connect your wallet to view your deposits'
                )}
            </div>
        </global_components.CardWrapper>
    )
}
