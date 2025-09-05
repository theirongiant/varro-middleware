# Varro Middleware

Express middleware for recording and replaying API calls during testing.

[![npm version](https://badge.fury.io/js/varro-middleware.svg)](https://badge.fury.io/js/varro-middleware)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Varro provides three modes of operation:

- **Off**: Does nothing (passes requests through normally)
- **Record**: Captures API requests and responses, saving them to files
- **Replay**: Intercepts API requests and replays previously recorded responses

## Installation

```bash
npm install varro-middleware
```

## Quick Start

1. **Set up your Express app with Varro middleware:**

```javascript
const express = require('express');
const VarroMiddleware = require('varro-middleware');

const app = express();
const varro = new VarroMiddleware();

// Add the middleware
app.use(varro.middleware());

// Your API routes...
```

2. **Configure Varro** by creating a `varro.config.js` or `varro.config.json` file in your project root:

**JavaScript Configuration (varro.config.js):**
```javascript
module.exports = {
  mode: 'record',  // 'off', 'record', or 'replay'
  recordingsDir: './recordings',
  namingPattern: '{method}_{url}_{timestamp}',
  matching: {
    includeQuery: true,
    includeHeaders: false,
    includeBody: false,
    caseSensitive: false
  },
  filters: {
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    urlPatterns: ['/api/*'],
    excludePatterns: ['/api/health']
  }
};
```

**JSON Configuration (varro.config.json):**
```json
{
  "mode": "replay",
  "recordingsDir": "./recordings",
  "namingPattern": "{method}_{url}_{date}_{counter}",
  "matching": {
    "includeQuery": true,
    "includeHeaders": true,
    "includeBody": false,
    "caseSensitive": false
  },
  "filters": {
    "methods": ["GET", "POST"],
    "urlPatterns": ["*"],
    "excludePatterns": []
  }
}
```

3. **Run the example server:**

```bash
git clone https://github.com/yourusername/varro-middleware.git
cd varro-middleware
npm install
npm run example
```

## Configuration Options

### Mode
- `'off'`: Middleware does nothing
- `'record'`: Records API calls to files
- `'replay'`: Replays recorded responses

### Recordings Directory
- `recordingsDir`: Where to store/load recording files relative to project root (default: `'./recordings'`)

### Naming Pattern
- `namingPattern`: Template for recording filenames
- Available variables: `{method}`, `{url}`, `{date}`, `{timestamp}`, `{counter}`
- Example: `'{method}_{url}_{timestamp}'` → `GET_api_users_1703123456789.json`

### Matching Configuration
- `includeQuery`: Include query parameters in request matching
- `includeHeaders`: Include headers in request matching  
- `includeBody`: Include request body in request matching
- `caseSensitive`: Case sensitive matching

### Filters
- `methods`: Array of HTTP methods to record/replay
- `urlPatterns`: Array of URL patterns to match (supports wildcards)
- `excludePatterns`: Array of URL patterns to exclude

## Usage Examples

### Recording Mode
Set `mode: 'record'` and make API calls. Check the recordings directory for saved files.

### Replay Mode
Set `mode: 'replay'` and the middleware will automatically replay recorded responses for matching requests.

### Custom Configuration
You can also pass configuration directly to the constructor:

```javascript
const varro = new VarroMiddleware({
  mode: 'record',
  recordingsDir: './my-recordings',
  namingPattern: '{date}_{method}_{url}'
});
```

## Example Server

Run `npm test` to start the example server with sample API endpoints. The server will show the current Varro mode and available endpoints.

## File Format

Recorded files are stored as JSON with the following structure:

```json
{
  "timestamp": "2023-12-21T10:30:00.000Z",
  "request": {
    "method": "GET",
    "url": "/api/users?page=1",
    "path": "/api/users",
    "query": {"page": "1"},
    "headers": {...},
    "body": {...}
  },
  "response": {
    "status": 200,
    "headers": {...},
    "body": "[{\"id\":1,\"name\":\"John Doe\"}]"
  },
  "requestKey": "get:/api/users?page=1"
}
```
