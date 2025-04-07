"use client";

import React, { useState, useEffect } from 'react';
import SurfaceChart from './SurfaceChart';
import CryptoSearch from './CryptoSearch';
import { useCryptoSnapshot } from '../../hooks/useCryptoSnapshot';
import IndependentCryptoChart from './RealTimeCryptoChart';
import CoinbaseCryptoDisplay from './CoinbaseDisplay';
import useLiveCryptoPrice from '../../hooks/useLiveCryptoPrice';

// Define interfaces for our state
interface PricingData {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    volumeInCoins: number;
    vwap: number;
    change: number;
    changePercent: number;
    lastUpdated: number;
    lastTradePrice?: number;
}

interface TickerDetails {
    name: string;
    description?: string;
    branding?: {
        logo_url?: string;
    };
}

export function CryptoChartComponent() {
    // State for selected ticker and year
    const [selectedTicker, setSelectedTicker] = useState<string>('X:BTCUSD');
    const [selectedYear, setSelectedYear] = useState<number>(2024);
    // Add a key to force child component refreshes
    const [tickerChangeCounter, setTickerChangeCounter] = useState<number>(0);
    // State to store processed pricing data
    const [pricing, setPricing] = useState<PricingData | null>(null);
    // State to store ticker details
    const [tickerDetails, setTickerDetails] = useState<TickerDetails | null>(null);

    // Use the snapshot hook for all data
    const {
        fetchCryptoData,
        isLoading,
        error
    } = useCryptoSnapshot();

    // Use the live crypto price hook
    const {
        lastPrice,
        status: liveDataStatus,
        subscribe
    } = useLiveCryptoPrice(selectedTicker);

    // Generate year options: current year and only 5 years back
    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

    // Get display ticker (without X: prefix) for UI purposes
    const getDisplayTicker = (ticker: string): string => {
        return ticker.startsWith('X:') ? ticker.substring(2) : ticker;
    };

    // Handle ticker selection
    const handleSelectTicker = (ticker: string) => {
        setSelectedTicker(ticker);
        // Subscribe to the new ticker for live data
        subscribe(ticker);
        // Increment the counter to force child component refreshes
        setTickerChangeCounter(prev => prev + 1);
    };

    // Handle year change
    const handleYearChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedYear(parseInt(event.target.value, 10));
    };

    // Fetch ticker details and pricing when selected ticker changes
    useEffect(() => {
        const fetchTickerData = async () => {
            if (!selectedTicker) return;

            try {
                // Fetch snapshot data for the selected ticker
                const data = await fetchCryptoData(selectedTicker);

                if (data.tickers && data.tickers.length > 0) {
                    // Safely access the first ticker with proper type checking
                    const tickerData = data.tickers[0];

                    // Process pricing data
                    const now = Date.now();

                    // If we have volumeUSD already calculated in the hook, use it
                    const volume = tickerData?.volumeUSD ?? 0;
                    const volumeInCoins = tickerData?.volumeInCoins ?? 0;

                    // Set pricing data
                    setPricing({
                        open: tickerData?.day?.o ?? 0,
                        high: tickerData?.day?.h ?? 0,
                        low: tickerData?.day?.l ?? 0,
                        close: tickerData?.day?.c ?? 0,
                        volume: volume, // Volume in USD from hook
                        volumeInCoins: volumeInCoins, // Original volume in coins from hook
                        vwap: tickerData?.day?.vw ?? 0,
                        change: tickerData?.todaysChange ?? 0,
                        changePercent: tickerData?.todaysChangePerc ?? 0,
                        lastUpdated: now,
                        lastTradePrice: tickerData?.lastTrade?.p
                    });

                    // Set ticker details - fake the structure to match what the component expects
                    setTickerDetails({
                        name: getDisplayTicker(selectedTicker),
                        description: '',
                        branding: {
                            // You can add logo_url if you have it
                        }
                    });
                }
            } catch (err) {
                console.error("Error fetching ticker data:", err);
            }
        };

        fetchTickerData();
    }, [selectedTicker, fetchCryptoData]);

    // Format price to appropriate decimal places based on value
    const formatPrice = (price: number): string => {
        if (!price) return '0.00';

        // For very low priced cryptos, show more decimal places
        if (price < 0.01) return price.toFixed(6);
        if (price < 1) return price.toFixed(4);
        return price.toFixed(2);
    };

    // Helper function to format large numbers
    const formatLargeNumber = (num: number | undefined): string => {
        if (!num) return 'N/A';
        if (num >= 1_000_000_000) {
            return (num / 1_000_000_000).toFixed(2) + 'B';
        } else if (num >= 1_000_000) {
            return (num / 1_000_000).toFixed(2) + 'M';
        } else if (num >= 1_000) {
            return (num / 1_000).toFixed(2) + 'K';
        }
        return num.toString();
    };

    return (
        <div className="container mx-auto">
            {/* Header Section with Search, Logo, and Current Price */}
            <div className="mb-6">
                {tickerDetails && (
                    <div className="mb-4 flex flex-col md:flex-row items-center justify-between border-b pb-4">
                        {/* Logo and Crypto Name */}
                        <div className="flex items-center mb-4 md:mb-0">
                            {tickerDetails.branding?.logo_url && (
                                <div className="mr-4 rounded-lg p-2 bg-gray-800">
                                    <img
                                        src={`${tickerDetails.branding.logo_url}?apiKey=${process.env.NEXT_PUBLIC_POLYGON_API_KEY}`}
                                        alt={`${tickerDetails.name} logo`}
                                        className="w-12 h-12 object-contain"
                                        onError={(e) => {
                                            console.warn('Failed to load logo:', e);
                                            e.currentTarget.style.display = 'none';
                                        }}
                                    />
                                </div>
                            )}
                            <div>
                                <h1 className="text-xl font-bold">{tickerDetails.name || getDisplayTicker(selectedTicker)}</h1>
                                <p className="text-sm text-gray-500">{getDisplayTicker(selectedTicker)} • Cryptocurrency</p>
                                {liveDataStatus && liveDataStatus !== 'Error' && (
                                    <p className="text-xs text-gray-400">
                                        Live Data Status: {liveDataStatus}
                                    </p>
                                )}
                                {lastPrice && (
                                    <p className="text-xs text-green-500">
                                        Live Data Active
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Current Price Display - Using live data for price only, keeping official change % */}
                        <div className="text-center md:text-right">
                            <div className="text-3xl font-bold">
                                ${lastPrice ? formatPrice(lastPrice) : pricing ? formatPrice(pricing.close) : '0.00'}
                                {lastPrice && <span className="text-xs ml-1 text-green-500">LIVE</span>}
                            </div>

                            {/* Always use the official day change percentage from the API */}
                            {pricing && (
                                <div className={`text-base ${pricing.change > 0 ? "text-green-500" : pricing.change < 0 ? "text-red-500" : ""}`}>
                                    {pricing.change > 0 ? "+" : ""}{formatPrice(pricing.change)} ({pricing.changePercent.toFixed(2)}%)
                                </div>
                            )}

                            {lastPrice && (
                                <div className="text-xs text-gray-400">
                                    Live price as of: {new Date().toLocaleTimeString()}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <label className="block text-sm font-medium mb-1">Search Cryptocurrencies</label>
                <CryptoSearch
                    onSelectTicker={handleSelectTicker}
                    selectedTicker={selectedTicker}
                    className="w-full"
                />
            </div>

            {/* Main content - 2x2 grid layout */}
            <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Price Information - Top left */}
                {pricing && (
                    <div className="p-4 bg-black border rounded">
                        <h2 className="text-lg font-bold mb-4">Latest Trading Data</h2>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <span className="text-sm font-medium text-gray-500">Open</span>
                                <p>${formatPrice(pricing.open)}</p>
                            </div>
                            <div>
                                <span className="text-sm font-medium text-gray-500">Close</span>
                                <p>${formatPrice(pricing.close)}</p>
                            </div>
                            <div>
                                <span className="text-sm font-medium text-gray-500">High</span>
                                <p>${formatPrice(pricing.high)}</p>
                            </div>
                            <div>
                                <span className="text-sm font-medium text-gray-500">Low</span>
                                <p>${formatPrice(pricing.low)}</p>
                            </div>
                            <div>
                                <span className="text-sm font-medium text-gray-500">Volume (USD)</span>
                                <p>${formatLargeNumber(pricing.volume)}</p>
                            </div>
                            <div>
                                <span className="text-sm font-medium text-gray-500">VWAP</span>
                                <p>${formatPrice(pricing.vwap)}</p>
                            </div>
                            <div className="col-span-2">
                                <span className="text-sm font-medium text-gray-500">Change</span>
                                <p className={pricing.change > 0 ? "text-green-500" : pricing.change < 0 ? "text-red-500" : ""}>
                                    ${formatPrice(pricing.change)} ({pricing.changePercent.toFixed(2)}%)
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 text-xs text-gray-500">
                            Data provided by Polygon.io. Cryptocurrency markets trade 24/7.<br />
                            Last updated: {new Date(pricing.lastUpdated).toLocaleTimeString()}
                        </div>
                    </div>
                )}

                {/* Surface Chart - Top right */}
                <div className="border rounded-lg overflow-hidden shadow-lg">
                    <div className="p-4 bg-black border-b flex justify-between items-center">
                        <h2 className="text-lg font-bold">{getDisplayTicker(selectedTicker)} Price Surface</h2>
                        <div className="flex items-center">
                            <select
                                value={selectedYear}
                                onChange={handleYearChange}
                                className="p-2 text-sm border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                            >
                                {yearOptions.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="h-80">
                        <SurfaceChart
                            ticker={selectedTicker}
                            year={selectedYear}
                            key={`surface-${tickerChangeCounter}`}
                        />
                    </div>
                </div>

                {/* Polygon Real-time Chart - Bottom left */}
                <div className="border rounded-lg overflow-hidden shadow-lg">
                    <div className="p-4 bg-black border-b">
                        <h2 className="text-lg font-bold">Polygon.io Real-time Data</h2>
                    </div>
                    <div className="h-80">
                        <IndependentCryptoChart
                            ticker={selectedTicker}
                            key={`polygon-${tickerChangeCounter}`}
                        />
                    </div>
                </div>

                {/* Coinbase Display - Bottom right */}
                <CoinbaseCryptoDisplay
                    ticker={selectedTicker}
                    className="h-full shadow-lg"
                    key={`coinbase-${tickerChangeCounter}`}
                />
            </div>

            {isLoading && (
                <div className="flex justify-center items-center py-10">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            )}

            {error && (
                <div className="mt-4 p-4 bg-red-100 border border-red-300 rounded text-red-700">
                    Error: {error}
                </div>
            )}
        </div>
    );
}