"use client";

import { StockChartComponent } from "./ChartSearch";

export default function StocksPageClient() {
  return (
    <div className="container py-10">
      <h1 className="text-4xl font-bold mb-6">Stock Visualization</h1>
      <StockChartComponent />
    </div>
  );
}
