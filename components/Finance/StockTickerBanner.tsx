"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useMarketSnapshot, MarketDataTicker } from '../../hooks/useStockMarketSnapshot';
import Papa from 'papaparse';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// Type definitions - matching CoreSearch types
interface Ticker {
  ticker: string;
  name: string;
}

interface StockResult {
  ticker: string;
  name: string;
  volume: number;
  price: number;
  change: number;
  isExactTickerMatch?: boolean;
  hasExactWordMatch?: boolean;
  hasWordStartingWithQuery?: boolean;
}

interface StockTickerBannerProps {
  tickersPerLetter?: number;
  scrollSpeed?: number;
  className?: string;
}

const StockTickerBanner: React.FC<StockTickerBannerProps> = ({
  tickersPerLetter = 10,
  scrollSpeed = 100,
  className = '',
}) => {
  // State for tickers and data
  const [, setAllTickers] = useState<Ticker[]>([]);
  const [tickerData, setTickerData] = useState<StockResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Refs for the scrolling container and animation
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);

  // Use the market snapshot hook
  const { fetchMarketData, isLoading: isMarketDataLoading } = useMarketSnapshot();

  // Load all tickers from CSV
  useEffect(() => {
    const loadTickers = async () => {
      try {
        const response = await fetch('/tickers.csv');
        if (!response.ok) {
          throw new Error(`Failed to load tickers.csv: ${response.status} ${response.statusText}`);
        }

        const csvText = await response.text();

        Papa.parse(csvText, {
          header: true,
          complete: async (results) => {
            const tickers = results.data as Ticker[];
            setAllTickers(tickers);
            await processAllLetters(tickers);
          },
          error: (err: Error | { message: string }) => {
            setError(`CSV parsing error: ${err.message}`);
            setIsLoading(false);
          }
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(`Failed to load tickers: ${errorMessage}`);
        setIsLoading(false);
      }
    };

    loadTickers();
  }, [fetchMarketData]);

  // Process all letters A-Z
  const processAllLetters = async (tickers: Ticker[]) => {
    try {
      setIsLoading(true);
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      let allResults: StockResult[] = [];

      for (const letter of alphabet) {
        // Get tickers starting with this letter (same as CoreSearch single-letter search)
        const letterTickers = tickers.filter(ticker => {
          const tickerSymbol = String(ticker.ticker || '').toUpperCase();
          return tickerSymbol.startsWith(letter);
        });

        if (letterTickers.length === 0) continue;

        // Get market data for these tickers
        const tickerSymbols = letterTickers.map(t => t.ticker).join(',');

        try {
          const marketData = await fetchMarketData(tickerSymbols);

          if (marketData.tickers && marketData.tickers.length > 0) {
            // Process and rank results (similar to CoreSearch)
            const processedResults = rankResults(letterTickers, marketData);

            // Take top N results by volume
            const topResults = processedResults
              .slice(0, tickersPerLetter);

            allResults = [...allResults, ...topResults];
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`Error processing letter ${letter}:`, errorMessage);
          // Continue with other letters even if one fails
        }
      }

      setTickerData(allResults);
      setIsLoading(false);

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Error processing letters:', errorMessage);
      setError(`Failed to process data: ${errorMessage}`);
      setIsLoading(false);
    }
  };

  // Rank results by volume - similar to CoreSearch's rankResults function
  const rankResults = (tickers: Ticker[], marketData: { tickers: MarketDataTicker[] }): StockResult[] => {
    // Use a Map to track unique tickers
    const uniqueTickersMap = new Map<string, StockResult>();

    // Combine ticker and market data
    tickers.forEach(ticker => {
      const marketInfo = marketData.tickers?.find(t => t.ticker === ticker.ticker);
      const tickerSymbol = String(ticker.ticker || '').toUpperCase();

      // Parse volume safely
      let volume = 0;
      if (marketInfo?.day?.v) {
        volume = parseFloat(String(marketInfo.day.v));
      }

      const newEntry = {
        ticker: ticker.ticker,
        name: ticker.name,
        volume: volume,
        price: marketInfo?.day?.c || 0,
        change: marketInfo?.todaysChangePerc || 0
      };

      // Only add if not already in the map, or if this entry has higher volume
      const existingEntry = uniqueTickersMap.get(tickerSymbol);
      if (!existingEntry || (volume > existingEntry.volume)) {
        uniqueTickersMap.set(tickerSymbol, newEntry);
      }
    });

    // Convert map to array and sort by volume (highest first)
    return Array.from(uniqueTickersMap.values()).sort((a, b) => {
      // Sort STRICTLY by volume
      return b.volume - a.volume;
    });
  };

  // Set up scrolling animation with requestAnimationFrame for smoother performance
  useEffect(() => {
    if (!scrollContainerRef.current || isLoading || tickerData.length === 0) return;

    const scrollContainer = scrollContainerRef.current;
    const scrollWidth = scrollContainer.scrollWidth;
    const containerWidth = scrollContainer.clientWidth;

    // Only scroll if content is wider than container
    if (scrollWidth <= containerWidth) return;

    let scrollPosition = 0;
    let lastTimestamp = 0;
    const pixelsPerSecond = scrollSpeed; // This makes the scrollSpeed directly control pixels per second

    // Use requestAnimationFrame for smoother animation
    const animate = (timestamp: number) => {
      if (!scrollContainerRef.current) return;

      // Calculate time delta for smooth animation regardless of frame rate
      if (!lastTimestamp) lastTimestamp = timestamp;
      const delta = timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      // Calculate how many pixels to move based on time and speed
      const pixelsToMove = (pixelsPerSecond * delta) / 1000;
      scrollPosition += pixelsToMove;

      // Reset when we've scrolled through the entire content
      if (scrollPosition >= scrollWidth / 2) {
        scrollPosition = 0;
      }

      scrollContainerRef.current.scrollLeft = scrollPosition;
      animationRef.current = requestAnimationFrame(animate);
    };

    // Start the animation
    animationRef.current = requestAnimationFrame(animate);

    // Cleanup function
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isLoading, tickerData, scrollSpeed]);

  // Format price for display
  const formatPrice = (price: number): string => {
    return price.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Format change percentage for display
  const formatChangePercent = (percent: number): string => {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  };

  // We're using cn utility for conditional classes now instead of this function

  // Get arrow based on price change
  const getChangeArrow = (change: number): string => {
    return change >= 0 ? '▲' : '▼';
  };

  // Render loading state
  if (isLoading || isMarketDataLoading) {
    return (
      <div className={cn(
        'w-full bg-black/90 backdrop-blur-sm border-y border-gray-800 text-white py-3 overflow-hidden',
        className
      )}>
        <div className="flex items-center justify-center h-8">
          <div className="animate-pulse flex space-x-6">
            <div className="h-5 w-28 bg-gray-800 rounded-md"></div>
            <div className="h-5 w-16 bg-gray-800 rounded-md"></div>
            <div className="h-5 w-20 bg-gray-800 rounded-md"></div>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={cn(
        'w-full bg-red-950/90 backdrop-blur-sm border-y border-red-800 text-white py-3 overflow-hidden',
        className
      )}>
        <div className="flex items-center justify-center h-8">
          <span className="text-sm font-medium">Error: {error}</span>
        </div>
      </div>
    );
  }

  // Create duplicate data for seamless scrolling
  const duplicatedData = [...tickerData, ...tickerData];

  return (
    <div className={cn(
      'w-full bg-black/90 backdrop-blur-sm border-y border-gray-800 text-white py-2 overflow-hidden',
      className
    )}>
      <div
        ref={scrollContainerRef}
        className="flex items-center space-x-8 whitespace-nowrap overflow-x-hidden"
        style={{ width: '100%' }}
      >
        {duplicatedData.map((ticker, index) => (
          <div key={`${ticker.ticker}-${index}`} className="flex items-center space-x-3 px-1">
            <Badge variant="outline" className="font-mono font-bold bg-gray-900/60 text-white border-gray-700">
              {ticker.ticker}
            </Badge>
            <span className="font-medium text-gray-200">{formatPrice(ticker.price)}</span>
            <span
              className={cn(
                'flex items-center font-medium text-sm rounded-sm px-1.5 py-0.5',
                ticker.change >= 0 ? 'bg-green-950/40 text-green-400 border border-green-800/50' :
                  'bg-red-950/40 text-red-400 border border-red-800/50'
              )}
            >
              {getChangeArrow(ticker.change)} {formatChangePercent(ticker.change)}
            </span>
            <Separator orientation="vertical" className="h-4 bg-gray-700/50" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default StockTickerBanner;
