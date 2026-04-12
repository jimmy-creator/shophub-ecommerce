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

// Get hero image (public)
router.get('/hero-image', async (req, res) => {
  try {
    const setting = await Setting.findByPk('hero-image');
    res.json({ value: setting?.value || null });
  } catch (error) {
    res.json({ value: null });
  }
});

// Update hero image (admin only)
router.put('/hero-image', protect, admin, async (req, res) => {
  try {
    const { value } = req.body;
    if (!value) return res.status(400).json({ message: 'Image URL is required' });
    await Setting.upsert({ key: 'hero-image', value });
    res.json({ value });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get banners (public)
router.get('/banners', async (req, res) => {
  try {
    const setting = await Setting.findByPk('banners');
    const banners = setting?.value ? JSON.parse(setting.value) : [];
    res.json(banners);
  } catch (error) {
    res.json([]);
  }
});

// Update banners (admin only) — max 5
router.put('/banners', protect, admin, async (req, res) => {
  try {
    const { banners } = req.body;
    if (!Array.isArray(banners) || banners.length > 5) {
      return res.status(400).json({ message: 'Provide an array of up to 5 banners' });
    }
    await Setting.upsert({ key: 'banners', value: JSON.stringify(banners) });
    res.json(banners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
