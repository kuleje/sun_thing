class SunMoonApp {
    constructor() {
        this.api = new AstronomicalAPI();
        this.calculations = new AstronomicalCalculations();
        this.timeCircle = null;
        this.currentData = null;
        this.matchingDayLength = null;
        this.lastUpdateDate = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.initializeTimeCircle();
        this.loadAstronomicalData();
    }
    
    setupEventListeners() {
        // Settings button
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.toggleSettings();
        });
        
        // Close settings
        document.getElementById('closeSettings').addEventListener('click', () => {
            this.hideSettings();
        });
        
        // Save settings
        document.getElementById('saveSettings').addEventListener('click', () => {
            this.saveSettings();
        });
        
        // Load existing settings
        this.loadSettings();
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });
        
        // Update data periodically (every hour, since astronomical data changes slowly)
        setInterval(() => {
            this.loadAstronomicalData();
        }, AppConfig.TIMEOUTS.UPDATE_INTERVAL);
        
        // Also check for date changes more frequently
        setInterval(() => {
            const currentDate = new Date().toDateString();
            if (this.lastUpdateDate && this.lastUpdateDate !== currentDate) {
                console.log('Date changed, refreshing astronomical data');
                this.loadAstronomicalData();
            }
            this.lastUpdateDate = currentDate;
        }, AppConfig.TIMEOUTS.DATE_CHECK_INTERVAL);
    }
    
    initializeTimeCircle() {
        const container = document.getElementById('timeCircle');
        const containerRect = container.getBoundingClientRect();
        
        // Make it responsive - allow larger sizes
        const size = AppConfig.getVisualizationSize(containerRect);
        
        this.timeCircle = new TimeCircle('#timeCircle', {
            width: size,
            height: size
        });
        
        // Set up date change handler for year circle
        this.timeCircle.setOnDateChange((date) => {
            this.handleDateChange(date);
        });
        
        // Set up time update handler for current time display
        this.timeCircle.setOnTimeUpdate(() => {
            this.handleTimeUpdate();
        });
        
        // Set up debounced handler for expensive date operations
        this.timeCircle.setOnDateChangeDebounced((date) => {
            this.handleDateChangeDebounced(date);
        });
    }
    
    async loadAstronomicalData() {
        try {
            this.updateStatus('Loading astronomical data...');
            console.log('Starting to load astronomical data...');
            
            // Get today's data
            const data = await this.api.getExtendedAstronomicalData();
            console.log('Astronomical data loaded:', data);
            this.currentData = data;
            
            // Update the time circle
            console.log('Updating time circle with sun data:', data.sun);
            this.timeCircle.updateSunData(data.sun);
            console.log('Updating time circle with moon data:', data.moon);
            this.timeCircle.updateMoonData(data.moon);
            console.log('Updating time circle with UV data:', data.uv);
            this.timeCircle.updateUVData(data.uv);
            
            // Calculate additional information
            await this.calculateExtendedInfo();
            
            // Update center display with all information
            this.updateCenterDisplay();
            
            // Display current location being used
            this.updateLocationDisplay(data.location);
            this.updateStatus('Data loaded successfully');
            
        } catch (error) {
            console.error('Failed to load astronomical data:', error);
            
            // Check if it's a location error
            if (error.message.includes('Location required') || error.message.includes('location')) {
                this.updateStatus('⚠️ Location required for accurate data. Please check Settings to enable location or enter coordinates.');
                this.updateLocationDisplay(null);
                return;
            }
            
            this.updateStatus('Failed to load data. Using fallback calculations.');
            
            // Try to work with fallback data
            try {
                console.log('Attempting fallback data...');
                const fallbackData = await this.getFallbackData();
                console.log('Fallback data:', fallbackData);
                this.currentData = fallbackData;
                this.timeCircle.updateSunData(fallbackData.sun);
                this.timeCircle.updateMoonData(fallbackData.moon);
                this.timeCircle.updateUVData(fallbackData.uv);
                this.updateCenterDisplay();
            } catch (fallbackError) {
                console.error('Fallback data error:', fallbackError);
                this.updateStatus('Unable to load astronomical data');
            }
        }
    }
    
    async calculateExtendedInfo() {
        if (!this.currentData) return;
        
        // Calculate day length
        const dayLength = this.calculations.calculateDayLength(this.currentData.sun);
        
        // Find matching day length
        if (dayLength) {
            console.log('Searching for matching day length for:', dayLength);
            this.matchingDayLength = await this.calculations.findMatchingDayLength(
                dayLength,
                this.currentData.location
            );
            console.log('Found matching day length:', this.matchingDayLength);
        } else {
            console.log('No day length calculated, cannot find matching day length');
        }
        
        // Get next equinox/solstice
        this.nextEvent = this.calculations.getNextEquinoxOrSolstice();
        console.log('Next equinox/solstice calculated:', this.nextEvent);
    }
    
    updateCenterDisplay() {
        if (!this.timeCircle || !this.currentData) return;
        
        const now = new Date();
        
        // Clear previous center info
        this.timeCircle.centerInfo.selectAll('*').remove();
        
        // Current time (large)
        const timeText = now.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        this.timeCircle.centerInfo.append('text')
            .attr('class', 'current-time')
            .attr('y', -50)
            .text(timeText);
        
        // Sun information
        if (this.currentData.sun) {
            const dayLength = this.calculations.calculateDayLength(this.currentData.sun);
            
            this.timeCircle.centerInfo.append('text')
                .attr('class', 'day-info')
                .attr('y', -20)
                .text(`☀️ ${dayLength ? dayLength.formatted : '---'}`);
        }
        
        // Matching day length - moved to be prominent, right after day length
        console.log('Matching day length data:', this.matchingDayLength);
        if (this.matchingDayLength) {
            console.log('Displaying matching day length:', this.matchingDayLength.daysFromToday, 'days');
            
            this.timeCircle.centerInfo.append('text')
                .attr('class', 'calculation-info')
                .attr('y', 5)
                .text(`Same day length:`);
            
            // Show both date and days countdown
            const dateStr = this.matchingDayLength.date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: this.matchingDayLength.date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
            });
            
            this.timeCircle.centerInfo.append('text')
                .attr('class', 'calculation-info')
                .attr('y', 20)
                .text(`${dateStr} (${this.matchingDayLength.daysFromToday} days)`);
        } else {
            console.log('No matching day length found');
        }
        
        // UV information
        if (this.currentData.uv) {
            const currentUV = this.currentData.uv.current;
            const uvCategory = this.api.getUVCategory(currentUV);
            
            this.timeCircle.centerInfo.append('text')
                .attr('class', 'uv-info')
                .attr('y', 45)
                .attr('fill', uvCategory.color)
                .text(`🌞 UV: ${currentUV.toFixed(1)} (${uvCategory.name})`);
        }
        
        // Moon information
        if (this.currentData.moon) {
            const moonEmoji = this.calculations.getMoonPhaseEmoji(this.currentData.moon.moonPhase);
            
            this.timeCircle.centerInfo.append('text')
                .attr('class', 'calculation-info')
                .attr('y', 65)
                .text(`${moonEmoji} ${Math.round(this.currentData.moon.illumination)}% lit`);
        }
        
        // Next equinox/solstice
        if (this.nextEvent) {
            console.log('Displaying next event in center:', this.nextEvent);
            this.timeCircle.centerInfo.append('text')
                .attr('class', 'calculation-info')
                .attr('y', 85)
                .text(`${this.nextEvent.name}:`);
            
            this.timeCircle.centerInfo.append('text')
                .attr('class', 'calculation-info')
                .attr('y', 100)
                .text(`${this.calculations.formatTimeUntilEvent(this.nextEvent.daysUntil)}`);
        } else {
            console.log('No next event found to display');
        }
    }
    
    async getFallbackData() {
        const now = new Date();
        const location = await this.api.getCurrentLocation();
        
        return {
            sun: this.api.getFallbackSunData(now),
            moon: this.api.getFallbackMoonData(now),
            uv: this.api.getFallbackUVData(now),
            location: location,
            lastUpdate: now
        };
    }
    
    toggleSettings() {
        const panel = document.getElementById('settingsPanel');
        panel.classList.toggle('hidden');
    }
    
    hideSettings() {
        const panel = document.getElementById('settingsPanel');
        panel.classList.add('hidden');
    }
    
    loadSettings() {
        const apiKey = localStorage.getItem('ipGeoApiKey') || '';
        const openWeatherApiKey = localStorage.getItem('openWeatherApiKey') || '';
        const location = localStorage.getItem('userLocation');
        
        document.getElementById('ipGeoApiKey').value = apiKey;
        document.getElementById('openWeatherApiKey').value = openWeatherApiKey;
        
        if (location) {
            const loc = JSON.parse(location);
            document.getElementById('locationInput').value = `${loc.lat}, ${loc.lng}`;
        }
    }
    
    async saveSettings() {
        const apiKey = document.getElementById('ipGeoApiKey').value.trim();
        const openWeatherApiKey = document.getElementById('openWeatherApiKey').value.trim();
        const locationInput = document.getElementById('locationInput').value.trim();
        
        // Save API keys
        if (apiKey) {
            this.api.setApiKey(apiKey);
            this.updateStatus('IP Geolocation API key saved');
        }
        
        if (openWeatherApiKey) {
            this.api.setOpenWeatherApiKey(openWeatherApiKey);
            this.updateStatus('OpenWeatherMap API key saved');
        }
        
        // Parse and save location
        if (locationInput) {
            try {
                const coords = locationInput.split(',').map(s => parseFloat(s.trim()));
                if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
                    this.api.setUserLocation({ lat: coords[0], lng: coords[1] });
                    this.updateStatus('Location saved');
                } else {
                    // Try to geocode the location name
                    this.updateStatus(`Location format should be: lat, lng (e.g., ${AppConfig.ASTRONOMY.DEFAULT_LOCATION.lat}, ${AppConfig.ASTRONOMY.DEFAULT_LOCATION.lng})`);
                }
            } catch (error) {
                this.updateStatus('Invalid location format');
                return;
            }
        }
        
        this.hideSettings();
        
        // Test API connection if key was provided
        if (apiKey) {
            try {
                const result = await this.api.testConnection();
                if (result.success) {
                    this.updateStatus('API connection successful');
                    // Reload data with new settings
                    setTimeout(() => this.loadAstronomicalData(), AppConfig.TIMEOUTS.SETTINGS_RELOAD_DELAY);
                } else {
                    this.updateStatus(`API error: ${result.message}`);
                }
            } catch (error) {
                this.updateStatus('Failed to test API connection');
            }
        }
    }
    
    updateStatus(message) {
        const statusElement = document.getElementById('status');
        statusElement.textContent = message;
        
        // Clear status after 5 seconds
        setTimeout(() => {
            if (statusElement.textContent === message) {
                statusElement.textContent = '';
            }
        }, AppConfig.TIMEOUTS.STATUS_CLEAR);
    }
    
    updateLocationDisplay(location) {
        const locationElement = document.getElementById('location-display');
        if (!location) {
            locationElement.textContent = '📍 No location set - click Settings to configure';
            locationElement.style.color = AppConfig.COLORS.STATUS_ERROR;
        } else {
            locationElement.textContent = `📍 Location: ${location.lat.toFixed(3)}°, ${location.lng.toFixed(3)}°`;
            locationElement.style.color = AppConfig.COLORS.STATUS_SUCCESS;
        }
    }
    
    handleResize() {
        if (!this.timeCircle) return;
        
        const container = document.getElementById('timeCircle');
        const containerRect = container.getBoundingClientRect();
        const size = AppConfig.getVisualizationSize(containerRect);
        
        this.timeCircle.resize(size, size);
        
        // Update center display after resize since it gets cleared during resize
        this.updateCenterDisplay();
    }
    
    /**
     * Handle date changes from the year circle
     */
    async handleDateChange(selectedDate) {
        console.log('Date changed to:', selectedDate);
        
        try {
            // Check if we're returning to current date
            if (this.isCurrentDate(selectedDate)) {
                console.log('Returned to current date, switching to current date mode');
                // Reload current data and switch to regular current date display
                await this.loadAstronomicalData();
                return;
            }
            
            // Get astronomical data for the selected date
            const data = await this.api.getExtendedAstronomicalDataForDate(selectedDate);
            console.log('Astronomical data loaded for selected date:', data);
            this.currentData = data;
            
            // Update the circles with new data
            this.timeCircle.updateSunData(data.sun);
            this.timeCircle.updateMoonData(data.moon);
            this.timeCircle.updateUVData(data.uv);
            
            // Calculate additional information for selected date (without same day length - will be done in debounced handler)
            await this.calculateExtendedInfoForDate(selectedDate);
            
            // Update center display
            this.updateCenterDisplayForDate(selectedDate);
            
        } catch (error) {
            console.error('Failed to load astronomical data for selected date:', error);
            this.updateStatus('Failed to load data for selected date');
        }
    }
    
    /**
     * Calculate extended info for a specific date
     */
    async calculateExtendedInfoForDate(date) {
        if (!this.currentData) return;
        
        // Calculate day length for selected date
        const dayLength = this.calculations.calculateDayLength(this.currentData.sun);
        
        // Reset matching day length - will be calculated in debounced handler
        this.matchingDayLength = null;
        
        // Get next equinox/solstice from the selected date
        this.nextEvent = this.calculations.getNextEquinoxOrSolstice(date);
        console.log('Next equinox/solstice from selected date:', this.nextEvent);
    }
    
    /**
     * Update center display for selected date
     */
    updateCenterDisplayForDate(selectedDate) {
        if (!this.timeCircle || !this.currentData) return;
        
        // Clear previous center info
        this.timeCircle.centerInfo.selectAll('*').remove();
        
        // Selected date (large)
        const dateText = selectedDate.toLocaleDateString('en-US', { 
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        
        this.timeCircle.centerInfo.append('text')
            .attr('class', 'selected-date')
            .attr('y', -75)
            .attr('font-size', '18px')
            .attr('fill', AppConfig.COLORS.SELECTED_DATE)
            .text(dateText);
        
        // Current time (smaller when showing selected date)
        const now = new Date();
        const timeText = now.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        // Add "Now:" prefix to the left of centered time
        this.timeCircle.centerInfo.append('text')
            .attr('class', 'now-prefix')
            .attr('y', -50)
            .attr('x', -50)
            .attr('font-size', '24px')
            .attr('fill', 'white')
            .attr('font-weight', 'bold')
            .attr('text-anchor', 'end')
            .style('cursor', 'pointer')
            .style('text-decoration', 'underline')
            .text('Now:')
            .on('click', () => {
                // Reset to current date
                this.timeCircle.setSelectedDate(new Date());
            });
        
        // Keep time centered
        this.timeCircle.centerInfo.append('text')
            .attr('class', 'current-time')
            .attr('y', -50)
            .text(timeText);
        
        // Sun information for selected date
        if (this.currentData.sun) {
            const dayLength = this.calculations.calculateDayLength(this.currentData.sun);
            
            this.timeCircle.centerInfo.append('text')
                .attr('class', 'day-info')
                .attr('y', -20)
                .text(`☀️ ${dayLength ? dayLength.formatted : '---'}`);
        }
        
        // Show matching day length if available
        if (this.matchingDayLength) {
            const dateStr = this.matchingDayLength.date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: this.matchingDayLength.date.getFullYear() !== selectedDate.getFullYear() ? 'numeric' : undefined
            });
            
            this.timeCircle.centerInfo.append('text')
                .attr('class', 'calculation-info')
                .attr('y', 5)
                .text(`Same day length:`);
            
            this.timeCircle.centerInfo.append('text')
                .attr('class', 'calculation-info')
                .attr('y', 20)
                .text(`${dateStr} (${this.matchingDayLength.daysFromToday} days)`);
        } else {
            // Show day of year as fallback
            const startOfYear = new Date(selectedDate.getFullYear(), 0, 1);
            const dayOfYear = Math.floor((selectedDate - startOfYear) / (1000 * 60 * 60 * 24)) + 1;
            
            this.timeCircle.centerInfo.append('text')
                .attr('class', 'calculation-info')
                .attr('y', 5)
                .text(`Day ${dayOfYear} of ${selectedDate.getFullYear()}`);
        }
        
        // UV information only for current date (not accurate for other dates)
        const isCurrentDate = this.isCurrentDate(selectedDate);
        if (this.currentData.uv && isCurrentDate) {
            const currentUV = this.currentData.uv.current;
            const uvCategory = this.api.getUVCategory(currentUV);
            
            this.timeCircle.centerInfo.append('text')
                .attr('class', 'uv-info')
                .attr('y', 45)
                .attr('fill', uvCategory.color)
                .text(`🌞 UV: ${currentUV.toFixed(1)} (${uvCategory.name})`);
        }
        
        // Moon information for selected date
        if (this.currentData.moon) {
            const moonEmoji = this.calculations.getMoonPhaseEmoji(this.currentData.moon.moonPhase);
            const moonText = `${moonEmoji} ${Math.round(this.currentData.moon.illumination)}% lit`;
            
            // Moon data is now accurate for all dates via SunCalc
            this.timeCircle.centerInfo.append('text')
                .attr('class', 'calculation-info')
                .attr('y', 65)
                .text(moonText);
        }
        
        // Next equinox/solstice from selected date
        if (this.nextEvent) {
            this.timeCircle.centerInfo.append('text')
                .attr('class', 'calculation-info')
                .attr('y', 85)
                .text(`Next: ${this.nextEvent.name}`);
            
            this.timeCircle.centerInfo.append('text')
                .attr('class', 'calculation-info')
                .attr('y', 100)
                .text(`${this.calculations.formatTimeUntilEvent(this.nextEvent.daysUntil)}`);
        }
    }
    
    /**
     * Handle time updates - only update center display if showing current date
     */
    handleTimeUpdate() {
        // Only update center display if we're showing current date (not a selected historical date)
        if (this.isCurrentDate(this.timeCircle.selectedDate)) {
            this.updateCenterDisplay();
        }
    }
    
    /**
     * Handle debounced date changes for expensive operations like same day length calculation
     */
    async handleDateChangeDebounced(selectedDate) {
        console.log('Debounced date change triggered for:', selectedDate);
        
        try {
            // Check if we're still on the same selected date and it's not current date
            if (this.isCurrentDate(selectedDate) || 
                selectedDate.toDateString() !== this.timeCircle.selectedDate.toDateString()) {
                console.log('Date changed or returned to current date, skipping debounced operation');
                return;
            }
            
            console.log('Performing expensive calculations for selected date:', selectedDate.toDateString());
            
            // Calculate same day length for selected date (expensive operation)
            if (this.currentData && this.currentData.sun) {
                const dayLength = this.calculations.calculateDayLength(this.currentData.sun);
                
                if (dayLength) {
                    console.log('Calculating matching day length for selected date:', selectedDate, dayLength);
                    this.matchingDayLength = await this.calculations.findMatchingDayLength(
                        dayLength,
                        this.currentData.location,
                        selectedDate
                    );
                    console.log('Found matching day length for selected date:', this.matchingDayLength);
                } else {
                    this.matchingDayLength = null;
                }
            }
            
            // Update center display with new calculations only if still on same selected date
            if (selectedDate.toDateString() === this.timeCircle.selectedDate.toDateString() &&
                !this.isCurrentDate(selectedDate)) {
                this.updateCenterDisplayForDate(selectedDate);
                console.log('Updated center display with debounced calculations');
            }
            
        } catch (error) {
            console.error('Failed to calculate extended info for debounced date change:', error);
        }
    }
    
    /**
     * Check if a date is the current date (today)
     */
    isCurrentDate(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.sunMoonApp = new SunMoonApp();
});