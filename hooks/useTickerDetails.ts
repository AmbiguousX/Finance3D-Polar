import { useState, useCallback } from 'react';
import { useTickerPricing } from './useTickerPriceRange';

// Type definitions remain the same
export interface TickerAddress {
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
}

export interface TickerBranding {
    logo_url?: string;
    icon_url?: string;
}

export interface TickerDetails {
    ticker: string;
    name?: string;
    market?: string;
    locale?: string;
    primary_exchange?: string;
    type?: string;
    active?: boolean;
    currency_name?: string;
    cik?: string;
    composite_figi?: string;
    share_class_figi?: string;
    market_cap?: number;
    phone_number?: string;
    address?: TickerAddress;
    description?: string;
    sic_code?: string;
    sic_description?: string;
    ticker_root?: string;
    ticker_suffix?: string;
    homepage_url?: string;
    total_employees?: number;
    list_date?: string;
    branding?: TickerBranding;
    share_class_shares_outstanding?: number;
    weighted_shares_outstanding?: number;
    round_lot?: number;
    delisted_utc?: string;
    lastUpdated: number;
    currentPrice?: number;
    dataSource?: string;
}

export interface UseTickerDetailsResult {
    tickerDetails: TickerDetails | null;
    isLoading: boolean;
    error: string | null;
    fetchTickerDetails: (ticker: string, date?: string) => Promise<TickerDetails | null>;
}

export const useTickerDetails = (): UseTickerDetailsResult => {
    const [tickerDetails, setTickerDetails] = useState<TickerDetails | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [tickerCache, setTickerCache] = useState<Record<string, TickerDetails>>({});

    // Import functions from useTickerPricing hook
    const { fetchTickerPrice } = useTickerPricing();

    // Helper function to check if the data is complete
    const isCompleteData = (data: TickerDetails): boolean => {
        // Check for essential fields that might be missing
        const essentialFields = [
            'market_cap',
            'description',
            'homepage_url',
            'total_employees',
            'branding'
        ];

        // Return true if at least 3 of the 5 essential fields are present
        const presentFieldsCount = essentialFields.filter(field => {
            const value = data[field as keyof TickerDetails];
            // For branding, check if logo_url exists
            if (field === 'branding' && value) {
                return (value as TickerBranding).logo_url !== undefined;
            }
            return value !== undefined && value !== null;
        }).length;

        console.log(`Data completeness: ${presentFieldsCount}/5 essential fields present`);
        return presentFieldsCount >= 3;
    };

    // Helper function to calculate market cap if missing
    const calculateMarketCap = async (ticker: string, shares: number): Promise<number | undefined> => {
        try {
            console.log(`Fetching price for ${ticker} using useTickerPricing hook`);
            const pricingData = await fetchTickerPrice(ticker);

            if (pricingData && typeof pricingData.close === 'number') {
                console.log(`Retrieved price for ${ticker}: ${pricingData.close}`);
                return pricingData.close * shares;
            }

            console.log('Failed to get price from useTickerPricing');
            return undefined;
        } catch (error) {
            console.error('Error calculating market cap:', error);
            return undefined;
        }
    };

    // Try to find the best historical data by going back day by day
    const findHistoricalData = async (
        ticker: string,
        baseUrl: string,
        apiKey: string,
        maxDaysBack: number = 7
    ): Promise<TickerDetails | null> => {
        console.log(`Searching for historical data, going back up to ${maxDaysBack} days`);

        for (let daysBack = 1; daysBack <= maxDaysBack; daysBack++) {
            const historicalDate = new Date();
            historicalDate.setDate(historicalDate.getDate() - daysBack);
            const dateStr = historicalDate.toISOString().split('T')[0];

            const historicalUrl = `${baseUrl}?apiKey=${apiKey}&date=${dateStr}`;
            console.log(`Trying historical date (${daysBack} days ago): ${dateStr}`);

            try {
                const historicalResponse = await fetch(historicalUrl);
                const historicalData = await historicalResponse.json();

                if (historicalResponse.ok && historicalData.results) {
                    const histDetails = {
                        ...historicalData.results,
                        lastUpdated: Date.now(),
                        dataSource: `historical-${daysBack}d`
                    };

                    console.log(`Data from ${dateStr}:`, {
                        market_cap: histDetails.market_cap,
                        total_employees: histDetails.total_employees,
                        branding: histDetails.branding?.logo_url ? 'present' : 'missing',
                        description: histDetails.description ? 'present' : 'missing'
                    });

                    if (isCompleteData(histDetails)) {
                        console.log(`Found complete data from ${daysBack} days ago (${dateStr})`);
                        return histDetails;
                    }
                }
            } catch (error) {
                console.error(`Error fetching data for ${dateStr}:`, error);
            }
        }

        console.log('Failed to find complete historical data after trying multiple dates');
        return null;
    };

    // Combine current and historical data, preferring the most complete fields
    const mergeTickerData = (current: TickerDetails, historical: TickerDetails): TickerDetails => {
        // Create a merged object that starts with historical data as the base
        // Then overlay the current data on top, but preserve specific fields from historical
        // when they're missing in current
        const fieldsToPreserve = [
            'market_cap', 'description', 'homepage_url', 'total_employees',
            'branding', 'address', 'phone_number', 'sic_code', 'sic_description'
        ];

        // Start with a copy of historical data
        const merged: TickerDetails = { ...historical };

        // Overlay all current data
        Object.entries(current).forEach(([key, value]) => {
            if (key === 'lastUpdated' || value !== undefined) {
                (merged as any)[key] = value;
            }
        });

        // Track which fields we kept from historical
        fieldsToPreserve.forEach(field => {
            if (!current[field as keyof TickerDetails] && historical[field as keyof TickerDetails]) {
                console.log(`Preserved ${field} from historical data`);
            }
        });

        // Ensure we keep the current data source tracking
        merged.dataSource = current.dataSource;

        return merged;
    };

    // Modified fetch function to try multiple historical dates if needed
    const fetchTickerDetails = useCallback(async (
        ticker: string,
        date?: string
    ): Promise<TickerDetails | null> => {
        if (!ticker) {
            setError("No ticker provided");
            return null;
        }

        const normalizedTicker = ticker.toUpperCase();
        setIsLoading(true);
        setError(null);

        // Check cache first
        const cacheKey = `${normalizedTicker}_${date || 'latest'}`;
        if (tickerCache[cacheKey]) {
            console.log('Using cached ticker data for:', normalizedTicker);
            setTickerDetails(tickerCache[cacheKey]);
            setIsLoading(false);
            return tickerCache[cacheKey];
        }

        try {
            const API_KEY = process.env.NEXT_PUBLIC_POLYGON_API_KEY;
            const TICKER_DETAILS_URL = `https://api.polygon.io/v3/reference/tickers/${normalizedTicker}`;

            console.group(`Fetching Ticker Details for ${normalizedTicker}`);
            console.log('API Key:', API_KEY ? 'Present' : 'Missing');
            console.log('Ticker:', normalizedTicker);

            // Try current date first (or the specified date)
            let url = `${TICKER_DETAILS_URL}?apiKey=${API_KEY}`;
            if (date) {
                url += `&date=${date}`;
                console.log('Specific date used:', date);
            } else {
                console.log('Using default most recent date');
            }

            let response = await fetch(url);
            let data = await response.json();
            console.log('Initial API Response Status:', response.status);

            // Process current data
            if (response.ok && data.results) {
                let companyData: TickerDetails = {
                    ...data.results,
                    lastUpdated: Date.now(),
                    dataSource: 'current'
                };

                console.log('Current data fields:', {
                    market_cap: companyData.market_cap,
                    total_employees: companyData.total_employees,
                    branding: companyData.branding?.logo_url ? 'present' : 'missing',
                    description: companyData.description ? 'present' : 'missing'
                });

                // If data is incomplete, try historical data
                if (!isCompleteData(companyData)) {
                    console.log('Current data is incomplete, searching historical data...');

                    // Try to find historical data with more complete information
                    const historicalData = await findHistoricalData(
                        normalizedTicker,
                        TICKER_DETAILS_URL,
                        API_KEY as string
                    );

                    if (historicalData && isCompleteData(historicalData)) {
                        // Merge the data, keeping the most complete information
                        companyData = mergeTickerData(companyData, historicalData);
                        console.log('Successfully merged with historical data');
                    }
                }

                // If market cap is still missing but we have shares outstanding, calculate it
                if (!companyData.market_cap &&
                    (companyData.share_class_shares_outstanding || companyData.weighted_shares_outstanding)) {
                    console.log('Market cap missing, attempting to calculate...');
                    const shares = companyData.weighted_shares_outstanding ||
                        companyData.share_class_shares_outstanding;

                    if (shares) {
                        const calculatedMarketCap = await calculateMarketCap(normalizedTicker, shares);
                        if (calculatedMarketCap) {
                            companyData.market_cap = calculatedMarketCap;
                            console.log('Calculated market cap:', calculatedMarketCap);
                        }
                    }
                }

                // Log final results
                console.log('Final data fields:');
                console.log('Market Cap:', companyData.market_cap);
                console.log('Total Employees:', companyData.total_employees);
                console.log('List Date:', companyData.list_date);
                console.log('Logo URL:', companyData.branding?.logo_url);
                console.log('Homepage URL:', companyData.homepage_url);
                console.log('Description:', companyData.description ? 'present' : 'missing');
                console.log('Data Source:', companyData.dataSource);

                // Cache the result
                setTickerCache(prev => ({
                    ...prev,
                    [cacheKey]: companyData
                }));

                // Set and return the details
                setTickerDetails(companyData);
                setIsLoading(false);
                console.groupEnd();
                return companyData;
            } else {
                console.error('API Error:', data.error || response.statusText);
                throw new Error(`Failed to fetch ticker details: ${data.error || response.statusText}`);
            }
        } catch (error: unknown) {
            console.groupEnd();
            const errorMessage = error instanceof Error ? error.message : 'Unknown error fetching ticker details';
            console.error(`Error fetching ticker details for ${normalizedTicker}:`, errorMessage);
            setError(errorMessage);
            setIsLoading(false);
            return null;
        }
    }, [tickerCache, fetchTickerPrice]);

    return { tickerDetails, isLoading, error, fetchTickerDetails };
};