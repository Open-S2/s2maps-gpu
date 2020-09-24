const express = require('express')
const cors = require('cors');
const app = express()
app.use(cors())
const port = 6000

app.get('/main.js', (req, res) => {
  console.log('HERE', req)
  res.set({ 'content-encoding': 'gzip' })
  res.sendfile('./buildS2/main.js.gz')
})
app.get('/main.js.gz', (req, res) => {
  res.set({ 'content-encoding': 'gzip' })
  res.sendfile('./buildS2/main.js.gz')
})

app.get('/0.chunk.worker.js', (req, res) => {
  res.set({ 'content-encoding': 'gzip' })
  res.sendfile('./buildS2/0.chunk.worker.js.gz')
})
app.get('/0.chunk.worker.js.gz', (req, res) => {
  res.set({ 'content-encoding': 'gzip' })
  res.sendfile('./buildS2/0.chunk.worker.js.gz')
})

app.get('/1.chunk.worker.js', (req, res) => {
  res.set({ 'content-encoding': 'gzip' })
  res.sendfile('./buildS2/1.chunk.worker.js.gz')
})
app.get('/1.chunk.worker.js.gz', (req, res) => {
  res.set({ 'content-encoding': 'gzip' })
  res.sendfile('./buildS2/1.chunk.worker.js.gz')
})

app.get('/2.chunk.js', (req, res) => {
  res.set({ 'content-encoding': 'gzip' })
  res.sendfile('./buildS2/2.chunk.js.gz')
})
app.get('/2.chunk.js.gz', (req, res) => {
  res.set({ 'content-encoding': 'gzip' })
  res.sendfile('./buildS2/2.chunk.js.gz')
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
