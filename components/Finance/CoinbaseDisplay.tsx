import React, { useState, useEffect } from 'react';
import useCoinbaseCryptoPrice from '../../hooks/useCoinbaseCryptoPrice';

// Component props
interface CoinbaseCryptoDisplayProps {
    initialProductId?: string;
    ticker?: string; // Add support for ticker from CryptoSearch
    className?: string;
}

const CoinbaseCryptoDisplay: React.FC<CoinbaseCryptoDisplayProps> = ({
    initialProductId = 'BTC-USD',
    ticker,
    className = ''
}) => {
    // Utility function for ticker conversion (moved from hook import)
    const convertTickerFormat = (input: string): string => {
        // If already in BTC-USD format, return as-is
        if (/^[A-Z]+-USD$/.test(input)) {
            return input;
        }

        // Remove X: prefix if present
        let formatted = input.replace('X:', '');

        // Remove any existing USD/USDT suffix
        formatted = formatted.replace(/(USD|USDT)$/, '');

        // Ensure base and quote currencies are correctly separated
        if (!formatted.includes('-')) {
            // Assuming standard 3-char crypto base and 3-char quote
            if (formatted.length >= 6) {
                const base = formatted.substring(0, 3);
                const quote = formatted.substring(3);
                formatted = `${base}-${quote}`;
            }
        }

        // Ensure quote is USD
        if (!formatted.endsWith('-USD')) {
            formatted = `${formatted}-USD`;
        }

        return formatted;
    };

    // Use the ticker prop if provided, otherwise use initialProductId
    const [currentProductId, setCurrentProductId] = useState<string>(
        ticker ? convertTickerFormat(ticker) : initialProductId
    );

    const [inputProductId, setInputProductId] = useState(currentProductId);

    // Update when ticker prop changes
    useEffect(() => {
        if (ticker) {
            const coinbaseTicker = convertTickerFormat(ticker);
            setCurrentProductId(coinbaseTicker);
            setInputProductId(coinbaseTicker);
        }
    }, [ticker]);

    // Use our custom Coinbase hook
    const {
        status,
        error,
        lastPrice,
        lastTicker,
        productId,
        tradeMessages,
        reconnect,
        subscribe
    } = useCoinbaseCryptoPrice(currentProductId);

    // Format price for display
    const formatPrice = (value: number): string => {
        return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`;
    };

    // Format time for display
    const formatTime = (timestamp: number): string => {
        return new Date(timestamp).toLocaleTimeString();
    };

    // Format size for display
    const formatSize = (size: number): string => {
        return size.toLocaleString(undefined, { minimumFractionDigits: 8, maximumFractionDigits: 8 });
    };

    // Subscribe to a new product ID
    const subscribeProduct = (): void => {
        const formattedProductId = convertTickerFormat(inputProductId);
        subscribe(formattedProductId);
        setCurrentProductId(formattedProductId);
        setInputProductId(formattedProductId);
    };

    // Calculate 24h change percentage if available
    const get24hChange = (): { value: number; isPositive: boolean } | null => {
        // Add null and undefined checks
        if (!lastTicker?.price || !lastTicker?.open_24h) return null;

        const current = parseFloat(lastTicker.price);
        const open24h = parseFloat(lastTicker.open_24h);

        if (isNaN(current) || isNaN(open24h) || open24h === 0) return null;

        const changePercentage = ((current - open24h) / open24h) * 100;
        return {
            value: Math.abs(changePercentage),
            isPositive: changePercentage >= 0
        };
    };

    const change24h = get24hChange();

    return (
        <div className={`p-4 border rounded-lg ${className}`}>
            <h2 className="text-xl font-bold mb-3">
                Coinbase: {productId} Live Trades
            </h2>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 p-3 bg-black rounded-lg">
                <div>
                    <p className="mb-1">
                        <span className="font-semibold">Status:</span>{' '}
                        <span className={`font-medium ${status.includes('Subscribed') ? 'text-green-500' :
                            status.includes('Error') || status.includes('Disconnected') ? 'text-red-500' :
                                'text-yellow-500'
                            }`}>
                            {status}
                        </span>
                        {(status.includes('Error') || status.includes('Disconnected')) && (
                            <button
                                onClick={reconnect}
                                className="ml-2 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                                Reconnect
                            </button>
                        )}
                    </p>
                </div>

                <div className="flex items-center mt-2 sm:mt-0">
                    <input
                        type="text"
                        value={inputProductId}
                        onChange={(e) => setInputProductId(e.target.value)}
                        placeholder="BTC-USD, ETH-USD, etc."
                        className="px-3 py-1 text-sm border border-gray-700 bg-gray-900 rounded mr-2"
                    />
                    <button
                        onClick={subscribeProduct}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Subscribe
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-3 mb-5 bg-red-900 text-white rounded-md flex justify-between items-center">
                    {error}
                    <button
                        onClick={reconnect}
                        className="ml-2 px-3 py-1 bg-white text-red-600 rounded hover:bg-gray-100"
                    >
                        Try Again
                    </button>
                </div>
            )}

            {lastPrice !== null && (
                <div className="mb-5 p-4 bg-gray-900 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-400 mb-1">Latest Price</h3>
                    <div className="flex items-center">
                        <p className="text-3xl font-bold text-blue-500">
                            {formatPrice(lastPrice)}
                        </p>

                        {change24h && (
                            <span className={`ml-3 px-2 py-1 rounded text-xs font-bold ${change24h.isPositive ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                                }`}>
                                {change24h.isPositive ? '↑' : '↓'} {change24h.value.toFixed(2)}%
                            </span>
                        )}
                    </div>

                    {lastTicker?.volume_24h && (
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-400">
                            <div>
                                <span className="block">24h Volume</span>
                                <span className="font-semibold text-white">{parseFloat(lastTicker.volume_24h).toLocaleString()}</span>
                            </div>
                            <div>
                                <span className="block">24h High</span>
                                <span className="font-semibold text-white">{formatPrice(parseFloat(lastTicker.high_24h || '0'))}</span>
                            </div>
                            <div>
                                <span className="block">24h Low</span>
                                <span className="font-semibold text-white">{formatPrice(parseFloat(lastTicker.low_24h || '0'))}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="h-64 overflow-auto border border-gray-800 rounded-lg p-2 bg-gray-900 text-gray-300 font-mono text-xs">
                {tradeMessages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-gray-500">
                        <p>Waiting for trade data...</p>
                    </div>
                ) : (
                    tradeMessages.map((trade, index) => (
                        <div key={index} className={`mb-1 p-2 rounded ${trade.side === 'buy' ? 'bg-green-900/20 border-l-2 border-green-500' : 'bg-red-900/20 border-l-2 border-red-500'
                            }`}>
                            <span className="text-gray-400">[{formatTime(trade.timestamp)}]</span>
                            <span className={`ml-2 font-bold ${trade.side === 'buy' ? 'text-green-500' : 'text-red-500'
                                }`}>
                                {trade.side.toUpperCase()}
                            </span>
                            <span className="ml-2 text-yellow-300">{formatPrice(trade.price)}</span>
                            <span className="ml-2 text-gray-400">Size: {formatSize(trade.size)}</span>
                        </div>
                    ))
                )}
            </div>

            <div className="mt-2 text-xs text-gray-500">
                Received {tradeMessages.length} trades • Powered by Coinbase
            </div>
        </div>
    );
};

export default CoinbaseCryptoDisplay;