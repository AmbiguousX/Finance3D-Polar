import { useState, useEffect, useRef, useCallback } from 'react';
import { websocketClient } from "@polygon.io/client-js";

// Define WebSocket message interface
interface WebSocketMessage {
    data: string;
}

// Define WebSocket close event interface
interface WebSocketCloseEvent {
    code: number;
    reason: string;
}

// Define trade data interface
interface TradeMessage {
    ev: string;       // Event type (XT for crypto trades)
    pair: string;     // Crypto pair
    p: number;        // Price
    t: number;        // Timestamp in Unix MS
    s: number;        // Size
    c: number[];      // Conditions (0: empty, 1: sellside, 2: buyside)
    i?: number;       // Trade ID (optional)
    x?: number;       // Crypto exchange ID
    r?: number;       // Additional parameter from documentation
    side?: 'buy' | 'sell' | 'unknown'; // Derived side based on conditions
}

// Define the return type for our hook
interface LiveCryptoPriceHook {
    status: string;
    error: string | null;
    lastPrice: number | null;
    formattedTicker: string;
    tradeMessages: TradeMessage[];
    reconnect: () => void;
    subscribe: (newTicker: string) => void;
}

// Static variables for shared WebSocket
let sharedWsClient: any = null;
let isConnected = false;
let isAuthenticated = false;
let currentSubscriptions: string[] = [];
let apiKeyRef = '';
let connectingPromise: Promise<void> | null = null;
let pendingSubscriptions: Set<string> = new Set();
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;
let reconnectTimer: NodeJS.Timeout | null = null;

// Flag to indicate we're adding a new subscription
let isAddingNewSubscription = false;
let statusUpdateHandlers: Array<(status: string) => void> = [];

// Map to track subscribers for each ticker
const subscribers = new Map<string, Set<(messages: TradeMessage[]) => void>>();

// Register a status update handler
const registerStatusUpdateHandler = (handler: (status: string) => void) => {
    statusUpdateHandlers.push(handler);
    return () => {
        statusUpdateHandlers = statusUpdateHandlers.filter(h => h !== handler);
    };
};

// Update all status handlers except the new one
const updateAllStatusExceptNew = (status: string, excludeHandler?: (status: string) => void) => {
    if (isAddingNewSubscription) {
        // When adding a new subscription, don't update existing charts
        if (excludeHandler) {
            excludeHandler(status);
        }
        return;
    }

    // Normal operation - update all handlers
    statusUpdateHandlers.forEach(handler => {
        handler(status);
    });
};

/**
 * Converts a ticker format to the format expected by Polygon WebSocket API
 */
const convertTickerFormat = (input: string): string => {
    // If already in BTC-USD format, return as is
    if (/^[A-Z]+-USD$/.test(input)) {
        return input;
    }

    // Handle wildcard
    if (input === '*') {
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
        formatted = `${formatted.split('-')[0]}-USD`;
    }

    return formatted;
};

/**
 * Sets up the WebSocket connection
 */
const setupWebSocket = (
    apiKey: string,
    statusCallback: (status: string) => void,
    errorCallback: (error: string | null) => void
): Promise<void> => {
    // Return existing WebSocket if already connected
    if (sharedWsClient && isConnected) {
        return Promise.resolve();
    }

    // Return existing promise if already connecting
    if (connectingPromise) {
        return connectingPromise;
    }

    // Store API key for reconnection
    apiKeyRef = apiKey;

    // Create a promise to track connection setup
    connectingPromise = new Promise<void>((resolve, reject) => {
        let promiseSettled = false;

        try {
            console.log('Creating shared WebSocket connection to Polygon.io');
            // Only update the new chart's status, not existing ones
            if (isAddingNewSubscription) {
                statusCallback('Connecting...');
            } else {
                updateAllStatusExceptNew('Connecting...', statusCallback);
            }
            errorCallback(null);

            // Create WebSocket client
            const cryptoWS = websocketClient(apiKey).crypto();
            sharedWsClient = cryptoWS;

            // Handle connection open
            cryptoWS.onopen = () => {
                console.log('WebSocket connection opened');
                isConnected = true;
                // Only update the new chart's status, not existing ones
                if (isAddingNewSubscription) {
                    statusCallback('Connected');
                } else {
                    updateAllStatusExceptNew('Connected', statusCallback);
                }
                reconnectAttempts = 0;

                // Send authentication immediately
                console.log('Sending authentication...');
                try {
                    cryptoWS.send(JSON.stringify({
                        action: "auth",
                        params: apiKey
                    }));

                    // We'll resolve the promise when authentication succeeds
                    // See the onmessage handler for the auth_success response
                } catch (err) {
                    console.error('Error sending auth after connection:', err);
                    if (!promiseSettled) {
                        promiseSettled = true;
                        reject(err);
                    }
                }
            };

            // Handle connection close
            cryptoWS.onclose = (event: WebSocketCloseEvent) => {
                console.log(`WebSocket closed: ${event.code} - ${event.reason}`);
                isConnected = false;
                isAuthenticated = false;

                // Only update status if not adding a new subscription
                if (!isAddingNewSubscription) {
                    updateAllStatusExceptNew(`Disconnected (${event.code}${event.reason ? ': ' + event.reason : ''})`, statusCallback);
                }

                sharedWsClient = null;
                connectingPromise = null;

                // Only notify subscribers about disconnection if not silently resubscribing
                if (!isAddingNewSubscription) {
                    for (const [ticker, callbacks] of subscribers.entries()) {
                        for (const callback of callbacks) {
                            callback([]);
                        }
                    }
                }

                // Only reject if promise hasn't been settled
                if (!promiseSettled) {
                    promiseSettled = true;
                    reject(new Error(`WebSocket closed: ${event.code}`));
                }

                // Attempt to reconnect (if we have subscribers)
                if (subscribers.size > 0 && reconnectAttempts < maxReconnectAttempts) {
                    reconnectAttempts++;

                    // Clear any existing reconnect timer
                    if (reconnectTimer) {
                        clearTimeout(reconnectTimer);
                    }

                    // Exponential backoff for reconnect (1s, 2s, 4s, 8s, 16s)
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);

                    if (!isAddingNewSubscription) {
                        updateAllStatusExceptNew(`Reconnecting in ${delay / 1000}s...`, statusCallback);
                    } else {
                        console.log(`Silent reconnect in ${delay / 1000}s...`);
                    }

                    reconnectTimer = setTimeout(() => {
                        // Create a new connection
                        setupWebSocket(apiKeyRef, statusCallback, errorCallback)
                            .catch(err => console.error('Reconnection failed:', err));
                    }, delay);
                }
            };

            // Handle errors
            cryptoWS.onerror = (event: Event) => {
                console.error('WebSocket error:', event);

                // Only update status if not adding a new subscription
                if (!isAddingNewSubscription) {
                    updateAllStatusExceptNew('Error', statusCallback);
                    errorCallback('WebSocket connection error');
                }
                // We don't reject here since onclose will be called next
            };

            // Handle incoming messages
            cryptoWS.onmessage = (message: WebSocketMessage) => {
                try {
                    const data = JSON.parse(message.data);

                    // Handle authentication response
                    if (Array.isArray(data) &&
                        data[0]?.ev === 'status' &&
                        data[0]?.status === 'auth_success') {
                        console.log('Authentication successful on shared WebSocket');

                        // Only update status if not adding a new subscription
                        if (!isAddingNewSubscription) {
                            updateAllStatusExceptNew('Authenticated', statusCallback);
                        }
                        isAuthenticated = true;

                        // Resolve the promise if it hasn't been resolved yet
                        if (!promiseSettled) {
                            promiseSettled = true;
                            resolve();
                        }

                        // Process any pending subscriptions
                        processPendingSubscriptions(cryptoWS);
                    }

                    // Process trade messages
                    if (Array.isArray(data)) {
                        // Filter valid trade messages
                        const trades: TradeMessage[] = data.filter(item =>
                            item && typeof item === 'object' &&
                            item.ev === 'XT' &&
                            'p' in item && 't' in item && 's' in item && 'pair' in item
                        );

                        if (trades.length > 0) {
                            // Group trades by pair
                            const tradesByPair = new Map<string, TradeMessage[]>();

                            for (const trade of trades) {
                                if (!tradesByPair.has(trade.pair)) {
                                    tradesByPair.set(trade.pair, []);
                                }
                                tradesByPair.get(trade.pair)!.push(trade);
                            }

                            // Notify subscribers for each pair
                            for (const [pair, pairTrades] of tradesByPair.entries()) {
                                // Find subscribers for this pair
                                const pairSubscribers = subscribers.get(pair);
                                if (pairSubscribers) {
                                    for (const callback of pairSubscribers) {
                                        callback(pairTrades);
                                    }
                                }

                                // Also notify wildcard subscribers
                                const wildcardSubscribers = subscribers.get('*');
                                if (wildcardSubscribers) {
                                    for (const callback of wildcardSubscribers) {
                                        callback(pairTrades);
                                    }
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error('Error processing message:', err);
                }
            };
        } catch (err) {
            console.error('Error setting up WebSocket:', err);

            // Only update status if not adding a new subscription
            if (!isAddingNewSubscription) {
                updateAllStatusExceptNew('Setup Error', statusCallback);
                errorCallback(`WebSocket setup failed: ${err instanceof Error ? err.message : String(err)}`);
            }

            connectingPromise = null;

            if (!promiseSettled) {
                promiseSettled = true;
                reject(err);
            }
        }
    });

    return connectingPromise;
};

/**
 * Process any pending subscriptions that were requested while connecting
 */
const processPendingSubscriptions = (cryptoWS: any) => {
    if (!cryptoWS || !isAuthenticated || cryptoWS.readyState !== 1) {
        return false;
    }

    // Small delay to ensure the socket is ready
    setTimeout(() => {
        // Process pending subscriptions
        if (pendingSubscriptions.size > 0) {
            console.log(`Processing ${pendingSubscriptions.size} pending subscriptions...`);

            for (const subscription of pendingSubscriptions) {
                if (!currentSubscriptions.includes(subscription)) {
                    try {
                        console.log(`Subscribing to: ${subscription}`);
                        cryptoWS.send(JSON.stringify({
                            action: "subscribe",
                            params: subscription
                        }));
                        currentSubscriptions.push(subscription);
                    } catch (err) {
                        console.error(`Failed to subscribe to ${subscription}:`, err);
                    }
                }
            }

            pendingSubscriptions.clear();
        }
    }, 500);

    return true;
};

/**
 * Subscribe to a crypto ticker
 */
const subscribeTicker = (
    ticker: string,
    callback: (messages: TradeMessage[]) => void,
    statusCallback: (status: string) => void,
    silentMode: boolean = false
) => {
    const formattedTicker = convertTickerFormat(ticker);

    // Set the adding new subscription flag if in silent mode
    if (silentMode) {
        isAddingNewSubscription = true;
        // Reset flag after 3 seconds
        setTimeout(() => {
            isAddingNewSubscription = false;
        }, 3000);
    }

    // Add to subscribers map
    if (!subscribers.has(formattedTicker)) {
        subscribers.set(formattedTicker, new Set());
    }
    subscribers.get(formattedTicker)!.add(callback);

    // Prepare subscription string
    const subscription = formattedTicker === '*' ? 'XT.*' : `XT.${formattedTicker}`;

    // Check if already subscribed
    if (currentSubscriptions.includes(subscription)) {
        // Only update the new chart's status
        statusCallback(`Connected to ${formattedTicker}`);
        return;
    }

    // Add to pending subscriptions
    pendingSubscriptions.add(subscription);

    // If not connected or connecting, setup connection
    if (!sharedWsClient && !connectingPromise) {
        setupWebSocket(apiKeyRef, statusCallback, () => { })
            .then(() => {
                // processPendingSubscriptions will be called after auth_success
            })
            .catch(err => {
                console.error('Error setting up WebSocket for subscription:', err);
                // Only update the new chart's status
                statusCallback('Connection Error');
            });
        return;
    }

    // If already authenticated and ready, subscribe immediately
    if (isAuthenticated && sharedWsClient && sharedWsClient.readyState === 1) {
        try {
            console.log(`Subscribing to: ${subscription}`);
            sharedWsClient.send(JSON.stringify({
                action: "subscribe",
                params: subscription
            }));
            currentSubscriptions.push(subscription);
            pendingSubscriptions.delete(subscription);

            // Only update the new chart's status
            statusCallback(`Connected to ${formattedTicker}`);
        } catch (err) {
            console.error(`Failed to send subscription for ${subscription}:`, err);
            // Only update the new chart's status
            statusCallback(`Subscription error for ${formattedTicker}`);
        }
    } else {
        console.log(`Queued subscription for ${subscription} - waiting for connection/auth`);
        // Only update the new chart's status
        statusCallback(`Connecting to ${formattedTicker}`);
    }
};

/**
 * Unsubscribe from a crypto ticker
 */
const unsubscribeTicker = (ticker: string, callback: (messages: TradeMessage[]) => void) => {
    const formattedTicker = convertTickerFormat(ticker);

    // Remove from pending subscriptions if there
    const subscription = formattedTicker === '*' ? 'XT.*' : `XT.${formattedTicker}`;
    pendingSubscriptions.delete(subscription);

    // Remove callback from subscribers
    const callbacks = subscribers.get(formattedTicker);
    if (!callbacks) return;

    callbacks.delete(callback);

    // If no more callbacks for this ticker, unsubscribe from WebSocket
    if (callbacks.size === 0) {
        subscribers.delete(formattedTicker);

        if (sharedWsClient && isAuthenticated && sharedWsClient.readyState === 1) {
            // Find and remove subscription
            const subIndex = currentSubscriptions.indexOf(subscription);
            if (subIndex !== -1) {
                console.log(`Unsubscribing from: ${subscription}`);
                try {
                    sharedWsClient.send(JSON.stringify({
                        action: "unsubscribe",
                        params: subscription
                    }));
                    currentSubscriptions.splice(subIndex, 1);
                } catch (err) {
                    console.error(`Failed to unsubscribe from ${subscription}:`, err);
                    // Still remove from our tracking even if send fails
                    currentSubscriptions.splice(subIndex, 1);
                }
            }
        } else {
            // Just remove from our tracking if we can't send the unsubscribe
            const subIndex = currentSubscriptions.indexOf(subscription);
            if (subIndex !== -1) {
                currentSubscriptions.splice(subIndex, 1);
            }
        }
    }

    // If no more subscribers at all, close WebSocket
    if (subscribers.size === 0 && sharedWsClient) {
        console.log('No more subscribers, closing WebSocket');
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }

        try {
            sharedWsClient.close();
        } catch (err) {
            console.error('Error closing WebSocket:', err);
        }

        sharedWsClient = null;
        isConnected = false;
        isAuthenticated = false;
        currentSubscriptions = [];
        pendingSubscriptions.clear();
        reconnectAttempts = 0;
        isAddingNewSubscription = false;
    }
};

/**
 * Custom hook for Polygon.io WebSocket cryptocurrency price data
 * Using a shared WebSocket connection
 * @param initialTicker - The ticker symbol (e.g. "BTC-USD" or "*" for all)
 * @param apiKey - Polygon.io API key
 */
const useLiveCryptoPrice = (
    initialTicker: string = 'BTC-USD',
    apiKey: string = process.env.NEXT_PUBLIC_POLYGON_API_KEY || ''
): LiveCryptoPriceHook => {
    // State
    const [status, setStatus] = useState<string>('Initializing');
    const [error, setError] = useState<string | null>(null);
    const [lastPrice, setLastPrice] = useState<number | null>(null);
    const [formattedTicker, setFormattedTicker] = useState<string>('');
    const [tradeMessages, setTradeMessages] = useState<TradeMessage[]>([]);
    const [isInitializing, setIsInitializing] = useState<boolean>(true);

    // Refs to keep track of current ticker
    const currentTickerRef = useRef<string>(initialTicker);

    // Register for status updates
    useEffect(() => {
        const unregister = registerStatusUpdateHandler(setStatus);
        return unregister;
    }, []);

    // Mark chart as initializing for a period to prevent status updates
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsInitializing(false);
        }, 5000);
        return () => clearTimeout(timer);
    }, []);

    // Set API key for shared usage
    useEffect(() => {
        if (apiKey) {
            apiKeyRef = apiKey;
        }
    }, [apiKey]);

    // Callback to handle incoming trade messages
    const handleTrades = useCallback((trades: TradeMessage[]) => {
        if (trades.length > 0) {
            // Update last price from the most recent trade
            const latestTrade = trades[trades.length - 1];
            if (latestTrade && typeof latestTrade.p === 'number') {
                setLastPrice(latestTrade.p);
            }

            // Update trade messages
            setTradeMessages(prev => {
                // Keep only the most recent 100 trades
                const newMessages = [...prev, ...trades].slice(-100);
                return newMessages;
            });
        }
    }, []);

    // Subscribe function for the hook user
    const subscribe = useCallback((newTicker: string): void => {
        // Skip if same ticker
        if (newTicker === currentTickerRef.current) {
            return;
        }

        // Mark as initializing again for this new subscription
        setIsInitializing(true);
        setTimeout(() => {
            setIsInitializing(false);
        }, 5000);

        // Unsubscribe from previous ticker
        unsubscribeTicker(currentTickerRef.current, handleTrades);

        // Update current ticker
        currentTickerRef.current = newTicker;
        const formatted = convertTickerFormat(newTicker);
        setFormattedTicker(formatted);

        // Reset trade messages for new ticker
        setTradeMessages([]);
        setLastPrice(null);

        // Subscribe to new ticker in silent mode (doesn't affect other charts)
        subscribeTicker(newTicker, handleTrades, setStatus, true);
    }, [handleTrades]);

    // Function to manually reconnect
    const reconnect = useCallback((): void => {
        // Close existing connection if any
        if (sharedWsClient) {
            try {
                sharedWsClient.close();
            } catch (err) {
                console.error('Error closing WebSocket during reconnect:', err);
            }

            sharedWsClient = null;
            isConnected = false;
            isAuthenticated = false;
            connectingPromise = null;
        }

        // Clear any reconnect timer
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }

        // Reset reconnect attempts
        reconnectAttempts = 0;

        // Set status to indicate reconnection
        setStatus('Manually reconnecting...');

        // Setup connection and resubscribe
        setupWebSocket(apiKeyRef, setStatus, setError)
            .then(() => {
                // Re-subscribe with current ticker
                subscribeTicker(currentTickerRef.current, handleTrades, setStatus);
            })
            .catch(err => {
                console.error('Error during manual reconnect:', err);
                setStatus('Reconnect failed');
                setError(`Reconnect failed: ${err instanceof Error ? err.message : String(err)}`);
            });
    }, [handleTrades]);

    // Initialize on mount
    useEffect(() => {
        // Format the ticker
        const formatted = convertTickerFormat(initialTicker);
        setFormattedTicker(formatted);
        currentTickerRef.current = initialTicker;

        // Subscribe to initial ticker with silent mode to avoid affecting other charts
        subscribeTicker(initialTicker, handleTrades, setStatus, true);

        // Cleanup on unmount
        return () => {
            unsubscribeTicker(currentTickerRef.current, handleTrades);
        };
    }, [initialTicker, handleTrades]);

    return {
        // If we're initializing, always show "Connected" status
        status: isInitializing ? "Connected" : status,
        error,
        lastPrice,
        formattedTicker,
        tradeMessages,
        reconnect,
        subscribe
    };
};

export default useLiveCryptoPrice;