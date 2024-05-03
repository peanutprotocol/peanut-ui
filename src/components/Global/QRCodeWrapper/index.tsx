import QRCode from 'react-qr-code'

interface QRCodeWrapperProps {
    url: string
}

const QRCodeWrapper = ({ url }: QRCodeWrapperProps) => {
    return (
        <div
            style={{
                height: 'auto',
                margin: '0 auto',
                maxWidth: 192,
                width: '100%',
            }}
            className="border border-black border-n-1 dark:border-white "
        >
            <QRCode
                value={url}
                size={256}
                style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                viewBox={`0 0 256 256`}
            />
        </div>
    )
}

export default QRCodeWrapper
