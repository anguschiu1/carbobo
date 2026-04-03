import { join } from 'path'
import { tmpdir } from 'os'

// Use in-memory DB and temp uploads so tests don't touch real data
process.env.DB_PATH = ':memory:'
process.env.UPLOAD_DIR = join(tmpdir(), 'carbobo-test-uploads')
process.env.JWT_SECRET = 'test-secret-for-vitest-only'
