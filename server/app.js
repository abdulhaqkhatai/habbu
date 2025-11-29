require('dotenv').config()
const express = require('express')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')
const cors = require('cors')

const authRoutes = require('./routes/auth')
const testsRoutes = require('./routes/tests')
const User = require('./models/User')
const bcrypt = require('bcryptjs')

const app = express()
app.use(cors())
app.use(express.json())

const MONGO_URI = process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/marksdb'
const CLIENT_URL = process.env.CLIENT_URL || process.env.CLIENT_ORIGIN || '*'

function redactUri(uri){
  if(!uri) return 'none'
  try{
    // remove credentials from uri for safe logging
    return uri.replace(/:\/\/.+?:.+?@/, '://<REDACTED>@')
  }catch(e){ return uri }
}

async function connectDB() {
  if(!process.env.MONGO_URL && !process.env.MONGO_URI){
    console.warn('MONGO_URL not set — will attempt local/default or in-memory fallback')
  }

  const maxAttempts = 3
  let attempt = 0
  while(attempt < maxAttempts){
    attempt++
    try {
      console.log(`Attempt ${attempt}/${maxAttempts} to connect to MongoDB: ${redactUri(MONGO_URI)}`)
      await mongoose.connect(MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000
      })
      console.log('MongoDB connected')
      return true
    } catch (err) {
      console.warn(`MongoDB connect attempt ${attempt} failed: ${err && err.message ? err.message : err}`)
      if(attempt < maxAttempts){
        const waitMs = 1000 * attempt
        console.log(`Waiting ${waitMs}ms then retrying...`)
        await new Promise(r=>setTimeout(r, waitMs))
        continue
      }
      console.log('Atlas connection failed after retries, falling back to in-memory MongoDB...')
    try {
      const mongod = await MongoMemoryServer.create()
      const uri = mongod.getUri()
      await mongoose.connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      })
      console.log('Connected to in-memory MongoDB (for local development)')
      return true
    } catch (err2) {
      console.error('MongoDB connection error during in-memory startup:')
      console.error(err2 && err2.stack ? err2.stack : err2)
      return false
    }
  }
}

async function seedUsersIfNeeded() {
  try {
    const count = await User.countDocuments()
    if (count === 0) {
      const pass1 = await bcrypt.hash('ahkk', 10)
      const pass2 = await bcrypt.hash('habbu', 10)
      await User.create({ username: 'admin', password: pass1, role: 'teacher' })
      await User.create({ username: 'student', password: pass2, role: 'student' })
      console.log('Seeded default users: admin/student')
    }
  } catch (err) {
    console.error('User seed error', err)
  }
}

async function start() {
  const ok = await connectDB()
  if (!ok) {
    throw new Error('Could not connect to any MongoDB instance')
  }

  // Register routes after DB is ready
  // allow CORS from CLIENT_URL (set this to your Vercel app or allow all during dev)
  app.use(cors({ origin: CLIENT_URL }))

  app.use('/api/auth', authRoutes)
  app.use('/api/tests', testsRoutes)
  app.get('/', (req, res) => res.send({ ok: true }))

  await seedUsersIfNeeded()

  return app
}

module.exports = { app, start }
