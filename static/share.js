document.addEventListener('DOMContentLoaded', () => {
    // Initialize map
    const sharedMap = L.map('map-fullscreen').setView([51.505, -0.09], 13);
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(sharedMap);
    
    // Load track data
    loadTrackData();
    
    async function loadTrackData() {
        try {
            const response = await fetch(`/api/track/${trackId}`);
            
            if (!response.ok) {
                throw new Error('Failed to load track');
            }
            
            const track = await response.json();
            
            // Update page title and description
            document.getElementById('track-title').textContent = track.name;
            if (track.description) {
                document.getElementById('track-description').textContent = track.description;
            }
            
            // Parse GPX and display on map
            const parsedTrack = parseGPX(track.gpx_data);
            if (parsedTrack) {
                displayTrackOnMap(parsedTrack);
            }
            
        } catch (error) {
            console.error('Error loading track:', error);
            document.getElementById('shared-track-info').innerHTML = 
                `<div class="error">Error loading track: ${error.message}</div>`;
        }
    }
    
    // Parse GPX file
    function parseGPX(gpxString) {
        const parser = new DOMParser();
        const gpx = parser.parseFromString(gpxString, 'text/xml');
        
        // Get track points (trkpt elements)
        const trackPoints = gpx.querySelectorAll('trkpt');
        
        if (trackPoints.length === 0) {
            console.error('No track points found in the GPX file');
            return null;
        }
        
        const points = [];
        let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
        let totalDistance = 0;
        let elevGain = 0, elevLoss = 0;
        let prevPoint = null;
        let startTime = null, endTime = null;
        
        trackPoints.forEach(trkpt => {
            const lat = parseFloat(trkpt.getAttribute('lat'));
            const lon = parseFloat(trkpt.getAttribute('lon'));
            
            // Get elevation if available
            const elevElem = trkpt.querySelector('ele');
            const elevation = elevElem ? parseFloat(elevElem.textContent) : null;
            
            // Get time if available
            const timeElem = trkpt.querySelector('time');
            const timeStr = timeElem ? timeElem.textContent : null;
            const time = timeStr ? new Date(timeStr) : null;
            
            if (time) {
                if (!startTime || time < startTime) startTime = time;
                if (!endTime || time > endTime) endTime = time;
            }
            
            // Update bounds
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
            minLon = Math.min(minLon, lon);
            maxLon = Math.max(maxLon, lon);
            
            // Calculate distance and elevation changes
            if (prevPoint) {
                const dist = calculateDistance(
                    prevPoint.lat, prevPoint.lon, 
                    lat, lon
                );
                totalDistance += dist;
                
                if (elevation !== null && prevPoint.elevation !== null) {
                    const elevDiff = elevation - prevPoint.elevation;
                    if (elevDiff > 0) {
                        elevGain += elevDiff;
                    } else {
                        elevLoss += Math.abs(elevDiff);
                    }
                }
            }
            
            // Add point
            const point = { lat, lon, elevation, time };
            points.push(point);
            prevPoint = point;
        });
        
        // Calculate duration
        let duration = null;
        if (startTime && endTime) {
            duration = Math.floor((endTime - startTime) / 1000); // in seconds
        }
        
        // Get track name if available
        const nameElem = gpx.querySelector('trk > name');
        const name = nameElem ? nameElem.textContent : 'Unnamed Track';
        
        // Return track data
        return {
            name,
            points,
            bounds: { minLat, maxLat, minLon, maxLon },
            stats: {
                distance: totalDistance,
                elevGain,
                elevLoss,
                startTime,
                endTime,
                duration
            }
        };
    }
    
    // Calculate distance between two points using the Haversine formula
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;
        
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c;
        
        return d;
    }
    
    // Display track on map
    function displayTrackOnMap(track) {
        // Create polyline for the track
        const points = track.points.map(p => [p.lat, p.lon]);
        const polyline = L.polyline(points, { color: '#4285F4', weight: 5 }).addTo(sharedMap);
        
        // Set map view to track bounds
        const { minLat, maxLat, minLon, maxLon } = track.bounds;
        sharedMap.fitBounds([
            [minLat, minLon],
            [maxLat, maxLon]
        ]);
        
        // Add markers for start and end points
        const startPoint = track.points[0];
        const endPoint = track.points[track.points.length - 1];
        
        const startMarker = L.marker([startPoint.lat, startPoint.lon], {
            title: 'Start',
            icon: L.divIcon({
                className: 'start-marker',
                html: '<div style="background-color: green; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>'
            })
        }).addTo(sharedMap);
        
        const endMarker = L.marker([endPoint.lat, endPoint.lon], {
            title: 'End',
            icon: L.divIcon({
                className: 'end-marker',
                html: '<div style="background-color: red; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>'
            })
        }).addTo(sharedMap);
        
        // Display track info
        displayTrackInfo(track);
    }
    
    // Display track info
    function displayTrackInfo(track) {
        const { stats } = track;
        const detailsElement = document.getElementById('shared-track-details');
        
        let html = `<p><strong>Distance:</strong> ${(stats.distance / 1000).toFixed(2)} km</p>`;
        
        if (stats.elevGain && stats.elevLoss) {
            html += `<p><strong>Elevation Gain:</strong> ${stats.elevGain.toFixed(0)} m</p>`;
            html += `<p><strong>Elevation Loss:</strong> ${stats.elevLoss.toFixed(0)} m</p>`;
        }
        
        if (stats.startTime && stats.endTime) {
            const duration = stats.duration; // in seconds
            const hours = Math.floor(duration / 3600);
            const minutes = Math.floor((duration % 3600) / 60);
            const seconds = duration % 60;
            
            html += `<p><strong>Start Time:</strong> ${stats.startTime.toLocaleString()}</p>`;
            html += `<p><strong>Duration:</strong> ${hours}h ${minutes}m ${seconds}s</p>`;
        }
        
        html += `<p><strong>Points:</strong> ${track.points.length}</p>`;
        
        detailsElement.innerHTML = html;
    }
});