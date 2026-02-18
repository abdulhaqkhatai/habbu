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

const PORT = process.env.PORT || 5000
const MONGO_URI = process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/marksdb'

async function connectDB() {
  try {
    // First try Atlas connection
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000 // fail fast if Atlas not reachable
    })
    console.log('MongoDB Atlas connected')
    return true
  } catch (err) {
    console.log('Atlas connection failed, falling back to in-memory MongoDB...')
    try {
      // Start in-memory MongoDB
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

const { start: startApp } = require('./app')

if (require.main === module) {
  // running directly -> start server and listen (local dev)
  startApp()
    .then(appInstance => {
      appInstance.listen(PORT, () => console.log(`Server running on port ${PORT}`))
    })
    .catch(err => {
      console.error('Failed to start server:', err)
      process.exit(1)
    })
}
