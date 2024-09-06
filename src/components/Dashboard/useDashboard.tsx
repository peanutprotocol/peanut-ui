import { getLinkDetails, peanut } from '@squirrel-labs/peanut-sdk'

import * as interfaces from '@/interfaces'
import * as consts from '@/constants'
import * as utils from '@/utils'

export const useDashboard = () => {
    const fetchLinkDetailsAsync = async (visibleData: interfaces.IDashboardItem[]) => {
        // only fetching details for send links that are visible on the current page
        const _data1 = visibleData.filter((item) => item.type == 'Link Sent')
        try {
            await Promise.all(
                _data1.map(async (item) => {
                    try {
                        const linkDetails = await getLinkDetails({ link: item.link ?? '' })
                        item.status = linkDetails.claimed ? 'claimed' : 'pending'
                    } catch (error) {
                        console.error(error)
                    }
                })
            )
        } catch (error) {
            console.error('Error fetching link details:', error)
        }

        const _data2 = visibleData.filter((item) => item.type == 'Request Link')

        try {
            await Promise.all(
                _data2.map(async (item) => {
                    try {
                        const linkDetails = await peanut.getRequestLinkDetails({
                            link: item.link ?? '',
                            apiUrl: '/api/proxy/get',
                        })
                        item.status = linkDetails.status === 'PAID' ? 'paid' : 'pending'
                    } catch (error) {
                        console.error(error)
                    }
                })
            )
        } catch (error) {}

        const _data = [..._data1, ..._data2]

        return _data
    }

    const composeLinkDataArray = (address: string) => {
        const claimedLinks = utils.getClaimedLinksFromLocalStorage({ address: address })!
        const createdLinks = utils.getCreatedLinksFromLocalStorage({ address: address })!
        const directSends = utils.getDirectSendFromLocalStorage({ address: address })!
        const offrampClaims = utils.getOfframpClaimsFromLocalStorage()!
        const requestLinks = utils.getRequestLinksFromLocalStorage()!
        const requestLinkFulfillments = utils.getRequestLinkFulfillmentsFromLocalStorage()!

        let linkData: interfaces.IDashboardItem[] = []

        claimedLinks.forEach((link) => {
            linkData.push({
                link: link.link,
                type: 'Link Received',
                amount: link.tokenAmount,
                tokenSymbol: link.tokenSymbol,
                chain: consts.supportedPeanutChains.find((chain) => chain.chainId === link.chainId)?.name ?? '',
                date: link.depositDate.toString(),
                address: link.senderAddress,
                status: 'claimed',
                message: link.message,
                attachmentUrl: link.attachmentUrl,
                points: link.points,
                txHash: link.txHash,
            })
        })

        offrampClaims.forEach((link) => {
            linkData.push({
                link: link.link,
                type: 'Offramp Claim',
                amount: link.tokenAmount,
                tokenSymbol: link.tokenSymbol,
                chain: consts.supportedPeanutChains.find((chain) => chain.chainId === link.chainId)?.name ?? '',
                date: link.depositDate.toString(),
                address: link.senderAddress,
                status: 'claimed',
                message: link.message,
                attachmentUrl: link.attachmentUrl,
                points: link.points,
                txHash: link.txHash,
            })
        })

        createdLinks.forEach((link) => {
            linkData.push({
                link: link.link,
                type: 'Link Sent',
                amount: link.tokenAmount.toString(),
                tokenSymbol:
                    consts.peanutTokenDetails
                        .find((token) => token.chainId === link.chainId)
                        ?.tokens.find((token) => utils.compareTokenAddresses(token.address, link.tokenAddress ?? ''))
                        ?.symbol ?? '',
                chain: consts.supportedPeanutChains.find((chain) => chain.chainId === link.chainId)?.name ?? '',
                date: link.depositDate.toString(),
                address: undefined,
                status: undefined,
                message: link.message,
                attachmentUrl: link.attachmentUrl,
                points: link.points,
                txHash: link.txHash,
            })
        })

        directSends.forEach((link) => {
            linkData.push({
                link: undefined,
                type: 'Direct Sent',
                amount: link.tokenAmount.toString(),
                tokenSymbol:
                    consts.peanutTokenDetails
                        .find((token) => token.chainId === link.chainId)
                        ?.tokens.find((token) => utils.compareTokenAddresses(token.address, link.tokenAddress))
                        ?.symbol ?? '',
                chain: consts.supportedPeanutChains.find((chain) => chain.chainId === link.chainId)?.name ?? '',
                date: link.date.toString(),
                address: undefined,
                status: 'transfer',
                message: undefined,
                attachmentUrl: undefined,
                points: link.points,
                txHash: link.txHash,
            })
        })

        requestLinks.forEach((link) => {
            linkData.push({
                link: link.link,
                type: 'Request Link',
                amount: link.tokenAmount.toString(),
                tokenSymbol:
                    consts.peanutTokenDetails
                        .find((token) => token.chainId === link.chainId)
                        ?.tokens.find((token) => utils.compareTokenAddresses(token.address, link.tokenAddress))
                        ?.symbol ?? '',
                chain: consts.supportedPeanutChains.find((chain) => chain.chainId === link.chainId)?.name ?? '',
                date: link.createdAt.toString(),
                address: link.recipientAddress,
                status: undefined,
                message: link.reference ?? '',
                attachmentUrl: link.attachmentUrl ?? '',
                points: 0,
                txHash: '',
            })
        })

        requestLinkFulfillments.forEach((link) => {
            linkData.push({
                link: link.link,
                type: 'Request Link Fulfillment',
                amount: link.tokenAmount.toString(),
                tokenSymbol:
                    consts.peanutTokenDetails
                        .find((token) => token.chainId === link.chainId)
                        ?.tokens.find((token) => utils.compareTokenAddresses(token.address, link.tokenAddress))
                        ?.symbol ?? '',
                chain: consts.supportedPeanutChains.find((chain) => chain.chainId === link.chainId)?.name ?? '',
                date: link.createdAt.toString(),
                address: link.recipientAddress,
                status: 'paid',
                message: link.reference ?? '',
                attachmentUrl: link.attachmentUrl ?? '',
                points: 0,
                txHash: link.destinationChainFulfillmentHash ?? '',
            })
        })

        linkData = sortDashboardData('Date: new to old', linkData)

        return linkData
    }

    const sortDashboardData = (sortingValue: string, dashboardData: interfaces.IDashboardItem[]) => {
        const _dashboardData = [...dashboardData]
        switch (sortingValue) {
            case 'Date: new to old':
                _dashboardData.sort((a, b) => {
                    const dateA = new Date(a.date).getTime()
                    const dateB = new Date(b.date).getTime()
                    if (dateA === dateB) {
                        // If dates are equal, sort by time
                        return new Date(b.date).getTime() - new Date(a.date).getTime()
                    } else {
                        // Otherwise, sort by date
                        return dateB - dateA
                    }
                })
                break
            case 'Date: old to new':
                _dashboardData.sort((a, b) => {
                    const dateA = new Date(a.date).getTime()
                    const dateB = new Date(b.date).getTime()
                    if (dateA === dateB) {
                        // If dates are equal, sort by time
                        return new Date(a.date).getTime() - new Date(b.date).getTime()
                    } else {
                        // Otherwise, sort by date
                        return dateA - dateB
                    }
                })
                break

            case 'Amount: low to high':
                _dashboardData.sort((a, b) => {
                    return Number(a.amount) - Number(b.amount)
                })
                break
            case 'Amount: high to low':
                _dashboardData.sort((a, b) => {
                    return Number(b.amount) - Number(a.amount)
                })
                break
            case 'Type: Link Sent':
                _dashboardData.sort((a, b) => {
                    return a.type === 'Link Sent' ? -1 : 1
                })
                break
            case 'Type: Link Received':
                _dashboardData.sort((a, b) => {
                    return a.type === 'Link Received' ? -1 : 1
                })
                break
            default:
                break
        }
        // setDashboardData(_dashboardData)
        return _dashboardData
    }

    const filterDashboardData = (
        filterValue: string,
        dashboardData: interfaces.IDashboardItem[],
        itemsPerPage: number
    ) => {
        const _dashboardData = [...dashboardData]
        const filteredData = _dashboardData.filter((item) => {
            return (
                item.amount.includes(filterValue.toLowerCase()) ||
                item.chain.toLowerCase().includes(filterValue.toLowerCase()) ||
                item.date.includes(filterValue) ||
                item.tokenSymbol.toLowerCase().includes(filterValue.toLowerCase()) ||
                item.type.toLowerCase().includes(filterValue.toLowerCase()) ||
                (item.address && item.address.toLowerCase().includes(filterValue.toLowerCase()))
            )
        })

        return filteredData
    }
    return {
        fetchLinkDetailsAsync,
        composeLinkDataArray,
        sortDashboardData,
        filterDashboardData,
    }
}
