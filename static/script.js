document.addEventListener('DOMContentLoaded', () => {
    // Initialize maps
    const uploadMap = L.map('map-upload').setView([51.505, -0.09], 13);
    const tracksMap = L.map('map-tracks').setView([51.505, -0.09], 13);
    
    // Add tile layers
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(uploadMap);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(tracksMap);
    
    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            
            // Update active tab button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Show active tab content
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`${tabName}-tab`).classList.add('active');
            
            // Refresh maps when tab changes (fixes layout issues)
            uploadMap.invalidateSize();
            tracksMap.invalidateSize();
            
            // Load tracks list when switching to tracks tab
            if (tabName === 'tracks') {
                loadTracks();
            }
        });
    });
    
    // Track variables
    let currentUploadTrack = null;
    let currentSelectedTrack = null;
    
    // Form submission
    const uploadForm = document.getElementById('gpx-upload-form');
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(uploadForm);
        const file = document.getElementById('gpx-file').files[0];
        
        // Check if a file is selected
        if (!file) {
            alert('Please select a GPX file');
            return;
        }
        
        // Add track stats if available
        if (currentUploadTrack) {
            formData.append('distance', currentUploadTrack.stats.distance);
            formData.append('elevation_gain', currentUploadTrack.stats.elevGain);
            formData.append('duration', currentUploadTrack.stats.duration);
        }
        
        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Upload failed: ${errorText}`);
            }
            
            const result = await response.json();
            
            // Store track ID in localStorage
            storeMyTrackID(result.track_id);
            
            // Show success message and share link
            const uploadResult = document.getElementById('upload-result');
            uploadResult.classList.remove('hidden');
            
            const shareUrl = document.getElementById('share-url');
            const fullUrl = window.location.origin + result.share_url;
            shareUrl.value = fullUrl;
            
            // Add copy button functionality
            const copyBtn = document.getElementById('copy-btn');
            copyBtn.addEventListener('click', () => {
                shareUrl.select();
                document.execCommand('copy');
                copyBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyBtn.textContent = 'Copy';
                }, 2000);
            });
            
        } catch (error) {
            console.error('Error uploading track:', error);
            alert(`Error uploading track: ${error.message}`);
        }
    });
    
    // File input change handler
    const fileInput = document.getElementById('gpx-file');
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const gpxString = e.target.result;
            const track = parseGPX(gpxString);
            
            if (track) {
                displayTrackOnMap(track, uploadMap, 'track-details');
                currentUploadTrack = track;
            }
        };
        reader.readAsText(file);
    });
    
    // Load tracks list
    async function loadTracks() {
        const tracksContainer = document.getElementById('tracks-container');
        
        try {
            const response = await fetch('/api/tracks');
            
            if (!response.ok) {
                throw new Error('Failed to load tracks');
            }
            
            const data = await response.json();
            
            // Get user's tracks from localStorage
            const myTrackIDs = getMyTrackIDs();
            
            // Filter tracks to only show user's tracks
            const userTracks = data.tracks.filter(track => myTrackIDs.includes(track.track_id));
            
            if (userTracks.length === 0) {
                tracksContainer.innerHTML = '<p>No tracks found. Upload some tracks first!</p>';
                return;
            }
            
            // Display tracks
            tracksContainer.innerHTML = '';
            userTracks.forEach(track => {
                const trackItem = document.createElement('div');
                trackItem.className = 'track-item';
                trackItem.innerHTML = `
                    <h3>${track.name}</h3>
                    <p>${track.description || ''}</p>
                    <p><strong>Created:</strong> ${new Date(track.created_at).toLocaleString()}</p>
                    ${track.distance ? `<p><strong>Distance:</strong> ${(track.distance / 1000).toFixed(2)} km</p>` : ''}
                    <button class="view-btn" data-id="${track.track_id}">View</button>
                    <button class="share-btn" data-id="${track.track_id}">Share</button>
                `;
                
                tracksContainer.appendChild(trackItem);
                
                // Add click event for view button
                trackItem.querySelector('.view-btn').addEventListener('click', () => {
                    loadTrackDetails(track.track_id);
                    
                    // Update selected track styling
                    document.querySelectorAll('.track-item').forEach(item => {
                        item.classList.remove('selected');
                    });
                    trackItem.classList.add('selected');
                });
                
                // Add click event for share button
                trackItem.querySelector('.share-btn').addEventListener('click', () => {
                    const shareUrl = window.location.origin + `/share/${track.track_id}`;
                    navigator.clipboard.writeText(shareUrl)
                        .then(() => {
                            alert('Share link copied to clipboard!');
                        })
                        .catch(err => {
                            console.error('Could not copy text: ', err);
                            // Fallback
                            prompt('Copy this share link:', shareUrl);
                        });
                });
            });
            
        } catch (error) {
            console.error('Error loading tracks:', error);
            tracksContainer.innerHTML = `<p>Error loading tracks: ${error.message}</p>`;
        }
    }
    
    // Load track details
    async function loadTrackDetails(trackId) {
        try {
            const response = await fetch(`/api/track/${trackId}`);
            
            if (!response.ok) {
                throw new Error('Failed to load track details');
            }
            
            const track = await response.json();
            const parsedTrack = parseGPX(track.gpx_data);
            
            if (parsedTrack) {
                displayTrackOnMap(parsedTrack, tracksMap, 'selected-track-details');
                currentSelectedTrack = parsedTrack;
                
                // Show track info
                const trackInfo = document.getElementById('selected-track-info');
                trackInfo.classList.remove('hidden');
            }
            
        } catch (error) {
            console.error('Error loading track details:', error);
            alert(`Error loading track details: ${error.message}`);
        }
    }
    
    // Helper Functions
    
    // Display track on map
    function displayTrackOnMap(track, map, detailsElementId) {
        // Clear previous tracks
        map.eachLayer(layer => {
            if (layer instanceof L.Polyline || layer instanceof L.Marker) {
                map.removeLayer(layer);
            }
        });
        
        // Create polyline for the track
        const points = track.points.map(p => [p.lat, p.lon]);
        const polyline = L.polyline(points, { color: '#4285F4', weight: 5 }).addTo(map);
        
        // Set map view to track bounds
        const { minLat, maxLat, minLon, maxLon } = track.bounds;
        map.fitBounds([
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
        }).addTo(map);
        
        const endMarker = L.marker([endPoint.lat, endPoint.lon], {
            title: 'End',
            icon: L.divIcon({
                className: 'end-marker',
                html: '<div style="background-color: red; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>'
            })
        }).addTo(map);
        
        // Display track info
        displayTrackInfo(track, detailsElementId);
        
        // Show track info
        const trackInfoElement = document.getElementById(detailsElementId).parentElement;
        trackInfoElement.classList.remove('hidden');
    }
    
    // Display track info
    function displayTrackInfo(track, elementId) {
        const { stats } = track;
        const detailsElement = document.getElementById(elementId);
        
        let html = `<p><strong>Name:</strong> ${track.name}</p>`;
        html += `<p><strong>Distance:</strong> ${(stats.distance / 1000).toFixed(2)} km</p>`;
        
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
    
    // Helper Functions for localStorage track management
    function storeMyTrackID(trackId) {
        const myTracks = getMyTrackIDs();
        if (!myTracks.includes(trackId)) {
            myTracks.push(trackId);
            localStorage.setItem('myTracks', JSON.stringify(myTracks));
        }
    }
    
    function getMyTrackIDs() {
        const tracks = localStorage.getItem('myTracks');
        return tracks ? JSON.parse(tracks) : [];
    }
    
    // Parse GPX file
    function parseGPX(gpxString) {
        const parser = new DOMParser();
        const gpx = parser.parseFromString(gpxString, 'text/xml');
        
        // Get track points (trkpt elements)
        const trackPoints = gpx.querySelectorAll('trkpt');
        
        if (trackPoints.length === 0) {
            alert('No track points found in the GPX file');
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
});