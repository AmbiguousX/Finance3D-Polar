import React, { useState, useEffect, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { useMarketSnapshot, MarketDataTicker } from '../../hooks/useStockMarketSnapshot';

// Type definitions
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
    isExactTickerMatch: boolean;
    hasExactWordMatch: boolean;
    hasWordStartingWithQuery: boolean;
}

interface CoreSearchProps {
    className?: string;
    onSelectTicker?: (ticker: string) => void;
    selectedTicker?: string;
}

const CoreSearch: React.FC<CoreSearchProps> = ({ className, onSelectTicker, selectedTicker: externalSelectedTicker }) => {
    // App state
    const [allTickers, setAllTickers] = useState<Ticker[]>([]);
    const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [status, setStatus] = useState<string>('Type to search');
    const [results, setResults] = useState<StockResult[]>([]);
    const [isLocalLoading, setIsLocalLoading] = useState<boolean>(false);
    const [internalSelectedTicker, setInternalSelectedTicker] = useState<string>('');

    // Use external or internal selected ticker
    const selectedTicker = externalSelectedTicker || internalSelectedTicker;

    // Custom hook for market data
    const { fetchMarketData, isLoading: isApiLoading, error: apiError } = useMarketSnapshot();

    // Combined loading state
    const isLoading = isLocalLoading || isApiLoading;

    // Add state to track when dropdown should be visible
    const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
    const searchContainerRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }

        // Bind the event listener
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            // Unbind the event listener on cleanup
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Initialize the app - load ticker data
    useEffect(() => {
        const initialize = async () => {
            setIsLocalLoading(true);
            setStatus('Loading tickers...');

            try {
                const response = await fetch('/tickers.csv');

                if (!response.ok) {
                    throw new Error(`Failed to load tickers.csv: ${response.status} ${response.statusText}`);
                }

                const csvText = await response.text();

                // Parse the CSV data
                Papa.parse(csvText, {
                    header: true,
                    dynamicTyping: true,
                    skipEmptyLines: true,
                    complete: results => {
                        console.log("CSV parsing complete. Rows:", results.data?.length || 0);

                        // Process the parsed data to ensure it has the fields we need
                        const processedTickers = results.data
                            .map((row: any) => ({
                                ticker: row.ticker || row.symbol || row.TICKER || row.SYMBOL || '',
                                name: row.name || row.company || row.NAME || row.COMPANY || ''
                            }))
                            .filter((row: Ticker) => row.ticker && row.name);

                        console.log("Processed tickers from CSV:", processedTickers.length);

                        if (processedTickers.length > 0) {
                            setAllTickers(processedTickers);
                            setIsDataLoaded(true);
                            setStatus(`Loaded ${processedTickers.length} tickers. Type to search.`);
                            setIsLocalLoading(false);
                        } else {
                            throw new Error("No valid tickers found in CSV");
                        }
                    },
                    error: (err: Error | { message: string }) => {
                        console.error('CSV parsing error:', err);
                        throw new Error(`CSV parsing error: ${err.message}`);
                    }
                });
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error('Error loading tickers:', error);
                setStatus(`Error loading tickers: ${errorMessage}`);
                setIsLocalLoading(false);
            }
        };

        initialize();
    }, []);

    // Search for matches in all tickers
    const searchAllTickers = useCallback((query: string): Ticker[] => {
        const queryUpper = query.toUpperCase();
        const queryLower = query.toLowerCase();

        // Special case for searching partial ticker symbols like "ts" should find "tsla"
        const isPartialTickerSearch = queryUpper.length <= 3;

        return allTickers.filter(ticker => {
            // Get ticker symbol and company name safely
            const tickerSymbol = String(ticker.ticker || '').toUpperCase();
            const companyName = String(ticker.name || '').toLowerCase();

            // 1. Exact ticker match (highest priority)
            if (tickerSymbol === queryUpper) {
                return true;
            }

            // 2. Ticker starts with query
            if (tickerSymbol.startsWith(queryUpper)) {
                return true;
            }

            // 3. For short queries (1-3 chars), be more lenient with ticker matching
            if (isPartialTickerSearch && tickerSymbol.includes(queryUpper)) {
                return true;
            }

            // 4. Company name STARTS with query (this is crucial for searches like "red")
            if (companyName.startsWith(queryLower)) {
                return true;
            }

            // 5. Check for words that START with query
            const companyWords = companyName.split(/\s+/);
            if (companyWords.some(word => word.startsWith(queryLower))) {
                return true;
            }

            return false;
        });
    }, [allTickers]);

    // Rank and combine results
    const rankResults = useCallback((tickers: Ticker[], marketData: { tickers: MarketDataTicker[] }, query: string): StockResult[] => {
        const queryUpper = query.toUpperCase();
        const queryLower = query.toLowerCase();

        // Use a Set to track unique tickers
        const uniqueTickersMap = new Map<string, StockResult>();

        // Combine ticker and market data
        tickers.forEach(ticker => {
            const marketInfo = marketData.tickers?.find(t => t.ticker === ticker.ticker);
            const tickerSymbol = String(ticker.ticker || '').toUpperCase();
            const companyName = String(ticker.name || '').toLowerCase();

            // Parse volume safely
            let volume = 0;
            if (marketInfo?.day?.v) {
                volume = parseFloat(String(marketInfo.day.v));
            }

            // Check if this is an exact ticker match
            const isExactTickerMatch = tickerSymbol === queryUpper;

            // Check for word match in company name
            const companyWords = companyName.split(/\s+/);
            const hasExactWordMatch = companyWords.some(word => word === queryLower);
            const hasWordStartingWithQuery = companyWords.some(word => word.startsWith(queryLower));

            // Only add if not already in the map, or if this entry is a better match
            const existingEntry = uniqueTickersMap.get(tickerSymbol);
            const newEntry = {
                ticker: ticker.ticker,
                name: ticker.name,
                volume: volume,
                price: marketInfo?.day?.c || 0,
                change: marketInfo?.todaysChangePerc || 0,
                isExactTickerMatch,
                hasExactWordMatch,
                hasWordStartingWithQuery
            };

            if (!existingEntry ||
                (isExactTickerMatch && !existingEntry.isExactTickerMatch) ||
                (volume > existingEntry.volume)) {
                uniqueTickersMap.set(tickerSymbol, newEntry);
            }
        });

        // Convert map to array and sort
        return Array.from(uniqueTickersMap.values()).sort((a, b) => {
            // Only exact ticker matches get special treatment
            if (a.isExactTickerMatch && !b.isExactTickerMatch) return -1;
            if (!a.isExactTickerMatch && b.isExactTickerMatch) return 1;

            // Otherwise, sort STRICTLY by volume
            if (a.volume !== b.volume) {
                return b.volume - a.volume; // Higher volume first
            }

            // If volumes are equal, alphabetical by ticker
            // Make sure ticker is a string before using localeCompare
            const tickerA = typeof a.ticker === 'string' ? a.ticker : String(a.ticker || '');
            const tickerB = typeof b.ticker === 'string' ? b.ticker : String(b.ticker || '');
            return tickerA.localeCompare(tickerB);
        });
    }, []);

    // Format volume with K/M suffix
    const formatVolume = (volume: number): string => {
        if (!volume) return '0';
        if (volume >= 1000000) return (volume / 1000000).toFixed(2) + 'M';
        if (volume >= 1000) return (volume / 1000).toFixed(2) + 'K';
        return volume.toString();
    };

    // Format price to 2 decimal places
    const formatPrice = (price: number): string => {
        if (!price) return '0.00';
        return price.toFixed(2);
    };

    // Format change percentage
    const formatChange = (change: number): string => {
        if (!change) return '0.00';
        return change.toFixed(2);
    };

    // Search function
    const performSearch = useCallback(async () => {
        const query = searchQuery.trim();

        if (!query) {
            setResults([]);
            setStatus(`Loaded ${allTickers.length} tickers. Type to search.`);
            return;
        }

        if (!isDataLoaded) {
            setStatus('Still loading tickers...');
            return;
        }

        setIsLocalLoading(true);
        setStatus(`Searching for "${query}"...`);

        try {
            // Special handling for single-letter searches
            const isSingleLetter = query.length === 1;
            let matchedTickers: Ticker[];

            if (isSingleLetter) {
                // For single letters, get all tickers STARTING with that letter
                const queryUpper = query.toUpperCase();
                matchedTickers = allTickers.filter(ticker => {
                    const tickerSymbol = String(ticker.ticker || '').toUpperCase();
                    return tickerSymbol.startsWith(queryUpper);
                });
            } else {
                // For longer queries, do more comprehensive search
                matchedTickers = searchAllTickers(query);
            }

            // Sort the results for multi-letter queries
            if (matchedTickers.length > 0 && !isSingleLetter) {
                // Pre-score for sorting (emphasize starts with)
                const queryLower = query.toLowerCase();
                const queryUpper = query.toUpperCase();

                interface ScoredResult {
                    ticker: Ticker;
                    score: number;
                }

                const scoredResults: ScoredResult[] = matchedTickers.map(ticker => {
                    const tickerSymbol = String(ticker.ticker || '').toUpperCase();
                    const companyName = String(ticker.name || '').toLowerCase();
                    let score = 0;

                    // Scoring logic with higher priority for "starts with"
                    if (tickerSymbol === queryUpper) {
                        score += 10000; // Exact ticker match
                    } else if (tickerSymbol.startsWith(queryUpper)) {
                        score += 5000;  // Ticker starts with query
                    }

                    // Give high priority to names that START with query
                    if (companyName.startsWith(queryLower)) {
                        score += 3000;  // Company name starts with query
                    }

                    // Check words that START with query
                    const companyWords = companyName.split(/\s+/);
                    if (companyWords.some(word => word.startsWith(queryLower))) {
                        score += 1000;  // Word starts with query
                    }

                    return { ticker, score };
                });

                // Sort by score but don't limit the results
                matchedTickers = scoredResults
                    .sort((a, b) => b.score - a.score)
                    .map(item => item.ticker);
            }

            if (matchedTickers.length === 0) {
                setResults([]);
                setStatus('No matches found');
                setIsLocalLoading(false);
                return;
            }

            // Get market data
            setStatus(`Found ${matchedTickers.length} matches. Getting market data...`);

            try {
                const tickerSymbols = matchedTickers.map(t => t.ticker).join(',');
                const marketData = await fetchMarketData(tickerSymbols);

                // Combine and rank results
                const finalResults = rankResults(matchedTickers, marketData, query);

                // Display results
                setResults(finalResults);
                setStatus(`Showing ${finalResults.length} results for "${query}"`);
            } catch (error) {
                // Fallback for errors - try with fewer symbols
                if (matchedTickers.length > 300) {
                    console.log("Trying with fewer tickers due to error");
                    const reducedBatch = matchedTickers.slice(0, 300);
                    const reducedSymbols = reducedBatch.map(t => t.ticker).join(',');
                    const marketData = await fetchMarketData(reducedSymbols);

                    // Combine and rank results with reduced batch
                    const finalResults = rankResults(reducedBatch, marketData, query);

                    // Display results
                    setResults(finalResults);
                    setStatus(`Showing ${finalResults.length} results for "${query}" (limited due to size)`);
                } else {
                    throw error; // Re-throw if we can't recover
                }
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Search error:', error);
            setStatus(`Error: ${errorMessage}`);
        }

        setIsLocalLoading(false);
    }, [searchQuery, isDataLoaded, allTickers, searchAllTickers, fetchMarketData, rankResults]);

    // When search query changes, perform search and open dropdown
    useEffect(() => {
        if (searchQuery.trim().length === 0) {
            // Immediately clear results and close dropdown when search is empty
            setResults([]);
            setIsDropdownOpen(false);
            setStatus(`Loaded ${allTickers.length} tickers. Type to search.`);
            return;
        }

        // For non-empty queries, use debouncing to avoid too many searches
        const timer = setTimeout(() => {
            performSearch();
            setIsDropdownOpen(true);
        }, 400);

        return () => clearTimeout(timer);
    }, [searchQuery, performSearch, allTickers.length]);

    return (
        <div className={`relative ${className || ''}`} ref={searchContainerRef}>
            <div className="relative">
                <input
                    type="text"
                    className="w-full p-2 text-lg border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    placeholder="Search by company name or ticker (e.g., Amazon, AAPL)"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onClick={() => {
                        if (results.length > 0) {
                            setIsDropdownOpen(true);
                        }
                    }}
                />
                {isLoading && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                    </div>
                )}
            </div>

            {results.length > 0 && isDropdownOpen && (
                <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-96 overflow-y-auto">
                    <table className="w-full border-collapse">
                        <thead className="sticky top-0 bg-gray-50">
                            <tr>
                                <th className="p-2.5 text-left text-xs font-medium text-black uppercase tracking-wider border-b">Ticker</th>
                                <th className="p-2.5 text-left text-xs font-medium text-black uppercase tracking-wider border-b">Company</th>
                                <th className="p-2.5 text-left text-xs font-medium text-black uppercase tracking-wider border-b">Volume</th>
                                <th className="p-2.5 text-left text-xs font-medium text-black uppercase tracking-wider border-b">Price</th>
                                <th className="p-2.5 text-left text-xs font-medium text-black uppercase tracking-wider border-b">Change</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map(stock => (
                                <tr
                                    key={stock.ticker}
                                    className={`hover:bg-blue-50 transition-colors ${stock.isExactTickerMatch ? 'bg-blue-50' : ''} ${stock.ticker === selectedTicker ? 'bg-blue-100' : ''} cursor-pointer border-b border-gray-200`}
                                    onClick={() => {
                                        setInternalSelectedTicker(stock.ticker);
                                        if (onSelectTicker) {
                                            onSelectTicker(stock.ticker);
                                        }
                                        setIsDropdownOpen(false); // Close dropdown when an option is selected
                                    }}
                                >
                                    <td className="p-2.5 font-medium text-black">{stock.ticker}</td>
                                    <td className="p-2.5 text-black">{stock.name}</td>
                                    <td className="p-2.5 text-black">{formatVolume(stock.volume)}</td>
                                    <td className="p-2.5 text-black">${formatPrice(stock.price)}</td>
                                    <td
                                        className={`p-2.5 font-medium ${stock.change > 0 ? 'text-green-600' : stock.change < 0 ? 'text-red-600' : 'text-black'}`}
                                    >
                                        {formatChange(stock.change)}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {apiError && (
                <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
                    API Error: {apiError}
                </div>
            )}
        </div>
    );
};

export default CoreSearch;