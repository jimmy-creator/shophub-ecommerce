import { Router } from 'express';
import { Setting } from '../models/index.js';
import { protect, admin, requirePermission } from '../middleware/auth.js';

const router = Router();

// Get theme (public — all visitors need the active theme)
router.get('/theme', async (req, res) => {
  try {
    const setting = await Setting.findByPk('theme');
    res.json({ theme: setting?.value || 'default' });
  } catch (error) {
    res.json({ theme: 'default' });
  }
});

// Update theme (admin only)
router.put('/theme', protect, admin, async (req, res) => {
  try {
    const { theme } = req.body;
    const allowed = ['default', 'midnight', 'minimal', 'forest', 'royal', 'marketplace'];
    if (!allowed.includes(theme)) {
      return res.status(400).json({ message: 'Invalid theme' });
    }

    await Setting.upsert({ key: 'theme', value: theme });
    res.json({ theme });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
