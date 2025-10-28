import { Router } from 'express';
import { generateRouter } from './generate';
import { batchRouter } from './batch';
import { templatesRouter } from './templates';
import { personalizeRouter } from './personalize';
import { mlCompatibleRouter } from './mlCompatible';
import { useCasesRouter } from './useCases';
import { analyticsRouter } from './analytics';
import { templateInspirationRouter } from './templateInspiration';

export const v1Router = Router();

// Standard endpoints
v1Router.use('/generate', generateRouter);
v1Router.use('/batch', batchRouter);
v1Router.use('/templates', templatesRouter);
v1Router.use('/personalize', personalizeRouter);

// Third-party compatible endpoints
v1Router.use('/ml-compatible', mlCompatibleRouter);
v1Router.use('/action-tree', mlCompatibleRouter); // Reuse ML compatible logic
v1Router.use('/node', mlCompatibleRouter);

// Use-case specific endpoints
v1Router.use('/use-cases', useCasesRouter);

// Analytics endpoints
v1Router.use('/analytics', analyticsRouter);

// Template inspiration (RAG) endpoints
v1Router.use('/template-inspiration', templateInspirationRouter);

// Version info
v1Router.get('/', (_req, res) => {
  res.json({
    version: 'v1',
    status: 'active',
    endpoints: [
      'POST /generate',
      'POST /batch/campaign',
      'GET /templates/:id',
      'POST /personalize',
      'GET /preview/:id',
      'POST /ml-compatible/generate-amp-content',
      'POST /use-cases/abandoned-cart/campaign',
      'GET /analytics/campaign/:id',
      'GET /template-inspiration/stats',
      'GET /template-inspiration/health',
      'POST /template-inspiration/search'
    ]
  });
});
