import { useState, useCallback } from 'react';

// Define interface for Polygon API response data
interface PolygonDataPoint {
    t: number;  // timestamp
    o: number;  // open
    h: number;  // high
    l: number;  // low
    c: number;  // close
    v: number;  // volume
    vw?: number; // volume weighted average price
}

// Interface for Snapshot API response
interface SnapshotResponse {
    status?: string;
    request_id?: string;
    ticker?: {
        ticker?: string;
        day?: PolygonDataPoint;
        todaysChange?: number;
        todaysChangePerc?: number;
    };
    error?: string;
}

// Interface for Aggregate Bars API response
interface AggregateResponse {
    ticker?: string;
    status?: string;
    results?: PolygonDataPoint[];
    resultsCount?: number;
    error?: string;
    request_id?: string;
}

// Type definitions for ticker pricing data
interface TickerPrice {
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

// Interface for date range pricing data
interface TickerPriceRange {
    dataPoints: PolygonDataPoint[];
    minPrice: number;
    maxPrice: number;
    lastUpdated: number;
}

export function useTickerPricing() {
    const [pricing, setPricing] = useState<TickerPrice | null>(null);
    const [rangeData, setRangeData] = useState<TickerPriceRange | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTickerPrice = useCallback(async (ticker: string) => {
        if (!ticker) {
            setError("No ticker provided");
            return null;
        }

        setIsLoading(true);
        setError(null);

        try {
            const API_KEY = process.env.NEXT_PUBLIC_POLYGON_API_KEY;

            // Determine if it's a crypto or stock ticker
            const isCrypto = ticker.startsWith('X:') || ticker.includes('-');
            const normalizedTicker = ticker.toUpperCase();

            const SNAPSHOT_URL = isCrypto
                ? `https://api.polygon.io/v2/snapshot/locale/global/markets/crypto/tickers/${normalizedTicker}?apiKey=${API_KEY}`
                : `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${normalizedTicker}?apiKey=${API_KEY}`;

            const response = await fetch(SNAPSHOT_URL);
            const data = await response.json() as SnapshotResponse;

            if (!response.ok) {
                throw new Error(`Failed to fetch price data: ${data.error || response.statusText}`);
            }

            if (!data.ticker) {
                throw new Error(`No data available for ${normalizedTicker}`);
            }

            const snapshotData = data.ticker;
            const dayData = snapshotData.day || {
                o: 0,
                h: 0,
                l: 0,
                c: 0,
                v: 0,
                vw: 0
            };

            const now = Date.now();

            const priceData: TickerPrice = {
                open: dayData.o,
                high: dayData.h,
                low: dayData.l,
                close: dayData.c,
                volume: dayData.v,
                vwap: dayData.vw || 0,
                change: snapshotData.todaysChange || 0,
                changePercent: snapshotData.todaysChangePerc || 0,
                lastUpdated: now
            };

            setPricing(priceData);
            setIsLoading(false);
            return priceData;
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error fetching price data';
            setError(errorMessage);
            setIsLoading(false);
            return null;
        }
    }, []);

    const fetchTickerPriceRange = useCallback(async (ticker: string, fromDate: string, toDate: string) => {
        if (!ticker) {
            setError("No ticker provided");
            return null;
        }

        const normalizedTicker = ticker.toUpperCase();

        // Validate the toDate is not in the future
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const validToDate = new Date(toDate) > today ? todayStr : toDate;

        setIsLoading(true);
        setError(null);

        try {
            const API_KEY = process.env.NEXT_PUBLIC_POLYGON_API_KEY;

            // Create endpoint URL for range data
            const AGGS_URL = `https://api.polygon.io/v2/aggs/ticker/${normalizedTicker}/range/1/day/${fromDate}/${validToDate}?adjusted=true&apiKey=${API_KEY}`;

            // Fetch the aggregate data
            const response = await fetch(AGGS_URL);
            const data = await response.json() as AggregateResponse;

            if (!response.ok) {
                throw new Error(`Failed to fetch price range data: ${data.error || response.statusText}`);
            }

            // Check if we have results
            if (!data.results || data.results.length === 0) {
                throw new Error(`No price range data available for ${normalizedTicker} in the specified date range`);
            }

            // Calculate min/max prices for the range
            let minPrice = Number.MAX_VALUE;
            let maxPrice = Number.MIN_VALUE;

            // Find min/max prices across the dataset
            data.results.forEach(dayData => {
                const price = dayData.c;
                minPrice = Math.min(minPrice, price);
                maxPrice = Math.max(maxPrice, price);
            });

            // Ensure we have valid min/max
            if (!isFinite(minPrice) || !isFinite(maxPrice)) {
                minPrice = 0;
                maxPrice = 1000;
            }

            const now = Date.now();

            // Create the range data object
            const priceRangeData: TickerPriceRange = {
                dataPoints: data.results,
                minPrice,
                maxPrice,
                lastUpdated: now
            };

            setRangeData(priceRangeData);
            setIsLoading(false);
            return priceRangeData;
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error fetching price range data';
            setError(errorMessage);
            setIsLoading(false);
            return null;
        }
    }, []);

    return {
        pricing,
        rangeData,
        isLoading,
        error,
        fetchTickerPrice,
        fetchTickerPriceRange
    };
}

export default useTickerPricing;