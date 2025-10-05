import FirecrawlApp from '@mendable/firecrawl-js';

// Mock MCP tool implementations with realistic data
export const mockTools = {
    // Weather Tools - Using Open-Meteo API
    'weather_current': async (args: Record<string, any>) => {
        const { latitude, longitude, location_name } = args;

        if (!latitude || !longitude) {
            return {
                error: 'Missing required parameters: latitude and longitude are required',
                example: 'Use: {"latitude": 52.52, "longitude": 13.41, "location_name": "Berlin"}',
            };
        }

        try {
            // Call Open-Meteo API for current weather
            const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m&timezone=auto`
            );

            if (!response.ok) {
                throw new Error(`Weather API error: ${response.status}`);
            }

            const data = await response.json();
            const current = data.current;

            // Weather code to condition mapping (simplified)
            const weatherConditions: Record<number, string> = {
                0: 'Clear sky',
                1: 'Mainly clear',
                2: 'Partly cloudy',
                3: 'Overcast',
                45: 'Fog',
                48: 'Depositing rime fog',
                51: 'Light drizzle',
                53: 'Moderate drizzle',
                55: 'Dense drizzle',
                61: 'Slight rain',
                63: 'Moderate rain',
                65: 'Heavy rain',
                71: 'Slight snow',
                73: 'Moderate snow',
                75: 'Heavy snow',
                80: 'Slight rain showers',
                81: 'Moderate rain showers',
                82: 'Violent rain showers',
                95: 'Thunderstorm',
                96: 'Thunderstorm with slight hail',
                99: 'Thunderstorm with heavy hail',
            };

            const condition = weatherConditions[current.weather_code] || 'Unknown';

            return {
                location: location_name || `${latitude}, ${longitude}`,
                coordinates: { latitude, longitude },
                temperature: `${current.temperature_2m}°C`,
                feels_like: `${current.apparent_temperature}°C`,
                condition,
                humidity: `${current.relative_humidity_2m}%`,
                wind_speed: `${current.wind_speed_10m} km/h`,
                wind_direction: `${current.wind_direction_10m}°`,
                weather_code: current.weather_code,
                timestamp: current.time,
                timezone: data.timezone,
                source: 'Open-Meteo API',
                api_url: `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}`,
            };

        } catch (error) {
            return {
                error: 'Failed to fetch weather data',
                details: error instanceof Error ? error.message : 'Unknown error',
                coordinates: { latitude, longitude },
            };
        }
    },

    'weather_forecast': async (args: Record<string, any>) => {
        const { latitude, longitude, location_name, days = 3 } = args;
        const forecastDays = Math.min(days, 7); // Max 7 days

        if (!latitude || !longitude) {
            return {
                error: 'Missing required parameters: latitude and longitude are required',
                example: 'Use: {"latitude": 52.52, "longitude": 13.41, "location_name": "Berlin", "days": 5}',
            };
        }

        try {
            // Call Open-Meteo API for weather forecast
            const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto&forecast_days=${forecastDays}`
            );

            if (!response.ok) {
                throw new Error(`Weather API error: ${response.status}`);
            }

            const data = await response.json();
            const daily = data.daily;

            // Weather code to condition mapping
            const weatherConditions: Record<number, string> = {
                0: 'Clear sky',
                1: 'Mainly clear',
                2: 'Partly cloudy',
                3: 'Overcast',
                45: 'Fog',
                48: 'Depositing rime fog',
                51: 'Light drizzle',
                53: 'Moderate drizzle',
                55: 'Dense drizzle',
                61: 'Slight rain',
                63: 'Moderate rain',
                65: 'Heavy rain',
                71: 'Slight snow',
                73: 'Moderate snow',
                75: 'Heavy snow',
                80: 'Slight rain showers',
                81: 'Moderate rain showers',
                82: 'Violent rain showers',
                95: 'Thunderstorm',
                96: 'Thunderstorm with slight hail',
                99: 'Thunderstorm with heavy hail',
            };

            const forecast = daily.time.map((date: string, index: number) => ({
                date,
                high_temp: `${daily.temperature_2m_max[index]}°C`,
                low_temp: `${daily.temperature_2m_min[index]}°C`,
                condition: weatherConditions[daily.weather_code[index]] || 'Unknown',
                precipitation: `${daily.precipitation_sum[index]}mm`,
                wind_speed_max: `${daily.wind_speed_10m_max[index]} km/h`,
                weather_code: daily.weather_code[index],
            }));

            return {
                location: location_name || `${latitude}, ${longitude}`,
                coordinates: { latitude, longitude },
                forecast,
                forecast_days: forecastDays,
                timezone: data.timezone,
                source: 'Open-Meteo API',
                api_url: `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}`,
            };

        } catch (error) {
            return {
                error: 'Failed to fetch weather forecast',
                details: error instanceof Error ? error.message : 'Unknown error',
                coordinates: { latitude, longitude },
            };
        }
    },

    // Payment Tools
    'payment_process': async (args: Record<string, any>) => {
        const { amount, currency = 'USD', method = 'credit_card', description } = args;

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 500));

        return {
            transaction_id: `txn_${Math.random().toString(36).substr(2, 9)}`,
            status: 'completed',
            amount: parseFloat(amount) || 0,
            currency,
            method,
            description: description || 'Demo payment',
            timestamp: new Date().toISOString(),
            fee: Math.round((parseFloat(amount) || 0) * 0.029 * 100) / 100, // 2.9% fee
            net_amount: Math.round((parseFloat(amount) || 0) * 0.971 * 100) / 100,
        };
    },

    'payment_refund': async (args: Record<string, any>) => {
        const { transaction_id, amount, reason } = args;

        return {
            refund_id: `ref_${Math.random().toString(36).substr(2, 9)}`,
            original_transaction: transaction_id,
            status: 'processed',
            refund_amount: parseFloat(amount) || 0,
            reason: reason || 'Customer request',
            timestamp: new Date().toISOString(),
            estimated_arrival: '3-5 business days',
        };
    },

    // Database Tools
    'db_query': async (args: Record<string, any>) => {
        const { query, table = 'users' } = args;

        const mockData = {
            users: [
                { id: 1, name: 'John Doe', email: 'john@example.com', created_at: '2024-01-15' },
                { id: 2, name: 'Jane Smith', email: 'jane@example.com', created_at: '2024-02-20' },
                { id: 3, name: 'Bob Wilson', email: 'bob@example.com', created_at: '2024-03-10' },
            ],
            orders: [
                { id: 101, user_id: 1, amount: 99.99, status: 'completed', date: '2024-12-01' },
                { id: 102, user_id: 2, amount: 149.50, status: 'pending', date: '2024-12-15' },
            ],
            products: [
                { id: 201, name: 'Premium Plan', price: 99.99, category: 'subscription' },
                { id: 202, name: 'Enterprise Plan', price: 299.99, category: 'subscription' },
            ],
        };

        return {
            query: query || `SELECT * FROM ${table}`,
            table,
            results: mockData[table as keyof typeof mockData] || [],
            count: mockData[table as keyof typeof mockData]?.length || 0,
            execution_time: '0.05ms',
        };
    },

    // File Operations
    'file_read': async (args: Record<string, any>) => {
        const path = args.path || '/demo/sample.txt';
        const mockFiles = {
            '/demo/sample.txt': 'This is a sample text file for demonstration purposes.',
            '/config/app.json': '{"name": "Demo App", "version": "1.0.0", "debug": true}',
            '/logs/error.log': '2024-12-29 10:30:15 [ERROR] Connection timeout\n2024-12-29 10:31:22 [WARN] Retrying connection',
            '/data/users.csv': 'id,name,email\n1,John Doe,john@example.com\n2,Jane Smith,jane@example.com',
        };

        return {
            path,
            content: mockFiles[path as keyof typeof mockFiles] || `Mock content for ${path}`,
            size: mockFiles[path as keyof typeof mockFiles]?.length || 100,
            modified: new Date().toISOString(),
            encoding: 'utf-8',
        };
    },

    'file_write': async (args: Record<string, any>) => {
        const { path, content, mode = 'w' } = args;

        return {
            path: path || '/demo/output.txt',
            content: content || '',
            bytes_written: (content || '').length,
            mode,
            timestamp: new Date().toISOString(),
            success: true,
        };
    },

    'file_list': async (args: Record<string, any>) => {
        const directory = args.path || '/demo';

        const mockDirectories = {
            '/demo': [
                { name: 'sample.txt', type: 'file', size: 256, modified: '2024-12-29T10:00:00Z' },
                { name: 'images', type: 'directory', size: null, modified: '2024-12-28T15:30:00Z' },
                { name: 'data.json', type: 'file', size: 1024, modified: '2024-12-29T09:45:00Z' },
            ],
            '/config': [
                { name: 'app.json', type: 'file', size: 512, modified: '2024-12-29T08:00:00Z' },
                { name: 'database.yml', type: 'file', size: 256, modified: '2024-12-28T16:20:00Z' },
            ],
            '/logs': [
                { name: 'error.log', type: 'file', size: 2048, modified: '2024-12-29T11:00:00Z' },
                { name: 'access.log', type: 'file', size: 5120, modified: '2024-12-29T11:00:00Z' },
            ],
        };

        return {
            path: directory,
            files: mockDirectories[directory as keyof typeof mockDirectories] || [],
            total: mockDirectories[directory as keyof typeof mockDirectories]?.length || 0,
        };
    },

    // Web Search Tools - Using Firecrawl API
    'web_search': async (args: Record<string, any>) => {
        const { query, limit = 10 } = args;

        if (!query) {
            return {
                error: 'Missing required parameter: query is required',
                example: 'Use: {"query": "AI governance best practices", "limit": 5}',
            };
        }

        const apiKey = process.env.FIRECRAWL_API_KEY;
        if (!apiKey) {
            return {
                error: 'Firecrawl API key not configured',
                details: 'Please set FIRECRAWL_API_KEY environment variable',
            };
        }

        try {
            const app = new FirecrawlApp({ apiKey });

            // Use Firecrawl's search functionality
            const searchResult = await app.search(query, {
                limit: Math.min(limit, 10), // Max 10 results
            });

            if (!searchResult) {
                throw new Error('Search failed');
            }

            const results = Array.isArray(searchResult) ? searchResult.map((item: any, index: number) => ({
                title: item.title || `Result ${index + 1}`,
                url: item.url,
                snippet: item.description || item.content?.substring(0, 200) + '...',
                domain: item.url ? new URL(item.url).hostname : 'unknown',
                published: item.publishedTime || null,
                score: item.score || null,
            })) : [];

            return {
                query,
                results,
                total: results.length,
                source: 'Firecrawl Search API',
                search_time: `${Date.now()}ms`,
            };

        } catch (error) {
            return {
                error: 'Failed to perform web search',
                details: error instanceof Error ? error.message : 'Unknown error',
                query,
            };
        }
    },

    'web_scrape': async (args: Record<string, any>) => {
        const { url, formats = ['markdown', 'html'] } = args;

        if (!url) {
            return {
                error: 'Missing required parameter: url is required',
                example: 'Use: {"url": "https://example.com", "formats": ["markdown", "html"]}',
            };
        }

        const apiKey = process.env.FIRECRAWL_API_KEY;
        if (!apiKey) {
            return {
                error: 'Firecrawl API key not configured',
                details: 'Please set FIRECRAWL_API_KEY environment variable',
            };
        }

        try {
            const app = new FirecrawlApp({ apiKey });

            // Use Firecrawl's scraping functionality
            const scrapeResult = await app.scrape(url, {
                formats: formats,
                onlyMainContent: true,
                includeTags: ['title', 'meta', 'h1', 'h2', 'h3', 'p', 'a'],
                excludeTags: ['script', 'style', 'nav', 'footer'],
                waitFor: 1000, // Wait 1 second for dynamic content
            });

            if (!scrapeResult) {
                throw new Error('Scraping failed');
            }

            const data = scrapeResult as any;

            return {
                url,
                title: data.metadata?.title || 'No title found',
                content: data.markdown || data.html || data.rawHtml || 'No content extracted',
                metadata: {
                    description: data.metadata?.description,
                    keywords: data.metadata?.keywords,
                    author: data.metadata?.author,
                    language: data.metadata?.language,
                    published_time: data.metadata?.publishedTime,
                    modified_time: data.metadata?.modifiedTime,
                    image: data.metadata?.ogImage,
                    site_name: data.metadata?.siteName,
                },
                links: data.links || [],
                images: data.metadata?.ogImage ? [data.metadata.ogImage] : [],
                word_count: data.markdown ? data.markdown.split(/\s+/).length : 0,
                scraped_at: new Date().toISOString(),
                source: 'Firecrawl Scrape API',
                formats_returned: Object.keys(data).filter(key => ['markdown', 'html', 'rawHtml'].includes(key)),
            };

        } catch (error) {
            return {
                error: 'Failed to scrape webpage',
                details: error instanceof Error ? error.message : 'Unknown error',
                url,
            };
        }
    },

    // Email Tools
    'email_send': async (args: Record<string, any>) => {
        const { to, subject, body, from = 'demo@example.com' } = args;

        return {
            message_id: `msg_${Math.random().toString(36).substr(2, 9)}`,
            to: to || 'recipient@example.com',
            from,
            subject: subject || 'Demo Email',
            status: 'sent',
            timestamp: new Date().toISOString(),
            delivery_time: '< 1 minute',
        };
    },

    // Calendar Tools
    'calendar_create_event': async (args: Record<string, any>) => {
        const { title, start_time, end_time, description, attendees = [] } = args;

        return {
            event_id: `evt_${Math.random().toString(36).substr(2, 9)}`,
            title: title || 'Demo Meeting',
            start_time: start_time || new Date().toISOString(),
            end_time: end_time || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            description,
            attendees,
            calendar: 'primary',
            status: 'confirmed',
            created_at: new Date().toISOString(),
        };
    },

    // Key-Value Store
    'kv_get': async (args: Record<string, any>) => {
        const key = args.key || 'default_key';
        const mockStore = {
            'user_preferences': '{"theme": "dark", "notifications": true}',
            'api_config': '{"timeout": 30000, "retries": 3}',
            'cache_stats': '{"hits": 1250, "misses": 89, "ratio": 0.93}',
        };

        return {
            key,
            value: mockStore[key as keyof typeof mockStore] || `Mock value for ${key}`,
            exists: key in mockStore,
            timestamp: new Date().toISOString(),
            ttl: 3600, // 1 hour
        };
    },

    'kv_set': async (args: Record<string, any>) => {
        const { key, value, ttl = 3600 } = args;

        return {
            key: key || 'new_key',
            value: value || '',
            success: true,
            ttl,
            expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
            timestamp: new Date().toISOString(),
        };
    },
};
