import * as _consts from '../Cashout.consts'

export const InitialCashoutView = ({ onNext }: _consts.ICashoutScreenProps) => {
    return (
        <div>
            <button onClick={onNext}>Next</button>
        </div>
    )
}
