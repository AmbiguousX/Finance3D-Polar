# Finance3D

![Finance3D](public/images/finance3d-og.png)

Transform complex financial data into intuitive 3D visualizations. Make better decisions with our advanced analytics platform.

## Features

### Advanced Visualization
- 🌐 **3D Surface Charts** - Visualize stock price trends over time in three dimensions
- 📊 **Real-time Candlestick Charts** - Track market movements with comprehensive candlestick charts
- 📈 **Stock Ticker Banner** - Wall Street-style scrolling ticker with real-time price updates
- 📰 **Financial News Integration** - Stay informed with the latest market news

### Data Analysis
- 📉 **Technical Indicators** - Moving averages, volume analysis, and more
- 🔍 **Stock Search** - Find and analyze any publicly traded company
- 💹 **Crypto Markets** - Track cryptocurrency prices and trends
- 📱 **Responsive Design** - Access your financial data on any device

### User Experience
- 🌓 **Dark/Light Mode** - Optimized for both day and night trading
- 🔒 **User Authentication** - Secure access to your financial dashboard
- 💼 **Customizable Dashboard** - Arrange your financial widgets as you prefer
- 🚀 **High Performance** - Smooth animations and real-time data updates

## Technology Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS, shadcn/ui
- **Data Visualization**: SciChart.js for high-performance WebGL charts
- **Authentication**: Clerk for secure user management
- **API Integration**: Polygon.io for financial data

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/yourusername/finance3d.git
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Configure your environment variables:
```env
# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Polygon.io API
NEXT_PUBLIC_POLYGON_API_KEY=

# Frontend
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

5. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see your application.

## Project Structure

```
├── app/
│   ├── (auth)/        # Authentication routes
│   ├── (pages)/       # Main application pages
│   └── api/           # API routes
├── components/
│   ├── Finance/       # Financial visualization components
│   ├── dashboard/     # Dashboard components
│   ├── homepage/      # Landing page components
│   └── ui/            # UI components (shadcn)
├── hooks/             # Custom React hooks for financial data
├── lib/               # Utility functions
└── public/            # Static assets
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
