'use client';

import React, { useState, useEffect } from 'react';
import { PlusCircle, X, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

// Import actual chart components
import SurfaceChart from '@/components/Finance/SurfaceChart';
import SimpleCandlestickChart from '@/components/Finance/SimpleCandlestickChart';
import CoreSearch from '@/components/Finance/CoreSearch';
import CryptoSearch from '@/components/Finance/CryptoSearch';
import FlexibleCard from '@/components/ui/flexiblecard';

// Define the types of widgets that can be added to the dashboard
type WidgetType =
  | 'stats'
  | 'chart'
  | 'activity'
  | 'finance'
  | 'crypto-surface'
  | 'stock-surface'
  | 'crypto-candle'
  | 'stock-candle'
  | 'news';

// Widget configuration
interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  description?: string;
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
  isMaximized?: boolean;
}

// Available widget templates
const WIDGET_TEMPLATES: Record<WidgetType, Omit<Widget, 'id' | 'position'>> = {
  stats: {
    type: 'stats',
    title: 'Quick Stats',
    description: 'Overview of key metrics',
    size: { width: 300, height: 200 },
  },
  chart: {
    type: 'chart',
    title: 'Performance Chart',
    description: 'Visual representation of data',
    size: { width: 500, height: 300 },
  },
  activity: {
    type: 'activity',
    title: 'Recent Activity',
    description: 'Latest actions and updates',
    size: { width: 400, height: 300 },
  },
  finance: {
    type: 'finance',
    title: 'Financial Overview',
    description: 'Summary of financial data',
    size: { width: 400, height: 300 },
  },
  'crypto-surface': {
    type: 'crypto-surface',
    title: 'Crypto 3D Surface',
    description: '3D visualization of cryptocurrency price data',
    size: { width: 500, height: 400 },
  },
  'stock-surface': {
    type: 'stock-surface',
    title: 'Stock 3D Surface',
    description: '3D visualization of stock price data',
    size: { width: 500, height: 400 },
  },
  'crypto-candle': {
    type: 'crypto-candle',
    title: 'Crypto Candlestick',
    description: 'Real-time cryptocurrency candlestick chart',
    size: { width: 500, height: 400 },
  },
  'stock-candle': {
    type: 'stock-candle',
    title: 'Stock Candlestick',
    description: 'Real-time stock market candlestick chart',
    size: { width: 500, height: 400 },
  },
  news: {
    type: 'news',
    title: 'Financial News',
    description: 'Latest financial news and updates',
    size: { width: 400, height: 300 },
  },
};

// Widget state interface to store ticker information
interface WidgetState {
  [widgetId: string]: {
    ticker?: string;
    year?: number;
  };
}

// Component to render the content of each widget type
const WidgetContent: React.FC<{ widget: Widget }> = ({ widget }) => {
  // Get the current year for default value
  const currentYear = new Date().getFullYear();

  // State to store widget-specific data like selected tickers
  const [widgetStates, setWidgetStates] = useState<WidgetState>({});

  // Initialize widget state if it doesn't exist
  useEffect(() => {
    if (!widgetStates[widget.id]) {
      setWidgetStates(prev => ({
        ...prev,
        [widget.id]: {
          ticker: widget.type.includes('crypto') ? 'BTC-USD' : 'AAPL',
          year: currentYear
        }
      }));
    }
  }, [widget.id, widget.type, widgetStates]);

  // Get the current widget state
  const widgetState = widgetStates[widget.id] || { ticker: widget.type.includes('crypto') ? 'BTC-USD' : 'AAPL', year: currentYear };

  // Handler for ticker selection
  const handleSelectTicker = (ticker: string) => {
    setWidgetStates(prev => ({
      ...prev,
      [widget.id]: {
        ...prev[widget.id],
        ticker
      }
    }));
  };

  // Handler for year selection (for surface charts)
  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setWidgetStates(prev => ({
      ...prev,
      [widget.id]: {
        ...prev[widget.id],
        year: parseInt(e.target.value, 10)
      }
    }));
  };

  switch (widget.type) {
    case 'stats':
      return (
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">Total Projects</span>
            <span className="text-2xl font-bold">12</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">Active Users</span>
            <span className="text-2xl font-bold">1,234</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">Performance</span>
            <span className="text-2xl font-bold">98.2%</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">Engagement</span>
            <span className="text-2xl font-bold">89%</span>
          </div>
        </div>
      );
    case 'chart':
      return (
        <div className="h-[200px] flex items-end gap-2">
          {[40, 25, 45, 30, 60, 75, 65, 45, 50, 65, 70, 80].map((height, i) => (
            <div
              key={i}
              className="bg-primary/10 hover:bg-primary/20 rounded-md w-full transition-colors"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      );
    case 'crypto-surface':
      return (
        <div className="flex flex-col h-full">
          <div className="mb-4">
            <CryptoSearch
              onSelectTicker={handleSelectTicker}
              selectedTicker={widgetState.ticker}
              className="w-full"
            />
          </div>
          <div className="flex-grow">
            <SurfaceChart
              ticker={widgetState.ticker || 'BTC-USD'}
              year={widgetState.year || currentYear}
              key={`${widget.id}-${widgetState.ticker}-${widgetState.year}`}
            />
          </div>
        </div>
      );
    case 'stock-surface':
      return (
        <div className="flex flex-col h-full">
          <div className="mb-4">
            <CoreSearch
              onSelectTicker={handleSelectTicker}
              selectedTicker={widgetState.ticker}
              className="w-full"
            />
          </div>
          <div className="flex-grow">
            <SurfaceChart
              ticker={widgetState.ticker || 'AAPL'}
              year={widgetState.year || currentYear}
              key={`${widget.id}-${widgetState.ticker}-${widgetState.year}`}
            />
          </div>
        </div>
      );
    case 'crypto-candle':
      return (
        <div className="flex flex-col h-full">
          <div className="mb-4">
            <CryptoSearch
              onSelectTicker={handleSelectTicker}
              selectedTicker={widgetState.ticker}
              className="w-full"
            />
          </div>
          <div className="flex-grow">
            <SimpleCandlestickChart
              ticker={widgetState.ticker || 'BTC-USD'}
              key={`${widget.id}-${widgetState.ticker}`}
            />
          </div>
        </div>
      );
    case 'stock-candle':
      return (
        <div className="flex flex-col h-full">
          <div className="mb-4">
            <CoreSearch
              onSelectTicker={handleSelectTicker}
              selectedTicker={widgetState.ticker}
              className="w-full"
            />
          </div>
          <div className="flex-grow">
            <SimpleCandlestickChart
              ticker={widgetState.ticker || 'AAPL'}
              key={`${widget.id}-${widgetState.ticker}`}
            />
          </div>
        </div>
      );
    case 'activity':
      return (
        <div className="space-y-4">
          {[
            {
              title: "New Feature Released",
              description: "Enhanced project analytics and reporting tools are now available.",
              time: "2 hours ago"
            },
            {
              title: "System Update",
              description: "Performance improvements and bug fixes deployed.",
              time: "5 hours ago"
            },
            {
              title: "Community Milestone",
              description: "Over 1,000 projects created!",
              time: "1 day ago"
            }
          ].map((update, i) => (
            <div key={i} className="flex justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{update.title}</p>
                <p className="text-sm text-muted-foreground">{update.description}</p>
              </div>
              <p className="text-xs text-muted-foreground whitespace-nowrap">{update.time}</p>
            </div>
          ))}
        </div>
      );
    case 'finance':
      return (
        <div className="space-y-4">
          <div className="flex justify-between">
            <span className="text-sm font-medium">Current Balance</span>
            <span className="text-sm font-bold">$12,345.67</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-medium">Monthly Spending</span>
            <span className="text-sm font-bold">$2,456.78</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-medium">Savings Goal</span>
            <span className="text-sm font-bold">$50,000.00</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
            <div className="bg-blue-600 h-full rounded-full" style={{ width: '45%' }}></div>
          </div>
          <span className="text-xs text-muted-foreground">45% of goal reached</span>
        </div>
      );
    case 'news':
      return (
        <div className="space-y-4">
          <div className="border-b pb-2">
            <h3 className="font-medium">Fed Signals Potential Rate Cut</h3>
            <p className="text-sm text-muted-foreground">Federal Reserve hints at possible interest rate reduction in upcoming meeting.</p>
            <span className="text-xs text-muted-foreground">2 hours ago</span>
          </div>
          <div className="border-b pb-2">
            <h3 className="font-medium">Tech Stocks Rally on Earnings</h3>
            <p className="text-sm text-muted-foreground">Major technology companies exceed quarterly earnings expectations.</p>
            <span className="text-xs text-muted-foreground">5 hours ago</span>
          </div>
          <div>
            <h3 className="font-medium">Oil Prices Stabilize After Volatility</h3>
            <p className="text-sm text-muted-foreground">Crude oil markets find equilibrium following weeks of fluctuation.</p>
            <span className="text-xs text-muted-foreground">1 day ago</span>
          </div>
        </div>
      );
    default:
      return <div>Widget content not available</div>;
  }
};

// Widget component with drag functionality
const DraggableWidget: React.FC<{
  widget: Widget;
  onMove: (id: string, x: number, y: number) => void;
  onRemove: (id: string) => void;
  onResize: (id: string, width: number, height: number) => void;
  onToggleMaximize: (id: string) => void;
}> = ({ widget, onMove, onRemove, onResize, onToggleMaximize }) => {
  // Create header with controls
  const widgetHeader = (
    <div className="flex items-center justify-between w-full">
      <span className="text-sm font-medium">{widget.title}</span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onToggleMaximize(widget.id)}
        >
          {widget.isMaximized ? (
            <Minimize className="h-4 w-4" />
          ) : (
            <Maximize className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:text-red-500"
          onClick={() => onRemove(widget.id)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  // Optional footer for widgets that need it
  const widgetFooter = widget.description ? (
    <div className="text-xs text-muted-foreground">{widget.description}</div>
  ) : undefined;

  return (
    <FlexibleCard
      header={widgetHeader}
      footer={widgetFooter}
      initialWidth={widget.size.width}
      initialHeight={widget.size.height}
      initialX={widget.position.x}
      initialY={widget.position.y}
      isMaximized={widget.isMaximized}
      onMove={(x, y) => onMove(widget.id, x, y)}
      onResize={(width, height) => onResize(widget.id, width, height)}
      className="widget-card"
    >
      <WidgetContent widget={widget} />
    </FlexibleCard>
  );
};

// Widget selector component
const WidgetSelector: React.FC<{
  onSelect: (type: WidgetType) => void;
  onClose: () => void;
}> = ({ onSelect, onClose }) => {
  const [activeTab, setActiveTab] = useState<string>('general');

  // Filter widget types by category
  const generalWidgets: WidgetType[] = ['stats', 'chart', 'activity', 'finance', 'news'];
  const cryptoWidgets: WidgetType[] = ['crypto-surface', 'crypto-candle'];
  const stockWidgets: WidgetType[] = ['stock-surface', 'stock-candle'];

  // Get widgets for the current tab
  const getWidgetsForTab = () => {
    switch (activeTab) {
      case 'crypto':
        return cryptoWidgets;
      case 'stocks':
        return stockWidgets;
      default:
        return generalWidgets;
    }
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="general" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="crypto">Crypto</TabsTrigger>
          <TabsTrigger value="stocks">Stocks</TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getWidgetsForTab().map((type) => {
              const template = WIDGET_TEMPLATES[type];
              return (
                <Card
                  key={type}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => {
                    onSelect(type);
                    onClose();
                  }}
                >
                  <CardHeader>
                    <CardTitle className="text-base">{template.title}</CardTitle>
                    {template.description && (
                      <CardDescription>{template.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="h-24 overflow-hidden opacity-50">
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      {template.type.includes('surface') && 'Surface Chart'}
                      {template.type.includes('candle') && 'Candlestick Chart'}
                      {template.type === 'stats' && 'Statistics Widget'}
                      {template.type === 'chart' && 'Chart Widget'}
                      {template.type === 'activity' && 'Activity Feed'}
                      {template.type === 'finance' && 'Financial Data'}
                      {template.type === 'news' && 'News Feed'}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </Tabs>
    </div>
  );
};

// Main dashboard component
// Add global styles for dragging
const DashboardStyles = () => {
  return (
    <style jsx global>{`
      body.widget-dragging {
        cursor: grabbing !important;
        user-select: none;
      }
      body.widget-dragging * {
        cursor: grabbing !important;
      }
      .widget-card {
        cursor: default;
      }
      .widget-drag-handle {
        cursor: grab;
      }
      .widget-drag-handle:active {
        cursor: grabbing;
      }
    `}</style>
  );
};

const FlexibleDashboard: React.FC = () => {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [isAddingWidget, setIsAddingWidget] = useState(false);

  // Load saved dashboard layout from localStorage on initial render
  useEffect(() => {
    const savedLayout = localStorage.getItem('dashboardLayout');
    if (savedLayout) {
      try {
        setWidgets(JSON.parse(savedLayout));
      } catch (e) {
        console.error('Failed to load dashboard layout:', e);
      }
    }
  }, []);

  // Save dashboard layout to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('dashboardLayout', JSON.stringify(widgets));
  }, [widgets]);

  // Add a new widget to the dashboard
  const addWidget = (type: WidgetType) => {
    const template = WIDGET_TEMPLATES[type];

    // Get the dashboard container's position and dimensions
    const dashboardRect = document.getElementById('dashboard-container')?.getBoundingClientRect();

    if (dashboardRect) {
      const newWidget: Widget = {
        ...template,
        id: `widget-${Date.now()}`,
        position: {
          // Center the widget in the dashboard container
          x: Math.max(0, (dashboardRect.width - template.size.width) / 2),
          y: Math.max(0, 100), // Place it near the top with some padding
        },
      };
      setWidgets([...widgets, newWidget]);
    } else {
      // Fallback if container not found
      const newWidget: Widget = {
        ...template,
        id: `widget-${Date.now()}`,
        position: {
          x: 50,
          y: 100,
        },
      };
      setWidgets([...widgets, newWidget]);
    }
  };

  // Remove a widget from the dashboard
  const removeWidget = (id: string) => {
    setWidgets(widgets.filter((w) => w.id !== id));
  };

  // Update a widget's position
  const moveWidget = (id: string, x: number, y: number) => {
    // Ensure position is not negative
    const newX = Math.max(0, x);
    const newY = Math.max(0, y);

    // Update the widget position
    setWidgets(
      widgets.map((w) =>
        w.id === id ? { ...w, position: { x: newX, y: newY } } : w
      )
    );
  };

  // Update a widget's size
  const resizeWidget = (id: string, width: number, height: number) => {
    setWidgets(
      widgets.map((w) =>
        w.id === id ? { ...w, size: { width, height } } : w
      )
    );
  };

  // Toggle a widget's maximized state
  const toggleMaximize = (id: string) => {
    setWidgets(
      widgets.map((w) =>
        w.id === id ? { ...w, isMaximized: !w.isMaximized } : w
      )
    );
  };

  return (
    <div id="dashboard-container" className="relative min-h-[calc(100vh-4rem)] p-6">
      <DashboardStyles />
      {/* Dashboard header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Customize your dashboard by adding and arranging widgets.
          </p>
        </div>

        {/* Add widget button */}
        <Dialog open={isAddingWidget} onOpenChange={setIsAddingWidget}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <PlusCircle className="h-4 w-4" />
              Add Widget
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Add Widget</DialogTitle>
              <DialogDescription>
                Select a widget to add to your dashboard.
              </DialogDescription>
            </DialogHeader>
            <WidgetSelector
              onSelect={addWidget}
              onClose={() => setIsAddingWidget(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Empty state */}
      {widgets.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-lg">
          <h3 className="text-xl font-medium mb-2">Your dashboard is empty</h3>
          <p className="text-muted-foreground mb-6 text-center max-w-md">
            Add widgets to customize your dashboard with the information that matters most to you.
          </p>
          <Button
            onClick={() => setIsAddingWidget(true)}
            className="gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            Add Your First Widget
          </Button>
        </div>
      )}

      {/* Widgets container */}
      <div className="relative">
        {widgets.map((widget) => (
          <DraggableWidget
            key={widget.id}
            widget={widget}
            onMove={moveWidget}
            onRemove={removeWidget}
            onResize={resizeWidget}
            onToggleMaximize={toggleMaximize}
          />
        ))}
      </div>
    </div>
  );
};

export default FlexibleDashboard;
