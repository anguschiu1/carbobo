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

initDatabase()

app.use(helmet())
const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:5173'
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origin === frontendOrigin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      cb(null, true)
    } else {
      cb(null, false)
    }
  },
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/uploads', express.static('uploads'))

app.use('/api/auth', authRoutes)
app.use('/api/vehicles', vehiclesRoutes)
app.use('/api/vehicles', fuelRoutes)
app.use('/api/vehicles', healthScanRoutes)
app.use('/api/vehicles', documentRoutes)
app.use('/api/vehicles', reminderRoutes)
app.use('/api', reminderRoutes)
app.use('/api', fuelPricesRoutes)
app.use('/api', resalePackRoutes)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

export default app
