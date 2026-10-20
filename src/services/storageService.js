import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { config } from '../config/index.js';

/**
 * Storage Service for Multi-Tenant Sports SaaS
 * Implements tenant isolation format:
 *   storage/academies/{academy_id}/{YYYY-MM-DD}/{entity_type}_{entity_id}_{timestamp}.{ext}
 * Example:
 *   storage/academies/1/2026-10-20/academy_logo_1_1729420000000.png
 */
export class StorageService {
  /**
   * Resolves and ensures the daily storage directory for a specific academy
   * @param {number|string} academyId 
   * @param {string|null} dateStr Optional YYYY-MM-DD, defaults to current UTC date
   * @returns {{ fullPath: string, relativePath: string, dateStr: string }}
   */
  static getAcademyStorageDir(academyId, dateStr = null) {
    if (!academyId) {
      throw new Error('Academy ID is required for tenant-scoped file storage');
    }

    const today = dateStr || new Date().toISOString().slice(0, 10);
    const fullPath = path.join(config.storageDir, 'academies', String(academyId), today);

    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }

    const relativePath = `/storage/academies/${academyId}/${today}`;
    return { fullPath, relativePath, dateStr: today };
  }

  /**
   * Sanitizes and normalizes a file extension
   */
  static cleanExtension(filename, mimeType) {
    let ext = path.extname(filename).toLowerCase().replace(/^\./, '');
    if (!ext) {
      if (mimeType === 'image/jpeg') ext = 'jpg';
      else if (mimeType === 'image/png') ext = 'png';
      else if (mimeType === 'image/webp') ext = 'webp';
      else if (mimeType === 'image/svg+xml') ext = 'svg';
      else if (mimeType === 'application/pdf') ext = 'pdf';
      else ext = 'bin';
    }
    return ext;
  }

  /**
   * Deletes all files and folders belonging to an academy
   * Used for Super Admin tenant purge / truncate operations
   */
  static deleteAcademyStorage(academyId) {
    if (!academyId) return;

    // 1. Delete standard tenant directory: storage/academies/{id}
    const tenantDir = path.join(config.storageDir, 'academies', String(academyId));
    if (fs.existsSync(tenantDir)) {
      try {
        fs.rmSync(tenantDir, { recursive: true, force: true });
      } catch (e) {
        console.warn(`Could not remove tenant directory ${tenantDir}:`, e.message);
      }
    }

    // 2. Delete legacy directory if present: storage/uploads/academy_{id}
    const legacyDir = path.join(config.uploadsDir, `academy_${academyId}`);
    if (fs.existsSync(legacyDir)) {
      try {
        fs.rmSync(legacyDir, { recursive: true, force: true });
      } catch (e) {
        console.warn(`Could not remove legacy directory ${legacyDir}:`, e.message);
      }
    }
  }

  /**
   * Returns a configured Multer instance for Academy Logo uploads
   */
  static getLogoUploadMiddleware() {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        try {
          const academyId = (req.academy && req.academy.id) || req.params.academyId || 1;
          const { fullPath } = StorageService.getAcademyStorageDir(academyId);
          cb(null, fullPath);
        } catch (err) {
          cb(err);
        }
      },
      filename: (req, file, cb) => {
        const academyId = (req.academy && req.academy.id) || req.params.academyId || 1;
        const ext = StorageService.cleanExtension(file.originalname, file.mimetype);
        const timestamp = Date.now();
        // File naming format: academy_logo_{academyId}_{timestamp}.{ext}
        const filename = `academy_logo_${academyId}_${timestamp}.${ext}`;
        cb(null, filename);
      }
    });

    const fileFilter = (req, file, cb) => {
      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid image format. Supported formats: PNG, JPG, WEBP, SVG'), false);
      }
    };

    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
      }
    });
  }
}
