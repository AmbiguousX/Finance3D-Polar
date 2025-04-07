'use client';

import * as React from "react";
import { useTickerPricing } from '../../hooks/useTickerPriceRange';
import {
    CameraController,
    EDrawMeshAs,
    GradientColorPalette,
    HeatmapLegend,
    MouseWheelZoomModifier3D,
    NumberRange,
    NumericAxis3D,
    OrbitModifier3D,
    ResetCamera3DModifier,
    SciChart3DSurface,
    SurfaceMeshRenderableSeries3D,
    TooltipModifier3D,
    UniformGridDataSeries3D,
    Vector3,
    SciChartSurface
} from "scichart";

// Helper function to ensure a value is not undefined/null
function ensure<T>(value: T | undefined | null, message: string = 'Value was expected to exist'): T {
    if (value === undefined || value === null) {
        throw new TypeError(message);
    }
    return value;
}

// Props interface for the component
interface SurfaceChartProps {
    ticker?: string;
    year?: number;
}

// Make sure to initialize WASM before any chart creation
const initSciChartWasm = () => {
    try {
        // For 3D charts
        SciChart3DSurface.configure({
            dataUrl: "/scichart3d.data",
            wasmUrl: "/scichart3d.wasm"
        });

        // For 2D charts (used by the legend)
        try {
            SciChartSurface.configure({
                dataUrl: "/scichart2d.data",
                wasmUrl: "/scichart2d.wasm"
            });
            console.log("2D WASM configuration complete");
        } catch (error2d) {
            console.error("Error configuring 2D SciChart WASM:", error2d);
        }

        // Initialize the license
        SciChartSurface.UseCommunityLicense();

        console.log("SciChart WASM configuration complete");
    } catch (error) {
        console.error("Error configuring SciChart WASM:", error);
    }
}

// Initialize immediately
initSciChartWasm();

// REACT COMPONENT
export default function SurfaceChart({ ticker = 'AAPL', year = 2024 }: SurfaceChartProps) {
    // Use refs for chart elements
    const chartRef = React.useRef<HTMLDivElement>(null);
    const legendRef = React.useRef<HTMLDivElement>(null);

    // State to manage chart instances and UI states
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [mainChart, setMainChart] = React.useState<any>(null);
    const [legendChart, setLegendChart] = React.useState<any>(null);

    // Use the ticker pricing hook with updated function names
    const { fetchTickerPriceRange, isLoading: isDataLoading, error: dataError } = useTickerPricing();

    // Effect to create and initialize the chart
    React.useEffect(() => {
        console.log(`Component mounted for ${ticker} in ${year}, initializing...`);

        // Set loading state when ticker or year changes
        setIsLoading(true);
        setError(null);

        // Cleanup previous chart instances if they exist
        try {
            if (mainChart) {
                console.log("Cleaning up previous chart instance");
                mainChart.delete();
            }
        } catch (e) {
            console.error("Error cleaning up previous chart:", e);
        }

        try {
            if (legendChart) {
                console.log("Cleaning up previous legend instance");
                legendChart.delete();
            }
        } catch (e) {
            console.error("Error cleaning up previous legend:", e);
        }

        // Skip initialization if refs aren't ready
        if (!chartRef.current || !legendRef.current) {
            console.log("Chart or legend ref not ready, skipping initialization");
            return;
        }

        // Initialize the chart with a slight delay to ensure proper rendering
        const initChartTimeout = setTimeout(async () => {
            try {
                console.log(`Starting chart initialization for ${ticker} in ${year}`);

                // Create the SciChart3DSurface
                const { sciChart3DSurface, wasmContext } = await SciChart3DSurface.create(chartRef.current!);

                // Position the camera for better viewing, oriented to see months going outward on z-axis
                sciChart3DSurface.camera = new CameraController(wasmContext, {
                    position: new Vector3(-120, 100, -100),
                    target: new Vector3(15, 50, 6),
                });

                // Set world dimensions and background
                sciChart3DSurface.worldDimensions = new Vector3(200, 100, 200);
                sciChart3DSurface.background = "Transparent";

                // Create X-axis for days
                sciChart3DSurface.xAxis = new NumericAxis3D(wasmContext, {
                    axisTitle: "Day of Month",
                    visibleRange: new NumberRange(0, 30)
                });

                // Create Y-axis for price (range will be set after data is loaded)
                sciChart3DSurface.yAxis = new NumericAxis3D(wasmContext, {
                    axisTitle: "Price ($)"
                });

                // Create Z-axis with month names
                const zAxis = new NumericAxis3D(wasmContext, {
                    axisTitle: "Month",
                    visibleRange: new NumberRange(0, 11)
                });

                // Configure Z-axis to display month names instead of numbers
                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                zAxis.labelProvider.formatLabel = (dataValue: number): string => {
                    const monthIndex = Math.round(dataValue);
                    // Ensure we return a string in all cases
                    if (monthIndex >= 0 && monthIndex < monthNames.length) {
                        // TypeScript doesn't know that this access is safe, so we add a fallback
                        return monthNames[monthIndex] || "";
                    }
                    return "";
                };

                sciChart3DSurface.zAxis = zAxis;

                // Fixed parameters for the data grid
                const months = 12;
                const days = 31;
                const basePrice = 0; // Use 0 as placeholder for missing data

                // Fetch data for the whole year using our enhanced hook
                const startDate = `${year}-01-01`;
                const endDate = `${year}-12-31`;

                console.log(`Fetching data for ${ticker} from ${startDate} to ${endDate}`);

                // Use the updated function name
                const rangeData = await fetchTickerPriceRange(ticker, startDate, endDate);

                if (!rangeData || !rangeData.dataPoints || rangeData.dataPoints.length === 0) {
                    throw new Error(`No data available for ${ticker} in ${year}`);
                }

                console.log(`Received ${rangeData.dataPoints.length} data points for ${ticker}`);

                // Initialize grid with base values
                // We'll initially use null to identify missing data points
                const priceData = Array(months).fill(null).map(() => Array(days).fill(null));

                // Check current date to identify future dates
                const currentDate = new Date();
                const currentYear = currentDate.getFullYear();
                const currentMonth = currentDate.getMonth();
                const currentDay = currentDate.getDate();

                // Fill grid with actual data
                rangeData.dataPoints.forEach(dayData => {
                    try {
                        // Use UTC methods to avoid timezone issues
                        const date = new Date(dayData.t);
                        const month = date.getUTCMonth(); // 0-11
                        const day = date.getUTCDate() - 1; // 0-30

                        // Round price to 2 decimal places
                        const roundedPrice = Math.round(dayData.c * 100) / 100;

                        // Store in grid if month and day are valid
                        if (month >= 0 && month < 12 && day >= 0 && day < 31) {
                            const monthArray = ensure(priceData[month], `Month array at index ${month} should exist`);
                            monthArray[day] = roundedPrice;
                        }
                    } catch (e) {
                        console.error("Error processing data point:", e);
                    }
                });

                // Get min and max prices from the data
                let minPrice = rangeData.minPrice;
                let maxPrice = rangeData.maxPrice;

                // Ensure we have a reasonable Y-axis range even if data is sparse
                if (maxPrice - minPrice < 5) {
                    maxPrice = minPrice + 5;
                }

                // Now replace all null values with the minimum price
                // This creates a flat "floor" effect instead of gaps
                for (let m = 0; m < months; m++) {
                    const monthArray = ensure(priceData[m], `Month array at index ${m} should exist`);
                    for (let d = 0; d < days; d++) {
                        if (monthArray[d] === null) {
                            monthArray[d] = minPrice;
                        }
                    }
                }

                // Detect if there's any real data for each month
                const hasDataForMonth = priceData.map(monthData =>
                    monthData.some(price => price !== minPrice)
                );

                // Only fill in missing values within months that have data
                for (let m = 0; m < months; m++) {
                    // Skip filling if this is a future month in the current year or no data exists
                    const isFutureMonth = (year === currentYear && m > currentMonth) || (year > currentYear);

                    // Skip if no data exists for this month or it's a future month
                    if (!hasDataForMonth[m] || isFutureMonth) continue;

                    let lastKnownPrice = null;
                    const monthData = ensure(priceData[m], `Month array at index ${m} should exist`);

                    // Forward fill - use previous known price (but only within the same month)
                    for (let d = 0; d < days; d++) {
                        // Skip filling future days in current month/year
                        if (year === currentYear && m === currentMonth && d >= currentDay) {
                            continue;
                        }

                        if (monthData[d] !== minPrice) {
                            lastKnownPrice = monthData[d];
                        } else if (lastKnownPrice !== null) {
                            monthData[d] = lastKnownPrice;
                        }
                    }

                    // Backward fill - for start of month (if needed and not future)
                    lastKnownPrice = null;
                    for (let d = days - 1; d >= 0; d--) {
                        // Skip filling future days in current month/year
                        if (year === currentYear && m === currentMonth && d >= currentDay) {
                            continue;
                        }

                        if (monthData[d] !== minPrice) {
                            lastKnownPrice = monthData[d];
                        } else if (lastKnownPrice !== null) {
                            monthData[d] = lastKnownPrice;
                        }
                    }
                }

                // Only fill empty months with nearby data if they're not future months
                for (let m = 0; m < months; m++) {
                    // Skip if it's a future month
                    const isFutureMonth = (year === currentYear && m > currentMonth) ||
                        (year > currentYear);
                    if (isFutureMonth) continue;

                    const monthData = ensure(priceData[m], `Month array at index ${m} should exist`);

                    // Check if month has any real data
                    let hasData = monthData.some(price => price !== minPrice);

                    if (!hasData) {
                        let nearestMonth = -1;
                        let minDistance = months;

                        // Find nearest month with data
                        for (let mm = 0; mm < months; mm++) {
                            // Skip future months when searching for data
                            const isSourceFutureMonth = (year === currentYear && mm > currentMonth) ||
                                (year > currentYear);
                            if (mm === m || isSourceFutureMonth) continue;

                            // Check if this month has data
                            if (hasDataForMonth[mm]) {
                                const distance = Math.abs(mm - m);
                                if (distance < minDistance) {
                                    minDistance = distance;
                                    nearestMonth = mm;
                                }
                            }
                        }

                        // Copy from nearest month if found
                        if (nearestMonth !== -1) {
                            const nearestMonthData = ensure(priceData[nearestMonth],
                                `Nearest month array at index ${nearestMonth} should exist`);

                            for (let d = 0; d < days; d++) {
                                monthData[d] = nearestMonthData[d];
                            }
                        }
                    }
                }

                console.log(`Price range for ${ticker}: ${minPrice.toFixed(2)} to ${maxPrice.toFixed(2)}`);

                // Update Y axis range to match the data
                sciChart3DSurface.yAxis.visibleRange = new NumberRange(minPrice * 0.9, maxPrice * 1.1);

                // Create data series
                const dataSeries = new UniformGridDataSeries3D(wasmContext, {
                    yValues: priceData,
                    xStep: 1, // 1 day per step
                    zStep: 1, // 1 month per step
                    dataSeriesName: `${ticker} Price Surface (${year})`,
                    xStart: 0, // Start at day 0
                    zStart: 0  // Start at month 0
                });

                // Use the working colors from the example
                const colorMap = new GradientColorPalette(wasmContext, {
                    gradientStops: [
                        { offset: 0, color: "#1E5631" },   // Dark green (low values)
                        { offset: 0.25, color: "#A2D149" }, // Light green
                        { offset: 0.5, color: "#FFFF99" },  // Yellow
                        { offset: 0.75, color: "#FF9933" }, // Orange
                        { offset: 1, color: "#CC3300" },    // Red (high values)
                    ],
                });

                // Create surface series with financial styling
                const series = new SurfaceMeshRenderableSeries3D(wasmContext, {
                    dataSeries,
                    minimum: minPrice,
                    maximum: maxPrice,
                    opacity: 0.9,
                    cellHardnessFactor: 1.0,
                    shininess: 30,
                    lightingFactor: 0.6,
                    highlight: 1.0,
                    stroke: "#444444",
                    strokeThickness: 1.0,
                    contourStroke: "#FFFFFF",
                    contourInterval: (maxPrice - minPrice) / 10, // 10 contour lines
                    contourOffset: 0,
                    contourStrokeThickness: 1,
                    drawSkirt: false,
                    drawMeshAs: EDrawMeshAs.SOLID_WIREFRAME,
                    meshColorPalette: colorMap,
                    isVisible: true,
                });

                sciChart3DSurface.renderableSeries.add(series);

                // Add modifiers for interaction
                sciChart3DSurface.chartModifiers.add(new MouseWheelZoomModifier3D());
                sciChart3DSurface.chartModifiers.add(new OrbitModifier3D());
                sciChart3DSurface.chartModifiers.add(new ResetCamera3DModifier());
                sciChart3DSurface.chartModifiers.add(new TooltipModifier3D({
                    tooltipContainerBackground: "#333333"
                }));

                // Store chart reference
                setMainChart(sciChart3DSurface);

                // Create legend with matching color configuration
                if (legendRef.current) {
                    try {
                        const { heatmapLegend } = await HeatmapLegend.create(legendRef.current!, {
                            colorMap: {
                                minimum: minPrice,
                                maximum: maxPrice,
                                gradientStops: [
                                    { offset: 0, color: "#1E5631" },   // Dark green (low values)
                                    { offset: 0.25, color: "#A2D149" }, // Light green
                                    { offset: 0.5, color: "#FFFF99" },  // Yellow
                                    { offset: 0.75, color: "#FF9933" }, // Orange
                                    { offset: 1, color: "#CC3300" },    // Red (high values)
                                ],

                            },
                            yAxisOptions: {
                                isInnerAxis: true,
                                labelStyle: {
                                    fontSize: 12,
                                    color: "#FFFFFF",
                                },
                                axisBorder: {
                                    borderRight: 1,
                                    color: "#FFFFFF77",
                                },
                                majorTickLineStyle: {
                                    color: "#FFFFFF",
                                    tickSize: 6,
                                    strokeThickness: 1,
                                },
                                minorTickLineStyle: {
                                    color: "#FFFFFF",
                                    tickSize: 3,
                                    strokeThickness: 1,
                                },
                            }
                        });

                        // Store legend reference
                        setLegendChart(heatmapLegend);
                        console.log("Legend created successfully");
                    } catch (legendErr) {
                        console.warn("Non-critical error creating legend:", legendErr);
                    }
                }

                console.log("Chart initialized successfully");
                setIsLoading(false);

            } catch (err) {
                console.error("Failed to initialize chart:", err);
                setError(
                    err instanceof Error ? err.message : "Failed to load SciChart"
                );
                setIsLoading(false);
            }
        }, 100);

        // Cleanup function
        return () => {
            clearTimeout(initChartTimeout);

            try {
                if (mainChart) {
                    console.log("Cleaning up chart on unmount");
                    mainChart.delete();
                }
            } catch (e) {
                console.error("Error during chart cleanup:", e);
            }

            try {
                if (legendChart) {
                    console.log("Cleaning up legend on unmount");
                    legendChart.delete();
                }
            } catch (e) {
                console.error("Error during legend cleanup:", e);
            }
        };
    }, [ticker, year, fetchTickerPriceRange]); // Updated dependency

    // Compute effective loading and error states (combining our local state with hook state)
    const effectiveIsLoading = isLoading || isDataLoading;
    const effectiveError = error || dataError;

    return (
        <div className="relative h-[400px] w-full">
            {effectiveIsLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
                    <div className="text-center">
                        <div className="mb-2 text-white">Loading {ticker} data for {year}...</div>
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    </div>
                </div>
            )}

            {effectiveError && (
                <div className="absolute top-1/2 left-0 right-0 p-4 bg-red-100 bg-opacity-10 text-red-500 text-center -translate-y-1/2 z-10">
                    Error: {effectiveError}
                </div>
            )}

            <div ref={chartRef} className="h-full w-full" />
            <div
                ref={legendRef}
                className="absolute h-full w-16 top-0 right-3 z-5"
            />
        </div>
    );
}