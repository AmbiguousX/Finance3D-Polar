import { useState, useCallback } from 'react';

// API configuration
const API_KEY = process.env.NEXT_PUBLIC_POLYGON_API_KEY;
const CRYPTO_SNAPSHOT_URL = 'https://api.polygon.io/v2/snapshot/locale/global/markets/crypto/tickers';

// Type definitions
export interface CryptoDataTicker {
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
  lastTrade?: {
    p?: number; // price
    s?: number; // size
    t?: number; // timestamp
    x?: number; // exchange ID
  };
  fmv?: number; // fair market value (available on Business plans)
  todaysChangePerc?: number;
  todaysChange?: number;
  updated?: number; // timestamp of last update
  volumeUSD?: number; // Added: volume in USD
  volumeInCoins?: number; // Added: original volume in coins
}

export interface CryptoDataResponse {
  tickers: CryptoDataTicker[];
  status?: string;
  request_id?: string;
  count?: number;
}

export interface UseCryptoSnapshotResult {
  fetchCryptoData: (tickerSymbols?: string) => Promise<CryptoDataResponse>;
  isLoading: boolean;
  error: string | null;
}

export const useCryptoSnapshot = (): UseCryptoSnapshotResult => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCryptoData = useCallback(async (tickerSymbols?: string): Promise<CryptoDataResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      // Build the API URL - if no tickers are provided, fetch all crypto tickers
      let url = `${CRYPTO_SNAPSHOT_URL}?apiKey=${API_KEY}`;

      if (tickerSymbols) {
        // Clean up ticker symbols and remove empty strings
        const cleanTickerList = tickerSymbols.split(',').filter(t => t.trim());

        if (cleanTickerList.length > 0) {
          // Join the clean list
          const cleanTickerSymbols = cleanTickerList.join(',');
          url += `&tickers=${cleanTickerSymbols}`;
        }
      }

      // Log the exact URL we're calling (hiding API key for security)
      console.log("Calling Crypto API with URL:",
        API_KEY ? url.replace(API_KEY, "API_KEY_HIDDEN") : url);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch crypto data (${response.status})`);
      }

      const data = await response.json() as CryptoDataResponse;

      // Process the data to handle missing or zero values appropriately
      if (data.tickers && Array.isArray(data.tickers)) {
        data.tickers = data.tickers.map(ticker => {
          // Create a processed version of the ticker
          const processedTicker: CryptoDataTicker = {
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

          // Calculate percentage change manually if we have both current price and previous day data
          // Use lastTrade if available, otherwise use daily close
          const currentPrice = ticker.lastTrade?.p || ticker.day?.c;
          const prevClose = ticker.prevDay?.c;

          if (currentPrice && prevClose && prevClose !== 0) {
            // Calculate absolute change
            const change = currentPrice - prevClose;

            // Calculate percentage change
            const changePerc = (change / prevClose) * 100;

            // Set the values on the processed ticker
            processedTicker.todaysChange = change;
            processedTicker.todaysChangePerc = changePerc;
          }

          // Calculate volume in USD
          // First, determine the original volume in coins (prioritizing previous day data)
          let volumeInCoins = 0;
          if (ticker.prevDay?.v !== undefined && ticker.prevDay.v > 0) {
            // Use previous day's volume as it's more complete
            volumeInCoins = ticker.prevDay.v;
          } else if (ticker.day?.v !== undefined && ticker.day.v > 0) {
            // Fallback to current day's volume
            volumeInCoins = ticker.day.v;
          }

          // Store the original volume in coins
          processedTicker.volumeInCoins = volumeInCoins;

          // Now calculate the USD value
          let volumeUSD = 0;
          if (ticker.prevDay?.v !== undefined && ticker.prevDay.v > 0) {
            // Use previous day data with VWAP if available
            if (ticker.prevDay.vw !== undefined && ticker.prevDay.vw > 0) {
              volumeUSD = ticker.prevDay.v * ticker.prevDay.vw;
            } else if (ticker.prevDay.c !== undefined && ticker.prevDay.c > 0) {
              // Fallback to close price if VWAP not available
              volumeUSD = ticker.prevDay.v * ticker.prevDay.c;
            }
          } else if (ticker.day?.v !== undefined && ticker.day.v > 0) {
            // Fallback to current day data
            if (ticker.day.vw !== undefined && ticker.day.vw > 0) {
              volumeUSD = ticker.day.v * ticker.day.vw;
            } else if (ticker.day.c !== undefined && ticker.day.c > 0) {
              volumeUSD = ticker.day.v * ticker.day.c;
            }
          }

          // If we still couldn't calculate volume USD, use the last trade price as a last resort
          if (volumeUSD === 0 && volumeInCoins > 0 && currentPrice) {
            volumeUSD = volumeInCoins * currentPrice;
          }

          // Store the USD volume
          processedTicker.volumeUSD = volumeUSD;

          return processedTicker;
        });
      }

      setIsLoading(false);
      return data;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error fetching crypto data';
      console.error('Crypto snapshot error:', errorMessage);
      setError(errorMessage);
      setIsLoading(false);
      return { tickers: [] };
    }
  }, []);

  return { fetchCryptoData, isLoading, error };
};