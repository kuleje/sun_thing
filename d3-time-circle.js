class TimeCircle {
    constructor(container, options = {}) {
        this.container = d3.select(container);
        this.width = options.width || 1000;
        this.height = options.height || 1000;
        this.radius = Math.min(this.width, this.height) / 2 - 60;
        this.innerRadius = this.radius * 0.6;
        this.middleRadius = this.radius * 0.75;
        this.outerRadius = this.radius * 0.95;
        
        this.svg = null;
        this.g = null;
        // GPT-5's approach - D3 arc uses 0 rad at 12 o'clock, increases clockwise
        this.hourToAngle = (h) => {
            return ((h % 24) / 24) * 2 * Math.PI;
        };
        
        // Handle wrap-around spans properly
        this.spanToAngles = (startHour, endHour) => {
            const full = 2 * Math.PI;
            let a0 = this.hourToAngle(startHour);
            let a1 = this.hourToAngle(endHour);
            if (a1 <= a0) a1 += full; // Handle wrap-around
            return { startAngle: a0, endAngle: a1 };
        };
        
        // Convert from D3 arc coords to standard trig for text positioning
        this.angleForTrig = (h) => {
            return this.hourToAngle(h) - Math.PI / 2;
        };
        
        this.sunData = null;
        this.moonData = null;
        this.uvData = null;
        
        this.init();
    }
    
    // Helper function for smart text rotation
    getTextRotation(angle) {
        let rotation = angle * 180 / Math.PI; // Convert to degrees
        
        // If text would be upside down (90° to 270°), flip it
        if (rotation > 90 && rotation < 270) {
            rotation += 180; // Flip 180°
        }
        
        // Normalize to 0-360 range
        rotation = ((rotation % 360) + 360) % 360;
        
        return rotation;
    }
    
    init() {
        this.svg = this.container
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('class', 'time-circle');
        
        // Simple single group - no rotation needed with GPT-5's approach
        this.g = this.svg
            .append('g')
            .attr('transform', `translate(${this.width/2}, ${this.height/2})`);
        
        this.createGradients();
        this.createStaticElements();
        this.setupUpdateInterval();
    }
    
    createGradients() {
        const defs = this.svg.append('defs');
        
        // Day gradient
        const dayGradient = defs.append('radialGradient')
            .attr('id', 'dayGradient')
            .attr('cx', '50%')
            .attr('cy', '50%')
            .attr('r', '50%');
        
        dayGradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#ffd700')
            .attr('stop-opacity', 0.8);
        
        dayGradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#ff8c00')
            .attr('stop-opacity', 0.6);
        
        // Night gradient
        const nightGradient = defs.append('radialGradient')
            .attr('id', 'nightGradient')
            .attr('cx', '50%')
            .attr('cy', '50%')
            .attr('r', '50%');
        
        nightGradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#1a1a2e')
            .attr('stop-opacity', 0.9);
        
        nightGradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#16213e')
            .attr('stop-opacity', 0.7);
        
        // Moon gradient
        const moonGradient = defs.append('radialGradient')
            .attr('id', 'moonGradient')
            .attr('cx', '50%')
            .attr('cy', '50%')
            .attr('r', '50%');
        
        moonGradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#f5f5dc')
            .attr('stop-opacity', 0.8);
        
        moonGradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#c0c0c0')
            .attr('stop-opacity', 0.6);
        
        // UV gradients for different intensity levels
        const uvColors = [
            { id: 'uvLowGradient', color1: '#289500', color2: '#1e7100' },      // Green
            { id: 'uvModerateGradient', color1: '#F7E400', color2: '#d4c100' }, // Yellow
            { id: 'uvHighGradient', color1: '#F85900', color2: '#d14500' },     // Orange
            { id: 'uvVeryHighGradient', color1: '#D8001D', color2: '#a50016' }, // Red
            { id: 'uvExtremeGradient', color1: '#6B49C8', color2: '#4c329e' }   // Violet
        ];
        
        uvColors.forEach(uv => {
            const gradient = defs.append('radialGradient')
                .attr('id', uv.id)
                .attr('cx', '50%')
                .attr('cy', '50%')
                .attr('r', '50%');
            
            gradient.append('stop')
                .attr('offset', '0%')
                .attr('stop-color', uv.color1)
                .attr('stop-opacity', 1);
            
            gradient.append('stop')
                .attr('offset', '100%')
                .attr('stop-color', uv.color2)
                .attr('stop-opacity', 1);
        });
    }
    
    createStaticElements() {
        // Hour markers
        const hourMarkers = this.g.selectAll('.hour-marker')
            .data(d3.range(24))
            .enter()
            .append('line')
            .attr('class', 'hour-marker')
            .attr('x1', (d, i) => {
                const angle = this.angleForTrig(i); // Use standard trig for positioning
                return Math.cos(angle) * (this.outerRadius - 10);
            })
            .attr('y1', (d, i) => {
                const angle = this.angleForTrig(i);
                return Math.sin(angle) * (this.outerRadius - 10);
            })
            .attr('x2', (d, i) => {
                const angle = this.angleForTrig(i);
                const length = i % 6 === 0 ? 15 : i % 3 === 0 ? 10 : 5;
                return Math.cos(angle) * (this.outerRadius - length);
            })
            .attr('y2', (d, i) => {
                const angle = this.angleForTrig(i);
                const length = i % 6 === 0 ? 15 : i % 3 === 0 ? 10 : 5;
                return Math.sin(angle) * (this.outerRadius - length);
            })
            .attr('stroke', 'rgba(255, 255, 255, 0.6)')
            .attr('stroke-width', (d, i) => i % 6 === 0 ? 2 : 1);
        
        // Hour labels
        const hourLabels = this.g.selectAll('.hour-label')
            .data([0, 6, 12, 18])
            .enter()
            .append('text')
            .attr('class', 'hour-label')
            .attr('x', d => {
                const angle = this.angleForTrig(d); // Use standard trig for text positioning
                return Math.cos(angle) * (this.outerRadius + 20);
            })
            .attr('y', d => {
                const angle = this.angleForTrig(d);
                return Math.sin(angle) * (this.outerRadius + 20);
            })
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('fill', 'rgba(255, 255, 255, 0.8)')
            .attr('font-size', '14px')
            .text(d => d === 0 ? '24' : d);
        
        // Create groups for layers
        this.sunLayer = this.g.append('g').attr('class', 'sun-layer');
        this.moonLayer = this.g.append('g').attr('class', 'moon-layer');
        this.uvLayer = this.g.append('g').attr('class', 'uv-layer'); // UV layer after moon layer for proper z-ordering
        this.timeLayer = this.g.append('g').attr('class', 'time-layer');
        this.centerInfo = this.g.append('g').attr('class', 'center-info');
    }
    
    updateSunData(sunData) {
        this.sunData = sunData;
        this.renderSunArcs();
    }
    
    updateMoonData(moonData) {
        this.moonData = moonData;
        this.renderMoonArcs();
    }
    
    updateUVData(uvData) {
        this.uvData = uvData;
        // UV arcs are shown only on hover, so we don't render them initially
    }
    
    renderSunArcs() {
        if (!this.sunData) {
            console.log('No sun data available for rendering');
            return;
        }
        
        console.log('Rendering sun arcs with data:', this.sunData);
        
        const arcGenerator = d3.arc()
            .innerRadius(this.innerRadius)
            .outerRadius(this.middleRadius);
        
        // Clear previous sun arcs
        this.sunLayer.selectAll('*').remove();
        
        const sunriseHour = this.sunData.sunrise.getHours() + this.sunData.sunrise.getMinutes() / 60;
        const sunsetHour = this.sunData.sunset.getHours() + this.sunData.sunset.getMinutes() / 60;
        
        console.log('Sun arc calculation:', {
            sunrise: this.sunData.sunrise,
            sunset: this.sunData.sunset,
            sunriseHour: sunriseHour,
            sunsetHour: sunsetHour,
            sunriseAngle: this.hourToAngle(sunriseHour) * 180 / Math.PI,
            sunsetAngle: this.hourToAngle(sunsetHour) * 180 / Math.PI
        });
        
        // GPT-5's approach for sun/moon arcs
        
        // Day arc from sunrise to sunset
        const dayAngles = this.spanToAngles(sunriseHour, sunsetHour);
        const dayArc = arcGenerator(dayAngles);
        
        const dayArcElement = this.sunLayer.append('path')
            .attr('d', dayArc)
            .attr('fill', 'url(#dayGradient)')
            .attr('class', 'sun-arc day-arc')
            .style('cursor', 'pointer');
        
        // Create an invisible larger hover area to ensure consistent mouse events
        const hoverArcGenerator = d3.arc()
            .innerRadius(this.innerRadius - 10)
            .outerRadius(this.middleRadius + 10);
            
        const hoverArea = this.sunLayer.append('path')
            .attr('d', hoverArcGenerator(dayAngles))
            .attr('fill', 'transparent')
            .attr('class', 'sun-arc-hover-area')
            .style('cursor', 'pointer')
            .on('mouseover', () => {
                this.sunLayer.selectAll('.sunrise-label, .sunset-label')
                    .transition()
                    .duration(200)
                    .attr('opacity', 1);
                this.showUVArcs();
            })
            .on('mouseout', () => {
                this.sunLayer.selectAll('.sunrise-label, .sunset-label')
                    .transition()
                    .duration(200)
                    .attr('opacity', 0);
                this.hideUVArcs();
            });
        
        // Night arc from sunset to sunrise (next day)
        const nightAngles = this.spanToAngles(sunsetHour, sunriseHour + 24);
        const nightArc = arcGenerator(nightAngles);
        
        this.sunLayer.append('path')
            .attr('d', nightArc)
            .attr('fill', 'url(#nightGradient)')
            .attr('class', 'sun-arc night-arc')
            .style('cursor', 'pointer')
            .on('mouseover', () => {
                this.sunLayer.selectAll('.sunrise-label, .sunset-label')
                    .transition()
                    .duration(200)
                    .attr('opacity', 1);
            })
            .on('mouseout', () => {
                this.sunLayer.selectAll('.sunrise-label, .sunset-label')
                    .transition()
                    .duration(200)
                    .attr('opacity', 0);
            });
        
        // Add sunrise label ON the arc
        const sunriseAngle = this.angleForTrig(sunriseHour);
        const sunArcRadius = (this.innerRadius + this.middleRadius) / 2; // Center of sun arc
        const sunriseX = Math.cos(sunriseAngle) * sunArcRadius;
        const sunriseY = Math.sin(sunriseAngle) * sunArcRadius;
        const sunriseRotation = this.getTextRotation(sunriseAngle);
        
        this.sunLayer.append('text')
            .attr('class', 'arc-label sunrise-label')
            .attr('x', sunriseX)
            .attr('y', sunriseY)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('fill', 'rgba(255, 255, 255, 0.9)')
            .attr('font-size', '13px')
            .attr('font-weight', 'bold')
            .attr('transform', `rotate(${sunriseRotation}, ${sunriseX}, ${sunriseY})`)
            .attr('opacity', 0)  // Hidden by default - will show on hover
            .text(`↑${this.sunData.sunrise.toLocaleTimeString('en-US', { 
                hour12: false, hour: '2-digit', minute: '2-digit' 
            })}`);
        
        // Add sunset label ON the arc
        const sunsetAngle = this.angleForTrig(sunsetHour);
        const sunsetX = Math.cos(sunsetAngle) * sunArcRadius;
        const sunsetY = Math.sin(sunsetAngle) * sunArcRadius;
        const sunsetRotation = this.getTextRotation(sunsetAngle);
        
        this.sunLayer.append('text')
            .attr('class', 'arc-label sunset-label')
            .attr('x', sunsetX)
            .attr('y', sunsetY)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('fill', 'rgba(255, 255, 255, 0.9)')
            .attr('font-size', '13px')
            .attr('font-weight', 'bold')
            .attr('transform', `rotate(${sunsetRotation}, ${sunsetX}, ${sunsetY})`)
            .attr('opacity', 0)  // Hidden by default - will show on hover
            .text(`↓${this.sunData.sunset.toLocaleTimeString('en-US', { 
                hour12: false, hour: '2-digit', minute: '2-digit' 
            })}`);
    }
    
    renderMoonArcs() {
        if (!this.moonData) {
            console.log('No moon data available for rendering');
            return;
        }
        
        console.log('Rendering moon arcs with data:', this.moonData);
        
        const arcGenerator = d3.arc()
            .innerRadius(this.middleRadius + 10)
            .outerRadius(this.outerRadius);
        
        // Clear previous moon arcs
        this.moonLayer.selectAll('*').remove();
        
        // Moon visibility arc using GPT-5's approach
        if (this.moonData.moonrise && this.moonData.moonset) {
            const moonriseHour = this.moonData.moonrise.getHours() + this.moonData.moonrise.getMinutes() / 60;
            const moonsetHour = this.moonData.moonset.getHours() + this.moonData.moonset.getMinutes() / 60;
            
            // Use GPT-5's spanToAngles method to handle wrap-around automatically
            const moonAngles = this.spanToAngles(moonriseHour, moonsetHour);
            const moonArc = arcGenerator(moonAngles);
            
            this.moonLayer.append('path')
                .attr('d', moonArc)
                .attr('fill', 'url(#moonGradient)')
                .attr('fill-opacity', this.moonData.illumination / 100)
                .attr('class', 'moon-arc')
                .style('cursor', 'pointer')
                .on('mouseover', () => {
                    this.moonLayer.selectAll('.moonrise-label, .moonset-label')
                        .transition()
                        .duration(200)
                        .attr('opacity', 1);
                })
                .on('mouseout', () => {
                    this.moonLayer.selectAll('.moonrise-label, .moonset-label')
                        .transition()
                        .duration(200)
                        .attr('opacity', 0);
                });
            
            // Add moonrise label ON the arc if available
            if (this.moonData.moonrise) {
                const moonriseAngle = this.angleForTrig(moonriseHour);
                const moonArcRadius = (this.middleRadius + 10 + this.outerRadius) / 2; // Middle of moon arc
                const moonriseX = Math.cos(moonriseAngle) * moonArcRadius;
                const moonriseY = Math.sin(moonriseAngle) * moonArcRadius;
                const moonriseRotation = this.getTextRotation(moonriseAngle);
                
                this.moonLayer.append('text')
                    .attr('class', 'arc-label moonrise-label')
                    .attr('x', moonriseX)
                    .attr('y', moonriseY)
                    .attr('text-anchor', 'middle')
                    .attr('dominant-baseline', 'central')
                    .attr('fill', 'rgba(245, 245, 220, 0.9)')
                    .attr('font-size', '12px')
                    .attr('font-weight', 'bold')
                    .attr('transform', `rotate(${moonriseRotation}, ${moonriseX}, ${moonriseY})`)
                    .attr('opacity', 0)  // Hidden by default - will show on hover
                    .text(`🌙↑${this.moonData.moonrise.toLocaleTimeString('en-US', { 
                        hour12: false, hour: '2-digit', minute: '2-digit' 
                    })}`);
            }
            
            // Add moonset label ON the arc if available
            if (this.moonData.moonset) {
                const moonsetAngle = this.angleForTrig(moonsetHour);
                const moonArcRadius = (this.middleRadius + 10 + this.outerRadius) / 2; // Middle of moon arc
                const moonsetX = Math.cos(moonsetAngle) * moonArcRadius;
                const moonsetY = Math.sin(moonsetAngle) * moonArcRadius;
                const moonsetRotation = this.getTextRotation(moonsetAngle);
                
                this.moonLayer.append('text')
                    .attr('class', 'arc-label moonset-label')
                    .attr('x', moonsetX)
                    .attr('y', moonsetY)
                    .attr('text-anchor', 'middle')
                    .attr('dominant-baseline', 'central')
                    .attr('fill', 'rgba(245, 245, 220, 0.9)')
                    .attr('font-size', '12px')
                    .attr('font-weight', 'bold')
                    .attr('transform', `rotate(${moonsetRotation}, ${moonsetX}, ${moonsetY})`)
                    .attr('opacity', 0)  // Hidden by default - will show on hover
                    .text(`🌙↓${this.moonData.moonset.toLocaleTimeString('en-US', { 
                        hour12: false, hour: '2-digit', minute: '2-digit' 
                    })}`);
            }
        }
    }
    
    updateCurrentTime() {
        const now = new Date();
        const currentHour = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
        
        // Update time hand - clear all previous elements thoroughly
        this.timeLayer.selectAll('*').remove();
        
        const angle = this.angleForTrig(currentHour); // Use standard trig for time hand
        const innerX = Math.cos(angle) * this.innerRadius;
        const innerY = Math.sin(angle) * this.innerRadius;
        const outerX = Math.cos(angle) * this.outerRadius;
        const outerY = Math.sin(angle) * this.outerRadius;
        
        this.timeLayer.append('line')
            .attr('class', 'time-hand')
            .attr('x1', innerX)
            .attr('y1', innerY)
            .attr('x2', outerX)
            .attr('y2', outerY);
        
        // Center info is now handled by app.js - don't update here
    }
    
    // This method is deprecated - center info is now handled by app.js
    updateCenterInfo(now) {
        // No longer used - prevents conflicts with app.js updateCenterDisplay
    }
    
    calculateDayLength() {
        if (!this.sunData) return '---';
        
        const dayLengthMs = this.sunData.sunset - this.sunData.sunrise;
        const hours = Math.floor(dayLengthMs / (1000 * 60 * 60));
        const minutes = Math.floor((dayLengthMs % (1000 * 60 * 60)) / (1000 * 60));
        
        return `${hours}h ${minutes}m`;
    }
    
    setupUpdateInterval() {
        this.updateCurrentTime();
        setInterval(() => {
            this.updateCurrentTime();
        }, 60000); // Update every minute
    }
    
    resize(width, height) {
        this.width = width;
        this.height = height;
        this.radius = Math.min(this.width, this.height) / 2 - 60;
        this.innerRadius = this.radius * 0.6;
        this.middleRadius = this.radius * 0.75;
        this.outerRadius = this.radius * 0.95;
        
        this.svg
            .attr('width', this.width)
            .attr('height', this.height);
        
        this.g
            .attr('transform', `translate(${this.width/2}, ${this.height/2})`);
        
        // Redraw everything with new dimensions
        this.createStaticElements();
        this.renderSunArcs();
        this.renderMoonArcs();
        this.updateCurrentTime();
    }
    
    getUVGradientId(uvValue) {
        if (uvValue <= 2) return 'url(#uvLowGradient)';
        if (uvValue <= 5) return 'url(#uvModerateGradient)';
        if (uvValue <= 7) return 'url(#uvHighGradient)';
        if (uvValue <= 10) return 'url(#uvVeryHighGradient)';
        return 'url(#uvExtremeGradient)';
    }
    
    showUVArcs() {
        if (!this.uvData || !this.sunData) {
            console.log('No UV or sun data available for UV arc rendering');
            return;
        }
        
        console.log('Showing UV arcs with data:', this.uvData);
        
        // Debug: Log location and timing information
        console.log('Location & Timing Debug:');
        console.log('  Current local time:', new Date().toLocaleString());
        console.log('  Current local hour:', new Date().getHours());
        console.log('  User location coordinates:', JSON.stringify(window.sunMoonApp?.api?.userLocation || 'Not available'));
        console.log('  Sun data times - Sunrise:', this.sunData?.sunrise?.toLocaleString(), 'Sunset:', this.sunData?.sunset?.toLocaleString());
        
        // Hide the solar arc to be replaced by UV arcs
        const dayArcElement = this.sunLayer.select('.day-arc');
        console.log('Day arc element found for hiding:', !dayArcElement.empty());
        
        dayArcElement
            .transition()
            .duration(200)
            .attr('opacity', 0);
        
        // Clear any existing UV arcs
        this.uvLayer.selectAll('*').remove();
        
        // Use grouped UV data instead of individual hourly data
        const groupedUVData = this.uvData.grouped || [];
        console.log('Grouped UV data:', groupedUVData);
        
        if (groupedUVData.length === 0) {
            console.warn('No grouped UV data available');
            return;
        }
        
        // Create UV arc for each grouped UV index range
        groupedUVData.forEach((uvGroup, index) => {
            // Use the start and end hours from the group
            const startHour = uvGroup.startHour;
            const endHour = uvGroup.endHour;
            
            // Debug UV positioning
            console.log(`UV Group ${index}:`, {
                uvIndex: uvGroup.uvIndex,
                timeRange: `${uvGroup.startTime.getHours()}:00-${uvGroup.endTime.getHours()}:00`,
                hourCount: uvGroup.hours.length,
                startHour: startHour,
                endHour: endHour,
                startAngle: this.hourToAngle(startHour) * 180 / Math.PI,
                endAngle: this.hourToAngle(endHour) * 180 / Math.PI
            });
            
            // Add minimal padding between UV segments to reduce gaps
            const segmentPadding = 0.005; // Very small gap between segments (in hour units)
            const paddedStartHour = startHour + segmentPadding;
            const paddedEndHour = endHour - segmentPadding;
            
            const uvAngles = this.spanToAngles(paddedStartHour, paddedEndHour);
            
            // Enhanced debugging: Log D3 arc angles in degrees for comparison
            console.log(`UV Arc ${index} D3 Angles:`, {
                startAngleDegrees: uvAngles.startAngle * 180 / Math.PI,
                endAngleDegrees: uvAngles.endAngle * 180 / Math.PI,
                startAngleRadians: uvAngles.startAngle,
                endAngleRadians: uvAngles.endAngle,
                hourSpan: `${paddedStartHour.toFixed(2)} to ${paddedEndHour.toFixed(2)}`
            });
            
            // Calculate dynamic radius based on UV index using structured min/max approach
            const baseInnerRadius = this.innerRadius;
            
            // New approach: min width = middle of sun arc, max width = middle of moon arc
            const minRadius = (this.innerRadius + this.middleRadius) / 2; // Mid-sun arc
            const maxRadius = (this.middleRadius + this.outerRadius) / 2;  // Mid-moon arc
            const uvSteps = 12; // UV scale typically 0-11+ (allowing for extreme values)
            const stepSize = (maxRadius - minRadius) / uvSteps;
            
            // Calculate outer radius based on UV index with structured scaling
            const uvOuterRadius = minRadius + (stepSize * uvGroup.uvIndex);
            
            console.log(`UV Arc ${index} Width Calculation:`, {
                uvIndex: uvGroup.uvIndex,
                minRadius: minRadius,
                maxRadius: maxRadius,
                stepSize: stepSize,
                calculatedOuterRadius: uvOuterRadius,
                actualWidth: uvOuterRadius - baseInnerRadius
            });
            
            // Position UV arcs starting from inner radius
            const arcGenerator = d3.arc()
                .innerRadius(baseInnerRadius)
                .outerRadius(uvOuterRadius); // No artificial cap, uses calculated radius
            
            const uvArc = arcGenerator(uvAngles);
            
            // Create the UV arc - disable pointer events so solar arc hover works underneath
            const arcElement = this.uvLayer.append('path')
                .attr('d', uvArc)
                .attr('fill', this.getUVGradientId(uvGroup.uvIndex))
                .attr('class', 'uv-arc')
                .attr('opacity', 0)
                .style('pointer-events', 'none'); // Allow clicks/hover to pass through to solar arc
            
            // Add UV index text label inside the arc
            const centerHour = startHour + (endHour - startHour) / 2;
            const centerAngle = this.angleForTrig(centerHour);
            const textRadius = (baseInnerRadius + uvOuterRadius) / 2; // Middle of the UV arc
            
            const textX = Math.cos(centerAngle) * textRadius;
            const textY = Math.sin(centerAngle) * textRadius;
            
            // Calculate rotation angle for text to point toward center (perpendicular to arc)
            const rotationAngle = centerAngle * 180 / Math.PI; // Convert radians to degrees
            // Add 90 degrees to make text perpendicular to arc, then 180 to flip right-side up
            // Before noon: lean left, After noon: lean right, pointing toward center
            const textRotation = rotationAngle + 90 + 180;
            
            const uvText = this.uvLayer.append('text')
                .attr('x', textX)
                .attr('y', textY)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'central')
                .attr('class', 'uv-text')
                .attr('font-size', '14px')
                .attr('font-weight', 'bold')
                .attr('fill', 'white')
                .attr('opacity', 0)
                .attr('transform', `rotate(${textRotation}, ${textX}, ${textY})`) // Rotate text to match arc
                .style('pointer-events', 'none') // Same as UV arcs - don't interfere with hover
                .style('filter', 'drop-shadow(1px 1px 4px rgba(0,0,0,0.9))') // Add shadow for better visibility
                .text(uvGroup.uvIndex);
            
            // Animate both the arc and text appearance
            arcElement
                .transition()
                .duration(300)
                .attr('opacity', 1.0);
                
            uvText
                .transition()
                .duration(300)
                .attr('opacity', 1.0);
        });
    }
    
    getUVCategory(uvi) {
        if (uvi <= 2) return { name: "Low", color: "#289500" };
        if (uvi <= 5) return { name: "Moderate", color: "#F7E400" };
        if (uvi <= 7) return { name: "High", color: "#F85900" };
        if (uvi <= 10) return { name: "Very High", color: "#D8001D" };
        return { name: "Extreme", color: "#6B49C8" };
    }
    
    hideUVArcs() {
        // Restore the solar arc
        const dayArcElement = this.sunLayer.select('.day-arc');
        console.log('Day arc element found for restoring:', !dayArcElement.empty());
        
        dayArcElement
            .transition()
            .duration(200)
            .attr('opacity', 1);
        
        // Remove all UV arcs and text labels (no hover areas anymore since they use pointer-events: none)
        this.uvLayer.selectAll('.uv-arc, .uv-text')
            .transition()
            .duration(200)
            .attr('opacity', 0)
            .remove();
        
        // Also remove any tooltips
        this.g.selectAll('.uv-tooltip').remove();
    }
}