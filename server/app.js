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

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/marksdb'

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    })
    console.log('MongoDB connected')
    return true
  } catch (err) {
    console.log('Atlas connection failed, falling back to in-memory MongoDB...')
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
      console.error('MongoDB connection error:')
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
  app.use('/api/auth', authRoutes)
  app.use('/api/tests', testsRoutes)
  app.get('/', (req, res) => res.send({ ok: true }))

  await seedUsersIfNeeded()

  return app
}

module.exports = { app, start }
