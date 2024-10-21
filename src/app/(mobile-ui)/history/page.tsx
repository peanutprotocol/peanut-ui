const Home = () => {
    const txHistory = Array.from({ length: 100 }).map((_, i) => ({
        id: i,
        date: new Date().toISOString(),
        from: '0x1234...5678',
        to: '0x8765...4321',
        amount: Math.random() * 100,
        symbol: 'ETH',
    }))

    return (
        <div className="w-full">
            {txHistory.map((tx) => (
                <div className="grid grid-cols-5" key={tx.id}>
                    <p>{tx.date}</p>
                    <p>{tx.from}</p>
                    <p>{tx.to}</p>
                    <p>{tx.amount}</p>
                    <p>{tx.symbol}</p>
                </div>
            ))}
        </div>
    )
}

export default Home
