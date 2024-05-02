import Icon from '../../Icon'

export const SimpleTokenSelectorButton = ({ onClick, isVisible }: { onClick: () => void; isVisible: boolean }) => {
    return (
        <button className="btn-purple btn-xl flex w-max flex-row items-center justify-center gap-2" onClick={onClick}>
            <label className="text-h6 font-black">Select Token</label>
            <Icon
                name={'arrow-bottom'}
                className={`transition-transform dark:fill-white ${isVisible ? 'rotate-180 ' : ''}`}
            />
        </button>
    )
}

export default SimpleTokenSelectorButton
