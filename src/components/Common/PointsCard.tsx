import Card from '../Global/Card'
import InvitesIcon from '../Home/InvitesIcon'

const PointsCard = ({ points, pointsDivRef }: { points: number; pointsDivRef: React.RefObject<HTMLDivElement> }) => {
    return (
        <Card ref={pointsDivRef} className="flex flex-row items-center justify-center gap-3 p-3">
            <InvitesIcon />
            <p className="text-sm font-medium text-black">
                You&apos;ve earned {points} {points === 1 ? 'point' : 'points'}!
            </p>
        </Card>
    )
}

export default PointsCard
