"use client";

import React, { useState, useEffect } from 'react';
import SurfaceChart from './SurfaceChart';
import CoreSearch from './CoreSearch';
import { useTickerDetails } from '../../hooks/useTickerDetails';
import { useMarketSnapshot } from '../../hooks/useStockMarketSnapshot';
import { useMarketStatus } from '../../hooks/useMarketStatus';
import NewsComponent from './NewsComponent';

// Define interfaces for pricing data like in your crypto component
interface PricingData {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    vwap: number;
    change: number;
    changePercent: number;
    lastUpdated: number;
}

export function StockChartComponent() {
    // State for selected ticker and year
    const [selectedTicker, setSelectedTicker] = useState<string>('AAPL');
    const [selectedYear, setSelectedYear] = useState<number>(2024);
    const [pricing, setPricing] = useState<PricingData | null>(null);

    // Use our hooks
    const {
        tickerDetails,
        isLoading: isLoadingDetails,
        error: tickerError,
        fetchTickerDetails
    } = useTickerDetails();

    // Use market snapshot hook instead of stock pricing hook
    const {
        fetchMarketData,
        isLoading: isLoadingMarketData,
        error: marketDataError
    } = useMarketSnapshot();

    // Use our market status hook
    const {
        isMarketOpen,
        isPreMarket,
        isAfterHours,
        lastUpdated: marketStatusUpdated,
        isLoading: isLoadingMarketStatus
    } = useMarketStatus();

    // Combined loading state
    const isLoading = isLoadingDetails || isLoadingMarketData || isLoadingMarketStatus;

    // Combined error state
    const error = tickerError || marketDataError;

    // Generate year options: current year and only 5 years back
    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

    // Handle ticker selection
    const handleSelectTicker = (ticker: string) => {
        setSelectedTicker(ticker);
    };

    // Handle year change
    const handleYearChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedYear(parseInt(event.target.value, 10));
    };

    // Fetch ticker details and current pricing when selected ticker changes
    useEffect(() => {
        if (selectedTicker) {
            fetchTickerDetails(selectedTicker);

            const fetchData = async () => {
                const data = await fetchMarketData(selectedTicker);
                if (data.tickers && data.tickers.length > 0) {
                    const ticker = data.tickers[0];

                    if (ticker) {
                        // Store the current timestamp for lastUpdated
                        const now = Date.now();

                        setPricing({
                            open: ticker.day?.o || 0,
                            close: ticker.day?.c || 0,
                            high: ticker.day?.h || 0,
                            low: ticker.day?.l || 0,
                            volume: ticker.day?.v || 0,
                            vwap: ticker.day?.vw || 0,
                            change: ticker.todaysChange || 0,
                            changePercent: ticker.todaysChangePerc || 0,
                            lastUpdated: now // Use current timestamp
                        });
                    }
                }
            };

            fetchData();
        }
    }, [selectedTicker, fetchTickerDetails, fetchMarketData]);

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

    // Get the correct term for the current price based on market status
    const getCurrentPriceTerm = () => {
        if (isMarketOpen) return "Current Price";
        if (isPreMarket) return "Pre-Market Price";
        if (isAfterHours) return "After-Hours Price";
        return "Close"; // Market is closed, so it's a true closing price
    };

    // Determine if we should be showing the "Close" field based on market status
    const shouldShowCloseField = !isMarketOpen && !isPreMarket && !isAfterHours;

    return (
        <div className="container mx-auto">
            {/* Header Section with Search, Logo, and Current Price */}
            <div className="mb-6">
                {tickerDetails && pricing && (
                    <div className="mb-4 flex flex-col md:flex-row items-center justify-between border-b pb-4">
                        {/* Logo and Company Name */}
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
                                <h1 className="text-xl font-bold">{tickerDetails.name || selectedTicker}</h1>
                                <p className="text-sm text-gray-500">{tickerDetails.ticker || selectedTicker} • {tickerDetails.primary_exchange || 'Exchange'}</p>
                            </div>
                        </div>

                        {/* Current Price Display */}
                        <div className="text-center md:text-right">
                            <div className="text-3xl font-bold">${pricing.close.toFixed(2)}</div>
                            <div className={`text-base ${pricing.change > 0 ? "text-green-500" : pricing.change < 0 ? "text-red-500" : ""}`}>
                                {pricing.change > 0 ? "+" : ""}{pricing.change.toFixed(2)} ({pricing.changePercent.toFixed(2)}%)
                            </div>
                        </div>
                    </div>
                )}

                <label className="block text-sm font-medium mb-1">Search Stocks</label>
                <CoreSearch
                    onSelectTicker={handleSelectTicker}
                    selectedTicker={selectedTicker}
                    className="w-full"
                />
            </div>

            {/* Main content - Company Info (left) and Chart (right) */}
            {tickerDetails && (
                <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Company Information */}
                    <div className="p-4 bg-black border rounded">
                        <h2 className="text-lg font-bold mb-4">Company Information</h2>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <span className="text-sm font-medium text-gray-500">Market Cap</span>
                                <p>{formatLargeNumber(tickerDetails.market_cap)}</p>
                            </div>
                            <div>
                                <span className="text-sm font-medium text-gray-500">Exchange</span>
                                <p>{tickerDetails.primary_exchange || 'N/A'}</p>
                            </div>
                            <div>
                                <span className="text-sm font-medium text-gray-500">Industry</span>
                                <p>{tickerDetails.sic_description || 'N/A'}</p>
                            </div>
                            <div>
                                <span className="text-sm font-medium text-gray-500">Employees</span>
                                <p>{formatLargeNumber(tickerDetails.total_employees)}</p>
                            </div>
                            <div>
                                <span className="text-sm font-medium text-gray-500">Listed Date</span>
                                <p>{tickerDetails.list_date || 'N/A'}</p>
                            </div>
                            <div>
                                <span className="text-sm font-medium text-gray-500">Website</span>
                                <p>{tickerDetails.homepage_url ? (
                                    <a href={tickerDetails.homepage_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                                        Visit Site
                                    </a>
                                ) : 'N/A'}</p>
                            </div>
                        </div>
                        {tickerDetails.description && (
                            <div className="mt-3">
                                <span className="text-sm font-medium text-gray-500">Description</span>
                                <p className="text-sm mt-1">{tickerDetails.description}</p>
                            </div>
                        )}
                    </div>

                    {/* Stock chart with year selector in header */}
                    <div className="border rounded-lg overflow-hidden shadow-lg">
                        <div className="p-4 bg-black border-b flex justify-between items-center">
                            <h2 className="text-lg font-bold">{selectedTicker} Stock Price Surface</h2>
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
                        <div className="h-full">
                            <SurfaceChart
                                ticker={selectedTicker}
                                year={selectedYear}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Price Information - Modified to conditionally show/hide Close */}
            {pricing && (
                <div className="mb-6 p-4 bg-black border rounded">
                    <h2 className="text-lg font-bold mb-4">Latest Trading Data</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                            <span className="text-sm font-medium text-gray-500">Open</span>
                            <p>${pricing.open.toFixed(2)}</p>
                        </div>

                        {/* Conditionally display Close field only when market is closed */}
                        {shouldShowCloseField && (
                            <div>
                                <span className="text-sm font-medium text-gray-500">Close</span>
                                <p>${pricing.close.toFixed(2)}</p>
                            </div>
                        )}

                        {/* Always display current price with appropriate term */}
                        <div>
                            <span className="text-sm font-medium text-gray-500">{getCurrentPriceTerm()}</span>
                            <p>${pricing.close.toFixed(2)}</p>
                        </div>

                        <div>
                            <span className="text-sm font-medium text-gray-500">High</span>
                            <p>${pricing.high.toFixed(2)}</p>
                        </div>
                        <div>
                            <span className="text-sm font-medium text-gray-500">Low</span>
                            <p>${pricing.low.toFixed(2)}</p>
                        </div>
                        <div>
                            <span className="text-sm font-medium text-gray-500">Volume</span>
                            <p>{formatLargeNumber(pricing.volume)}</p>
                        </div>
                        <div>
                            <span className="text-sm font-medium text-gray-500">VWAP</span>
                            <p>${pricing.vwap.toFixed(2)}</p>
                        </div>
                        <div>
                            <span className="text-sm font-medium text-gray-500">Change</span>
                            <p className={pricing.change > 0 ? "text-green-500" : pricing.change < 0 ? "text-red-500" : ""}>
                                ${pricing.change.toFixed(2)} ({pricing.changePercent.toFixed(2)}%)
                            </p>
                        </div>
                        <div>
                            <span className="text-sm font-medium text-gray-500">Date</span>
                            <p>{new Date(pricing.lastUpdated).toISOString().split('T')[0]}</p>
                        </div>
                    </div>

                    <div className="mt-3 text-xs text-gray-500">
                        {(() => {
                            const now = new Date();
                            const today = now.toISOString().split('T')[0];
                            const dateStr = new Date(pricing.lastUpdated).toISOString().split('T')[0];
                            const isToday = dateStr === today;

                            // Get market status text
                            let marketStatusText;
                            if (isMarketOpen) {
                                marketStatusText = "Market Open";
                            } else if (isPreMarket) {
                                marketStatusText = "Pre-Market";
                            } else if (isAfterHours) {
                                marketStatusText = "After-Hours";
                            } else {
                                marketStatusText = "Market Closed";
                            }

                            if (!isToday) {
                                // For previous dates, just show date with "most recent trading day"
                                return `Most recent trading day: ${dateStr}`;
                            } else if (isMarketOpen) {
                                // Only show update time with freshness when market is actually open
                                const diffMs = now.getTime() - pricing.lastUpdated;
                                const diffMinutes = Math.floor(diffMs / (1000 * 60));
                                return `Last updated: ${new Date(pricing.lastUpdated).toLocaleTimeString()} (${diffMinutes < 1 ? 'just now' : `${diffMinutes} min ago`}) • ${marketStatusText}`;
                            } else {
                                // For closed market, just show time and status without freshness indicators
                                return `Last updated: ${new Date(pricing.lastUpdated).toLocaleTimeString()} • ${marketStatusText}`;
                            }
                        })()}
                    </div>
                </div>
            )}

            {error && (
                <div className="mt-4 p-4 bg-red-100 border border-red-300 rounded text-red-700">
                    Error: {error}
                </div>
            )}

            <div className="mt-4 text-sm text-gray-500">
                Note: Data provided by Polygon.io. Chart displays daily closing prices for the selected year.
                {pricing ? (() => {
                    const now = new Date();
                    const today = now.toISOString().split('T')[0];
                    const dateStr = new Date(pricing.lastUpdated).toISOString().split('T')[0];
                    const isToday = dateStr === today;

                    // Market status text
                    const marketStatusText = isMarketOpen ? "Market is open" :
                        isPreMarket ? "Pre-market hours" :
                            isAfterHours ? "After-hours trading" :
                                "Market is closed";

                    let statusNote;
                    if (!isToday) {
                        statusNote = `Data from most recent trading day (${dateStr}).`;
                    } else if (isMarketOpen) {
                        // Only mention update frequency if market is actually open
                        const diffMs = now.getTime() - pricing.lastUpdated;
                        const diffMinutes = Math.floor(diffMs / (1000 * 60));
                        statusNote = `${marketStatusText}. Updated ${diffMinutes < 1 ? 'just now' : `${diffMinutes} min ago`}.`;
                    } else {
                        // For closed market, just show status
                        statusNote = `${marketStatusText}. Last updated at ${new Date(pricing.lastUpdated).toLocaleTimeString()}.`;
                    }

                    return ` ${statusNote}`;
                })() : " Loading market data..."}
            </div>

            <div className="mt-6">
                <NewsComponent ticker={selectedTicker} />
            </div>
        </div>
    );
}