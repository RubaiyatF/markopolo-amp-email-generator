import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma';
import supabase from '../lib/supabase';
import { AppError } from './errorHandler';

export interface AuthenticatedRequest extends Request {
  company?: any;
}

export async function authenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'Missing or invalid authorization header');
    }

    const apiKey = authHeader.substring(7);

    if (!apiKey) {
      throw new AppError(401, 'API key is required');
    }

    // Try Prisma first, fallback to Supabase
    let company = null;
    try {
      company = await prisma.company.findFirst({
        where: { apiKey }
      });
    } catch (prismaError: any) {
      // If Prisma fails (database connection issue), try Supabase
      if (prismaError.message?.includes("Can't reach database server")) {
        console.log('⚠️ Prisma connection failed, using Supabase fallback');
        company = await supabase.findCompanyByApiKey(apiKey);
      } else {
        throw prismaError;
      }
    }

    if (!company) {
      throw new AppError(401, 'Invalid API key');
    }

    // Attach company to request
    req.company = company;

    next();
  } catch (error) {
    next(error);
  }
}

export async function generateAPIKey(): Promise<string> {
  const randomString = Math.random().toString(36).substring(2, 15) +
                       Math.random().toString(36).substring(2, 15) +
                       Math.random().toString(36).substring(2, 15);
  
  return `amp_key_${randomString}`;
}

export async function hashAPIKey(apiKey: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(apiKey, salt);
}

export async function compareAPIKey(apiKey: string, hashedKey: string): Promise<boolean> {
  return await bcrypt.compare(apiKey, hashedKey);
}
