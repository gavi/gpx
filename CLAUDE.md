# GPX Track Viewer Development Guide

## Commands
- **Run Server**: `uvicorn api.gpx_server:app --host 0.0.0.0 --port 8000 --reload`
- **Install Dependencies**: `pip install -r requirements.txt`
- **Start Development**: `python -m api.gpx_server`

## Code Style Guidelines

### Python
- Use 4-space indentation
- Include type annotations for function parameters and returns
- Follow PEP 8 naming conventions (snake_case for variables/functions)
- Organize imports: standard library first, then third-party, then local
- Use descriptive docstrings for functions and classes
- Use appropriate error handling with try/except blocks
- Prefer FastAPI dependency injection for route parameters

### JavaScript
- Use 4-space indentation 
- Use modern JS features (async/await, template literals)
- Follow camelCase naming convention for variables and functions
- Error handling: wrap fetch calls and DOM operations in try/catch
- Organize code in well-named functions for specific tasks
- Store user data in localStorage when appropriate