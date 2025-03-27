# GPX Track Viewer

A web application for visualizing and interacting with GPX track files.

## Features

- Upload and view GPX track files on an interactive map
- Toggle visibility of individual tracks
- Full-screen map display
- Share view with specific tracks

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd gpx

# Install dependencies
pip install -r requirements.txt
```

## Usage

### Running the Server

```bash
# Start the development server
uvicorn api.gpx_server:app --host 0.0.0.0 --port 8000 --reload

# Alternative method
python -m api.gpx_server
```

The application will be available at `http://localhost:8000`.

## Development

### Backend (Python/FastAPI)

The backend is built with FastAPI and handles GPX file parsing and serving.

### Frontend (JavaScript)

The frontend provides an interactive map interface using modern JavaScript.

## License

MIT License

Copyright (c) 2025

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.