import { Router } from 'express';
import { User } from '../models/index.js';
import { protect, admin } from '../middleware/auth.js';
import { Op } from 'sequelize';
import bcrypt from 'bcryptjs';

const router = Router();

const AVAILABLE_PERMISSIONS = [
  { id: 'products', label: 'Products', desc: 'Create, edit, delete products' },
  { id: 'orders', label: 'Orders', desc: 'View and manage orders' },
  { id: 'coupons', label: 'Coupons', desc: 'Manage discount codes' },
  { id: 'reviews', label: 'Reviews', desc: 'Moderate reviews' },
  { id: 'customers', label: 'Customers', desc: 'View customer data' },
  { id: 'analytics', label: 'Analytics', desc: 'View dashboard and reports' },
  { id: 'categories', label: 'Categories', desc: 'Manage categories' },
  { id: 'settings', label: 'Settings', desc: 'Theme and store settings' },
];

// Get available permissions list
router.get('/permissions', protect, admin, (req, res) => {
  res.json(AVAILABLE_PERMISSIONS);
});

// List all staff members
router.get('/', protect, admin, async (req, res) => {
  try {
    // Only super admin (role=admin) can manage staff
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admin can manage staff' });
    }

    const staff = await User.findAll({
      where: { role: { [Op.in]: ['admin', 'staff'] } },
      attributes: ['id', 'name', 'email', 'phone', 'role', 'permissions', 'createdAt'],
      order: [['role', 'ASC'], ['createdAt', 'DESC']],
    });

    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create staff account
router.post('/', protect, admin, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admin can create staff' });
    }

    const { name, email, password, permissions } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const existing = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: 'staff',
      permissions: permissions || [],
    });

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update staff permissions
router.put('/:id', protect, admin, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admin can update staff' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Can't modify the main admin
    if (user.role === 'admin' && user.id !== req.user.id) {
      return res.status(403).json({ message: 'Cannot modify another admin' });
    }

    const { name, permissions, password } = req.body;
    const updates = {};
    if (name) updates.name = name.trim();
    if (permissions) updates.permissions = permissions;
    if (password && password.length >= 8) updates.password = password;

    await user.update(updates);
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete staff account
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admin can delete staff' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Cannot delete admin account' });
    }

    if (user.role !== 'staff') {
      return res.status(400).json({ message: 'Can only delete staff accounts' });
    }

    await user.destroy();
    res.json({ message: 'Staff account deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
