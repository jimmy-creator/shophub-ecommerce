import { Router } from 'express';
import {
  createOrder,
  createGuestOrder,
  trackGuestOrder,
  getMyOrders,
  getOrder,
  getAllOrders,
  updateOrderStatus,
} from '../controllers/orderController.js';
import { protect, admin } from '../middleware/auth.js';

const router = Router();

router.post('/', protect, createOrder);
router.post('/guest', createGuestOrder);
router.get('/track', trackGuestOrder);
router.get('/my-orders', protect, getMyOrders);
router.get('/all', protect, admin, getAllOrders);
router.get('/:id', protect, getOrder);
router.put('/:id/status', protect, admin, updateOrderStatus);

export default router;
