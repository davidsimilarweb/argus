import { Router } from 'express';
import * as deviceController from '../controllers/devices';

const router = Router();

router.get('/', deviceController.getAllDevices);
router.get('/:id', deviceController.getDeviceById);
router.post('/', deviceController.createDevice);
router.patch('/:id', deviceController.updateDevice);
router.delete('/:id', deviceController.deleteDevice);
router.get('/:id/history', deviceController.getDeviceHistory);
router.post('/:id/assign-account', deviceController.assignAccount);
router.post('/:id/unassign-account', deviceController.unassignAccount);
router.post('/:id/assign-host', deviceController.assignHost);
router.post('/:id/unassign-host', deviceController.unassignHost);
router.post('/:id/change-status', deviceController.changeStatus);
router.post('/:id/maintenance', deviceController.addMaintenanceEvent);

export default router;