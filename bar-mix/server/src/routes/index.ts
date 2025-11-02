import { Router } from 'express';
import { getApiData } from '../controllers/api';

const router = Router();

router.get('/api/data', getApiData);

export default router;