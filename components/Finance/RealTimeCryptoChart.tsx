import React, { useEffect, useState } from 'react';
import useLiveCryptoPrice from '../../hooks/useLiveCryptoPrice';
import { useTickerDetails } from '../../hooks/useTickerDetails';
import CryptoSearch from './CryptoSearch';

// Component props
interface IndependentCryptoChartProps {
    ticker?: string;
    className?: string;
}

const IndependentCryptoChart: React.FC<IndependentCryptoChartProps> = ({
    ticker = 'BTC-USD',
    className = ''
}) => {
    // State for internal ticker management
    const [internalTicker, setInternalTicker] = useState<string>(ticker);
    // State for showing/hiding search
    const [showSearch, setShowSearch] = useState<boolean>(false);

    // Update internal ticker if the prop changes
    useEffect(() => {
        setInternalTicker(ticker);
    }, [ticker]);

    // Use price data hook for WebSocket data
    const {
        status: originalStatus,
        error,
        lastPrice,
        formattedTicker,
        tradeMessages,
        reconnect,
        subscribe
    } = useLiveCryptoPrice(internalTicker);

    // Use ticker details hook to get the logo
    const { tickerDetails, isLoading, fetchTickerDetails } = useTickerDetails();

    // Get Polygon API key from environment
    const apiKey = process.env.NEXT_PUBLIC_POLYGON_API_KEY || '';

    // Ensure ticker is in X:BTCUSD format for ticker details API
    const getTickerDetailsFormat = (inputTicker: string): string => {
        // Handle empty input
        if (!inputTicker) return 'X:BTCUSD';

        let result = inputTicker;

        // Add X: prefix if not already present
        if (!result.startsWith('X:')) {
            result = `X:${result}`;
        }

        // Convert BTC-USD to BTCUSD if needed
        if (result.includes('-')) {
            result = result.replace('-', '');
        }

        return result;
    };

    // Fetch ticker details with correct format
    useEffect(() => {
        const detailsTicker = getTickerDetailsFormat(internalTicker);
        console.log(`Fetching ticker details with: ${detailsTicker}`);
        fetchTickerDetails(detailsTicker);
    }, [internalTicker, fetchTickerDetails]);

    // Add API key to logo URLs
    const getLogoUrlWithApiKey = (url: string | undefined): string | undefined => {
        if (!url) return undefined;

        // Check if URL already has query parameters
        const hasQueryParams = url.includes('?');

        // Add the API key
        return `${url}${hasQueryParams ? '&' : '?'}apiKey=${apiKey}`;
    };

    // Handle ticker selection from search
    const handleTickerSelect = (newTicker: string) => {
        console.log(`Selected new ticker: ${newTicker}`);
        setInternalTicker(newTicker);
        subscribe(newTicker);
        setShowSearch(false);
    };

    // Toggle search visibility
    const toggleSearch = () => {
        setShowSearch(prev => !prev);
    };

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

    return (
        <div>
            {/* Search section - completely separated from the chart */}
            {showSearch && (
                <div className="mb-3 p-4 border rounded-lg bg-white">
                    <h3 className="mb-2 text-lg font-bold">Change Ticker</h3>
                    <CryptoSearch
                        className="w-full"
                        onSelectTicker={handleTickerSelect}
                    />
                </div>
            )}

            {/* Chart component */}
            <div className={`w-full h-full p-4 border rounded-lg bg-white ${className}`}>
                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-xl font-bold flex items-center text-black">
                        {tickerDetails?.branding?.logo_url && (
                            <img
                                src={getLogoUrlWithApiKey(tickerDetails.branding.logo_url)}
                                alt={`${formattedTicker} logo`}
                                className="w-6 h-6 mr-2 rounded-full"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        )}
                        {formattedTicker === '*' ? 'All Cryptocurrencies' : formattedTicker} Live Trades
                    </h2>

                    {/* Search button */}
                    <button
                        onClick={toggleSearch}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        {showSearch ? 'Hide Search' : 'Change Ticker'}
                    </button>
                </div>

                <div className="flex justify-between items-center mb-5 p-3 bg-black rounded-lg">
                    <div>
                        <p className="mb-1">
                            <span className="font-semibold text-white">Status:</span>{' '}
                            <span className="font-medium text-green-500">Connected</span>
                            {originalStatus.includes('Error') && (
                                <button
                                    onClick={reconnect}
                                    className="ml-2 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                    Reconnect
                                </button>
                            )}
                        </p>
                        {lastPrice !== null && (
                            <p className="text-xl font-bold text-blue-500">
                                Current: {formatPrice(lastPrice)}
                            </p>
                        )}
                    </div>

                    {/* Company info section */}
                    {tickerDetails && (
                        <div className="text-right text-xs text-gray-300">
                            <p>{tickerDetails.name || internalTicker}</p>
                            {tickerDetails.homepage_url && (
                                <a
                                    href={tickerDetails.homepage_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:underline"
                                >
                                    Website
                                </a>
                            )}
                        </div>
                    )}
                </div>

                <div className="h-64 overflow-auto border border-gray-800 rounded-lg p-2 bg-gray-900 text-black font-mono text-xs">
                    {tradeMessages.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-gray-500">
                            <p>Waiting for trade data...</p>
                        </div>
                    ) : (
                        tradeMessages.slice().reverse().map((trade, index) => (
                            <div key={index} className="mb-1 p-2 rounded bg-gray-800">
                                <span className="text-gray-400">[{formatTime(trade.t)}]</span>
                                <span className="ml-2 text-yellow-300">{trade.pair}</span>
                                <span className="ml-2 text-yellow-300">Price: {formatPrice(trade.p)}</span>
                                <span className="ml-2 text-gray-400">Size: {formatSize(trade.s)}</span>
                            </div>
                        ))
                    )}
                </div>

                <div className="mt-2 text-xs text-black flex justify-between items-center">
                    <span>Received {tradeMessages.length} trades • Powered by Polygon</span>

                    {/* Small logo display in footer with API key */}
                    {tickerDetails?.branding?.icon_url && (
                        <img
                            src={getLogoUrlWithApiKey(tickerDetails.branding.icon_url)}
                            alt={`${formattedTicker} icon`}
                            className="w-4 h-4 rounded-full"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default IndependentCryptoChart;