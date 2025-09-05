const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class VarroMiddleware {
  constructor(config = {}) {
    this.config = this.loadConfig(config);
    this.counter = 0;
    this.ensureRecordingsDir();
  }

  loadConfig(userConfig) {
    const defaultConfig = {
      mode: 'off',
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
        urlPatterns: ['*'],
        excludePatterns: []
      }
    };

    // Try to load from varro.config.js or varro.config.json in project root
    let fileConfig = {};
    try {
      const projectRoot = this.getProjectRoot();
      const jsConfigPath = path.join(projectRoot, 'varro.config.js');
      const jsonConfigPath = path.join(projectRoot, 'varro.config.json');
      
      if (fs.existsSync(jsConfigPath)) {
        fileConfig = require(jsConfigPath);
      } else if (fs.existsSync(jsonConfigPath)) {
        fileConfig = JSON.parse(fs.readFileSync(jsonConfigPath, 'utf8'));
      }
    } catch (error) {
      console.warn('Warning: Could not load varro config file:', error.message);
    }

    const mergedConfig = { ...defaultConfig, ...fileConfig, ...userConfig };
    
    // Ensure recordings directory is relative to project root
    if (!path.isAbsolute(mergedConfig.recordingsDir)) {
      mergedConfig.recordingsDir = path.join(this.getProjectRoot(), mergedConfig.recordingsDir);
    }
    
    return mergedConfig;
  }

  getProjectRoot() {
    // Start from the current working directory (where the app is running)
    let currentDir = process.cwd();
    
    // Walk up the directory tree looking for package.json
    while (currentDir !== path.dirname(currentDir)) {
      if (fs.existsSync(path.join(currentDir, 'package.json'))) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }
    
    // If no package.json found, return the original working directory
    return process.cwd();
  }

  ensureRecordingsDir() {
    if (!fs.existsSync(this.config.recordingsDir)) {
      fs.mkdirSync(this.config.recordingsDir, { recursive: true });
    }
  }

  middleware() {
    return (req, res, next) => {
      if (this.config.mode === 'off') {
        return next();
      }

      if (this.config.mode === 'record') {
        return this.recordRequest(req, res, next);
      }

      if (this.config.mode === 'replay') {
        return this.replayRequest(req, res, next);
      }

      next();
    };
  }

  recordRequest(req, res, next) {
    if (!this.shouldRecord(req)) {
      return next();
    }

    const originalSend = res.send;
    const originalJson = res.json;
    let responseBody = '';

    // Capture response body
    res.send = function(body) {
      responseBody = body;
      return originalSend.call(this, body);
    };

    res.json = function(body) {
      responseBody = JSON.stringify(body);
      return originalJson.call(this, body);
    };

    res.on('finish', () => {
      this.saveRecording(req, res, responseBody);
    });

    next();
  }

  replayRequest(req, res, next) {
    if (!this.shouldReplay(req)) {
      return next();
    }

    const recording = this.findRecording(req);
    if (recording) {
      // Set response status and headers
      res.status(recording.response.status);
      Object.entries(recording.response.headers || {}).forEach(([key, value]) => {
        res.set(key, value);
      });

      // Send the recorded response body
      if (recording.response.body) {
        try {
          const body = JSON.parse(recording.response.body);
          res.json(body);
        } catch {
          res.send(recording.response.body);
        }
      } else {
        res.end();
      }
    } else {
      next();
    }
  }

  shouldRecord(req) {
    return this.matchesFilters(req, this.config.filters);
  }

  shouldReplay(req) {
    return this.matchesFilters(req, this.config.filters);
  }

  matchesFilters(req, filters) {
    // Check HTTP method
    if (!filters.methods.includes(req.method)) {
      return false;
    }

    // Check URL patterns
    const urlMatches = filters.urlPatterns.some(pattern => {
      if (pattern === '*') return true;
      return this.matchesPattern(req.path, pattern);
    });

    if (!urlMatches) return false;

    // Check exclude patterns
    const shouldExclude = filters.excludePatterns.some(pattern => {
      return this.matchesPattern(req.path, pattern);
    });

    return !shouldExclude;
  }

  matchesPattern(url, pattern) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(url);
  }

  findRecording(req) {
    const recordings = this.getRecordings();
    const requestKey = this.generateRequestKey(req);

    // Find exact match first
    for (const recording of recordings) {
      if (recording.requestKey === requestKey) {
        return recording;
      }
    }

    // If no exact match, find by filename pattern
    const filename = this.generateFilename(req);
    const recordingFile = path.join(this.config.recordingsDir, filename + '.json');
    
    if (fs.existsSync(recordingFile)) {
      try {
        return JSON.parse(fs.readFileSync(recordingFile, 'utf8'));
      } catch (error) {
        console.warn('Could not load recording file:', recordingFile, error.message);
      }
    }

    return null;
  }

  saveRecording(req, res, responseBody) {
    const recording = {
      timestamp: new Date().toISOString(),
      request: {
        method: req.method,
        url: req.url,
        path: req.path,
        query: req.query,
        headers: this.config.matching.includeHeaders ? req.headers : {},
        body: this.config.matching.includeBody ? req.body : undefined
      },
      response: {
        status: res.statusCode,
        headers: this.config.matching.includeHeaders ? res.getHeaders() : {},
        body: responseBody
      },
      requestKey: this.generateRequestKey(req)
    };

    const filename = this.generateFilename(req);
    const filepath = path.join(this.config.recordingsDir, filename + '.json');

    try {
      fs.writeFileSync(filepath, JSON.stringify(recording, null, 2));
      console.log(`Varro: Recorded ${req.method} ${req.path} to ${filename}.json`);
    } catch (error) {
      console.error('Varro: Failed to save recording:', error.message);
    }
  }

  generateRequestKey(req) {
    let key = req.method + ':' + req.path;
    
    if (this.config.matching.includeQuery && Object.keys(req.query).length > 0) {
      key += '?' + new URLSearchParams(req.query).toString();
    }
    
    if (this.config.matching.includeHeaders) {
      const relevantHeaders = Object.entries(req.headers)
        .filter(([key]) => !['host', 'user-agent', 'accept-encoding'].includes(key.toLowerCase()))
        .sort()
        .map(([k, v]) => `${k}:${v}`)
        .join('|');
      if (relevantHeaders) {
        key += '|' + relevantHeaders;
      }
    }
    
    if (this.config.matching.includeBody && req.body) {
      const bodyHash = crypto.createHash('md5').update(JSON.stringify(req.body)).digest('hex');
      key += '|body:' + bodyHash;
    }

    return this.config.matching.caseSensitive ? key : key.toLowerCase();
  }

  generateFilename(req) {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const timestamp = now.getTime();
    this.counter++;

    const url = req.path.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    
    return this.config.namingPattern
      .replace(/{method}/g, req.method)
      .replace(/{url}/g, url)
      .replace(/{date}/g, date)
      .replace(/{timestamp}/g, timestamp)
      .replace(/{counter}/g, this.counter.toString().padStart(4, '0'));
  }

  getRecordings() {
    try {
      const files = fs.readdirSync(this.config.recordingsDir)
        .filter(file => file.endsWith('.json'))
        .map(file => path.join(this.config.recordingsDir, file));

      return files.map(file => {
        try {
          return JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch (error) {
          console.warn('Could not load recording file:', file, error.message);
          return null;
        }
      }).filter(Boolean);
    } catch (error) {
      console.warn('Could not read recordings directory:', error.message);
      return [];
    }
  }
}

module.exports = VarroMiddleware;
