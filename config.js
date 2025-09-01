/**
 * Configuration management for Sun & Moon Time Circle
 * Centralizes all magic numbers, timeouts, and settings for better maintainability
 */
class AppConfig {
    // ========== TIMING & INTERVALS ==========
    static TIMEOUTS = {
        STATUS_CLEAR: 5000,                           // Clear status message after 5 seconds
        CACHE_DURATION: 6 * 60 * 60 * 1000,          // API cache: 6 hours
        UPDATE_INTERVAL: 60 * 60 * 1000,              // Data refresh: 1 hour
        DATE_CHECK_INTERVAL: 10 * 60 * 1000,          // Date change check: 10 minutes
        CLOCK_UPDATE_INTERVAL: 60000,                 // Clock hand update: 1 minute
        LOCATION_CACHE: 5 * 60 * 1000,                // Location cache: 5 minutes
        API_REQUEST_TIMEOUT: 10000,                   // API request timeout: 10 seconds
        SETTINGS_RELOAD_DELAY: 1000,                  // Delay before reloading data after settings change
        DATE_SELECTION_DEBOUNCE: 500                  // Debounce delay for date selection calculations
    };

    // ========== VISUALIZATION DIMENSIONS ==========
    static VISUALIZATION = {
        // Default dimensions
        DEFAULT_WIDTH: 1000,
        DEFAULT_HEIGHT: 1000,
        MAX_SIZE: 1200,
        VIEWPORT_RATIO: 0.9,                          // 90% of viewport height
        SVG_MARGIN: 60,                               // Margin around SVG
        
        // Radius ratios for different layers
        RADIUS_RATIOS: {
            INNER: 0.50,                              // Inner circle (day/night arcs inner edge)
            MIDDLE: 0.62,                             // Middle circle (day/night arcs outer edge) 
            OUTER: 0.75,                              // Outer circle (moon arcs and hour markers)
            YEAR: 0.92                                // Year circle (outermost ring for date selection)
        },
        
        // Layer spacing and padding
        LAYER_SPACING: {
            MOON_LAYER_OFFSET: 10,                    // Gap between sun and moon layers
            YEAR_LAYER_OFFSET: 25,                    // Gap between moon and year layers (increased)
            HOVER_AREA_PADDING: 10,                   // Extra padding for hover areas
            UV_SEGMENT_PADDING: 0.005                 // Tiny gap between UV segments (hour units)
        },
        
        // Visual styling constants
        OPACITY: {
            DEFAULT: 1.0,
            HIDDEN: 0,
            SEMI_TRANSPARENT: 0.6,
            MARKERS: 0.6,
            LABELS: 0.8,
            SUN_LABELS: 0.9,
            MOON_LABELS: 0.9
        }
    };

    // ========== ASTRONOMICAL CONSTANTS ==========
    static ASTRONOMY = {
        // Solar calculations
        SOLAR_DECLINATION_ANGLE: 23.45,              // Earth's axial tilt in degrees
        SOLAR_DECLINATION_OFFSET: 81,                // Day offset for declination calculation
        DAYS_PER_YEAR: 365,
        
        // Lunar calculations  
        LUNAR_CYCLE_DAYS: 29.53,                     // Average lunar cycle length
        KNOWN_NEW_MOON: new Date('2025-01-29'),      // Reference new moon date
        
        // Moon phase thresholds
        MOON_PHASE_THRESHOLDS: {
            NEW_MOON: 0.125,
            WAXING_CRESCENT: 0.25,
            FIRST_QUARTER: 0.375,
            WAXING_GIBBOUS: 0.5,
            FULL_MOON: 0.625,
            WANING_GIBBOUS: 0.75,
            LAST_QUARTER: 0.875
        },
        
        // Time conversion constants
        HOURS_TO_MS: 60 * 60 * 1000,
        MINUTES_TO_MS: 60 * 1000,
        SECONDS_TO_MS: 1000,
        DAY_TO_MS: 24 * 60 * 60 * 1000,
        
        // Default coordinates
        DEFAULT_LOCATION: {
            lat: 40.7128,                             // New York City latitude
            lng: -74.0060                             // New York City longitude
        }
    };

    // ========== UV INDEX CONFIGURATION ==========
    static UV_INDEX = {
        // UV categories and colors
        CATEGORIES: [
            { max: 2, name: "Low", color: "#289500", gradientId: "uvLowGradient" },
            { max: 5, name: "Moderate", color: "#F7E400", gradientId: "uvModerateGradient" },
            { max: 7, name: "High", color: "#F85900", gradientId: "uvHighGradient" },
            { max: 10, name: "Very High", color: "#D8001D", gradientId: "uvVeryHighGradient" },
            { max: Infinity, name: "Extreme", color: "#6B49C8", gradientId: "uvExtremeGradient" }
        ],
        
        // UV gradient definitions
        GRADIENTS: {
            uvLowGradient: { color1: '#289500', color2: '#1e7100' },
            uvModerateGradient: { color1: '#F7E400', color2: '#d4c100' },
            uvHighGradient: { color1: '#F85900', color2: '#d14500' },
            uvVeryHighGradient: { color1: '#D8001D', color2: '#a50016' },
            uvExtremeGradient: { color1: '#6B49C8', color2: '#4c329e' }
        },
        
        // UV calculation settings
        MAX_SCALE: 12,                                // UV scale goes up to 12+
        ROUNDING_PRECISION: 0.5,                      // Round to nearest 0.5
        FALLBACK_PEAK_UV: 8,                         // Peak UV for fallback calculations
        NOON_FALLBACK_DECAY: 1.2                     // Decay rate from noon for fallback
    };

    // ========== API CONFIGURATION ==========
    static API = {
        // Rate limiting and caching
        MAX_HISTORICAL_REQUESTS: 12,                  // Max historical API calls
        FORECAST_HOURS: 48,                           // Hours to fetch in forecast
        UV_FORECAST_CUTOFF_HOURS: 6,                  // Only show UV forecast up to 6 hours
        
        // API endpoints base URLs
        OPENWEATHER_BASE_URL: 'https://api.openweathermap.org/data/3.0',
        
        // Retry and timeout settings
        MAX_RETRIES: 3,
        RETRY_DELAY: 1000,                            // Base retry delay in ms
        
        // Data validation
        LOCATION_TOLERANCE: 5,                        // Day length matching tolerance (minutes)
        SEARCH_RANGE_DAYS: 30,                        // Days to search for matching day length
        EXTENDED_SEARCH_DAYS: 60                      // Extended search range if needed
    };

    // ========== COLOR SCHEMES ==========
    static COLORS = {
        // Day/Night gradients
        DAY_GRADIENT: {
            inner: { color: '#ffd700', opacity: 0.8 },
            outer: { color: '#ff8c00', opacity: 0.6 }
        },
        NIGHT_GRADIENT: {
            inner: { color: '#1a1a2e', opacity: 0.9 },
            outer: { color: '#16213e', opacity: 0.7 }
        },
        MOON_GRADIENT: {
            inner: { color: '#f5f5dc', opacity: 0.8 },
            outer: { color: '#c0c0c0', opacity: 0.6 }
        },
        
        // UI element colors
        CLOCK_HAND: '#ffd700',
        HOUR_MARKERS: 'rgba(255, 255, 255, 0.6)',
        HOUR_LABELS: 'rgba(255, 255, 255, 0.8)',
        SUN_LABELS: 'rgba(255, 255, 255, 0.9)',
        MOON_LABELS: 'rgba(245, 245, 220, 0.9)',
        
        // Year circle colors
        YEAR_GRADIENT: {
            inner: { color: '#4a90e2', opacity: 0.3 },    // Light blue for year ring
            outer: { color: '#2c5aa0', opacity: 0.5 }
        },
        YEAR_MARKERS: 'rgba(255, 255, 255, 0.4)',
        YEAR_LABELS: 'rgba(255, 255, 255, 0.7)',
        SELECTED_DATE: '#ffd700',                         // Gold for selected date indicator
        
        // Status colors
        STATUS_SUCCESS: '#51cf66',
        STATUS_ERROR: '#ff6b6b',
        STATUS_WARNING: '#ffd43b'
    };

    // ========== FONT AND TEXT SETTINGS ==========
    static TEXT = {
        FONTS: {
            HOUR_LABELS: '14px',
            TIME_LABELS: '13px',
            MOON_LABELS: '12px',
            UV_LABELS: '14px',
            CENTER_TIME: '24px',
            CENTER_INFO: '14px',
            CENTER_CALC: '12px',
            YEAR_LABELS: '11px',
            SELECTED_DATE: '12px'
        },
        
        WEIGHTS: {
            NORMAL: 'normal',
            BOLD: 'bold'
        },
        
        ANCHORS: {
            MIDDLE: 'middle',
            START: 'start',
            END: 'end'
        }
    };

    // ========== ANIMATION SETTINGS ==========
    static ANIMATION = {
        DURATIONS: {
            FAST: 200,                                // Fast transitions (hover effects)
            MEDIUM: 300,                              // Medium transitions (UV arcs)
            SLOW: 500                                 // Slow transitions (major changes)
        },
        
        EASING: 'ease-in-out'
    };

    // ========== EQUINOX/SOLSTICE DATA ==========
    static ASTRONOMICAL_EVENTS = {
        2024: {
            springEquinox: new Date('2024-03-20T03:06:00Z'),
            summerSolstice: new Date('2024-06-20T20:51:00Z'),
            autumnEquinox: new Date('2024-09-22T12:44:00Z'),
            winterSolstice: new Date('2024-12-21T09:21:00Z')
        },
        2025: {
            springEquinox: new Date('2025-03-20T09:01:00Z'),
            summerSolstice: new Date('2025-06-21T02:42:00Z'),
            autumnEquinox: new Date('2025-09-22T18:19:00Z'),
            winterSolstice: new Date('2025-12-21T15:03:00Z')
        }
    };

    // ========== HELPER METHODS ==========
    
    /**
     * Get UV category for a given UV index value
     * @param {number} uvIndex - UV index value
     * @returns {object} Category object with name, color, and gradientId
     */
    static getUVCategory(uvIndex) {
        return this.UV_INDEX.CATEGORIES.find(cat => uvIndex <= cat.max) || 
               this.UV_INDEX.CATEGORIES[this.UV_INDEX.CATEGORIES.length - 1];
    }
    
    /**
     * Convert hours to milliseconds
     * @param {number} hours - Number of hours
     * @returns {number} Milliseconds
     */
    static hoursToMs(hours) {
        return hours * this.ASTRONOMY.HOURS_TO_MS;
    }
    
    /**
     * Convert minutes to milliseconds  
     * @param {number} minutes - Number of minutes
     * @returns {number} Milliseconds
     */
    static minutesToMs(minutes) {
        return minutes * this.ASTRONOMY.MINUTES_TO_MS;
    }
    
    /**
     * Get the default size for the visualization
     * @param {object} containerRect - Container bounding rectangle
     * @returns {number} Calculated size
     */
    static getVisualizationSize(containerRect) {
        return Math.min(
            containerRect.width || this.VISUALIZATION.DEFAULT_WIDTH,
            window.innerHeight * this.VISUALIZATION.VIEWPORT_RATIO,
            this.VISUALIZATION.MAX_SIZE
        );
    }
    
    /**
     * Calculate radius with margin
     * @param {number} width - Width of container
     * @param {number} height - Height of container  
     * @returns {number} Radius with margin applied
     */
    static getRadiusWithMargin(width, height) {
        return Math.min(width, height) / 2 - this.VISUALIZATION.SVG_MARGIN;
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppConfig;
}