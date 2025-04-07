"use client";

import { CryptoChartComponent } from "./CryptoSearchPage";

export default function CryptoPageClient() {
  return (
    <div className="container py-10">
      <h1 className="text-4xl font-bold mb-6">Crypto Visualization</h1>
      <CryptoChartComponent />
    </div>
  );
}
