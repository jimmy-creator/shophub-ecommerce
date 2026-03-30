import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { protect, admin } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../../uploads');

const storage = multer.memoryStorage(); // Use memory for processing

const fileFilter = (req, file, cb) => {
  const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedMime.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpg, png, webp, gif) are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB input (will be compressed)
});

// Process and save image as optimized WebP
async function processImage(buffer, maxWidth = 1200) {
  const uniqueName = crypto.randomBytes(12).toString('hex');
  const filename = `${uniqueName}.webp`;
  const filepath = path.join(uploadsDir, filename);

  await sharp(buffer)
    .resize(maxWidth, null, { withoutEnlargement: true, fit: 'inside' })
    .webp({ quality: 80 })
    .toFile(filepath);

  return { url: `/uploads/${filename}`, filename };
}

const router = Router();

// Upload single image
router.post('/', protect, admin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    // Determine max width based on usage
    const maxWidth = req.body.type === 'hero' ? 1920 : req.body.type === 'category' ? 400 : 1200;
    const result = await processImage(req.file.buffer, maxWidth);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Image processing failed' });
  }
});

// Upload multiple images (up to 5)
router.post('/multiple', protect, admin, upload.array('images', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No image files provided' });
    }
    const results = [];
    for (const file of req.files) {
      const result = await processImage(file.buffer);
      results.push(result);
    }
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: 'Image processing failed' });
  }
});

export default router;
