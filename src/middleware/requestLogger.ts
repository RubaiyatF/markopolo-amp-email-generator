import { Request, Response, NextFunction } from 'express';

interface LogEntry {
  timestamp: string;
  level: string;
  service: string;
  method?: string;
  endpoint?: string;
  requestId?: string;
  duration?: number;
  status?: number;
  message: string;
  error?: any;
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  // Attach request ID
  (req as any).requestId = requestId;
  (req as any).startTime = startTime;

  // Log request
  logInfo({
    service: 'api',
    method: req.method,
    endpoint: req.path,
    requestId,
    message: `Incoming ${req.method} ${req.path}`
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
    
    log({
      timestamp: new Date().toISOString(),
      level,
      service: 'api',
      method: req.method,
      endpoint: req.path,
      requestId,
      duration,
      status: res.statusCode,
      message: `${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
    });
  });

  next();
}

function log(entry: LogEntry) {
  const logString = JSON.stringify(entry);
  
  if (entry.level === 'ERROR') {
    console.error(logString);
  } else if (entry.level === 'WARN') {
    console.warn(logString);
  } else {
    console.log(logString);
  }
}

export function logInfo(data: Partial<LogEntry>) {
  log({
    timestamp: new Date().toISOString(),
    level: 'INFO',
    service: 'api',
    message: '',
    ...data
  });
}

export function logError(data: Partial<LogEntry>) {
  log({
    timestamp: new Date().toISOString(),
    level: 'ERROR',
    service: 'api',
    message: '',
    ...data
  });
}

export function logWarn(data: Partial<LogEntry>) {
  log({
    timestamp: new Date().toISOString(),
    level: 'WARN',
    service: 'api',
    message: '',
    ...data
  });
}
