import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// API Key constant
const API_KEY = process.env.NEXT_PUBLIC_POLYGON_API_KEY;

// Interface for the news article
interface NewsArticle {
    id: string;
    title: string;
    description?: string;
    article_url: string;
    published_utc: string;
    publisher: {
        name: string;
        homepage_url?: string;
        logo_url?: string;
    };
    author?: string;
    image_url?: string;
}

// News component that takes a ticker as a prop
const NewsComponent: React.FC<{ ticker: string }> = ({ ticker }) => {
    const [news, setNews] = useState<NewsArticle[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Format date to be more readable
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    useEffect(() => {
        const fetchNews = async () => {
            if (!ticker) return;

            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(`https://api.polygon.io/v2/reference/news?ticker=${ticker}&limit=5&apiKey=${API_KEY}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch news');
                }

                const data = await response.json();
                setNews(data.results || []);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An unknown error occurred');
                console.error('News fetch error:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchNews();
    }, [ticker]);

    if (isLoading) {
        return (
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>Latest News for {ticker}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-500">Loading news...</p>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>News</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-red-500">{error}</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Latest News for {ticker}</CardTitle>
            </CardHeader>
            <CardContent>
                {news.length === 0 ? (
                    <p className="text-gray-500">No recent news available.</p>
                ) : (
                    <div className="space-y-4">
                        {news.map((article) => (
                            <div
                                key={article.id}
                                className="border-b pb-4 last:border-b-0 hover:bg-gray-50 transition-colors"
                            >
                                {article.image_url && (
                                    <img
                                        src={article.image_url}
                                        alt={article.title}
                                        className="w-full h-40 object-cover rounded-t-lg mb-2"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                        }}
                                    />
                                )}
                                <div>
                                    <a
                                        href={article.article_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-lg font-semibold text-blue-600 hover:underline"
                                    >
                                        {article.title}
                                    </a>
                                    {article.description && (
                                        <p className="text-sm text-gray-600 mt-1">
                                            {article.description}
                                        </p>
                                    )}
                                    <div className="mt-2 text-xs text-gray-500 flex justify-between">
                                        <span>
                                            {article.publisher.name}
                                            {article.author ? ` • ${article.author}` : ''}
                                        </span>
                                        <span>{formatDate(article.published_utc)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default NewsComponent;