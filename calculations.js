class AstronomicalCalculations {
    constructor() {
        const currentYear = new Date().getFullYear();
        this.equinoxSolsticeData = this.getEquinoxSolsticeData(currentYear);
    }
    
    // Fixed dates for equinoxes and solstices
    getEquinoxSolsticeData(year) {
        // Approximate dates - these vary slightly each year but are close enough
        const data = AppConfig.ASTRONOMICAL_EVENTS;
        
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
                const daysUntil = Math.ceil((event.date - now) / AppConfig.ASTRONOMY.DAY_TO_MS);
                return {
                    ...event,
                    daysUntil: daysUntil
                };
            }
        }
        
        // If no events left this year, return the first event of next year
        // For now, just return the spring equinox with approximate date
        const nextSpringEquinox = new Date(currentYear + 1, 2, 20); // Approximate
        const daysUntil = Math.ceil((nextSpringEquinox - now) / AppConfig.ASTRONOMY.DAY_TO_MS);
        
        return {
            name: 'Spring Equinox',
            date: nextSpringEquinox,
            season: 'spring',
            daysUntil: daysUntil
        };
    }
    
    getNextSolstice(today) {
        const currentYear = today.getFullYear();
        const events = this.equinoxSolsticeData;
        
        if (!events) {
            return null;
        }
        
        const solsticeList = [
            { name: 'Summer Solstice', date: events.summerSolstice, season: 'summer' },
            { name: 'Winter Solstice', date: events.winterSolstice, season: 'winter' }
        ];
        
        // Find the next solstice
        for (const solstice of solsticeList) {
            if (solstice.date > today) {
                return solstice;
            }
        }
        
        // If no solstices left this year, return the summer solstice of next year
        const nextSummerSolstice = new Date(currentYear + 1, 5, 21); // Approximate June 21
        return {
            name: 'Summer Solstice',
            date: nextSummerSolstice,
            season: 'summer'
        };
    }
    
    calculateDayLength(sunData) {
        if (!sunData || !sunData.sunrise || !sunData.sunset) {
            return null;
        }
        
        const dayLengthMs = sunData.sunset - sunData.sunrise;
        const totalMinutes = Math.floor(dayLengthMs / AppConfig.ASTRONOMY.MINUTES_TO_MS);
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
            console.log('No current day length or totalMinutes:', currentDayLength);
            return null;
        }
        
        const targetMinutes = currentDayLength.totalMinutes;
        const today = new Date();
        const currentDayOfYear = this.getDayOfYear(today);
        
        console.log('Searching for closest matching day length:', {
            targetMinutes,
            currentDayLength,
            userLocation
        });
        
        // Find the next solstice to determine when the seasonal direction changes
        const nextSolstice = this.getNextSolstice(today);
        console.log('Next solstice:', nextSolstice);
        
        // Search only after the next solstice (when seasonal direction changes)
        let closestMatch = null;
        let smallestDifference = Infinity;
        let checkedDates = 0;
        
        // Start searching from the day after the next solstice
        const searchStartDate = new Date(nextSolstice.date);
        searchStartDate.setDate(searchStartDate.getDate() + 1);
        const daysUntilSearchStart = Math.ceil((searchStartDate - today) / AppConfig.ASTRONOMY.DAY_TO_MS);
        
        console.log(`Searching after next solstice (${nextSolstice.name}), starting ${daysUntilSearchStart} days from now...`);
        
        // Search for up to 185 days after the solstice (just over 6 months)
        for (let daysAfterSolstice = 1; daysAfterSolstice <= 185; daysAfterSolstice++) {
            const daysAhead = daysUntilSearchStart + daysAfterSolstice;
            const testDate = new Date(today);
            testDate.setDate(testDate.getDate() + daysAhead);
            
            checkedDates++;
            const testDayLength = this.estimateDayLength(testDate, userLocation);
            const difference = Math.abs(testDayLength.totalMinutes - targetMinutes);
            
            // Keep track of the closest match, regardless of how close it is
            if (difference < smallestDifference) {
                smallestDifference = difference;
                closestMatch = {
                    date: new Date(testDate),
                    dayLength: testDayLength,
                    difference: difference,
                    daysFromToday: daysAhead
                };
                
                // Log good matches for debugging
                if (difference <= 10) {
                    console.log(`Good match found: ${testDate.toDateString()}, dayLength: ${testDayLength.totalMinutes}min, diff: ${difference}min`);
                }
            }
            
            // Log first few checks for debugging
            if (checkedDates <= 5) {
                console.log(`Check ${checkedDates} (${daysAhead} days): ${testDate.toDateString()}, dayLength: ${testDayLength.totalMinutes}min, diff: ${difference}min`);
            }
        }
        
        console.log(`Checked ${checkedDates} dates. Best match: ${closestMatch ? closestMatch.date.toDateString() : 'none'} (${smallestDifference.toFixed(1)} min difference)`);
        return closestMatch;
    }
    
    estimateDayLength(date, location) {
        // Simplified day length calculation based on latitude and day of year
        if (!location || typeof location.lat !== 'number') {
            location = AppConfig.ASTRONOMY.DEFAULT_LOCATION;
        }
        
        const dayOfYear = this.getDayOfYear(date);
        const lat = location.lat * Math.PI / 180; // Convert to radians
        
        // Solar declination angle
        const declination = AppConfig.ASTRONOMY.SOLAR_DECLINATION_ANGLE * Math.sin((360 / AppConfig.ASTRONOMY.DAYS_PER_YEAR) * (dayOfYear - AppConfig.ASTRONOMY.SOLAR_DECLINATION_OFFSET) * Math.PI / 180);
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