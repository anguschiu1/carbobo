import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../db/index.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'

const router = Router()
const db = getDatabase()

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    // Check if user exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' })
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)
    const userId = uuidv4()

    const now = new Date().toISOString()
    db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
      userId,
      email,
      passwordHash,
      now
    )

    const jwtSecret = process.env.JWT_SECRET!
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d'
    const token = jwt.sign({ userId }, jwtSecret, { expiresIn } as jwt.SignOptions)

    res.status(201).json({
      token,
      user: {
        id: userId,
        email,
        created_at: now,
      },
    })
  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    // Find user
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as {
      id: string
      email: string
      password_hash: string
      created_at: string
    } | undefined

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash)
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Generate token
    const jwtSecret = process.env.JWT_SECRET!
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d'
    const token = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn } as jwt.SignOptions)

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get current user
router.get('/me', authenticateToken, (req: AuthRequest, res) => {
  try {
    const userId = req.userId
    const user = db.prepare('SELECT id, email, created_at FROM users WHERE id = ?').get(userId) as {
      id: string
      email: string
      created_at: string
    } | undefined

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({ user })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
