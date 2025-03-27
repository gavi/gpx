import os
import sqlite3
import uuid
import json
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, RedirectResponse
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SQLite database
DB_PATH = './gpx_data.db'

# Serve static files
app.mount("/static", StaticFiles(directory="static", html=True), name="static")

# Models
class GPXTrackInfo(BaseModel):
    track_id: str
    name: str
    description: Optional[str] = None
    created_at: str
    distance: Optional[float] = None
    elevation_gain: Optional[float] = None
    duration: Optional[int] = None

class GPXUploadResponse(BaseModel):
    track_id: str
    share_url: str

class GPXList(BaseModel):
    tracks: List[GPXTrackInfo]

# Initialize database
def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS gpx_tracks (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            created_at TEXT NOT NULL,
            gpx_data TEXT NOT NULL,
            distance REAL,
            elevation_gain REAL,
            duration INTEGER
        )
        ''')
        conn.commit()

# Database functions
def save_gpx_track(track_id: str, name: str, description: str, gpx_data: str, 
                   distance: Optional[float], elevation_gain: Optional[float], 
                   duration: Optional[int]) -> None:
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        created_at = datetime.now().isoformat()
        cursor.execute(
            '''
            INSERT INTO gpx_tracks (id, name, description, created_at, gpx_data, distance, elevation_gain, duration)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (track_id, name, description, created_at, gpx_data, distance, elevation_gain, duration)
        )
        conn.commit()

def get_gpx_track(track_id: str) -> Optional[Dict[str, Any]]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM gpx_tracks WHERE id = ?", (track_id,))
        track = cursor.fetchone()
        if track:
            track_dict = dict(track)
            # Make a copy of 'id' as 'track_id' for consistency
            track_dict['track_id'] = track_dict['id']
            return track_dict
        return None


# Routes
@app.get("/", response_class=HTMLResponse)
async def root():
    return RedirectResponse(url="/static/index.html")

@app.post("/api/upload", response_model=GPXUploadResponse)
async def upload_gpx(
    gpx_file: UploadFile = File(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    distance: Optional[float] = Form(None),
    elevation_gain: Optional[float] = Form(None),
    duration: Optional[int] = Form(None)
):
    # Generate unique ID
    track_id = str(uuid.uuid4())
    
    # Read GPX file content
    gpx_content = await gpx_file.read()
    gpx_data = gpx_content.decode("utf-8")
    
    # Store in database
    save_gpx_track(
        track_id=track_id,
        name=name,
        description=description,
        gpx_data=gpx_data,
        distance=distance,
        elevation_gain=elevation_gain,
        duration=duration
    )
    
    # Create share URL
    share_url = f"/share/{track_id}"
    
    return GPXUploadResponse(track_id=track_id, share_url=share_url)

@app.get("/api/tracks", response_model=GPXList)
async def list_tracks():
    tracks = get_all_tracks()
    return GPXList(tracks=[GPXTrackInfo(**track) for track in tracks])

@app.get("/api/track/{track_id}")
async def get_track(track_id: str):
    track = get_gpx_track(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    return track

@app.get("/share/{track_id}", response_class=HTMLResponse)
async def share_track(track_id: str):
    # This endpoint will serve the viewer HTML page with the track_id embedded
    # The frontend JS will then fetch the track data using the API
    with open("static/share.html", "r") as f:
        html_content = f.read()
    
    # Replace placeholder with actual track_id
    html_content = html_content.replace("{{TRACK_ID}}", track_id)
    
    return HTMLResponse(content=html_content)

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    init_db()
    # Ensure static directory exists
    os.makedirs("static", exist_ok=True)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("gpx_server:app", host="0.0.0.0", port=8000, reload=True)