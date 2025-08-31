class SunMoonApp {
    constructor() {
        this.api = new AstronomicalAPI();
        this.calculations = new AstronomicalCalculations();
        this.timeCircle = null;
        this.currentData = null;
        this.matchingDayLength = null;
        
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
        
        // Update data periodically (every 5 minutes)
        setInterval(() => {
            this.loadAstronomicalData();
        }, 5 * 60 * 1000);
    }
    
    initializeTimeCircle() {
        const container = document.getElementById('timeCircle');
        const containerRect = container.getBoundingClientRect();
        
        // Make it responsive
        const size = Math.min(containerRect.width || 600, window.innerHeight * 0.8, 600);
        
        this.timeCircle = new TimeCircle('#timeCircle', {
            width: size,
            height: size
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
            
            // Calculate additional information
            await this.calculateExtendedInfo();
            
            // Update center display with all information
            this.updateCenterDisplay();
            
            this.updateStatus('Data loaded successfully');
            
        } catch (error) {
            console.error('Failed to load astronomical data:', error);
            this.updateStatus('Failed to load data. Using fallback calculations.');
            
            // Try to work with fallback data
            try {
                console.log('Attempting fallback data...');
                const fallbackData = await this.getFallbackData();
                console.log('Fallback data:', fallbackData);
                this.currentData = fallbackData;
                this.timeCircle.updateSunData(fallbackData.sun);
                this.timeCircle.updateMoonData(fallbackData.moon);
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
            .attr('y', -80)
            .text(timeText);
        
        // Sun information
        if (this.currentData.sun) {
            const dayLength = this.calculations.calculateDayLength(this.currentData.sun);
            
            this.timeCircle.centerInfo.append('text')
                .attr('class', 'day-info')
                .attr('y', -50)
                .text(`☀️ ${dayLength ? dayLength.formatted : '---'}`);
            
            this.timeCircle.centerInfo.append('text')
                .attr('class', 'day-info')
                .attr('y', -30)
                .text(`↑ ${this.currentData.sun.sunrise.toLocaleTimeString('en-US', { 
                    hour12: false, hour: '2-digit', minute: '2-digit' 
                })}`);
            
            this.timeCircle.centerInfo.append('text')
                .attr('class', 'day-info')
                .attr('y', -10)
                .text(`↓ ${this.currentData.sun.sunset.toLocaleTimeString('en-US', { 
                    hour12: false, hour: '2-digit', minute: '2-digit' 
                })}`);
        }
        
        // Moon information
        if (this.currentData.moon) {
            const moonEmoji = this.calculations.getMoonPhaseEmoji(this.currentData.moon.moonPhase);
            
            this.timeCircle.centerInfo.append('text')
                .attr('class', 'calculation-info')
                .attr('y', 15)
                .text(`${moonEmoji} ${Math.round(this.currentData.moon.illumination)}%`);
        }
        
        // Next equinox/solstice
        if (this.nextEvent) {
            this.timeCircle.centerInfo.append('text')
                .attr('class', 'calculation-info')
                .attr('y', 35)
                .text(`${this.nextEvent.name}:`);
            
            this.timeCircle.centerInfo.append('text')
                .attr('class', 'calculation-info')
                .attr('y', 50)
                .text(`${this.calculations.formatTimeUntilEvent(this.nextEvent.daysUntil)}`);
        }
        
        // Matching day length
        if (this.matchingDayLength) {
            this.timeCircle.centerInfo.append('text')
                .attr('class', 'calculation-info')
                .attr('y', 70)
                .text(`Same day length:`);
            
            this.timeCircle.centerInfo.append('text')
                .attr('class', 'calculation-info')
                .attr('y', 85)
                .text(`${this.matchingDayLength.date.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                })}`);
        }
    }
    
    async getFallbackData() {
        const now = new Date();
        const location = await this.api.getCurrentLocation();
        
        return {
            sun: this.api.getFallbackSunData(now),
            moon: this.api.getFallbackMoonData(now),
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
        const location = localStorage.getItem('userLocation');
        
        document.getElementById('ipGeoApiKey').value = apiKey;
        
        if (location) {
            const loc = JSON.parse(location);
            document.getElementById('locationInput').value = `${loc.lat}, ${loc.lng}`;
        }
    }
    
    async saveSettings() {
        const apiKey = document.getElementById('ipGeoApiKey').value.trim();
        const locationInput = document.getElementById('locationInput').value.trim();
        
        // Save API key
        if (apiKey) {
            this.api.setApiKey(apiKey);
            this.updateStatus('API key saved');
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
                    this.updateStatus('Location format should be: lat, lng (e.g., 40.7128, -74.0060)');
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
                    setTimeout(() => this.loadAstronomicalData(), 1000);
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
        }, 5000);
    }
    
    handleResize() {
        if (!this.timeCircle) return;
        
        const container = document.getElementById('timeCircle');
        const containerRect = container.getBoundingClientRect();
        const size = Math.min(containerRect.width || 600, window.innerHeight * 0.8, 600);
        
        this.timeCircle.resize(size, size);
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.sunMoonApp = new SunMoonApp();
});