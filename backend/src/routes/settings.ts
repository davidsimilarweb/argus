import { Router } from 'express';
import {
  getAllSettings,
  getSettingByKey,
  upsertSetting,
  batchUpdateSettings,
  deleteSetting,
} from '../controllers/settings';

const router = Router();

router.get('/', getAllSettings);
router.get('/:key', getSettingByKey);
router.post('/', upsertSetting);
router.post('/batch', batchUpdateSettings);
router.delete('/:key', deleteSetting);

export default router;
