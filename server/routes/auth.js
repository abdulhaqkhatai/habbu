const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/User')

const JWT_SECRET = process.env.JWT_SECRET || 'change-me'

// Sign up
router.post('/signup', async (req, res) => {
  try {
    const { username, password, role } = req.body
    if (!username || !password || !role) return res.status(400).json({ error: 'username,password,role required' })
    const exists = await User.findOne({ username })
    if (exists) return res.status(409).json({ error: 'username exists' })
    const hash = await bcrypt.hash(password, 10)
    const user = await User.create({ username, password: hash, role })
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '30d' })
    res.json({ token, user: { id: user._id, username: user.username, role: user.role } })
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' })
  }
})

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) return res.status(400).json({ error: 'username,password required' })
    const user = await User.findOne({ username })
    if (!user) return res.status(401).json({ error: 'invalid credentials' })
    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return res.status(401).json({ error: 'invalid credentials' })
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '30d' })
    res.json({ token, user: { id: user._id, username: user.username, role: user.role } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server error' })
  }
})

module.exports = router
