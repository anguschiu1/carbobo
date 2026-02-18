import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import { initDatabase } from './db/index.js'
import authRoutes from './routes/auth.js'
import vehiclesRoutes from './routes/vehicles.js'
import fuelRoutes from './routes/fuel.js'
import healthScanRoutes from './routes/healthScans.js'
import documentRoutes from './routes/documents.js'
import reminderRoutes from './routes/reminders.js'
import fuelPricesRoutes from './routes/fuelPrices.js'
import resalePackRoutes from './routes/resalePack.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Initialize database
initDatabase()

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Serve uploaded files
app.use('/uploads', express.static('uploads'))

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/vehicles', vehiclesRoutes)
app.use('/api/vehicles', fuelRoutes)
app.use('/api/vehicles', healthScanRoutes)
app.use('/api/vehicles', documentRoutes)
app.use('/api/vehicles', reminderRoutes) // Vehicle-specific reminder routes
app.use('/api', reminderRoutes) // General reminder routes (/api/reminders/*)
app.use('/api', fuelPricesRoutes)
app.use('/api', resalePackRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
