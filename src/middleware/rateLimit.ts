import { Response, NextFunction } from 'express';
import redis from '../lib/redis';
import { AppError } from './errorHandler';
import { AuthenticatedRequest } from './auth';

const RATE_LIMITS: Record<string, { perMinute: number; perHour: number; perDay: number }> = {
  free: { perMinute: 10, perHour: 100, perDay: 1000 },
  starter: { perMinute: 60, perHour: 1000, perDay: 10000 },
  growth: { perMinute: 300, perHour: 5000, perDay: 50000 },
  enterprise: { perMinute: Infinity, perHour: Infinity, perDay: Infinity }
};

export async function rateLimit(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (process.env.RATE_LIMIT_ENABLED !== 'true') {
      return next();
    }

    const company = req.company;
    if (!company) {
      throw new AppError(401, 'Authentication required for rate limiting');
    }

    const limits = RATE_LIMITS[company.rateLimitTier] || RATE_LIMITS.free;
    const now = Date.now();
    
    // Check per-minute limit
    const minuteKey = `ratelimit:${company.companyId}:minute:${Math.floor(now / 60000)}`;
    const minuteCount = await redis.incr(minuteKey);
    
    if (minuteCount === 1) {
      await redis.expire(minuteKey, 60);
    }

    if (minuteCount > limits.perMinute) {
      res.setHeader('Retry-After', '60');
      res.setHeader('X-RateLimit-Limit', limits.perMinute.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', (Math.floor(now / 60000) * 60 + 60).toString());
      
      throw new AppError(429, 'Rate limit exceeded. Please try again later.');
    }

    // Check per-hour limit
    const hourKey = `ratelimit:${company.companyId}:hour:${Math.floor(now / 3600000)}`;
    const hourCount = await redis.incr(hourKey);
    
    if (hourCount === 1) {
      await redis.expire(hourKey, 3600);
    }

    if (hourCount > limits.perHour) {
      throw new AppError(429, 'Hourly rate limit exceeded');
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', limits.perMinute.toString());
    res.setHeader('X-RateLimit-Remaining', (limits.perMinute - minuteCount).toString());
    res.setHeader('X-RateLimit-Reset', (Math.floor(now / 60000) * 60 + 60).toString());

    next();
  } catch (error) {
    next(error);
  }
}
