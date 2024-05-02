'use client'
import { useState } from 'react'
import Icon from '../Global/Icon'
import Sorting from '../Global/Sorting'
import TablePagination from '../Global/TablePagination'
import { Menu, Transition } from '@headlessui/react'

import * as utils from '@/utils'
import * as consts from '@/constants'
import { useAccount } from 'wagmi'
import Search from '../Global/Search'
import { ILinkDetails } from '@/interfaces'

export const linkDetails = [
    {
        link: 'http://localhost:3000/claim?c=137&v=v4.3&i=2798&t=ui#p=eYjrgjdBejeYior5',
        chainId: '137',
        depositIndex: 2798,
        contractVersion: 'v4.3',
        password: 'eYjrgjdBejeYior5',
        senderAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        tokenType: 0,
        tokenAddress: '0x0000000000000000000000000000000000000000',
        tokenDecimals: 18,
        tokenSymbol: 'MATIC',
        tokenName: 'MATIC',
        tokenAmount: '0.151224',
        tokenId: 0,
        claimed: true,
        depositDate: new Date('2024-04-30T13:26:35.000Z'),
        tokenURI: null,
        metadata: null,
        rawOnchainDepositInfo: {
            pubKey20: '0x187D565389c27c5EC6C20a9F5A3BE5b7f83F8b34',
            amount: '151224000000000000',
            tokenAddress: '0x0000000000000000000000000000000000000000',
            contractType: '0',
            claimed: 'true',
            requiresMFA: 'false',
            timestamp: '1714483595',
            tokenId: '0',
            senderAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        },
        recipient: undefined,
        reclaimableAfter: undefined,
    },
    {
        link: 'http://localhost:3000/claim?c=137&v=v4.3&i=2798&t=ui#p=eYjrgjdBejeYior5',
        chainId: '137',
        depositIndex: 2798,
        contractVersion: 'v4.3',
        password: 'eYjrgjdBejeYior5',
        senderAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        tokenType: 0,
        tokenAddress: '0x0000000000000000000000000000000000000000',
        tokenDecimals: 18,
        tokenSymbol: 'MATIC',
        tokenName: 'MATIC',
        tokenAmount: '0.151224',
        tokenId: 0,
        claimed: true,
        depositDate: new Date('2024-04-30T13:26:35.000Z'),
        tokenURI: null,
        metadata: null,
        rawOnchainDepositInfo: {
            pubKey20: '0x187D565389c27c5EC6C20a9F5A3BE5b7f83F8b34',
            amount: '151224000000000000',
            tokenAddress: '0x0000000000000000000000000000000000000000',
            contractType: '0',
            claimed: 'true',
            requiresMFA: 'false',
            timestamp: '1714483595',
            tokenId: '0',
            senderAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        },
        recipient: undefined,
        reclaimableAfter: undefined,
    },
    {
        link: 'http://localhost:3000/claim?c=137&v=v4.3&i=2798&t=ui#p=eYjrgjdBejeYior5',
        chainId: '137',
        depositIndex: 2798,
        contractVersion: 'v4.3',
        password: 'eYjrgjdBejeYior5',
        senderAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        tokenType: 0,
        tokenAddress: '0x0000000000000000000000000000000000000000',
        tokenDecimals: 18,
        tokenSymbol: 'MATIC',
        tokenName: 'MATIC',
        tokenAmount: '0.151224',
        tokenId: 0,
        claimed: true,
        depositDate: new Date('2024-04-30T13:26:35.000Z'),
        tokenURI: null,
        metadata: null,
        rawOnchainDepositInfo: {
            pubKey20: '0x187D565389c27c5EC6C20a9F5A3BE5b7f83F8b34',
            amount: '151224000000000000',
            tokenAddress: '0x0000000000000000000000000000000000000000',
            contractType: '0',
            claimed: 'true',
            requiresMFA: 'false',
            timestamp: '1714483595',
            tokenId: '0',
            senderAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        },
        recipient: undefined,
        reclaimableAfter: undefined,
    },
    {
        link: 'http://localhost:3000/claim?c=137&v=v4.3&i=2798&t=ui#p=eYjrgjdBejeYior5',
        chainId: '137',
        depositIndex: 2798,
        contractVersion: 'v4.3',
        password: 'eYjrgjdBejeYior5',
        senderAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        tokenType: 0,
        tokenAddress: '0x0000000000000000000000000000000000000000',
        tokenDecimals: 18,
        tokenSymbol: 'MATIC',
        tokenName: 'MATIC',
        tokenAmount: '0.151224',
        tokenId: 0,
        claimed: true,
        depositDate: new Date('2024-04-30T13:26:35.000Z'),
        tokenURI: null,
        metadata: null,
        rawOnchainDepositInfo: {
            pubKey20: '0x187D565389c27c5EC6C20a9F5A3BE5b7f83F8b34',
            amount: '151224000000000000',
            tokenAddress: '0x0000000000000000000000000000000000000000',
            contractType: '0',
            claimed: 'true',
            requiresMFA: 'false',
            timestamp: '1714483595',
            tokenId: '0',
            senderAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        },
        recipient: undefined,
        reclaimableAfter: undefined,
    },
    {
        link: 'http://localhost:3000/claim?c=137&v=v4.3&i=2798&t=ui#p=eYjrgjdBejeYior5',
        chainId: '137',
        depositIndex: 2798,
        contractVersion: 'v4.3',
        password: 'eYjrgjdBejeYior5',
        senderAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        tokenType: 0,
        tokenAddress: '0x0000000000000000000000000000000000000000',
        tokenDecimals: 18,
        tokenSymbol: 'MATIC',
        tokenName: 'MATIC',
        tokenAmount: '0.151224',
        tokenId: 0,
        claimed: true,
        depositDate: new Date('2024-04-30T13:26:35.000Z'),
        tokenURI: null,
        metadata: null,
        rawOnchainDepositInfo: {
            pubKey20: '0x187D565389c27c5EC6C20a9F5A3BE5b7f83F8b34',
            amount: '151224000000000000',
            tokenAddress: '0x0000000000000000000000000000000000000000',
            contractType: '0',
            claimed: 'true',
            requiresMFA: 'false',
            timestamp: '1714483595',
            tokenId: '0',
            senderAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        },
        recipient: undefined,
        reclaimableAfter: undefined,
    },
    {
        link: 'http://localhost:3000/claim?c=137&v=v4.3&i=2798&t=ui#p=eYjrgjdBejeYior5',
        chainId: '137',
        depositIndex: 2798,
        contractVersion: 'v4.3',
        password: 'eYjrgjdBejeYior5',
        senderAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        tokenType: 0,
        tokenAddress: '0x0000000000000000000000000000000000000000',
        tokenDecimals: 18,
        tokenSymbol: 'MATIC',
        tokenName: 'MATIC',
        tokenAmount: '0.151224',
        tokenId: 0,
        claimed: true,
        depositDate: new Date('2024-04-30T13:26:35.000Z'),
        tokenURI: null,
        metadata: null,
        rawOnchainDepositInfo: {
            pubKey20: '0x187D565389c27c5EC6C20a9F5A3BE5b7f83F8b34',
            amount: '151224000000000000',
            tokenAddress: '0x0000000000000000000000000000000000000000',
            contractType: '0',
            claimed: 'true',
            requiresMFA: 'false',
            timestamp: '1714483595',
            tokenId: '0',
            senderAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        },
        recipient: undefined,
        reclaimableAfter: undefined,
    },
    {
        link: 'http://localhost:3000/claim?c=137&v=v4.3&i=2798&t=ui#p=eYjrgjdBejeYior5',
        chainId: '137',
        depositIndex: 2798,
        contractVersion: 'v4.3',
        password: 'eYjrgjdBejeYior5',
        senderAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        tokenType: 0,
        tokenAddress: '0x0000000000000000000000000000000000000000',
        tokenDecimals: 18,
        tokenSymbol: 'MATIC',
        tokenName: 'MATIC',
        tokenAmount: '0.151224',
        tokenId: 0,
        claimed: true,
        depositDate: new Date('2024-04-30T13:26:35.000Z'),
        tokenURI: null,
        metadata: null,
        rawOnchainDepositInfo: {
            pubKey20: '0x187D565389c27c5EC6C20a9F5A3BE5b7f83F8b34',
            amount: '151224000000000000',
            tokenAddress: '0x0000000000000000000000000000000000000000',
            contractType: '0',
            claimed: 'true',
            requiresMFA: 'false',
            timestamp: '1714483595',
            tokenId: '0',
            senderAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        },
        recipient: undefined,
        reclaimableAfter: undefined,
    },
    {
        link: 'http://localhost:3000/claim?c=137&v=v4.3&i=2798&t=ui#p=eYjrgjdBejeYior5',
        chainId: '137',
        depositIndex: 2798,
        contractVersion: 'v4.3',
        password: 'eYjrgjdBejeYior5',
        senderAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        tokenType: 0,
        tokenAddress: '0x0000000000000000000000000000000000000000',
        tokenDecimals: 18,
        tokenSymbol: 'MATIC',
        tokenName: 'MATIC',
        tokenAmount: '0.151224',
        tokenId: 0,
        claimed: true,
        depositDate: new Date('2024-04-30T13:26:35.000Z'),
        tokenURI: null,
        metadata: null,
        rawOnchainDepositInfo: {
            pubKey20: '0x187D565389c27c5EC6C20a9F5A3BE5b7f83F8b34',
            amount: '151224000000000000',
            tokenAddress: '0x0000000000000000000000000000000000000000',
            contractType: '0',
            claimed: 'true',
            requiresMFA: 'false',
            timestamp: '1714483595',
            tokenId: '0',
            senderAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        },
        recipient: undefined,
        reclaimableAfter: undefined,
    },
    {
        link: 'http://localhost:3000/claim?c=137&v=v4.3&i=2798&t=ui#p=eYjrgjdBejeYior5',
        chainId: '137',
        depositIndex: 2798,
        contractVersion: 'v4.3',
        password: 'eYjrgjdBejeYior5',
        senderAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        tokenType: 0,
        tokenAddress: '0x0000000000000000000000000000000000000000',
        tokenDecimals: 18,
        tokenSymbol: 'MATIC',
        tokenName: 'MATIC',
        tokenAmount: '0.151224',
        tokenId: 0,
        claimed: true,
        depositDate: new Date('2024-04-30T13:26:35.000Z'),
        tokenURI: null,
        metadata: null,
        rawOnchainDepositInfo: {
            pubKey20: '0x187D565389c27c5EC6C20a9F5A3BE5b7f83F8b34',
            amount: '151224000000000000',
            tokenAddress: '0x0000000000000000000000000000000000000000',
            contractType: '0',
            claimed: 'true',
            requiresMFA: 'false',
            timestamp: '1714483595',
            tokenId: '0',
            senderAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        },
        recipient: undefined,
        reclaimableAfter: undefined,
    },
    {
        link: 'http://localhost:3000/claim?c=137&v=v4.3&i=2798&t=ui#p=eYjrgjdBejeYior5',
        chainId: '137',
        depositIndex: 2798,
        contractVersion: 'v4.3',
        password: 'eYjrgjdBejeYior5',
        senderAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        tokenType: 0,
        tokenAddress: '0x0000000000000000000000000000000000000000',
        tokenDecimals: 18,
        tokenSymbol: 'MATIC',
        tokenName: 'MATIC',
        tokenAmount: '0.151224',
        tokenId: 0,
        claimed: true,
        depositDate: new Date('2024-04-30T13:26:35.000Z'),
        tokenURI: null,
        metadata: null,
        rawOnchainDepositInfo: {
            pubKey20: '0x187D565389c27c5EC6C20a9F5A3BE5b7f83F8b34',
            amount: '151224000000000000',
            tokenAddress: '0x0000000000000000000000000000000000000000',
            contractType: '0',
            claimed: 'true',
            requiresMFA: 'false',
            timestamp: '1714483595',
            tokenId: '0',
            senderAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        },
        recipient: undefined,
        reclaimableAfter: undefined,
    },
    {
        link: 'http://localhost:3000/claim?c=137&v=v4.3&i=2798&t=ui#p=eYjrgjdBejeYior5',
        chainId: '137',
        depositIndex: 2798,
        contractVersion: 'v4.3',
        password: 'eYjrgjdBejeYior5',
        senderAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        tokenType: 0,
        tokenAddress: '0x0000000000000000000000000000000000000000',
        tokenDecimals: 18,
        tokenSymbol: 'MATIC',
        tokenName: 'MATIC',
        tokenAmount: '0.151224',
        tokenId: 0,
        claimed: true,
        depositDate: new Date('2024-04-30T13:26:35.000Z'),
        tokenURI: null,
        metadata: null,
        rawOnchainDepositInfo: {
            pubKey20: '0x187D565389c27c5EC6C20a9F5A3BE5b7f83F8b34',
            amount: '151224000000000000',
            tokenAddress: '0x0000000000000000000000000000000000000000',
            contractType: '0',
            claimed: 'true',
            requiresMFA: 'false',
            timestamp: '1714483595',
            tokenId: '0',
            senderAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        },
        recipient: undefined,
        reclaimableAfter: undefined,
    },
    {
        link: 'http://localhost:3000/claim?c=137&v=v4.3&i=2798&t=ui#p=eYjrgjdBejeYior5',
        chainId: '137',
        depositIndex: 2798,
        contractVersion: 'v4.3',
        password: 'eYjrgjdBejeYior5',
        senderAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        tokenType: 0,
        tokenAddress: '0x0000000000000000000000000000000000000000',
        tokenDecimals: 18,
        tokenSymbol: 'MATIC',
        tokenName: 'MATIC',
        tokenAmount: '0.151224',
        tokenId: 0,
        claimed: true,
        depositDate: new Date('2024-04-30T13:26:35.000Z'),
        tokenURI: null,
        metadata: null,
        rawOnchainDepositInfo: {
            pubKey20: '0x187D565389c27c5EC6C20a9F5A3BE5b7f83F8b34',
            amount: '151224000000000000',
            tokenAddress: '0x0000000000000000000000000000000000000000',
            contractType: '0',
            claimed: 'true',
            requiresMFA: 'false',
            timestamp: '1714483595',
            tokenId: '0',
            senderAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        },
        recipient: undefined,
        reclaimableAfter: undefined,
    },
    {
        link: 'http://localhost:3000/claim?c=137&v=v4.3&i=2798&t=ui#p=eYjrgjdBejeYior5',
        chainId: '137',
        depositIndex: 2798,
        contractVersion: 'v4.3',
        password: 'eYjrgjdBejeYior5',
        senderAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        tokenType: 0,
        tokenAddress: '0x0000000000000000000000000000000000000000',
        tokenDecimals: 18,
        tokenSymbol: 'MATIC',
        tokenName: 'MATIC',
        tokenAmount: '0.151224',
        tokenId: 0,
        claimed: true,
        depositDate: new Date('2024-04-30T13:26:35.000Z'),
        tokenURI: null,
        metadata: null,
        rawOnchainDepositInfo: {
            pubKey20: '0x187D565389c27c5EC6C20a9F5A3BE5b7f83F8b34',
            amount: '151224000000000000',
            tokenAddress: '0x0000000000000000000000000000000000000000',
            contractType: '0',
            claimed: 'true',
            requiresMFA: 'false',
            timestamp: '1714483595',
            tokenId: '0',
            senderAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        },
        recipient: undefined,
        reclaimableAfter: undefined,
    },
    {
        link: 'http://localhost:3000/claim?c=137&v=v4.3&i=2798&t=ui#p=eYjrgjdBejeYior5',
        chainId: '137',
        depositIndex: 2798,
        contractVersion: 'v4.3',
        password: 'eYjrgjdBejeYior5',
        senderAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        tokenType: 0,
        tokenAddress: '0x0000000000000000000000000000000000000000',
        tokenDecimals: 18,
        tokenSymbol: 'MATIC',
        tokenName: 'MATIC',
        tokenAmount: '0.151224',
        tokenId: 0,
        claimed: true,
        depositDate: new Date('2024-04-30T13:26:35.000Z'),
        tokenURI: null,
        metadata: null,
        rawOnchainDepositInfo: {
            pubKey20: '0x187D565389c27c5EC6C20a9F5A3BE5b7f83F8b34',
            amount: '151224000000000000',
            tokenAddress: '0x0000000000000000000000000000000000000000',
            contractType: '0',
            claimed: 'true',
            requiresMFA: 'false',
            timestamp: '1714483595',
            tokenId: '0',
            senderAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        },
        recipient: undefined,
        reclaimableAfter: undefined,
    },
]

const sortingTypes = [
    'Date: new to old',
    'Date: old to new',
    'Amount: low to high',
    'Amount: high to low',
    'Type: send',
    'Type: receive',
]

const getLinkType = (link: string) => {}

export const Dashboard = () => {
    const [filterValue, setFilterValue] = useState('')
    const [sortingValue, setSortingValue] = useState<string>(sortingTypes[0])
    const { address } = useAccount()

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 p-4">
            <div className="flex w-full flex-row items-start justify-between">
                <div className="flex flex-col items-start justify-center">
                    <label className="text-h2">Link History</label>
                    <label className="text-h7 font-normal">Here are all the links you have created or claimed.</label>
                </div>
                <button className="btn-purple btn-xl hidden w-max flex-row items-center justify-center px-4 sm:flex">
                    Create Link
                    <Icon name={'plus-circle'} className="h-4 fill-white" />
                </button>
            </div>

            <div className="flex w-full flex-col items-center justify-center gap-3">
                <div className="flex w-full flex-col-reverse items-center justify-center gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <SortComponent
                        sortingValue={sortingValue}
                        setSortingValue={(sortingValue: string) => {
                            setSortingValue(sortingValue)
                        }}
                        buttonClassName="w-full sm:w-max"
                    />

                    <Search
                        onChange={(e: any) => setFilterValue(e.target.value)}
                        onSubmit={() => {}}
                        placeholder="Search"
                        value={filterValue}
                        medium={true}
                        border={true}
                        className=" bg-white "
                    />
                </div>
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
                                <Sorting title="Date Created" />
                            </th>
                            <th className="th-custom ">
                                <Sorting title="Date Claimed" />
                            </th>
                            <th className="th-custom ">
                                <Sorting title="To/From" />
                            </th>{' '}
                            <th className="th-custom ">
                                <Sorting title="Status" />
                            </th>
                            <th className="th-custom"></th>{' '}
                        </tr>
                    </thead>
                    <tbody>
                        {linkDetails.map((link) => (
                            <tr className="text-h8 font-normal" key={link.link}>
                                <td className="td-custom font-bold">
                                    {link.senderAddress === address ? 'Send' : 'Receive'}
                                </td>
                                <td className="td-custom font-bold">
                                    {utils.formatTokenAmount(Number(link.tokenAmount), 4)} {link.tokenSymbol}
                                    {' - '}
                                    {consts.supportedPeanutChains.find((chain) => chain.chainId === link.chainId)?.name}
                                </td>
                                <td className="td-custom">{formatDate(link.depositDate)}</td>
                                <td className="td-custom">{formatDate(link.depositDate)}</td>
                                <td className="td-custom">{utils.shortenAddressLong(link.senderAddress)}</td>
                                <td className="td-custom">
                                    {link.claimed ? (
                                        <div className="border-green-3 text-green-3 border border-n-1 px-2 py-1 text-center">
                                            claimed
                                        </div>
                                    ) : (
                                        <div className="border border-gray-1 border-n-1 p-2 text-gray-1">pending</div>
                                    )}
                                </td>{' '}
                                <td className="td-custom text-center ">
                                    <OptionsItem />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="block w-full sm:hidden">
                    {linkDetails.map((link) => (
                        <MobileItem linkDetail={link} address={address ?? ''} />
                    ))}
                </div>
                <label className="cursor-pointer self-end text-purple-1">Download CSV</label>
            </div>
            <TablePagination onNext={() => {}} onPrev={() => {}} totalPages={10} currentPage={1} />

            <button className="flex cursor-pointer flex-row items-center justify-center gap-1" onClick={() => {}}>
                <Icon name={'question-circle'} />
                <label>Click here if you had a problem creating a link.</label>
            </button>
        </div>
    )
}

const SortComponent = ({
    sortingValue,
    setSortingValue,
    buttonClassName,
}: {
    sortingValue: string
    setSortingValue: any
    buttonClassName: string
}) => {
    return (
        <Menu className="relative w-full" as="div">
            <Menu.Button
                className={`btn-purple-2 flex h-max flex-row items-center justify-center px-4 py-2 text-h8 font-normal ${buttonClassName}`}
            >
                Sort by: {sortingValue}
            </Menu.Button>
            <Transition
                enter="transition duration-100 ease-out"
                enterFrom="transform scale-95 opacity-0"
                enterTo="transform scale-100 opacity-100"
                leave="transition duration-75 ease-out"
                leaveFrom="transform scale-100 opacity-100"
                leaveTo="transform scale-95 opacity-0"
            >
                <Menu.Items className=" shadow-primary-4 absolute left-0 top-full z-30 mt-2.5 max-h-96 w-[14.69rem] divide-y divide-black overflow-auto rounded-sm border border-n-1 bg-white dark:divide-white dark:border-white dark:bg-n-1 ">
                    {sortingTypes.map((type) => (
                        <Menu.Item
                            as={'button'}
                            onClick={() => {
                                setSortingValue(type)
                            }}
                            className=" flex h-12 w-full items-center gap-2 px-4 text-sm font-bold transition-colors last:mb-0 hover:bg-n-3/10 dark:hover:bg-white/20"
                            key={type}
                        >
                            <div className="text-h8">{type}</div>
                        </Menu.Item>
                    ))}
                </Menu.Items>
            </Transition>
        </Menu>
    )
}

const OptionsItem = () => {
    return (
        <Menu className="relative" as="div">
            <Menu.Button className={''}>
                <Icon name={'dots'} className="cursor-pointer" />
            </Menu.Button>
            <Transition
                enter="transition duration-100 ease-out"
                enterFrom="transform scale-95 opacity-0"
                enterTo="transform scale-100 opacity-100"
                leave="transition duration-75 ease-out"
                leaveFrom="transform scale-100 opacity-100"
                leaveTo="transform scale-95 opacity-0"
            >
                <Menu.Items className="shadow-primary-4 absolute right-12 top-full z-30 mt-2.5 max-h-96 w-[14.69rem] divide-y divide-black overflow-auto rounded-sm border border-n-1 bg-white dark:divide-white dark:border-white dark:bg-n-1">
                    <Menu.Item
                        as={'button'}
                        onClick={() => {
                            console.log('clicked')
                        }}
                        className="flex h-12 w-full items-center gap-2 px-4 text-sm font-bold transition-colors last:mb-0 hover:bg-n-3/10 dark:hover:bg-white/20"
                    >
                        <div className="text-h8">Claim</div>
                    </Menu.Item>
                    <Menu.Item
                        as={'button'}
                        onClick={() => {
                            console.log('clicked')
                        }}
                        className="flex h-12 w-full items-center gap-2 px-4 text-sm font-bold transition-colors last:mb-0 hover:bg-n-3/10 dark:hover:bg-white/20"
                    >
                        <div className="text-h8">Copy Link</div>
                    </Menu.Item>
                    <Menu.Item
                        as={'button'}
                        onClick={() => {
                            console.log('clicked')
                        }}
                        className="flex h-12 w-full items-center gap-2 px-4 text-sm font-bold transition-colors last:mb-0 hover:bg-n-3/10 dark:hover:bg-white/20"
                    >
                        <div className="text-h8">Delete</div>
                    </Menu.Item>
                </Menu.Items>
            </Transition>
        </Menu>
    )
}

function formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0') // JavaScript months are zero-indexed
    const year = date.getFullYear()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const seconds = date.getSeconds().toString().padStart(2, '0')

    return `${day} ${month} ${year} ${hours}:${minutes}:${seconds}`
}

const MobileItem = ({ linkDetail, address }: { linkDetail: ILinkDetails; address: string }) => {
    return (
        <div className=" flex flex w-full flex-col gap-2 border border-n-1 bg-white px-2 py-4 text-h8 font-normal dark:bg-black">
            <div className="flex w-full flex-row items-center justify-between">
                <label className="font-bold">{linkDetail.senderAddress === address ? 'Send' : 'Receive'}</label>
                <label>{formatDate(linkDetail.depositDate)}</label>
            </div>
            <div className="flex w-full border-t border-dotted border-black" />
            <div className="flex w-full flex-row items-end justify-between">
                <div className="flex flex-col items-start justify-end gap-2 text-start">
                    <label>
                        {utils.formatTokenAmount(Number(linkDetail.tokenAmount), 4)} {linkDetail.tokenSymbol} [
                        {consts.supportedPeanutChains.find((chain) => chain.chainId === linkDetail.chainId)?.name}]
                    </label>
                    <label>To: {utils.shortenAddressLong(linkDetail.senderAddress)}</label>
                </div>
                <div className="flex flex-col items-end justify-end gap-2 text-end">
                    <div>
                        {linkDetail.claimed ? (
                            <div className="border-green-3 text-green-3 border border-n-1 px-2 py-1 text-center">
                                claimed
                            </div>
                        ) : (
                            <div className="border border-gray-1 border-n-1 p-2 text-gray-1">pending</div>
                        )}
                    </div>
                    <div>{formatDate(linkDetail.depositDate)}</div>
                </div>
            </div>
        </div>
    )
}
