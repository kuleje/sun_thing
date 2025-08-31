class AstronomicalAPI {
    constructor() {
        this.apiKey = localStorage.getItem('ipGeoApiKey') || '';
        this.userLocation = this.loadUserLocation();
        this.cache = new Map();
        this.cacheTimeout = 6 * 60 * 60 * 1000; // 6 hours in ms
        this.dailyCache = new Map(); // Cache astronomical data per day
    }
    
    setApiKey(apiKey) {
        this.apiKey = apiKey;
        localStorage.setItem('ipGeoApiKey', apiKey);
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
            const defaultLocation = { lat: 40.7128, lng: -74.0060 };
            this.setUserLocation(defaultLocation);
            return defaultLocation;
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
                        const defaultLocation = { lat: 40.7128, lng: -74.0060 };
                        this.setUserLocation(defaultLocation);
                        resolve(defaultLocation);
                    },
                    {
                        timeout: 10000,
                        maximumAge: 5 * 60 * 1000 // Cache location for 5 minutes
                    }
                );
            } else {
                // Geolocation not supported, use default location
                const defaultLocation = { lat: 40.7128, lng: -74.0060 };
                this.setUserLocation(defaultLocation);
                resolve(defaultLocation);
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
            
            const data = {
                sun: sunData,
                moon: moonData,
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