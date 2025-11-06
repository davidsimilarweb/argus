import { Router } from 'express';
import * as slotsController from '../controllers/slots';
import * as healthController from '../controllers/health';

const router = Router();

// Health routes must be before generic :id route
router.post('/:slotNumber/health', healthController.postHealthBySlotNumber);

// Slot management
router.get('/', slotsController.listSlots);
router.get('/:id', slotsController.getSlotById);
router.post('/:id/assign-device', slotsController.assignDevice);
router.post('/:id/unassign-device', slotsController.unassignDevice);
router.patch('/:id', slotsController.updateSlot);
router.post('/:id/start', slotsController.startSlot);
router.post('/:id/stop', slotsController.stopSlot);

// Health history (slot id)
router.get('/:id/health-history', healthController.getHealthHistory);

export default router;
