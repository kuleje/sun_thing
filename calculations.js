class AstronomicalCalculations {
    constructor() {
        const currentYear = new Date().getFullYear();
        this.equinoxSolsticeData = this.getEquinoxSolsticeData(currentYear);
    }
    
    // Fixed dates for equinoxes and solstices
    getEquinoxSolsticeData(year) {
        // Approximate dates - these vary slightly each year but are close enough
        const data = {
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
        
        // If we have data for the year, use it
        if (data[year]) {
            return data[year];
        }
        
        // Otherwise, calculate approximate dates for any year
        return {
            springEquinox: new Date(year, 2, 20, 12, 0, 0), // March 20
            summerSolstice: new Date(year, 5, 21, 12, 0, 0), // June 21
            autumnEquinox: new Date(year, 8, 22, 12, 0, 0), // September 22
            winterSolstice: new Date(year, 11, 21, 12, 0, 0) // December 21
        };
    }
    
    getNextEquinoxOrSolstice() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const events = this.equinoxSolsticeData;
        
        if (!events) {
            return null;
        }
        
        const eventList = [
            { name: 'Spring Equinox', date: events.springEquinox, season: 'spring' },
            { name: 'Summer Solstice', date: events.summerSolstice, season: 'summer' },
            { name: 'Autumn Equinox', date: events.autumnEquinox, season: 'autumn' },
            { name: 'Winter Solstice', date: events.winterSolstice, season: 'winter' }
        ];
        
        // Find the next event
        for (const event of eventList) {
            if (event.date > now) {
                const daysUntil = Math.ceil((event.date - now) / (1000 * 60 * 60 * 24));
                return {
                    ...event,
                    daysUntil: daysUntil
                };
            }
        }
        
        // If no events left this year, return the first event of next year
        // For now, just return the spring equinox with approximate date
        const nextSpringEquinox = new Date(currentYear + 1, 2, 20); // Approximate
        const daysUntil = Math.ceil((nextSpringEquinox - now) / (1000 * 60 * 60 * 24));
        
        return {
            name: 'Spring Equinox',
            date: nextSpringEquinox,
            season: 'spring',
            daysUntil: daysUntil
        };
    }
    
    calculateDayLength(sunData) {
        if (!sunData || !sunData.sunrise || !sunData.sunset) {
            return null;
        }
        
        const dayLengthMs = sunData.sunset - sunData.sunrise;
        const totalMinutes = Math.floor(dayLengthMs / (1000 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        
        return {
            hours: hours,
            minutes: minutes,
            totalMinutes: totalMinutes,
            formatted: `${hours}h ${minutes}m`
        };
    }
    
    async findMatchingDayLength(currentDayLength, userLocation) {
        if (!currentDayLength || !currentDayLength.totalMinutes) {
            return null;
        }
        
        const targetMinutes = currentDayLength.totalMinutes;
        const tolerance = 5; // 5 minutes tolerance
        const today = new Date();
        const currentDayOfYear = this.getDayOfYear(today);
        
        // Search through the year for matching day lengths
        // We'll check days 6 months away (opposite season)
        const sixMonthsAway = new Date(today);
        sixMonthsAway.setMonth(sixMonthsAway.getMonth() + 6);
        
        // Search around the opposite season (±30 days)
        let closestMatch = null;
        let smallestDifference = Infinity;
        
        for (let offset = -30; offset <= 30; offset++) {
            const testDate = new Date(sixMonthsAway);
            testDate.setDate(testDate.getDate() + offset);
            
            // Skip if the test date is too close to today (within 60 days)
            const daysDifference = Math.abs((testDate - today) / (1000 * 60 * 60 * 24));
            if (daysDifference < 60) {
                continue;
            }
            
            const testDayLength = this.estimateDayLength(testDate, userLocation);
            const difference = Math.abs(testDayLength.totalMinutes - targetMinutes);
            
            if (difference <= tolerance && difference < smallestDifference) {
                smallestDifference = difference;
                closestMatch = {
                    date: new Date(testDate),
                    dayLength: testDayLength,
                    difference: difference,
                    daysFromToday: Math.round(daysDifference)
                };
            }
        }
        
        return closestMatch;
    }
    
    estimateDayLength(date, location) {
        // Simplified day length calculation based on latitude and day of year
        if (!location || typeof location.lat !== 'number') {
            location = { lat: 40.7128 }; // Default to NYC
        }
        
        const dayOfYear = this.getDayOfYear(date);
        const lat = location.lat * Math.PI / 180; // Convert to radians
        
        // Solar declination angle
        const declination = 23.45 * Math.sin((360 / 365) * (dayOfYear - 81) * Math.PI / 180);
        const declinationRad = declination * Math.PI / 180;
        
        // Hour angle at sunrise/sunset
        const hourAngleRad = Math.acos(-Math.tan(lat) * Math.tan(declinationRad));
        const hourAngleDegrees = hourAngleRad * 180 / Math.PI;
        
        // Day length in hours
        const dayLengthHours = 2 * hourAngleDegrees / 15;
        const totalMinutes = Math.round(dayLengthHours * 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        
        return {
            hours: hours,
            minutes: minutes,
            totalMinutes: totalMinutes,
            formatted: `${hours}h ${minutes}m`
        };
    }
    
    getDayOfYear(date) {
        const start = new Date(date.getFullYear(), 0, 0);
        const diff = date - start;
        const oneDay = 1000 * 60 * 60 * 24;
        return Math.floor(diff / oneDay);
    }
    
    getSeason(date) {
        const month = date.getMonth();
        const day = date.getDate();
        
        // Approximate seasons for Northern Hemisphere
        if ((month === 2 && day >= 20) || (month >= 3 && month <= 5) || (month === 5 && day < 21)) {
            return 'Spring';
        } else if ((month === 5 && day >= 21) || (month >= 6 && month <= 8) || (month === 8 && day < 23)) {
            return 'Summer';
        } else if ((month === 8 && day >= 23) || (month >= 9 && month <= 11) || (month === 11 && day < 21)) {
            return 'Autumn';
        } else {
            return 'Winter';
        }
    }
    
    getMoonPhaseEmoji(phaseName) {
        const phaseEmojis = {
            'New Moon': '🌑',
            'Waxing Crescent': '🌒',
            'First Quarter': '🌓',
            'Waxing Gibbous': '🌔',
            'Full Moon': '🌕',
            'Waning Gibbous': '🌖',
            'Last Quarter': '🌗',
            'Waning Crescent': '🌘'
        };
        
        return phaseEmojis[phaseName] || '🌙';
    }
    
    formatTimeUntilEvent(days) {
        if (days === 0) return 'Today';
        if (days === 1) return 'Tomorrow';
        if (days < 7) return `${days} days`;
        if (days < 30) return `${Math.floor(days / 7)} weeks`;
        if (days < 365) return `${Math.floor(days / 30)} months`;
        return `${Math.floor(days / 365)} years`;
    }
    
    // Calculate sun's position (elevation and azimuth) at any time
    calculateSunPosition(date, location) {
        if (!location) return null;
        
        const lat = location.lat * Math.PI / 180;
        const lng = location.lng * Math.PI / 180;
        
        // Julian day calculation
        const jd = this.getJulianDay(date);
        const n = jd - 2451545.0;
        
        // Solar coordinates
        const L = (280.460 + 0.9856474 * n) * Math.PI / 180;
        const g = (357.528 + 0.9856003 * n) * Math.PI / 180;
        const lambda = L + 1.915 * Math.sin(g) * Math.PI / 180 + 0.020 * Math.sin(2 * g) * Math.PI / 180;
        
        // Declination
        const beta = 0;
        const epsilon = 23.439 * Math.PI / 180;
        const alpha = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda));
        const delta = Math.asin(Math.sin(epsilon) * Math.sin(lambda));
        
        // Local hour angle
        const gmst = 18.697374558 + 24.06570982441908 * n;
        const lmst = gmst + lng * 180 / Math.PI / 15;
        const h = (lmst * 15 - alpha * 180 / Math.PI) * Math.PI / 180;
        
        // Elevation and azimuth
        const elevation = Math.asin(Math.sin(lat) * Math.sin(delta) + Math.cos(lat) * Math.cos(delta) * Math.cos(h));
        const azimuth = Math.atan2(-Math.sin(h), Math.tan(delta) * Math.cos(lat) - Math.sin(lat) * Math.cos(h));
        
        return {
            elevation: elevation * 180 / Math.PI,
            azimuth: (azimuth * 180 / Math.PI + 360) % 360
        };
    }
    
    getJulianDay(date) {
        const a = Math.floor((14 - (date.getMonth() + 1)) / 12);
        const y = date.getFullYear() + 4800 - a;
        const m = (date.getMonth() + 1) + 12 * a - 3;
        
        return date.getDate() + Math.floor((153 * m + 2) / 5) + 365 * y + 
               Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045 +
               (date.getHours() - 12) / 24 + date.getMinutes() / 1440 + date.getSeconds() / 86400;
    }
}