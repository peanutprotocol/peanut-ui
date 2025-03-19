import { Card } from '../0_Bruddle'
interface PintaReqViewWrapperProps {
    children: React.ReactNode
    view: 'INITIAL' | 'CONFIRM' | 'SUCCESS' | 'ERROR'
}

const PintaReqViewWrapper = ({ children, view }: PintaReqViewWrapperProps) => {
    const viewContentMap = {
        INITIAL: {
            title: 'Claim Beer',
            description: 'Exchange your Pinta Tokens for cold beer at this bar. Each token gets you drink.',
        },
        CONFIRM: {
            title: 'Claim Beer',
            description: 'Exchange your Pinta Tokens for cold beer at this bar. Each token gets you drink.',
        },
        SUCCESS: {
            title: 'Your beer is on its way!',
            description: 'Enjoy it! Nothing goes better with a beer than a handful of Peanuts.',
        },
        ERROR: {
            title: 'There was an error',
            description: 'Please try again later.',
        },
    }

    const { title, description } = viewContentMap[view] || viewContentMap.INITIAL

    return (
        <Card>
            <Card.Header>
                <Card.Title className="font-extrabold">{title}</Card.Title>
                <Card.Description>{description}</Card.Description>
            </Card.Header>
            <Card.Content className="space-y-4">{children}</Card.Content>
        </Card>
    )
}

export default PintaReqViewWrapper
