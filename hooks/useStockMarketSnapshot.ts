import { useState, useCallback } from 'react';

// API configuration
const API_KEY = process.env.NEXT_PUBLIC_POLYGON_API_KEY;
const SNAPSHOT_URL = 'https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers';

// Type definitions
export interface MarketDataTicker {
  ticker: string;
  day?: {
    o?: number; // open
    h?: number; // high
    l?: number; // low
    c?: number; // close price
    v?: number; // volume
    vw?: number; // volume weighted
  };
  min?: {
    o?: number;
    h?: number;
    l?: number;
    c?: number;
    v?: number;
    vw?: number;
  };
  prevDay?: {
    o?: number; // open
    h?: number; // high
    l?: number; // low
    c?: number; // close
    v?: number; // volume
    vw?: number; // volume weighted
  };
  todaysChangePerc?: number;
  todaysChange?: number;
  updated?: number; // timestamp of last update
}

export interface MarketDataResponse {
  tickers: MarketDataTicker[];
  status?: string;
  request_id?: string;
  count?: number;
}

export interface UseMarketSnapshotResult {
  fetchMarketData: (tickerSymbols: string) => Promise<MarketDataResponse>;
  isLoading: boolean;
  error: string | null;
}

export const useMarketSnapshot = (): UseMarketSnapshotResult => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMarketData = useCallback(async (tickerSymbols: string): Promise<MarketDataResponse> => {
    if (!tickerSymbols) return { tickers: [] };

    setIsLoading(true);
    setError(null);

    try {
      // Clean up ticker symbols and remove empty strings
      const cleanTickerList = tickerSymbols.split(',').filter(t => t.trim());

      if (cleanTickerList.length === 0) {
        setIsLoading(false);
        return { tickers: [] };
      }

      // Join the clean list
      const cleanTickerSymbols = cleanTickerList.join(',');

      // First, let's log the exact URL we're calling to debug
      const url = `${SNAPSHOT_URL}?tickers=${cleanTickerSymbols}&apiKey=${API_KEY}`;
      console.log("Calling API with URL:", API_KEY ? url.replace(API_KEY, "API_KEY_HIDDEN") : url);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch market data (${response.status})`);
      }

      const data = await response.json() as MarketDataResponse;

      // Process the data to handle zero values appropriately
      // Process the data to handle zero values appropriately
      if (data.tickers && Array.isArray(data.tickers)) {
        data.tickers = data.tickers.map(ticker => {
          // Create a processed version of the ticker that handles zero values
          const processedTicker: MarketDataTicker = {
            ...ticker,
            ticker: ticker.ticker
          };

          // Fill in day data if needed
          if (!ticker.day || ticker.day.c === 0) {
            if (ticker.prevDay) {
              processedTicker.day = {
                ...ticker.prevDay
              };
            }
          }

          // Calculate percentage change manually if we have both current and previous day data
          if (ticker.day?.c && ticker.prevDay?.c) {
            const currentClose = ticker.day.c;
            const prevClose = ticker.prevDay.c;

            // Calculate absolute change
            const change = currentClose - prevClose;

            // Calculate percentage change
            const changePerc = (change / prevClose) * 100;

            // Set the values on the processed ticker
            processedTicker.todaysChange = change;
            processedTicker.todaysChangePerc = changePerc;
          }

          return processedTicker;
        });
      }

      setIsLoading(false);
      return data;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error fetching market data';
      console.error('Market snapshot error:', errorMessage);
      setError(errorMessage);
      setIsLoading(false);
      return { tickers: [] };
    }
  }, []);

  return { fetchMarketData, isLoading, error };
};