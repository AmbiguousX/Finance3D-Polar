import React, { useState, useEffect, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { CryptoDataTicker, useCryptoSnapshot } from '../../hooks/useCryptoSnapshot';

// Type definitions
interface Ticker {
    ticker: string;
    name: string;
}

interface CryptoResult {
    ticker: string;
    displayTicker: string; // This will be ticker without the 'X:' prefix
    name: string;
    volume: number;
    price: number;
    volumeUSD: number; // Previously called marketCap, renamed to volumeUSD
    change: number;
    isExactTickerMatch: boolean;
    hasExactWordMatch: boolean;
    hasWordStartingWithQuery: boolean;
}

interface CryptoSearchProps {
    className?: string;
    onSelectTicker?: (ticker: string) => void;
    selectedTicker?: string;
}

const CryptoSearch: React.FC<CryptoSearchProps> = ({ className, onSelectTicker, selectedTicker: externalSelectedTicker }) => {
    // App state
    const [allTickers, setAllTickers] = useState<Ticker[]>([]);
    const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [status, setStatus] = useState<string>('Type to search');
    const [results, setResults] = useState<CryptoResult[]>([]);
    const [isLocalLoading, setIsLocalLoading] = useState<boolean>(false);
    const [internalSelectedTicker, setInternalSelectedTicker] = useState<string>('');

    // Use external or internal selected ticker
    const selectedTicker = externalSelectedTicker || internalSelectedTicker;

    // Custom hook for crypto market data
    const { fetchCryptoData, isLoading: isApiLoading, error: apiError } = useCryptoSnapshot();

    // Combined loading state
    const isLoading = isLocalLoading || isApiLoading;

    // Add state to track when dropdown should be visible
    const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
    const searchContainerRef = useRef<HTMLDivElement>(null);

    // Function to remove 'X:' prefix for display purposes
    const removeXPrefix = (ticker: string): string => {
        if (ticker && ticker.startsWith('X:')) {
            return ticker.substring(2);
        }
        return ticker;
    };

    // Function to ensure ticker has 'X:' prefix for API calls
    const ensureXPrefix = (ticker: string): string => {
        if (ticker && !ticker.startsWith('X:')) {
            return `X:${ticker}`;
        }
        return ticker;
    };

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
            setStatus('Loading crypto tickers...');

            try {
                const response = await fetch('/crypto_tickers.csv');

                if (!response.ok) {
                    throw new Error(`Failed to load crypto_tickers.csv: ${response.status} ${response.statusText}`);
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
                                name: row.name || row.currency || row.NAME || row.CURRENCY || ''
                            }))
                            .filter((row: Ticker) => row.ticker && row.name);

                        console.log("Processed crypto tickers from CSV:", processedTickers.length);

                        if (processedTickers.length > 0) {
                            setAllTickers(processedTickers);
                            setIsDataLoaded(true);
                            setStatus(`Loaded ${processedTickers.length} crypto tickers. Type to search.`);
                            setIsLocalLoading(false);
                        } else {
                            throw new Error("No valid crypto tickers found in CSV");
                        }
                    },
                    error: (err: Error | { message: string }) => {
                        console.error('CSV parsing error:', err);
                        throw new Error(`CSV parsing error: ${err.message}`);
                    }
                });
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error('Error loading crypto tickers:', error);
                setStatus(`Error loading crypto tickers: ${errorMessage}`);
                setIsLocalLoading(false);
            }
        };

        initialize();
    }, []);

    // Search for matches in all tickers
    const searchAllTickers = useCallback((query: string): Ticker[] => {
        const queryUpper = query.toUpperCase();
        const queryLower = query.toLowerCase();

        // Special case for searching partial ticker symbols like "bt" should find "btc"
        const isPartialTickerSearch = queryUpper.length <= 3;

        return allTickers.filter(ticker => {
            // Get ticker symbol without X: prefix and company name safely
            const fullTickerSymbol = String(ticker.ticker || '').toUpperCase();
            const tickerSymbol = removeXPrefix(fullTickerSymbol).toUpperCase();
            const currencyName = String(ticker.name || '').toLowerCase();

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

            // 4. Currency name STARTS with query (this is crucial for searches like "bit")
            if (currencyName.startsWith(queryLower)) {
                return true;
            }

            // 5. Check for words that START with query
            const currencyWords = currencyName.split(/\s+/);
            if (currencyWords.some(word => word.startsWith(queryLower))) {
                return true;
            }

            return false;
        });
    }, [allTickers]);

    // Rank and combine results
    const rankResults = useCallback((tickers: Ticker[], marketData: { tickers: CryptoDataTicker[] }, query: string): CryptoResult[] => {
        const queryUpper = query.toUpperCase();
        const queryLower = query.toLowerCase();

        // Use a Map to track unique tickers
        const uniqueTickersMap = new Map<string, CryptoResult>();

        // Combine ticker and market data
        tickers.forEach(ticker => {
            const fullTickerSymbol = String(ticker.ticker || '').toUpperCase();
            // Find market info using the full ticker (with X: prefix)
            const marketInfo = marketData.tickers?.find(t => t.ticker === fullTickerSymbol);

            // For matching and display, use the ticker without the X: prefix
            const displayTickerSymbol = removeXPrefix(fullTickerSymbol).toUpperCase();
            const currencyName = String(ticker.name || '').toLowerCase();

            // Parse volume and price safely
            let volume = 0;
            let price = 0;
            let volumeUSD = 0;

            // Use prevDay for volume when available for more complete data
            if (marketInfo?.prevDay?.v) {
                volume = parseFloat(String(marketInfo.prevDay.v));
            } else if (marketInfo?.day?.v) {
                // Fallback to current day volume if prevDay not available
                volume = parseFloat(String(marketInfo.day.v));
            }

            // Get price from lastTrade or day close
            if (marketInfo?.lastTrade?.p) {
                price = parseFloat(String(marketInfo.lastTrade.p));
            } else if (marketInfo?.day?.c) {
                price = parseFloat(String(marketInfo.day.c));
            }

            // Calculate volume in USD using volume weighted average price when available
            if (marketInfo?.prevDay?.v && marketInfo?.prevDay?.vw) {
                // Use previous day's VWAP for more accurate calculation
                const prevDayVolume = parseFloat(String(marketInfo.prevDay.v));
                const prevDayVWAP = parseFloat(String(marketInfo.prevDay.vw));
                volumeUSD = prevDayVolume * prevDayVWAP;
            } else if (marketInfo?.day?.v && marketInfo?.day?.vw) {
                // Fallback to current day VWAP
                const dayVolume = parseFloat(String(marketInfo.day.v));
                const dayVWAP = parseFloat(String(marketInfo.day.vw));
                volumeUSD = dayVolume * dayVWAP;
            } else {
                // Final fallback to simple volume * price
                volumeUSD = volume * price;
            }

            // Check if this is an exact ticker match
            const isExactTickerMatch = displayTickerSymbol === queryUpper;

            // Check for word match in currency name
            const currencyWords = currencyName.split(/\s+/);
            const hasExactWordMatch = currencyWords.some(word => word === queryLower);
            const hasWordStartingWithQuery = currencyWords.some(word => word.startsWith(queryLower));

            // Only add if not already in the map, or if this entry is a better match
            const existingEntry = uniqueTickersMap.get(displayTickerSymbol);
            const newEntry = {
                ticker: fullTickerSymbol, // Keep full ticker with X: for API calls
                displayTicker: displayTickerSymbol, // Display ticker without X:
                name: ticker.name,
                volume: volume,
                price: price,
                volumeUSD: volumeUSD, // Renamed from marketCap to volumeUSD
                change: marketInfo?.todaysChangePerc || 0,
                isExactTickerMatch,
                hasExactWordMatch,
                hasWordStartingWithQuery
            };

            if (!existingEntry ||
                (isExactTickerMatch && !existingEntry.isExactTickerMatch) ||
                (volumeUSD > existingEntry.volumeUSD)) {
                uniqueTickersMap.set(displayTickerSymbol, newEntry);
            }
        });

        // Convert map to array and sort
        return Array.from(uniqueTickersMap.values()).sort((a, b) => {
            // Only exact ticker matches get special treatment
            if (a.isExactTickerMatch && !b.isExactTickerMatch) return -1;
            if (!a.isExactTickerMatch && b.isExactTickerMatch) return 1;

            // Otherwise, sort by volume USD (previously market cap)
            if (a.volumeUSD !== b.volumeUSD) {
                return b.volumeUSD - a.volumeUSD; // Higher volume first
            }

            // If volumes are equal, alphabetical by ticker
            return a.displayTicker.localeCompare(b.displayTicker);
        });
    }, []);

    // Format volume with K/M suffix
    const formatVolume = (volume: number): string => {
        if (!volume) return '0';
        if (volume >= 1000000) return (volume / 1000000).toFixed(2) + 'M';
        if (volume >= 1000) return (volume / 1000).toFixed(2) + 'K';
        return volume.toString();
    };

    // Format price to appropriate decimal places based on value
    const formatPrice = (price: number): string => {
        if (!price) return '0.00';

        // For very low priced cryptos, show more decimal places
        if (price < 0.01) return price.toFixed(6);
        if (price < 1) return price.toFixed(4);
        return price.toFixed(2);
    };

    // Format change percentage
    const formatChange = (change: number): string => {
        if (!change) return '0.00';
        return change.toFixed(2);
    };

    // Format volume USD (previously marketCap) with K/M/B suffix
    const formatVolumeUSD = (volumeUSD: number): string => {
        if (!volumeUSD) return '$0';
        if (volumeUSD >= 1000000000) return '$' + (volumeUSD / 1000000000).toFixed(2) + 'B';
        if (volumeUSD >= 1000000) return '$' + (volumeUSD / 1000000).toFixed(2) + 'M';
        if (volumeUSD >= 1000) return '$' + (volumeUSD / 1000).toFixed(2) + 'K';
        return '$' + volumeUSD.toFixed(2);
    };

    // Search function
    const performSearch = useCallback(async () => {
        const query = searchQuery.trim();

        if (!query) {
            setResults([]);
            setStatus(`Loaded ${allTickers.length} crypto tickers. Type to search.`);
            return;
        }

        if (!isDataLoaded) {
            setStatus('Still loading crypto tickers...');
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
                    const tickerSymbol = removeXPrefix(String(ticker.ticker || '')).toUpperCase();
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
                    const tickerSymbol = removeXPrefix(String(ticker.ticker || '')).toUpperCase();
                    const currencyName = String(ticker.name || '').toLowerCase();
                    let score = 0;

                    // Scoring logic with higher priority for "starts with"
                    if (tickerSymbol === queryUpper) {
                        score += 10000; // Exact ticker match
                    } else if (tickerSymbol.startsWith(queryUpper)) {
                        score += 5000;  // Ticker starts with query
                    }

                    // Give high priority to names that START with query
                    if (currencyName.startsWith(queryLower)) {
                        score += 3000;  // Currency name starts with query
                    }

                    // Check words that START with query
                    const currencyWords = currencyName.split(/\s+/);
                    if (currencyWords.some(word => word.startsWith(queryLower))) {
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

            // Get market data - ensure all tickers have X: prefix for API call
            setStatus(`Found ${matchedTickers.length} matches. Getting crypto market data...`);

            try {
                // Make sure all tickers have X: prefix for the API call
                const tickerSymbols = matchedTickers
                    .map(t => ensureXPrefix(t.ticker))
                    .join(',');

                const marketData = await fetchCryptoData(tickerSymbols);

                // Combine and rank results
                const finalResults = rankResults(matchedTickers, marketData, query);

                // Display results
                setResults(finalResults);
                setStatus(`Showing ${finalResults.length} results for "${query}"`);
            } catch (error) {
                // Fallback for errors - try with fewer symbols
                if (matchedTickers.length > 300) {
                    console.log("Trying with fewer crypto tickers due to error");
                    const reducedBatch = matchedTickers.slice(0, 300);
                    const reducedSymbols = reducedBatch
                        .map(t => ensureXPrefix(t.ticker))
                        .join(',');

                    const marketData = await fetchCryptoData(reducedSymbols);

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
            console.error('Crypto search error:', error);
            setStatus(`Error: ${errorMessage}`);
        }

        setIsLocalLoading(false);
    }, [searchQuery, isDataLoaded, allTickers, searchAllTickers, fetchCryptoData, rankResults]);

    // When search query changes, perform search and open dropdown
    useEffect(() => {
        if (searchQuery.trim().length === 0) {
            // Immediately clear results and close dropdown when search is empty
            setResults([]);
            setIsDropdownOpen(false);
            setStatus(`Loaded ${allTickers.length} crypto tickers. Type to search.`);
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
                    placeholder="Search by cryptocurrency name or ticker (e.g., Bitcoin, BTC)"
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
                                <th className="p-2.5 text-left text-xs font-medium text-black uppercase tracking-wider border-b">Currency</th>
                                <th className="p-2.5 text-left text-xs font-medium text-black uppercase tracking-wider border-b">Volume</th>
                                <th className="p-2.5 text-left text-xs font-medium text-black uppercase tracking-wider border-b">Price</th>
                                <th className="p-2.5 text-left text-xs font-medium text-black uppercase tracking-wider border-b">Volume (USD)</th>
                                <th className="p-2.5 text-left text-xs font-medium text-black uppercase tracking-wider border-b">Change</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map(crypto => (
                                <tr
                                    key={crypto.ticker}
                                    className={`hover:bg-blue-50 transition-colors ${crypto.isExactTickerMatch ? 'bg-blue-50' : ''} ${crypto.ticker === selectedTicker ? 'bg-blue-100' : ''} cursor-pointer border-b border-gray-200`}
                                    onClick={() => {
                                        setInternalSelectedTicker(crypto.ticker);
                                        if (onSelectTicker) {
                                            onSelectTicker(crypto.ticker);
                                        }
                                        setIsDropdownOpen(false); // Close dropdown when an option is selected
                                    }}
                                >
                                    <td className="p-2.5 font-medium text-black">{crypto.displayTicker}</td>
                                    <td className="p-2.5 text-black">{crypto.name}</td>
                                    <td className="p-2.5 text-black">{formatVolume(crypto.volume)}</td>
                                    <td className="p-2.5 text-black">${formatPrice(crypto.price)}</td>
                                    <td className="p-2.5 text-black">{formatVolumeUSD(crypto.volumeUSD)}</td>
                                    <td
                                        className={`p-2.5 font-medium ${crypto.change > 0 ? 'text-green-600' : crypto.change < 0 ? 'text-red-600' : 'text-black'}`}
                                    >
                                        {formatChange(crypto.change)}%
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

export default CryptoSearch;