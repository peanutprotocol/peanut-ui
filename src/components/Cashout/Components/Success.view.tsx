import * as _consts from '../Cashout.consts'

export const SuccessCashoutView = ({ onPrev }: _consts.ICashoutScreenProps) => {
    return (
        <div>
            <button onClick={onPrev}>Prev</button>
        </div>
    )
}
