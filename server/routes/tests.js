const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const Test = require('../models/Test')

const JWT_SECRET = process.env.JWT_SECRET || 'change-me'

function verifyToken(req, res, next) {
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ error: 'no token' })
  const parts = auth.split(' ')
  if (parts.length !== 2) return res.status(401).json({ error: 'invalid auth header' })
  const token = parts[1]
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = payload
    next()
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' })
  }
}

// Get all tests
router.get('/', verifyToken, async (req, res) => {
  try {
    const tests = await Test.find().sort({ date: -1 })
    res.json(tests)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server error' })
  }
})

// Create test (teacher only)
router.post('/', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'forbidden' })
    const { date, marks } = req.body
    if (!date || !marks) return res.status(400).json({ error: 'date and marks required' })
    const t = await Test.create({ date: new Date(date), marks, createdBy: req.user.id })
    res.json(t)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server error' })
  }
})

// Update test (teacher only)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'forbidden' })
    const { id } = req.params
    const { marks, date } = req.body
    const t = await Test.findById(id)
    if (!t) return res.status(404).json({ error: 'not found' })
    if (marks) t.marks = marks
    if (date) t.date = new Date(date)
    await t.save()
    res.json(t)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server error' })
  }
})

// Delete (teacher only)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'forbidden' })
    const { id } = req.params
    await Test.findByIdAndDelete(id)
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server error' })
  }
})

module.exports = router
