const mongoose = require('mongoose')

const TestSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  marks: { type: mongoose.Schema.Types.Mixed, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true })

module.exports = mongoose.model('Test', TestSchema)
