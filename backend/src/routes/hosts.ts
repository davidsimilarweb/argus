import { Router } from 'express';
import * as hostController from '../controllers/hosts';

const router = Router();

router.get('/', hostController.getAllHosts);
router.get('/:id', hostController.getHostById);
router.post('/', hostController.createHost);
router.patch('/:id', hostController.updateHost);
router.delete('/:id', hostController.deleteHost);
router.get('/:id/devices', hostController.getHostDevices);

export default router;