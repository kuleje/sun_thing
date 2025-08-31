class AstronomicalAPI {
    constructor() {
        this.apiKey = localStorage.getItem('ipGeoApiKey') || '';
        this.openWeatherApiKey = localStorage.getItem('openWeatherApiKey') || '';
        this.userLocation = this.loadUserLocation();
        this.cache = new Map();
        this.cacheTimeout = 6 * 60 * 60 * 1000; // 6 hours in ms
        this.dailyCache = new Map(); // Cache astronomical data per day
    }
    
    setApiKey(apiKey) {
        this.apiKey = apiKey;
        localStorage.setItem('ipGeoApiKey', apiKey);
    }
    
    setOpenWeatherApiKey(apiKey) {
        this.openWeatherApiKey = apiKey;
        localStorage.setItem('openWeatherApiKey', apiKey);
    }
    
    setUserLocation(location) {
        this.userLocation = location;
        localStorage.setItem('userLocation', JSON.stringify(location));
    }
    
    loadUserLocation() {
        const saved = localStorage.getItem('userLocation');
        return saved ? JSON.parse(saved) : null;
    }
    
    async getCurrentLocation() {
        if (this.userLocation) {
            return this.userLocation;
        }
        
        // Check if user has previously denied location or we have a saved preference
        const locationPermissionDenied = localStorage.getItem('locationPermissionDenied') === 'true';
        if (locationPermissionDenied) {
            // No default location - require explicit user action
            throw new Error('Location access denied. Please enable location sharing or enter coordinates manually in Settings.');
        }
        
        // Try to get user's location via geolocation API
        return new Promise((resolve) => {
            if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const location = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        };
                        this.setUserLocation(location);
                        localStorage.removeItem('locationPermissionDenied'); // Clear any previous denial
                        resolve(location);
                    },
                    (error) => {
                        // User denied location or error occurred
                        localStorage.setItem('locationPermissionDenied', 'true');
                        // No default location - reject with clear message
                        resolve(null);
                    },
                    {
                        timeout: 10000,
                        maximumAge: 5 * 60 * 1000 // Cache location for 5 minutes
                    }
                );
            } else {
                // Geolocation not supported, no default location
                resolve(null);
            }
        });
    }
    
    getCacheKey(endpoint, params) {
        return `${endpoint}_${JSON.stringify(params)}`;
    }
    
    isCacheValid(cacheEntry) {
        return Date.now() - cacheEntry.timestamp < this.cacheTimeout;
    }
    
    async fetchWithCache(endpoint, params) {
        const cacheKey = this.getCacheKey(endpoint, params);
        const cached = this.cache.get(cacheKey);
        
        if (cached && this.isCacheValid(cached)) {
            return cached.data;
        }
        
        try {
            const data = await this.fetchFromAPI(endpoint, params);
            this.cache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });
            return data;
        } catch (error) {
            console.error('API fetch error:', error);
            // Return cached data even if expired, as fallback
            if (cached) {
                return cached.data;
            }
            throw error;
        }
    }
    
    async fetchFromAPI(endpoint, params) {
        const location = await this.getCurrentLocation();
        if (!location) {
            throw new Error('Location required. Please enable location sharing or enter coordinates manually in Settings.');
        }
        const baseUrl = 'https://api.ipgeolocation.io/astronomy';
        
        const urlParams = new URLSearchParams({
            apiKey: this.apiKey,
            lat: location.lat.toString(),
            long: location.lng.toString(),
            ...params
        });
        
        const response = await fetch(`${baseUrl}?${urlParams}`);
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        
        return await response.json();
    }
    
    async getSunData(date = new Date()) {
        const dateStr = date.toISOString().split('T')[0];
        
        try {
            const data = await this.fetchWithCache('sun', { date: dateStr });
            
            return {
                sunrise: data.sunrise ? new Date(`${dateStr}T${data.sunrise}`) : this.getFallbackSunData(new Date(dateStr)).sunrise,
                sunset: data.sunset ? new Date(`${dateStr}T${data.sunset}`) : this.getFallbackSunData(new Date(dateStr)).sunset,
                solarNoon: data.solar_noon ? new Date(`${dateStr}T${data.solar_noon}`) : new Date(`${dateStr}T12:00:00`),
                dayLength: data.day_length,
                sunAzimuth: isNaN(parseFloat(data.sun_azimuth)) ? 0 : parseFloat(data.sun_azimuth),
                sunAltitude: isNaN(parseFloat(data.sun_altitude)) ? 0 : parseFloat(data.sun_altitude)
            };
        } catch (error) {
            console.error('Failed to fetch sun data:', error);
            return this.getFallbackSunData(date);
        }
    }
    
    async getMoonData(date = new Date()) {
        const dateStr = date.toISOString().split('T')[0];
        
        try {
            const data = await this.fetchWithCache('moon', { date: dateStr });
            
            return {
                moonrise: data.moonrise ? new Date(`${dateStr}T${data.moonrise}`) : null,
                moonset: data.moonset ? new Date(`${dateStr}T${data.moonset}`) : null,
                moonPhase: data.moon_phase,
                illumination: isNaN(parseFloat(data.moon_illumination)) ? 50 : parseFloat(data.moon_illumination),
                moonAzimuth: isNaN(parseFloat(data.moon_azimuth)) ? 0 : parseFloat(data.moon_azimuth),
                moonAltitude: isNaN(parseFloat(data.moon_altitude)) ? 0 : parseFloat(data.moon_altitude)
            };
        } catch (error) {
            console.error('Failed to fetch moon data:', error);
            return this.getFallbackMoonData(date);
        }
    }
    
    getFallbackSunData(date) {
        // Simple sunrise/sunset calculation for fallback
        // This is a very basic approximation - real calculation would be more complex
        const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
        const lat = this.userLocation?.lat || 40.7128; // Default to NYC
        
        // Very simplified calculation (not accurate but provides fallback)
        const declination = 23.45 * Math.sin((360/365) * (dayOfYear - 81) * Math.PI / 180);
        const hourAngle = Math.acos(-Math.tan(lat * Math.PI / 180) * Math.tan(declination * Math.PI / 180));
        
        const sunriseHour = 12 - (hourAngle * 180 / Math.PI) / 15;
        const sunsetHour = 12 + (hourAngle * 180 / Math.PI) / 15;
        
        const sunrise = new Date(date);
        sunrise.setHours(Math.floor(sunriseHour), (sunriseHour % 1) * 60, 0, 0);
        
        const sunset = new Date(date);
        sunset.setHours(Math.floor(sunsetHour), (sunsetHour % 1) * 60, 0, 0);
        
        return {
            sunrise: sunrise,
            sunset: sunset,
            solarNoon: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0),
            dayLength: `${Math.floor(sunsetHour - sunriseHour)}h ${Math.floor(((sunsetHour - sunriseHour) % 1) * 60)}m`,
            sunAzimuth: 0,
            sunAltitude: 0
        };
    }
    
    getFallbackMoonData(date) {
        // Very basic moon phase calculation for fallback
        const knownNewMoon = new Date('2025-01-29'); // Known new moon date
        const daysSinceNewMoon = (date - knownNewMoon) / (1000 * 60 * 60 * 24);
        const lunarCycle = 29.53; // days
        const phase = (daysSinceNewMoon % lunarCycle) / lunarCycle;
        
        let illumination;
        if (phase < 0.5) {
            illumination = phase * 2 * 100; // Waxing
        } else {
            illumination = (1 - phase) * 2 * 100; // Waning
        }
        
        return {
            moonrise: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 20, 0, 0),
            moonset: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 6, 0, 0),
            moonPhase: this.getMoonPhaseName(phase),
            illumination: Math.max(0, Math.min(100, illumination)),
            moonAzimuth: 0,
            moonAltitude: 0
        };
    }
    
    getMoonPhaseName(phase) {
        if (phase < 0.125) return 'New Moon';
        if (phase < 0.25) return 'Waxing Crescent';
        if (phase < 0.375) return 'First Quarter';
        if (phase < 0.5) return 'Waxing Gibbous';
        if (phase < 0.625) return 'Full Moon';
        if (phase < 0.75) return 'Waning Gibbous';
        if (phase < 0.875) return 'Last Quarter';
        return 'Waning Crescent';
    }
    
    async getHistoricalUVData(startTime, endTime) {
        if (!this.openWeatherApiKey) {
            console.log('No OpenWeatherMap API key available for historical UV data');
            return [];
        }
        
        try {
            const location = await this.getCurrentLocation();
            if (!location) {
                throw new Error('Location required for historical UV data');
            }
            
            const historicalData = [];
            const cacheKey = `historical_uv_${startTime.toDateString()}`;
            
            // Check cache first
            const cached = this.cache.get(cacheKey);
            if (cached && this.isCacheValid(cached)) {
                console.log('Using cached historical UV data for', startTime.toDateString());
                return cached.data;
            }
            
            console.log('Fetching historical UV data from', startTime.toLocaleString(), 'to', endTime.toLocaleString());
            
            // Make timemachine API calls for each hour - limit concurrent requests
            const promises = [];
            const current = new Date(startTime);
            let hourCount = 0;
            const maxHours = 12; // Limit historical requests to prevent API abuse
            
            while (current <= endTime && hourCount < maxHours) {
                const timestamp = Math.floor(current.getTime() / 1000); // Unix timestamp
                const url = `https://api.openweathermap.org/data/3.0/onecall/timemachine?lat=${location.lat}&lon=${location.lng}&dt=${timestamp}&appid=${this.openWeatherApiKey}`;
                const currentHourForLogging = new Date(current);
                
                promises.push(
                    fetch(url)
                        .then(response => {
                            if (!response.ok) {
                                if (response.status === 429) {
                                    throw new Error('Rate limited by OpenWeatherMap API');
                                }
                                throw new Error(`Historical API request failed: ${response.status}`);
                            }
                            return response.json();
                        })
                        .then(data => ({
                            time: new Date(currentHourForLogging),
                            uv: data.data?.[0]?.uvi || data.uvi || 0, // Handle different response formats
                            hour: currentHourForLogging.getHours()
                        }))
                        .catch(error => {
                            console.warn('Failed to fetch historical UV for', currentHourForLogging.toLocaleString(), error.message);
                            // Return null to indicate failure, will be filtered out
                            return null;
                        })
                );
                
                current.setHours(current.getHours() + 1);
                hourCount++;
            }
            
            // Add a small delay between requests to avoid rate limiting
            if (promises.length > 1) {
                console.log(`Making ${promises.length} historical UV requests with rate limiting...`);
            }
            
            // Wait for all requests to complete
            const results = await Promise.all(promises);
            
            // Filter out failed requests and zero UV values
            const validResults = results.filter(result => result !== null && result.uv > 0);
            historicalData.push(...validResults);
            
            // Cache the results
            this.cache.set(cacheKey, {
                data: historicalData,
                timestamp: Date.now()
            });
            
            console.log(`Fetched ${historicalData.length} hours of historical UV data`);
            return historicalData;
            
        } catch (error) {
            console.error('Failed to fetch historical UV data:', error);
            return [];
        }
    }
    
    async getUVForecast(date = new Date()) {
        if (!this.openWeatherApiKey) {
            console.log('No OpenWeatherMap API key available for UV data');
            return this.getFallbackUVData();
        }
        
        try {
            const location = await this.getCurrentLocation();
            if (!location) {
                throw new Error('Location required for UV forecast. Please enable location sharing or enter coordinates manually in Settings.');
            }
            
            const cached = this.cache.get(`uv_complete_${date.toDateString()}`);
            if (cached && this.isCacheValid(cached)) {
                console.log('Using cached complete UV data');
                return cached.data;
            }
            
            console.log('Fetching complete UV data (historical + forecast) from OpenWeatherMap API');
            
            // Get current time and day boundaries
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
            
            // Get sun data to determine daylight hours
            const sunData = await this.getSunData(date);
            const sunriseHour = sunData.sunrise.getHours();
            const currentHour = now.getHours();
            
            let allHourlyData = [];
            
            // 1. Get historical data for past daylight hours (sunrise to current hour)
            if (currentHour > sunriseHour) {
                const historicalStart = new Date(todayStart);
                historicalStart.setHours(sunriseHour, 0, 0, 0);
                
                const historicalEnd = new Date(now);
                historicalEnd.setMinutes(0, 0, 0); // Round to current hour start
                
                console.log('Fetching historical UV data from', historicalStart.toLocaleString(), 'to', historicalEnd.toLocaleString());
                const historicalData = await this.getHistoricalUVData(historicalStart, historicalEnd);
                allHourlyData.push(...historicalData);
            }
            
            // 2. Get forecast data for current hour onwards
            const forecastUrl = `https://api.openweathermap.org/data/3.0/onecall?lat=${location.lat}&lon=${location.lng}&exclude=minutely,alerts&units=metric&appid=${this.openWeatherApiKey}`;
            const forecastResponse = await fetch(forecastUrl);
            
            if (!forecastResponse.ok) {
                throw new Error(`Forecast API request failed: ${forecastResponse.status}`);
            }
            
            const forecastData = await forecastResponse.json();
            
            // Process forecast data - include current hour through tomorrow morning
            const forecastHourly = forecastData.hourly?.slice(0, 48)
                .map(hour => ({
                    time: new Date(hour.dt * 1000),
                    uv: hour.uvi || 0,
                    hour: new Date(hour.dt * 1000).getHours()
                }))
                .filter(hour => {
                    // Include current hour onwards through tomorrow morning
                    return hour.time >= new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()) 
                           && hour.time < new Date(tomorrowStart.getTime() + 6 * 60 * 60 * 1000);
                }) || [];
            
            allHourlyData.push(...forecastHourly);
            
            // 3. Sort by time and remove duplicates
            allHourlyData.sort((a, b) => a.time - b.time);
            
            // Remove duplicates (prefer historical data over forecast for same hour)
            const uniqueHourlyData = [];
            const seenHours = new Set();
            
            for (const hourData of allHourlyData) {
                const hourKey = `${hourData.time.getDate()}_${hourData.time.getHours()}`;
                if (!seenHours.has(hourKey)) {
                    seenHours.add(hourKey);
                    uniqueHourlyData.push(hourData);
                }
            }
            
            // 4. Group consecutive hours with same UV index for fine-grained arcs
            const groupedUVData = this.groupUVDataByIndex(uniqueHourlyData);
            
            const uvData = {
                current: forecastData.current?.uvi || 0,
                hourly: uniqueHourlyData,
                grouped: groupedUVData, // Add grouped data for arc rendering
                daily: forecastData.daily?.slice(0, 7).map(day => ({
                    date: new Date(day.dt * 1000),
                    maxUv: day.uvi || 0
                })) || []
            };
            
            // Cache the complete result
            this.cache.set(`uv_complete_${date.toDateString()}`, {
                data: uvData,
                timestamp: Date.now()
            });
            
            console.log(`Complete UV data: ${uniqueHourlyData.length} hours, ${groupedUVData.length} grouped arcs`);
            return uvData;
            
        } catch (error) {
            console.error('Failed to fetch complete UV data:', error);
            return this.getFallbackUVData();
        }
    }
    
    groupUVDataByIndex(hourlyData) {
        if (!hourlyData || hourlyData.length === 0) return [];
        
        const grouped = [];
        let currentGroup = null;
        
        for (const hourData of hourlyData) {
            // Round UV index to nearest 0.5 for grouping (prevents too many tiny segments)
            const roundedUV = Math.round(hourData.uv * 2) / 2;
            
            if (!currentGroup || currentGroup.uvIndex !== roundedUV) {
                // Start a new group
                if (currentGroup) {
                    grouped.push(currentGroup);
                }
                
                currentGroup = {
                    uvIndex: roundedUV,
                    startTime: hourData.time,
                    endTime: new Date(hourData.time.getTime() + 60 * 60 * 1000), // +1 hour
                    startHour: hourData.time.getHours() + hourData.time.getMinutes() / 60,
                    endHour: hourData.time.getHours() + 1 + hourData.time.getMinutes() / 60,
                    hours: [hourData]
                };
            } else {
                // Extend current group
                currentGroup.endTime = new Date(hourData.time.getTime() + 60 * 60 * 1000); // +1 hour from this hour
                currentGroup.endHour = hourData.time.getHours() + 1 + hourData.time.getMinutes() / 60;
                currentGroup.hours.push(hourData);
            }
        }
        
        // Don't forget the last group
        if (currentGroup) {
            grouped.push(currentGroup);
        }
        
        // Filter out groups with UV index 0 (no UV)
        const filteredGroups = grouped.filter(group => group.uvIndex > 0);
        
        console.log('UV index grouping result:', {
            originalHours: hourlyData.length,
            groupedArcs: filteredGroups.length,
            groups: filteredGroups.map(g => ({
                uvIndex: g.uvIndex,
                timeRange: `${g.startTime.getHours()}:00-${g.endTime.getHours()}:00`,
                hourCount: g.hours.length
            }))
        });
        
        return filteredGroups;
    }
    
    getFallbackUVData() {
        // Simple fallback UV data - assumes moderate UV during daylight hours
        const now = new Date();
        const hourly = [];
        
        // Generate 24 hours of fallback UV data
        for (let i = 0; i < 24; i++) {
            const hour = new Date(now.getTime() + (i * 60 * 60 * 1000));
            const hourOfDay = hour.getHours();
            
            let uvValue = 0;
            // Simple daylight UV simulation
            if (hourOfDay >= 6 && hourOfDay <= 18) {
                // Peak UV around noon, lower in morning/evening
                const distanceFromNoon = Math.abs(12 - hourOfDay);
                uvValue = Math.max(0, 8 - (distanceFromNoon * 1.2));
            }
            
            hourly.push({
                time: hour,
                uv: uvValue,
                hour: hourOfDay
            });
        }
        
        // Group the fallback data like the real API data
        const grouped = this.groupUVDataByIndex(hourly.filter(h => h.uv > 0));
        
        return {
            current: hourly.find(h => h.hour === now.getHours())?.uv || 0,
            hourly: hourly,
            grouped: grouped, // Add grouped fallback data
            daily: [{
                date: now,
                maxUv: Math.max(...hourly.map(h => h.uv))
            }]
        };
    }
    
    getUVCategory(uvi) {
        if (uvi <= 2) return { name: "Low", color: "#289500" };
        if (uvi <= 5) return { name: "Moderate", color: "#F7E400" };
        if (uvi <= 7) return { name: "High", color: "#F85900" };
        if (uvi <= 10) return { name: "Very High", color: "#D8001D" };
        return { name: "Extreme", color: "#6B49C8" };
    }
    
    async getExtendedAstronomicalData() {
        try {
            const today = new Date();
            const dateKey = today.toDateString(); // e.g., "Sat Aug 31 2025"
            
            // Check daily cache first
            const cachedData = this.dailyCache.get(dateKey);
            if (cachedData) {
                console.log('Using cached daily astronomical data for:', dateKey);
                return cachedData;
            }
            
            console.log('Fetching fresh astronomical data for:', dateKey);
            const sunData = await this.getSunData(today);
            const moonData = await this.getMoonData(today);
            const uvData = await this.getUVForecast(today);
            
            const data = {
                sun: sunData,
                moon: moonData,
                uv: uvData,
                location: await this.getCurrentLocation(),
                lastUpdate: new Date()
            };
            
            // Cache the data for the day
            this.dailyCache.set(dateKey, data);
            
            // Clean up old cache entries (keep only last 3 days)
            const keys = Array.from(this.dailyCache.keys());
            if (keys.length > 3) {
                const oldestKey = keys[0];
                this.dailyCache.delete(oldestKey);
                console.log('Removed old cached data for:', oldestKey);
            }
            
            return data;
        } catch (error) {
            console.error('Failed to fetch astronomical data:', error);
            throw error;
        }
    }
    
    // Method to test API connection
    async testConnection() {
        if (!this.apiKey) {
            throw new Error('No API key provided');
        }
        
        try {
            await this.getSunData();
            return { success: true, message: 'API connection successful' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
}