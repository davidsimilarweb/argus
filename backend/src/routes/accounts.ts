import { Router } from 'express';
import * as accountController from '../controllers/accounts';

const router = Router();

router.get('/', accountController.getAllAccounts);
router.get('/:id', accountController.getAccountById);
router.post('/', accountController.createAccount);
router.patch('/:id', accountController.updateAccount);
router.delete('/:id', accountController.deleteAccount);

export default router;