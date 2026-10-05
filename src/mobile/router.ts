import { Router } from 'express';
import { createMobileApi, MobileApiOptions, toErrorResponse } from './api';

export function createMobileRouter(options: MobileApiOptions): Router {
  const router = Router();
  const api = createMobileApi(options);
  router.use((_req, res, next) => {
    // Location and personal clothing preferences should not enter shared caches.
    res.setHeader('Cache-Control', 'private, no-store');
    next();
  });
  router.get('/outfit', async (req, res) => {
    try {
      res.json(await api.outfit(req.query));
    } catch (error) {
      const result = toErrorResponse(error);
      res.status(result.status).json(result.body);
    }
  });
  router.get('/locations', async (req, res) => {
    try {
      res.json(await api.locations(req.query));
    } catch (error) {
      const result = toErrorResponse(error);
      res.status(result.status).json(result.body);
    }
  });
  return router;
}
