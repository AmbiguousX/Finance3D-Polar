'use client';

import React, { useEffect, useRef, useState } from 'react';
import useLiveCryptoPrice from '../../hooks/useLiveCryptoPrice';

// Import SciChart modules
import {
    SciChartSurface,
    NumericAxis,
    FastCandlestickRenderableSeries,
    OhlcDataSeries,
    ZoomPanModifier,
    ZoomExtentsModifier,
    MouseWheelZoomModifier,
    EAutoRange,
    NumberRange,
    EAxisAlignment,
    CursorModifier,
    RubberBandXyZoomModifier,
    XAxisDragModifier,
    YAxisDragModifier
} from "scichart";

// Initialize SciChart with community license
SciChartSurface.UseCommunityLicense();

// Basic configuration
SciChartSurface.configure({
    dataUrl: "/scichart2d.data",
    wasmUrl: "/scichart2d.wasm"
});

const CANDLE_TIMEFRAME = 1; // 1 second
const MAX_CANDLES = 100;
// Only using smart scaling
const AUTO_SCALING_STRATEGY = "smart";

interface SimpleCandlestickChartProps {
    ticker?: string;
    autoScalingStrategy?: string; // Kept for backward compatibility
    initialVisibleCandles?: number;
}

const SimpleCandlestickChart: React.FC<SimpleCandlestickChartProps> = ({
    ticker = 'BTC-USD',
    autoScalingStrategy = AUTO_SCALING_STRATEGY,
    initialVisibleCandles = 60  // Increased from 30 to 60 for more zoom out
}) => {
    const chartRef = useRef<HTMLDivElement>(null);
    const [chartReady, setChartReady] = useState(false);
    const [chartError, setChartError] = useState<string | null>(null);
    const [selectedStrategy] = useState(AUTO_SCALING_STRATEGY); // Always smart

    // Chart state storage
    const chartState = useRef({
        surface: null as any,
        dataSeries: null as any,
        nextIndex: 0,
        currentCandle: null as any,
        yAxis: null as any,
        xAxis: null as any,
        priceHistory: [] as number[],
        volatilityFactor: 0.1,
        lastAutoRangeTime: 0,
        priceMarker: null as any,
        previousGrowBy: new NumberRange(0.1, 0.1),
        lastVisibleRange: null as any,
        visibleRangeChangeCount: 0,
        isUserZoomed: false
    });

    // Display state
    const [displayCandle, setDisplayCandle] = useState<{
        open: number; high: number; low: number; close: number; timestamp: number;
    } | null>(null);

    const [autoScalingEnabled, setAutoScalingEnabled] = useState(true);

    // Use crypto price hook
    const {
        status,
        error,
        lastPrice,
        formattedTicker,
        tradeMessages,
        reconnect,
        subscribe
    } = useLiveCryptoPrice(ticker || 'BTC-USD');

    // Calculate smart growth factor based on price volatility
    const calculateSmartGrowthFactor = () => {
        const prices = chartState.current.priceHistory;
        if (prices.length < 5) return new NumberRange(0.1, 0.1);

        // Calculate recent price volatility
        const recentPrices = prices.slice(-20);
        const priceChanges = recentPrices.map((price, index) =>
            index > 0 ? Math.abs(price - recentPrices[index - 1]) / recentPrices[index - 1] : 0
        ).filter(change => !isNaN(change) && isFinite(change));

        if (priceChanges.length < 2) return new NumberRange(0.1, 0.1);

        // Get average volatility
        const avgVolatility = priceChanges.reduce((sum, val) => sum + val, 0) / priceChanges.length;

        // Calculate adaptive growth factor - more volatile = more padding
        // Cap between 0.05 (5%) and 0.3 (30%) for reasonable bounds
        const adaptiveGrowth = Math.max(0.05, Math.min(0.3, avgVolatility * 20));

        // Smoothly transition to new growth factor (avoid sudden jumps)
        const currentFactor = chartState.current.volatilityFactor;
        const newFactor = currentFactor * 0.7 + adaptiveGrowth * 0.3; // Blend old and new
        chartState.current.volatilityFactor = newFactor;

        return new NumberRange(newFactor, newFactor);
    };

    // Apply smart auto-ranging for Y axis
    const applySmartAutoRanging = (force = false) => {
        if (!chartState.current.yAxis || !chartState.current.dataSeries) return;

        // Skip if auto-scaling is disabled
        if (!autoScalingEnabled && !force) return;

        // Skip if we recently auto-ranged (prevents constant rescaling)
        const now = Date.now();
        if (!force && now - chartState.current.lastAutoRangeTime < 500) return;
        chartState.current.lastAutoRangeTime = now;

        try {
            const yAxis = chartState.current.yAxis;
            const dataSeries = chartState.current.dataSeries;

            // Skip if no data
            if (dataSeries.count() === 0) return;

            // Get visible range
            const xAxis = chartState.current.xAxis;
            const xRange = xAxis.visibleRange;
            const xMin = xRange.min;
            const xMax = xRange.max;

            // Find min/max values in visible range
            let minVal = Number.MAX_VALUE;
            let maxVal = Number.MIN_VALUE;

            for (let i = 0; i < dataSeries.count(); i++) {
                const x = dataSeries.xValues.get(i);
                if (x >= xMin && x <= xMax) {
                    const high = dataSeries.highValues.get(i);
                    const low = dataSeries.lowValues.get(i);

                    if (high > maxVal) maxVal = high;
                    if (low < minVal) minVal = low;
                }
            }

            // Safety check
            if (minVal === Number.MAX_VALUE || maxVal === Number.MIN_VALUE ||
                !isFinite(minVal) || !isFinite(maxVal)) return;

            // Always use smart scaling with larger padding for better visibility
            // Smart combines adaptive with smoothing to prevent jumpy scales
            const adaptive = calculateSmartGrowthFactor();
            const current = chartState.current.previousGrowBy;

            // Blend previous and new (weighted averaging for smoothness)
            // Adding additional padding (0.2 instead of original values) for more room
            const blendedMin = (current.min * 0.7 + adaptive.min * 0.3) + 0.2;
            const blendedMax = (current.max * 0.7 + adaptive.max * 0.3) + 0.2;

            const growBy = new NumberRange(blendedMin, blendedMax);
            chartState.current.previousGrowBy = growBy;

            // Calculate the full range with padding
            const range = maxVal - minVal;
            const paddedMin = minVal - (range * growBy.min);
            const paddedMax = maxVal + (range * growBy.max);

            // Apply the range more smoothly by detecting if it's a significant change
            const currentMin = yAxis.visibleRange.min;
            const currentMax = yAxis.visibleRange.max;

            // Only apply if the change is significant (avoids micro-adjustments)
            const changeThreshold = 0.015; // 1.5% change threshold
            const minChange = Math.abs((paddedMin - currentMin) / currentMin);
            const maxChange = Math.abs((paddedMax - currentMax) / currentMax);

            if (force || minChange > changeThreshold || maxChange > changeThreshold) {
                // FIX: Instead of using animateVisibleRange which causes the error,
                // directly set the visibleRange property
                yAxis.visibleRange = new NumberRange(paddedMin, paddedMax);

                // Update price marker position
                if (chartState.current.priceMarker && lastPrice) {
                    chartState.current.priceMarker.y1 = lastPrice;
                }

                // Increment change counter (for UI feedback)
                chartState.current.visibleRangeChangeCount++;
            }
        } catch (err) {
            console.warn("Error applying smart auto-ranging:", err);
        }
    };

    // Manage X-axis auto-scrolling
    const manageXAxisAutoScrolling = () => {
        if (!chartState.current.xAxis || !chartState.current.dataSeries) return;

        // Skip if auto-scaling is disabled
        if (!autoScalingEnabled) return;

        try {
            const xAxis = chartState.current.xAxis;
            const dataSeries = chartState.current.dataSeries;

            // Skip if no data or not enough data
            if (dataSeries.count() < 2) return;

            // Get current visible range
            const currentRange = xAxis.visibleRange;
            const visibleWidth = currentRange.max - currentRange.min;

            // Get latest data point
            const lastDataX = dataSeries.xValues.get(dataSeries.count() - 1);

            // If the last data point is outside visible range or close to edge,
            // scroll the chart to keep it visible with some leading space
            if (lastDataX > currentRange.max - (visibleWidth * 0.1)) {
                // Calculate new range that maintains the same visible width
                // but shifts to show the latest data with some space
                const leadingSpace = visibleWidth * 0.2; // 20% leading space
                const newMax = lastDataX + leadingSpace;
                const newMin = newMax - visibleWidth;

                // FIX: Instead of using animateVisibleRange which causes the error,
                // directly set the visibleRange property
                xAxis.visibleRange = new NumberRange(newMin, newMax);
            }
        } catch (err) {
            console.warn("Error managing X-axis auto-scrolling:", err);
        }
    };

    // Initialize and setup the chart
    useEffect(() => {
        if (!chartRef.current) return;

        // Clean up any existing chart
        if (chartState.current.surface) {
            chartState.current.surface.delete();
            chartState.current.surface = null;
            chartState.current.dataSeries = null;
            chartState.current.nextIndex = 0;
            chartState.current.currentCandle = null;
            chartState.current.yAxis = null;
            chartState.current.xAxis = null;
            chartState.current.priceMarker = null;
            chartState.current.priceHistory = [];
            chartState.current.volatilityFactor = 0.1;
            chartState.current.lastAutoRangeTime = 0;
            chartState.current.previousGrowBy = new NumberRange(0.1, 0.1);
            chartState.current.lastVisibleRange = null;
            chartState.current.visibleRangeChangeCount = 0;
            setChartReady(false);
        }

        let isComponentMounted = true;

        // Wait before initializing
        const initTimer = setTimeout(async () => {
            try {
                if (!chartRef.current || !isComponentMounted) return;

                // Create chart surface
                const { sciChartSurface, wasmContext } = await SciChartSurface.create(chartRef.current);

                if (!isComponentMounted) {
                    sciChartSurface.delete();
                    return;
                }

                chartState.current.surface = sciChartSurface;

                // Create X-axis with better time scaling
                const xAxis = new NumericAxis(wasmContext, {
                    axisTitle: "Time",
                    drawMajorGridLines: true,
                    drawMinorGridLines: false,
                    drawMajorBands: false,
                    autoTicks: true
                });
                sciChartSurface.xAxes.add(xAxis);
                chartState.current.xAxis = xAxis;

                // Create Y-axis with initial auto-range settings
                const yAxis = new NumericAxis(wasmContext, {
                    axisTitle: "Price",
                    axisAlignment: EAxisAlignment.Right,
                    drawMajorGridLines: true,
                    drawMinorGridLines: true,
                    drawMajorBands: false,
                    autoRange: EAutoRange.Never, // We'll handle auto-ranging manually
                    growBy: new NumberRange(0.1, 0.1)
                });
                sciChartSurface.yAxes.add(yAxis);
                chartState.current.yAxis = yAxis;

                // Create data series
                const dataSeries = new OhlcDataSeries(wasmContext);
                chartState.current.dataSeries = dataSeries;

                // Create renderable series
                const renderSeries = new FastCandlestickRenderableSeries(wasmContext, {
                    dataSeries,
                    strokeThickness: 1,
                    dataPointWidth: 0.7,
                    brushUp: "#26a69a",
                    brushDown: "#ef5350",
                    strokeUp: "#26a69a",
                    strokeDown: "#ef5350"
                });
                sciChartSurface.renderableSeries.add(renderSeries);

                // Price marker removed to fix TypeScript errors

                // Add chart modifiers with cleaner interface
                sciChartSurface.chartModifiers.add(
                    new ZoomPanModifier(),
                    new ZoomExtentsModifier(),
                    new MouseWheelZoomModifier(),
                    // Removed RubberBandXyZoomModifier to prevent box drawing zoom
                    new CursorModifier({
                        showTooltip: false, // Disabled tooltip
                        crosshairStroke: "#888888",
                        crosshairStrokeThickness: 1
                    }),
                    new XAxisDragModifier(),
                    new YAxisDragModifier()
                );

                // Set up axis range changed listeners for smart auto-scaling
                xAxis.visibleRangeChanged.subscribe(() => {
                    // User manually changed the range
                    chartState.current.isUserZoomed = true;

                    // Call the auto-scrolling function to handle new data
                    manageXAxisAutoScrolling();
                });

                if (isComponentMounted) {
                    // Mark the chart as ready
                    setChartReady(true);
                    console.log("Chart ready for data");
                }
            } catch (err) {
                console.error("Chart initialization error:", err);
                setChartError(`Init error: ${err instanceof Error ? err.message : String(err)}`);
            }
        }, 1000);

        return () => {
            isComponentMounted = false;
            clearTimeout(initTimer);

            // Clean up chart
            if (chartState.current.surface) {
                try {
                    chartState.current.surface.delete();
                } catch (e) {
                    console.warn("Error during cleanup:", e);
                }
                chartState.current.surface = null;
                chartState.current.dataSeries = null;
                chartState.current.yAxis = null;
                chartState.current.xAxis = null;
                chartState.current.priceMarker = null;
            }
        };
    }, [ticker]);

    // Apply auto-scaling immediately when chart is ready
    useEffect(() => {
        if (chartReady) {
            applySmartAutoRanging(true);
        }
    }, [chartReady]);

    // Handle subscriptions only after chart is ready
    useEffect(() => {
        // Only subscribe once the chart is ready
        if (chartReady) {
            console.log("Chart ready, subscribing to", ticker);
            subscribe(ticker || 'BTC-USD');

            // Initialize with the selected number of visible candles
            setTimeout(() => {
                try {
                    if (chartState.current.xAxis && chartState.current.dataSeries) {
                        const dataSeries = chartState.current.dataSeries;
                        if (dataSeries.count() > 0) {
                            const xAxis = chartState.current.xAxis;
                            const lastIndex = dataSeries.count() - 1;
                            const visibleCount = Math.min(initialVisibleCandles, dataSeries.count());

                            if (visibleCount > 0) {
                                const startIndex = Math.max(0, lastIndex - visibleCount + 1);
                                const startX = dataSeries.xValues.get(startIndex);
                                const endX = dataSeries.xValues.get(lastIndex) + 1; // Add 1 for some padding

                                xAxis.visibleRange = new NumberRange(startX, endX);
                                applySmartAutoRanging(true);
                            }
                        }
                    }
                } catch (err) {
                    console.warn("Error setting initial visible range:", err);
                }
            }, 500);
        }
    }, [ticker, subscribe, chartReady, initialVisibleCandles]);

    // Process trade data and update the chart
    useEffect(() => {
        // Skip if chart not ready or no data
        if (!chartReady || !chartState.current.dataSeries || tradeMessages.length === 0) return;

        try {
            // Get latest trade
            const latestTrade = tradeMessages[tradeMessages.length - 1];
            const timestamp = latestTrade.t;
            const price = latestTrade.p;

            // Store price in history for volatility calculations
            chartState.current.priceHistory.push(price);
            // Limit history size
            if (chartState.current.priceHistory.length > 100) {
                chartState.current.priceHistory.shift();
            }

            // Update price marker
            if (chartState.current.priceMarker) {
                chartState.current.priceMarker.y1 = price;
                chartState.current.priceMarker.axisLabelFormatter = (v: number) =>
                    `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`;
            }

            // Calculate candle timestamp
            const candleDuration = CANDLE_TIMEFRAME * 1000;
            const candleTimestamp = Math.floor(timestamp / candleDuration) * candleDuration;

            // Get current candle
            const currentCandle = chartState.current.currentCandle;

            // Update or create new candle
            if (!currentCandle || currentCandle.timestamp !== candleTimestamp) {
                // If we have a current candle, append it
                if (currentCandle) {
                    chartState.current.dataSeries.append(
                        currentCandle.index,
                        currentCandle.open,
                        currentCandle.high,
                        currentCandle.low,
                        currentCandle.close
                    );

                    // Increment next index
                    chartState.current.nextIndex++;

                    // Handle X-axis auto-scrolling
                    manageXAxisAutoScrolling();
                }

                // Create new candle
                const newCandle = {
                    index: chartState.current.nextIndex,
                    timestamp: candleTimestamp,
                    open: price,
                    high: price,
                    low: price,
                    close: price
                };

                // Store in state
                chartState.current.currentCandle = newCandle;

                // Update display state
                setDisplayCandle({
                    open: price,
                    high: price,
                    low: price,
                    close: price,
                    timestamp: candleTimestamp
                });
            } else {
                // Update existing candle
                currentCandle.high = Math.max(currentCandle.high, price);
                currentCandle.low = Math.min(currentCandle.low, price);
                currentCandle.close = price;

                // Update in series
                if (chartState.current.dataSeries.count() > 0) {
                    chartState.current.dataSeries.update(
                        currentCandle.index,
                        currentCandle.open,
                        currentCandle.high,
                        currentCandle.low,
                        price
                    );
                }

                // Update display occasionally
                if (Math.random() < 0.1) {
                    setDisplayCandle({
                        open: currentCandle.open,
                        high: currentCandle.high,
                        low: currentCandle.low,
                        close: currentCandle.close,
                        timestamp: currentCandle.timestamp
                    });
                }
            }

            // Limit candles
            if (chartState.current.dataSeries.count() > MAX_CANDLES) {
                const removeCount = chartState.current.dataSeries.count() - MAX_CANDLES;
                chartState.current.dataSeries.removeRange(0, removeCount);
            }

            // Apply smart auto-ranging
            applySmartAutoRanging();

        } catch (err) {
            console.warn("Error updating chart data:", err);
        }
    }, [tradeMessages, chartReady]);

    // Format time for display
    const formatTime = (timestamp: number): string => {
        return new Date(timestamp).toLocaleTimeString();
    };

    // Toggle auto-scaling
    const toggleAutoScaling = () => {
        setAutoScalingEnabled(!autoScalingEnabled);
        if (!autoScalingEnabled) {
            // If turning on, immediately apply auto-scaling
            applySmartAutoRanging(true);
        }
    };

    // Removed changeStrategy function as we only use smart scaling

    return (
        <div className="relative w-full h-full">
            {/* Status indicators */}
            {(status !== 'Connected' && status !== 'Initializing') && (
                <div className="absolute top-2 right-2 z-10 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-medium">
                    {status}
                </div>
            )}

            {!chartReady && (
                <div className="absolute top-2 right-16 z-10 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                    Chart loading...
                </div>
            )}

            {/* Error display */}
            {(error || chartError) && (
                <div className="absolute top-2 left-2 z-10 bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-medium max-w-xs">
                    Error: {error || chartError}
                </div>
            )}

            {/* Price and candle info */}
            {lastPrice && displayCandle && (
                <div className="absolute top-2 left-2 z-10 bg-black bg-opacity-70 text-white px-3 py-1 rounded-md">
                    <div className="text-xs opacity-70">{formattedTicker}</div>
                    <div className="text-xl font-bold">${lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</div>
                    <div className="text-xs mt-1">
                        <span className="opacity-70">Candle: </span>
                        <span className="font-mono">O: ${displayCandle.open.toFixed(2)} </span>
                        <span className="font-mono">H: ${displayCandle.high.toFixed(2)} </span>
                        <span className="font-mono">L: ${displayCandle.low.toFixed(2)} </span>
                        <span className="font-mono">C: ${displayCandle.close.toFixed(2)}</span>
                    </div>
                    <div className="text-xs opacity-70">
                        {formatTime(displayCandle.timestamp)}
                    </div>
                </div>
            )}

            {/* Simplified timeframe indicator */}
            <div className="absolute top-2 right-2 z-10 bg-gray-800 text-white px-3 py-1 rounded-md flex items-center">
                <span>1s Candles</span>
                <div className="text-xs ml-2 px-2 py-0.5 bg-gray-700 rounded-sm">
                    Smart Scale
                </div>
            </div>

            {/* Simplified controls */}
            <div className="absolute bottom-2 left-2 z-10 bg-gray-800 bg-opacity-75 text-white px-3 py-1 rounded-md flex items-center space-x-2">
                <button
                    onClick={toggleAutoScaling}
                    className={`text-xs px-2 py-0.5 rounded ${autoScalingEnabled ? 'bg-green-600' : 'bg-gray-600'}`}
                >
                    Auto-Scale: {autoScalingEnabled ? 'ON' : 'OFF'}
                </button>

                <button
                    onClick={() => applySmartAutoRanging(true)}
                    className="text-xs px-2 py-0.5 bg-blue-600 rounded"
                >
                    Reset View
                </button>
            </div>

            {/* Reconnect button */}
            {status === 'Disconnected' && (
                <button
                    onClick={reconnect}
                    className="absolute bottom-2 right-2 z-10 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                >
                    Reconnect
                </button>
            )}

            {/* Chart container */}
            <div ref={chartRef} className="w-full h-full" />
        </div>
    );
};

export default SimpleCandlestickChart;