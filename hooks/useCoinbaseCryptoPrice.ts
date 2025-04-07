import { useState, useEffect, useRef, useCallback } from 'react';

// Define WebSocket message interface
interface WebSocketMessage {
    data: string;
}

// Define WebSocket close event interface
interface WebSocketCloseEvent {
    code: number;
    reason: string;
}

// Define trade data interface for Coinbase
interface CoinbaseTrade {
    type: string;
    sequence: number;
    product_id: string;
    price: string;
    open_24h: string;
    volume_24h: string;
    low_24h: string;
    high_24h: string;
    volume_30d: string;
    best_bid: string;
    best_ask: string;
    side: string;
    time: string;
    trade_id: number;
    last_size: string;
}

// Interface for ticker message
interface TickerMessage {
    type: string;
    sequence: number;
    product_id: string;
    price: string;
    time: string;
    side: string;
    last_size: string;
    trade_id: number;
    open_24h?: string;
    volume_24h?: string;
    low_24h?: string;
    high_24h?: string;
    [key: string]: any; // For other fields that might be present
}

// Interface to store processed trade data
interface ProcessedTrade {
    product_id: string;   // e.g., "BTC-USD"
    price: number;        // Price as a number
    size: number;         // Size/volume as a number
    timestamp: number;    // Timestamp in milliseconds
    side: string;         // "buy" or "sell"
    trade_id: number;     // Unique trade ID
}

// Define the return type for our hook
interface CoinbaseCryptoPriceHook {
    status: string;
    error: string | null;
    lastPrice: number | null;
    lastTicker: TickerMessage | null;
    productId: string;
    tradeMessages: ProcessedTrade[];
    reconnect: () => void;
    subscribe: (newProductId: string) => void;
}

// Utility function to convert ticker format
export const convertTickerFormat = (input: string): string => {
    // If already in BTC-USD format, return as-is
    if (/^[A-Z]+-USD$/.test(input)) {
        return input;
    }

    // Remove X: prefix if present
    let formatted = input.replace('X:', '');

    // Remove any existing USD/USDT suffix
    formatted = formatted.replace(/(USD|USDT)$/, '');

    // Ensure base and quote currencies are correctly separated
    if (!formatted.includes('-')) {
        // Assuming standard 3-char crypto base and 3-char quote
        if (formatted.length >= 6) {
            const base = formatted.substring(0, 3);
            const quote = formatted.substring(3);
            formatted = `${base}-${quote}`;
        }
    }

    // Ensure quote is USD
    if (!formatted.endsWith('-USD')) {
        formatted = `${formatted}-USD`;
    }

    return formatted;
};

// Constants
const COINBASE_WS_URL = 'wss://ws-feed.exchange.coinbase.com';

/**
 * Custom hook for Coinbase WebSocket cryptocurrency data
 * @param initialProductId - The product ID (e.g. "BTC-USD")
 */
function useCoinbaseCryptoPrice(
    initialProductId: string = 'BTC-USD'
): CoinbaseCryptoPriceHook {
    // State
    const [status, setStatus] = useState('Disconnected');
    const [error, setError] = useState<string | null>(null);
    const [lastPrice, setLastPrice] = useState<number | null>(null);
    const [lastTicker, setLastTicker] = useState<TickerMessage | null>(null);
    const [productId, setProductId] = useState(convertTickerFormat(initialProductId));
    const [tradeMessages, setTradeMessages] = useState<ProcessedTrade[]>([]);
    const [isInitialConnection, setIsInitialConnection] = useState(true);

    // Refs
    const wsRef = useRef<WebSocket | null>(null);
    const currentProductIdRef = useRef(convertTickerFormat(initialProductId));

    // Connect to WebSocket
    const connect = useCallback((targetProductId: string): void => {
        // Clean up existing connection
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        const formattedProductId = convertTickerFormat(targetProductId);
        currentProductIdRef.current = formattedProductId;

        // Only set these if not initial connection
        if (!isInitialConnection) {
            setStatus('Connecting...');
            setError(null);
            setProductId(formattedProductId);
        }

        try {
            const ws = new WebSocket(COINBASE_WS_URL);
            wsRef.current = ws;

            ws.onopen = (): void => {
                setIsInitialConnection(false);
                setStatus('Connected');
                setError(null);

                const subscribeMsg = {
                    type: 'subscribe',
                    product_ids: [formattedProductId],
                    channels: ['ticker', 'matches']
                };
                ws.send(JSON.stringify(subscribeMsg));
            };

            ws.onclose = (event: CloseEvent): void => {
                if (!isInitialConnection) {
                    console.log(`WebSocket closed: ${event.code} - ${event.reason}`);
                    setStatus(`Disconnected (${event.code}${event.reason ? ': ' + event.reason : ''})`);
                    if (event.code !== 1000 && event.code !== 1001) {
                        setError(`Connection closed (${event.code}${event.reason ? ': ' + event.reason : ''})`);
                    }
                }
            };

            ws.onerror = (event: Event): void => {
                if (!isInitialConnection) {
                    console.error('WebSocket error:', event);
                    setStatus('Error');
                    setError('WebSocket connection error');
                }
            };

            // Handle incoming messages
            ws.onmessage = (event: MessageEvent): void => {
                try {
                    const data = JSON.parse(event.data);

                    // Set isInitialConnection to false on first successful message
                    if (isInitialConnection) {
                        setIsInitialConnection(false);
                        setError(null);
                    }

                    // Handle different message types
                    switch (data.type) {
                        case 'subscriptions':
                            console.log('Subscribed to channels:', data.channels);
                            setStatus('Subscribed');
                            break;

                        case 'ticker':
                            // Process ticker update
                            const price = parseFloat(data.price);
                            setLastPrice(price);
                            setLastTicker(data);

                            // Create processed trade from ticker
                            const processedTrade: ProcessedTrade = {
                                product_id: data.product_id,
                                price: price,
                                size: parseFloat(data.last_size),
                                timestamp: new Date(data.time).getTime(),
                                side: data.side,
                                trade_id: data.trade_id
                            };

                            // Add to trade messages
                            setTradeMessages(prev => {
                                // Keep only the most recent 100 trades
                                const newMessages = [...prev, processedTrade].slice(-100);
                                return newMessages;
                            });
                            break;

                        case 'match':
                            // Process match (individual trade)
                            const matchPrice = parseFloat(data.price);

                            // Create processed trade from match
                            const matchTrade: ProcessedTrade = {
                                product_id: data.product_id,
                                price: matchPrice,
                                size: parseFloat(data.size),
                                timestamp: new Date(data.time).getTime(),
                                side: data.side,
                                trade_id: data.trade_id
                            };

                            // Add to trade messages
                            setTradeMessages(prev => {
                                // Keep only the most recent 100 trades
                                const newMessages = [...prev, matchTrade].slice(-100);
                                return newMessages;
                            });
                            break;

                        case 'error':
                            console.error('WebSocket error message:', data);
                            setError(`Coinbase error: ${data.message}`);
                            break;

                        default:
                            // Ignore other message types
                            break;
                    }
                } catch (err) {
                    if (!isInitialConnection) {
                        console.error('Error processing message:', err);
                    }
                }
            };

        } catch (err) {
            if (!isInitialConnection) {
                console.error('Error setting up WebSocket:', err);
                setStatus('Setup Error');
                setError(`WebSocket setup failed: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
    }, [isInitialConnection]);

    // Subscribe to a new product ID
    const subscribe = useCallback((newProductId: string): void => {
        connect(newProductId);
    }, [connect]);

    // Reconnect function
    const reconnect = useCallback((): void => {
        connect(currentProductIdRef.current);
    }, [connect]);

    // Initial connection effect
    useEffect(() => {
        connect(initialProductId);

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [initialProductId, connect]);

    return {
        status,
        error,
        lastPrice,
        lastTicker,
        productId,
        tradeMessages,
        reconnect,
        subscribe
    };
}

// Make sure to use a named export AND a default export
export { useCoinbaseCryptoPrice };
export default useCoinbaseCryptoPrice;