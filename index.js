'use strict';

const express = require('express');
const { MongoClient } = require('mongodb');
const { trace } = require('@opentelemetry/api');

const app = express();
const PORT = 3000;
const MONGO_URL = 'mongodb://localhost:27017';
const DB_NAME = 'todoapp';

const client = new MongoClient(MONGO_URL);
const tracer = trace.getTracer('todo-service');

async function seed(db) {
  const todos = db.collection('todos');
  await todos.deleteMany({});
  await todos.insertMany([
    { title: 'Read the OpenTelemetry docs', done: true },
    { title: 'Instrument the Express server', done: true },
    { title: 'View traces in Jaeger', done: false },
  ]);
}

app.get('/todo', async (req, res) => {
  const span = tracer.startSpan('get-todos');
  try {
    const todos = await client.db(DB_NAME).collection('todos').find({}).toArray();
    span.setAttribute('todo.count', todos.length);
    res.json(todos);
  } catch (err) {
    span.recordException(err);
    res.status(500).json({ error: err.message });
  } finally {
    span.end();
  }
});

async function startServer() {
  await client.connect();
  await seed(client.db(DB_NAME));
  app.listen(PORT, () => {
    console.log(`Todo service listening on http://localhost:${PORT}/todo`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
