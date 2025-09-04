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
        // Only update when tab is visible and this tab is the leader
        setInterval(() => {
            if (!document.hidden && this.isTabLeader()) {
                this.loadAstronomicalData();
            }
        }, AppConfig.TIMEOUTS.UPDATE_INTERVAL);
        
        // Also check for date changes more frequently
        setInterval(() => {
            const currentDate = new Date().toDateString();
            if (this.lastUpdateDate && this.lastUpdateDate !== currentDate && !document.hidden) {
                console.log('Date changed, refreshing astronomical data');
                this.loadAstronomicalData();
            }
            this.lastUpdateDate = currentDate;
        }, AppConfig.TIMEOUTS.DATE_CHECK_INTERVAL);
        
        // Set up cross-tab coordination
        this.setupCrossTabCoordination();
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
            // Check if we should actually load data or wait for shared data
            if (!this.isTabLeader()) {
                console.log(`Tab ${this.tabId}: Not leader, checking for existing data...`);
                
                // Try to get recent shared data first
                const sharedData = this.getRecentSharedData();
                if (sharedData) {
                    console.log(`Tab ${this.tabId}: Using recent shared data, no API call needed`);
                    this.handleSharedDataUpdate(sharedData);
                    return;
                }
                
                // If no recent data, wait a moment for leader to load data
                console.log(`Tab ${this.tabId}: No recent shared data, waiting for leader...`);
                setTimeout(() => {
                    const newSharedData = this.getRecentSharedData();
                    if (newSharedData) {
                        console.log(`Tab ${this.tabId}: Received data from leader after waiting`);
                        this.handleSharedDataUpdate(newSharedData);
                    } else {
                        console.log(`Tab ${this.tabId}: No data from leader, promoting to leader and loading`);
                        this.promoteToLeader();
                        this.loadAstronomicalData();
                    }
                }, 2000);
                return;
            }
            
            console.log(`Tab ${this.tabId}: Leader tab, loading astronomical data...`);
            this.updateStatus('Loading astronomical data...');
            
            // Get today's data
            const data = await this.api.getExtendedAstronomicalData();
            this.currentData = data;
            
            // Share data with other tabs
            this.shareDataWithOtherTabs(data);
            
            // Update the time circle
            this.timeCircle.updateSunData(data.sun);
            this.timeCircle.updateMoonData(data.moon);
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
            this.matchingDayLength = await this.calculations.findMatchingDayLength(
                dayLength,
                this.currentData.location
            );
        } else {
        }
        
        // Get next equinox/solstice
        this.nextEvent = this.calculations.getNextEquinoxOrSolstice();
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
        if (this.matchingDayLength) {
            
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
            this.timeCircle.centerInfo.append('text')
                .attr('class', 'calculation-info')
                .attr('y', 85)
                .text(`${this.nextEvent.name}:`);
            
            this.timeCircle.centerInfo.append('text')
                .attr('class', 'calculation-info')
                .attr('y', 100)
                .text(`${this.calculations.formatTimeUntilEvent(this.nextEvent.daysUntil)}`);
        } else {
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
    
    setupCrossTabCoordination() {
        // Generate unique tab ID
        this.tabId = 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // Register this tab as active
        this.registerTab();
        
        // Listen for localStorage changes from other tabs
        window.addEventListener('storage', (e) => {
            if (e.key === 'sun-moon-data' && e.newValue) {
                try {
                    const data = JSON.parse(e.newValue);
                    this.handleSharedDataUpdate(data);
                } catch (error) {
                    console.error('Error parsing shared data:', error);
                }
            }
        });
        
        // Clean up when tab is closed/refreshed
        window.addEventListener('beforeunload', () => {
            this.unregisterTab();
        });
        
        // Periodic cleanup of stale tabs
        setInterval(() => {
            this.cleanupStaleTabs();
        }, 30000); // Every 30 seconds
    }
    
    registerTab() {
        const activeTabs = JSON.parse(localStorage.getItem('sun-moon-active-tabs') || '{}');
        activeTabs[this.tabId] = {
            timestamp: Date.now(),
            isLeader: Object.keys(activeTabs).length === 0 // First tab becomes leader
        };
        localStorage.setItem('sun-moon-active-tabs', JSON.stringify(activeTabs));
    }
    
    unregisterTab() {
        const activeTabs = JSON.parse(localStorage.getItem('sun-moon-active-tabs') || '{}');
        delete activeTabs[this.tabId];
        localStorage.setItem('sun-moon-active-tabs', JSON.stringify(activeTabs));
        
        // If this was the leader, promote another tab
        if (Object.keys(activeTabs).length > 0) {
            const oldestTab = Object.keys(activeTabs).sort()[0];
            activeTabs[oldestTab].isLeader = true;
            localStorage.setItem('sun-moon-active-tabs', JSON.stringify(activeTabs));
        }
    }
    
    cleanupStaleTabs() {
        const activeTabs = JSON.parse(localStorage.getItem('sun-moon-active-tabs') || '{}');
        const now = Date.now();
        let hasChanges = false;
        
        // Remove tabs that haven't updated in 2 minutes
        Object.keys(activeTabs).forEach(tabId => {
            if (now - activeTabs[tabId].timestamp > 120000) {
                delete activeTabs[tabId];
                hasChanges = true;
            }
        });
        
        if (hasChanges) {
            localStorage.setItem('sun-moon-active-tabs', JSON.stringify(activeTabs));
            
            // Ensure there's always a leader
            if (Object.keys(activeTabs).length > 0 && !Object.values(activeTabs).some(tab => tab.isLeader)) {
                const oldestTab = Object.keys(activeTabs).sort()[0];
                activeTabs[oldestTab].isLeader = true;
                localStorage.setItem('sun-moon-active-tabs', JSON.stringify(activeTabs));
            }
        }
        
        // Update this tab's timestamp
        activeTabs[this.tabId] = {
            timestamp: now,
            isLeader: activeTabs[this.tabId]?.isLeader || false
        };
        localStorage.setItem('sun-moon-active-tabs', JSON.stringify(activeTabs));
    }
    
    isTabLeader() {
        const activeTabs = JSON.parse(localStorage.getItem('sun-moon-active-tabs') || '{}');
        const isLeader = activeTabs[this.tabId]?.isLeader || false;
        console.log(`Tab ${this.tabId}: Leader check result: ${isLeader}`);
        return isLeader;
    }
    
    getRecentSharedData() {
        try {
            const sharedData = localStorage.getItem('sun-moon-data');
            if (sharedData) {
                const data = JSON.parse(sharedData);
                // Consider data recent if it's less than 5 minutes old
                if (Date.now() - data.timestamp < 300000) {
                    return data;
                }
            }
        } catch (error) {
            console.warn('Error getting recent shared data:', error);
        }
        return null;
    }
    
    promoteToLeader() {
        const activeTabs = JSON.parse(localStorage.getItem('sun-moon-active-tabs') || '{}');
        if (activeTabs[this.tabId]) {
            activeTabs[this.tabId].isLeader = true;
            localStorage.setItem('sun-moon-active-tabs', JSON.stringify(activeTabs));
            console.log(`Tab ${this.tabId}: Promoted to leader`);
        }
    }
    
    shareDataWithOtherTabs(data) {
        // Store data in localStorage for other tabs
        // Note: JSON.stringify converts Date objects to strings, so we need to handle this
        localStorage.setItem('sun-moon-data', JSON.stringify({
            ...data,
            timestamp: Date.now(),
            tabId: this.tabId
        }));
    }
    
    handleSharedDataUpdate(data) {
        // Only update if data is from another tab and is recent, or if called directly
        if (!data.tabId || data.tabId !== this.tabId) {
            console.log(`Tab ${this.tabId}: Received shared data from another tab`);
            
            // Convert date strings back to Date objects (they get serialized as strings in localStorage)
            const processedData = this.deserializeDateObjects(data);
            this.currentData = processedData;
            
            // Update the visualization with shared data without making new API calls
            if (this.timeCircle && processedData.sun && processedData.moon && processedData.uv) {
                console.log(`Tab ${this.tabId}: Updating UI with shared data`);
                this.timeCircle.updateSunData(processedData.sun);
                this.timeCircle.updateMoonData(processedData.moon);
                this.timeCircle.updateUVData(processedData.uv);
                
                // Update center display with shared data
                this.updateCenterDisplay(processedData);
                
                // Update location display
                this.updateLocationDisplay(processedData.location);
                
                // Update status
                this.updateStatus('Updated from shared data');
                
                // Calculate additional information
                this.calculateExtendedInfo();
            }
        }
    }
    
    deserializeDateObjects(data) {
        // Convert date strings back to Date objects
        const processed = JSON.parse(JSON.stringify(data)); // Deep copy
        
        // Convert sun data dates
        if (processed.sun) {
            if (processed.sun.sunrise) processed.sun.sunrise = new Date(processed.sun.sunrise);
            if (processed.sun.sunset) processed.sun.sunset = new Date(processed.sun.sunset);
            if (processed.sun.solarNoon) processed.sun.solarNoon = new Date(processed.sun.solarNoon);
        }
        
        // Convert moon data dates
        if (processed.moon) {
            if (processed.moon.moonrise) processed.moon.moonrise = new Date(processed.moon.moonrise);
            if (processed.moon.moonset) processed.moon.moonset = new Date(processed.moon.moonset);
        }
        
        // Convert UV data dates
        if (processed.uv && processed.uv.hourly) {
            processed.uv.hourly.forEach(uvHour => {
                if (uvHour.time) uvHour.time = new Date(uvHour.time);
            });
        }
        
        if (processed.uv && processed.uv.grouped) {
            processed.uv.grouped.forEach(uvGroup => {
                if (uvGroup.startTime) uvGroup.startTime = new Date(uvGroup.startTime);
                if (uvGroup.endTime) uvGroup.endTime = new Date(uvGroup.endTime);
                if (uvGroup.hours) {
                    uvGroup.hours.forEach(hour => {
                        if (hour.time) hour.time = new Date(hour.time);
                    });
                }
            });
        }
        
        return processed;
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
        
        try {
            // Check if we're returning to current date
            if (this.isCurrentDate(selectedDate)) {
                // Reload current data and switch to regular current date display
                await this.loadAstronomicalData();
                return;
            }
            
            // Get astronomical data for the selected date
            const data = await this.api.getExtendedAstronomicalDataForDate(selectedDate);
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
        
        try {
            // Check if we're still on the same selected date and it's not current date
            if (this.isCurrentDate(selectedDate) || 
                selectedDate.toDateString() !== this.timeCircle.selectedDate.toDateString()) {
                return;
            }
            
            
            // Calculate same day length for selected date (expensive operation)
            if (this.currentData && this.currentData.sun) {
                const dayLength = this.calculations.calculateDayLength(this.currentData.sun);
                
                if (dayLength) {
                    this.matchingDayLength = await this.calculations.findMatchingDayLength(
                        dayLength,
                        this.currentData.location,
                        selectedDate
                    );
                } else {
                    this.matchingDayLength = null;
                }
            }
            
            // Update center display with new calculations only if still on same selected date
            if (selectedDate.toDateString() === this.timeCircle.selectedDate.toDateString() &&
                !this.isCurrentDate(selectedDate)) {
                this.updateCenterDisplayForDate(selectedDate);
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