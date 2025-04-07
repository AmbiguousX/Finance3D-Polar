import { useState, useEffect, useCallback } from 'react';

// Define the market status response type based on the API documentation
export interface MarketStatusResponse {
    afterHours?: boolean;
    earlyHours?: boolean;
    market?: string;
    serverTime?: string;
    exchanges?: {
        nasdaq?: string;
        nyse?: string;
        otc?: string;
    };
    currencies?: {
        fx?: string;
        crypto?: string;
    };
    indicesGroups?: {
        nasdaq?: string;
        dow_jones?: string;
        s_and_p?: string;
        msci?: string;
        ftse_russell?: string;
        [key: string]: string | undefined;
    };
}

// Return type for our hook
export interface UseMarketStatusResult {
    marketStatus: MarketStatusResponse | null;
    isMarketOpen: boolean;
    isPreMarket: boolean;
    isAfterHours: boolean;
    lastUpdated: Date | null;
    isLoading: boolean;
    error: string | null;
    refreshMarketStatus: () => Promise<void>;
}

/**
 * Custom hook for fetching and monitoring market status
 * @param refreshInterval Time in milliseconds between automatic refreshes. Default is 5 minutes.
 */
export const useMarketStatus = (refreshInterval = 5 * 60 * 1000): UseMarketStatusResult => {
    const [marketStatus, setMarketStatus] = useState<MarketStatusResponse | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Derived state: Is the market open?
    const isMarketOpen = marketStatus?.market === 'open';
    const isPreMarket = Boolean(marketStatus?.earlyHours);
    const isAfterHours = Boolean(marketStatus?.afterHours);

    const fetchMarketStatus = useCallback(async (): Promise<void> => {
        setIsLoading(true);
        setError(null);

        try {
            const API_KEY = process.env.NEXT_PUBLIC_POLYGON_API_KEY;
            if (!API_KEY) {
                throw new Error('Polygon API key is missing');
            }

            const MARKET_STATUS_URL = `https://api.polygon.io/v1/marketstatus/now?apiKey=${API_KEY}`;

            const response = await fetch(MARKET_STATUS_URL);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(`Failed to fetch market status: ${data.error || response.statusText}`);
            }

            // Set the market status and update timestamp
            setMarketStatus(data);
            setLastUpdated(new Date());
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error fetching market status';
            console.error('Error fetching market status:', errorMessage);
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchMarketStatus();
    }, [fetchMarketStatus]);

    // Set up automatic refresh interval
    useEffect(() => {
        if (refreshInterval <= 0) return;

        const intervalId = setInterval(() => {
            fetchMarketStatus();
        }, refreshInterval);

        return () => clearInterval(intervalId);
    }, [fetchMarketStatus, refreshInterval]);

    return {
        marketStatus,
        isMarketOpen,
        isPreMarket,
        isAfterHours,
        lastUpdated,
        isLoading,
        error,
        refreshMarketStatus: fetchMarketStatus
    };
};