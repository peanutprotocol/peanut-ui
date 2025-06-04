import { NextRequest, NextResponse } from 'next/server'

interface TransferDetails {
    id: string
    timestamp: string
    chain: string
    details: any
}

interface Portfolio {
    id: string
    ownerAddress: string
    assetActivities: TransferDetails[]
}

const query = `
    query RecentTokenTransfers($address: String!) {
      portfolios(
        ownerAddresses: [$address]
        chains: [ETHEREUM, POLYGON, ARBITRUM, OPTIMISM, BASE, BNB]
      ) {
        id
        ownerAddress
        assetActivities(
          pageSize: 100
          page: 1
          chains: [ETHEREUM, POLYGON, ARBITRUM, OPTIMISM, BASE, BNB]
        ) {
          id
          timestamp
          chain
          details {
            ... on TransactionDetails {
              to
              type
              hash
              from
              status
              assetChanges {
                __typename
                ... on TokenTransfer {
                  id
                  asset {
                    id
                    symbol
                    address
                    decimals
                    chain
                    project {
                      id
                      isSpam
                      spamCode
                      __typename
                    }
                    __typename
                  }
                  tokenStandard
                  quantity
                  sender
                  recipient
                  direction
                  transactedValue {
                    currency
                    value
                    __typename
                  }
                  __typename
                }
              }
              __typename
            }
            __typename
          }
          __typename
        }
        __typename
      }
    }
  `

export async function POST(request: NextRequest, response: NextResponse) {
    const body = await request.json()

    try {
        const response = await fetch('https://interface.gateway.uniswap.org/v1/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: '*/*',
                'Accept-Language': 'en-US,en;q=0.9,de-DE;q=0.8,de;q=0.7,es-ES;q=0.6,es;q=0.5,pt;q=0.4',
                'Cache-Control': 'no-cache',
                Pragma: 'no-cache',
                Origin: 'https://app.uniswap.org',
                Referer: 'https://app.uniswap.org/',
            },
            body: JSON.stringify({
                operationName: 'RecentTokenTransfers',
                variables: { address: body.address },
                query,
            }),
        })

        const responseJson = await response.text()

        return new Response(responseJson, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    } catch (error: any) {
        console.error('Error occurred while fetching recent transactions:', error)

        return NextResponse.json({
            status: 500,
            body: {
                error: 'Error occurred while fetching recent transactions',
            },
        })
    }
}
