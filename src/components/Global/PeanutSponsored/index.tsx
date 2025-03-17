import Icon from '../Icon'

const PeanutSponsored = () => {
    return (
        <div className="flex items-center justify-center gap-1 text-gray-1">
            <Icon name="gas" className="h-5 w-5" fill="currentColor" />
            <label className="text-xs">This transaction is sponsored by Peanut. Enjoy!</label>
        </div>
    )
}

export default PeanutSponsored
