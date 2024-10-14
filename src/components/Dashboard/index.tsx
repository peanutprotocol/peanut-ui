'use client'
import { useEffect, useState } from 'react'
import Icon from '../Global/Icon'
import Sorting from '../Global/Sorting'
import TablePagination from '../Global/TablePagination'
import { useAccount } from 'wagmi'
import Loading from '../Global/Loading'
import { useRouter } from 'next/navigation'
import { CSVLink } from 'react-csv'

import * as utils from '@/utils'
import * as interfaces from '@/interfaces'
import * as _consts from './Dashboard.consts'
import * as components from './components'
import Modal from '../Global/Modal'

import { useDashboard } from './useDashboard'

export const Dashboard = () => {
    const itemsPerPage = 10
    const [filterValue, setFilterValue] = useState('')
    const [sortingValue, setSortingValue] = useState<string>(_consts.sortingTypes[0])
    const [dashboardData, setDashboardData] = useState<interfaces.IDashboardItem[]>([])
    const [filteredDashboardData, setFilteredDashboardData] = useState<interfaces.IDashboardItem[]>([])
    const [totalPages, setTotalPages] = useState<number>(0)
    const [currentPage, setCurrentPage] = useState<number>(1)
    const [legacyLinks, setLegacyLinks] = useState<string[]>([])

    const { address } = useAccount()
    const router = useRouter()

    const { composeLinkDataArray, fetchLinkDetailsAsync, filterDashboardData, sortDashboardData } = useDashboard()

    useEffect(() => {
        const linkData = composeLinkDataArray(address ?? '')
        setTotalPages(Math.ceil(linkData.length / itemsPerPage))
        setCurrentPage(1)
        setDashboardData(
            linkData.sort((a, b) => {
                const dateA = new Date(a.date).getTime()
                const dateB = new Date(b.date).getTime()
                if (dateA === dateB) {
                    return new Date(b.date).getTime() - new Date(a.date).getTime()
                } else {
                    return dateB - dateA
                }
            })
        )

        if (address) {
            const links: string[] = []
            const legacyLinkObject = utils.getAllLinksFromLocalStorage({ address: address })
            if (legacyLinkObject) {
                legacyLinkObject.forEach((obj) => {
                    links.push(obj.link)
                })
            }
            const raffleLegacyLinkObject = utils.getAllRaffleLinksFromLocalstorage({ address: address })
            if (raffleLegacyLinkObject) {
                raffleLegacyLinkObject.forEach((obj) => {
                    links.push(obj.link)
                })
            }
            setLegacyLinks(links)
        } else {
            setLegacyLinks([])
        }
    }, [address])

    useEffect(() => {
        if (sortingValue && dashboardData.length > 0) {
            const sortedDashboardData = sortDashboardData(sortingValue, dashboardData)
            setDashboardData(sortedDashboardData)
        }
    }, [sortingValue])

    useEffect(() => {
        async function _fetchLinkDetailsAsync(visibleData: interfaces.IDashboardItem[]) {
            const data = await fetchLinkDetailsAsync(visibleData)
            setDashboardData((prevData) =>
                prevData.map((item) => {
                    const updatedItem = data.find((updated) => updated.link === item.link)
                    return updatedItem ? { ...item, status: updatedItem.status } : item
                })
            )
        }

        const visibleData = dashboardData
            .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
            .filter((item) => item.status === undefined)
        if (visibleData.length > 0) {
            _fetchLinkDetailsAsync(visibleData)
        }
        // }, [currentPage, dashboardData])
    }, [currentPage, dashboardData])

    useEffect(() => {
        if (filterValue) {
            const filteredDashboarData = filterDashboardData(filterValue, dashboardData, itemsPerPage)
            setFilteredDashboardData(filteredDashboarData)
            setTotalPages(Math.ceil(filteredDashboarData.length / itemsPerPage))
            setCurrentPage(1)
        } else {
            setFilteredDashboardData(dashboardData)
        }
    }, [filterValue, dashboardData])

    return (
        <div className="flex h-full w-full flex-col items-center justify-start gap-6 p-4">
            <div className="flex w-full flex-row items-start justify-between">
                <div className="flex flex-col items-start justify-center">
                    <label className="text-h2">Dashboard</label>
                    <label className="text-h7 font-normal">
                        {dashboardData.length > 0
                            ? `See all links created and claimed  ${address ? `with ${utils.printableAddress(address)}` : 'on this device'}`
                            : 'You have not created or claimed any links yet.'}
                    </label>
                </div>
                <button
                    className="btn-purple btn-xl hidden w-max flex-row items-center justify-center px-4 sm:flex"
                    onClick={() => {
                        router.push('/send')
                    }}
                >
                    Make Payment
                    <Icon name={'plus-circle'} className="h-4 fill-white" />
                </button>
            </div>

            <div className="flex w-full flex-col items-center justify-center gap-3">
                {dashboardData.length > 0 && (
                    <div className="flex w-full flex-col-reverse items-center justify-center gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <components.SortComponent
                            sortingValue={sortingValue}
                            setSortingValue={(sortingValue: string) => {
                                setSortingValue(sortingValue)
                            }}
                            buttonClassName="w-full sm:w-max"
                        />
                    </div>
                )}
                {filteredDashboardData.length > 0 && (
                    <>
                        <table className="table-custom hidden sm:table">
                            <thead>
                                <tr>
                                    <th className="th-custom">
                                        <Sorting title="Type" />
                                    </th>
                                    <th className="th-custom">
                                        <Sorting title="Amount" />
                                    </th>
                                    <th className="th-custom">
                                        <Sorting title="Chain" />
                                    </th>
                                    <th className="th-custom">
                                        <Sorting title="Date" />
                                    </th>
                                    <th className="th-custom ">
                                        <Sorting title="From" />
                                    </th>
                                    <th className="th-custom ">
                                        <Sorting title="Ref." />
                                    </th>
                                    <th className="th-custom ">
                                        <Sorting title="Status" />
                                    </th>
                                    <th className="th-custom"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredDashboardData &&
                                    filteredDashboardData
                                        .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                        .map((link) => (
                                            <tr
                                                className="h-16 text-h8 font-normal"
                                                key={(link.link ?? link.txHash ?? '') + Math.random()}
                                            >
                                                <td className="td-custom font-bold">{link.type}</td>
                                                <td className="td-custom font-bold">
                                                    {utils.formatTokenAmount(Number(link.amount), 4)} {link.tokenSymbol}
                                                </td>
                                                <td className="td-custom font-bold">{link.chain}</td>
                                                <td className="td-custom">{utils.formatDate(new Date(link.date))}</td>
                                                <td className="td-custom">
                                                    {utils.printableAddress(link.address ?? address ?? '')}
                                                </td>
                                                <td className="td-custom max-w-32">
                                                    <span
                                                        className="block flex-grow overflow-hidden text-ellipsis whitespace-nowrap"
                                                        title={link.message ? link.message : ''}
                                                    >
                                                        {link.message ? link.message : ''}
                                                    </span>
                                                </td>

                                                <td className="td-custom">
                                                    {!link.status ? (
                                                        <div className="border border-gray-1 px-2 py-1 text-center text-gray-1">
                                                            <Loading />
                                                        </div>
                                                    ) : link.status === 'claimed' ? (
                                                        <div className="border border-teal-3 px-2 py-1 text-center text-teal-3">
                                                            claimed
                                                        </div>
                                                    ) : link.status === 'transfer' ? (
                                                        <div className="border border-teal-3 px-2 py-1 text-center text-teal-3">
                                                            sent
                                                        </div>
                                                    ) : (
                                                        <div className="border border-gray-1 px-2 py-1 text-center text-gray-1">
                                                            pending
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="td-custom text-center ">
                                                    <components.OptionsItemComponent item={link} />
                                                </td>
                                            </tr>
                                        ))}
                            </tbody>
                        </table>
                        <div className="block w-full sm:hidden">
                            {filteredDashboardData
                                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                .map((link) => (
                                    <div key={(link.link ?? link.txHash ?? '') + Math.random()}>
                                        <components.MobileItemComponent linkDetail={link} address={address ?? ''} />
                                    </div>
                                ))}
                        </div>
                    </>
                )}

                {legacyLinks.length > 0 && (
                    <CSVLink
                        data={legacyLinks ? legacyLinks.join('\n') : ''}
                        filename="links.csv"
                        className="cursor-pointer self-end text-purple-1"
                    >
                        Download {legacyLinks.length} legacy links as CSV
                    </CSVLink>
                )}
            </div>
            {filteredDashboardData.length > 0 && totalPages > 1 && (
                <TablePagination
                    onNext={() => {
                        if (currentPage < totalPages) {
                            setCurrentPage(currentPage + 1)
                        }
                    }}
                    onPrev={() => {
                        if (currentPage > 1) {
                            setCurrentPage(currentPage - 1)
                        }
                    }}
                    totalPages={totalPages}
                    currentPage={currentPage}
                />
            )}

            <button
                className="center-xy"
                onClick={() => {
                    router.push('/refund')
                }}
            >
                <Icon name={'question-circle'} /> Had an issue creating a link? click here to reclaim the funds.
            </button>
        </div>
    )
}
