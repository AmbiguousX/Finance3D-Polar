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
    NumberRange
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

interface SimpleCandlestickChartProps {
    ticker?: string;
}

const SimpleCandlestickChart: React.FC<SimpleCandlestickChartProps> = ({
    ticker = 'BTC-USD'
}) => {
    const chartRef = useRef<HTMLDivElement>(null);
    const [chartReady, setChartReady] = useState(false);
    const [chartError, setChartError] = useState<string | null>(null);

    // Chart state storage
    const chartState = useRef({
        surface: null as any,
        dataSeries: null as any,
        nextIndex: 0,
        currentCandle: null as any
    });

    // Display state
    const [displayCandle, setDisplayCandle] = useState<{
        open: number; high: number; low: number; close: number; timestamp: number;
    } | null>(null);

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

    // PHASE 1: Initialize the chart only
    useEffect(() => {
        if (!chartRef.current) return;

        // Clean up any existing chart
        if (chartState.current.surface) {
            chartState.current.surface.delete();
            chartState.current.surface = null;
            chartState.current.dataSeries = null;
            chartState.current.nextIndex = 0;
            chartState.current.currentCandle = null;
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

                // Create axes
                const xAxis = new NumericAxis(wasmContext);
                sciChartSurface.xAxes.add(xAxis);

                const yAxis = new NumericAxis(wasmContext, {
                    growBy: new NumberRange(0.1, 0.1),
                    autoRange: EAutoRange.Always
                });
                sciChartSurface.yAxes.add(yAxis);

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

                // Add chart modifiers
                sciChartSurface.chartModifiers.add(
                    new ZoomPanModifier(),
                    new ZoomExtentsModifier(),
                    new MouseWheelZoomModifier()
                );

                if (isComponentMounted) {
                    // Mark the chart as ready only after successful initialization
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
            }
        };
    }, [ticker]);

    // PHASE 2: Handle subscriptions only after chart is ready
    useEffect(() => {
        // Only subscribe once the chart is ready
        if (chartReady) {
            console.log("Chart ready, subscribing to", ticker);
            subscribe(ticker || 'BTC-USD');
        }
    }, [ticker, subscribe, chartReady]);

    // PHASE 3: Process data only after chart is ready
    useEffect(() => {
        // Skip if chart not ready or no data
        if (!chartReady || !chartState.current.dataSeries || tradeMessages.length === 0) return;

        try {
            // Get latest trade
            const latestTrade = tradeMessages[tradeMessages.length - 1];
            const timestamp = latestTrade.t;
            const price = latestTrade.p;

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
        } catch (err) {
            console.warn("Error updating chart data:", err);
        }
    }, [tradeMessages, chartReady]);

    // Format time for display
    const formatTime = (timestamp: number): string => {
        return new Date(timestamp).toLocaleTimeString();
    };

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

            {/* Timeframe indicator */}
            <div className="absolute top-2 right-2 z-10 bg-gray-800 text-white px-3 py-1 rounded-md">
                1s Candles
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