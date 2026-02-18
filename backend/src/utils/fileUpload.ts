import multer from 'multer'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'

const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads')

// Ensure upload directories exist
const healthScansDir = join(UPLOAD_DIR, 'health-scans')
const documentsDir = join(UPLOAD_DIR, 'documents')

if (!existsSync(healthScansDir)) {
  mkdirSync(healthScansDir, { recursive: true })
}
if (!existsSync(documentsDir)) {
  mkdirSync(documentsDir, { recursive: true })
}

// Storage configuration for health scans
const healthScanStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, healthScansDir)
  },
  filename: (req, file, cb) => {
    const ext = file.originalname.split('.').pop()
    cb(null, `health-scan-${uuidv4()}.${ext}`)
  },
})

// Storage configuration for documents
const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, documentsDir)
  },
  filename: (req, file, cb) => {
    const ext = file.originalname.split('.').pop()
    cb(null, `document-${uuidv4()}.${ext}`)
  },
})

// File filter - only images
const imageFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true)
  } else {
    cb(new Error('Only image files are allowed'))
  }
}

// File filter - images and PDFs
const documentFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    cb(null, true)
  } else {
    cb(new Error('Only image and PDF files are allowed'))
  }
}

export const uploadHealthScanPhotos = multer({
  storage: healthScanStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
})

export const uploadDocument = multer({
  storage: documentStorage,
  fileFilter: documentFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
})

export function getFileUrl(filename: string, type: 'health-scans' | 'documents'): string {
  return `/uploads/${type}/${filename}`
}
