const serverless = require('serverless-http')
const { app, start } = require('../server/app')

let handler

async function ensureHandler() {
  if (!handler) {
    await start()
    handler = serverless(app)
  }
  return handler
}

module.exports = async (req, res) => {
  try {
    const h = await ensureHandler()
    return h(req, res)
  } catch (err) {
    console.error('API handler error', err)
    res.statusCode = 500
    res.end('Internal Server Error')
  }
}
