import express from 'express';
import { getWalletInfo, getTransactions } from '../controllers/walletController.js';

const router = express.Router();

router.get('/:userId', getWalletInfo);
router.get('/transactions/:userId', getTransactions);

export default router;
