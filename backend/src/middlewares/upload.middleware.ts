import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { BadRequestError } from '../common/errors/app-error.js';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${cleanBase}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const allowedImageMimes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
  ];
  const allowedVideoMimes = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
  ];

  if (
    allowedImageMimes.includes(file.mimetype) ||
    allowedVideoMimes.includes(file.mimetype)
  ) {
    cb(null, true);
  } else {
    cb(
      new BadRequestError(
        `Unsupported file type: ${file.mimetype}. Allowed formats: JPEG, PNG, WEBP, GIF, SVG, MP4, WebM, QuickTime.`
      )
    );
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

export const uploadSingleMedia = upload.single('file');
