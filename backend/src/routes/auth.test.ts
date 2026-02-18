import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../app.js'
import { getDatabase } from '../db/index.js'

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    const db = getDatabase()
    db.prepare('DELETE FROM users').run()
  })

  it('returns 201 and token + user when registration succeeds', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'secret123' })
      .expect(201)

    expect(res.body).toHaveProperty('token')
    expect(typeof res.body.token).toBe('string')
    expect(res.body.token.length).toBeGreaterThan(0)

    expect(res.body).toHaveProperty('user')
    expect(res.body.user).toMatchObject({
      email: 'test@example.com',
    })
    expect(res.body.user).toHaveProperty('id')
    expect(res.body.user).toHaveProperty('created_at')
    expect(typeof res.body.user.id).toBe('string')
    expect(typeof res.body.user.created_at).toBe('string')
  })

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ password: 'secret123' })
      .expect(400)

    expect(res.body).toHaveProperty('error')
    expect(res.body.error).toMatch(/email|required/i)
  })

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com' })
      .expect(400)

    expect(res.body).toHaveProperty('error')
    expect(res.body.error).toMatch(/password|required/i)
  })

  it('returns 400 when body is empty', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({})
      .expect(400)

    expect(res.body).toHaveProperty('error')
  })

  it('returns 400 when user already exists', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@example.com', password: 'secret123' })
      .expect(201)

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@example.com', password: 'other456' })
      .expect(400)

    expect(res.body.error).toMatch(/already exists/i)
  })

  it('persists user in database and login works after register', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'persist@example.com', password: 'mypassword' })
      .expect(201)

    const token = registerRes.body.token
    expect(token).toBeTruthy()

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(meRes.body.user.email).toBe('persist@example.com')

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'persist@example.com', password: 'mypassword' })
      .expect(200)

    expect(loginRes.body.token).toBeTruthy()
    expect(loginRes.body.user.email).toBe('persist@example.com')
  })
})
