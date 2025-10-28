import { Router } from 'express';
import { v1Router } from './v1';

export const apiRouter = Router();

// API version 1
apiRouter.use('/v1', v1Router);

// API root endpoint
apiRouter.get('/', (_req, res) => {
  res.json({
    name: 'AMP Email Generation API Platform',
    version: process.env.API_VERSION || 'v1',
    documentation: '/api/docs',
    endpoints: {
      generate: 'POST /api/v1/generate',
      batch: 'POST /api/v1/batch/campaign',
      templates: 'GET /api/v1/templates/:id',
      personalize: 'POST /api/v1/personalize',
      preview: 'GET /api/v1/preview/:id'
    }
  });
});
