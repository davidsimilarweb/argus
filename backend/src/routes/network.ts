import { Router } from 'express';
import * as networkController from '../controllers/network';

const router = Router();

router.get('/reservations', networkController.listReservations);
router.post('/reservations', networkController.createReservation);
router.patch('/reservations/:id', networkController.updateReservation);
router.delete('/reservations/:id', networkController.deleteReservation);
router.get('/reservations/summary', networkController.getSummary);

export default router;
