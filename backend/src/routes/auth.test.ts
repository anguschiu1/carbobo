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
    expect(res.body.user).not.toHaveProperty('password_hash')
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

  it('should return 200 and allow GET /api/auth/me after register', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'persist@example.com', password: 'mypassword' })
      .expect(201)

    const token = registerRes.body.token as string
    expect(token).toBeTruthy()

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(meRes.body.user.email).toBe('persist@example.com')
  })

  it('should return 200 and valid token when login is called after register', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'logintest@example.com', password: 'mypassword' })
      .expect(201)

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'logintest@example.com', password: 'mypassword' })
      .expect(200)

    expect(loginRes.body.token).toBeTruthy()
    expect(typeof loginRes.body.token).toBe('string')
    expect(loginRes.body.user.email).toBe('logintest@example.com')
  })

  it('should not expose password_hash on the user object returned by register', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'nohash@example.com', password: 'mypassword' })
      .expect(201)

    expect(res.body.user).not.toHaveProperty('password_hash')
  })
})

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    const db = getDatabase()
    db.prepare('DELETE FROM users').run()
  })

  it('should return 200, non-empty token, and user without password_hash when credentials are correct', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'loginok@example.com', password: 'correct-pass' })
      .expect(201)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'loginok@example.com', password: 'correct-pass' })
      .expect(200)

    expect(typeof res.body.token).toBe('string')
    expect(res.body.token.length).toBeGreaterThan(0)
    expect(res.body.user.email).toBe('loginok@example.com')
    expect(res.body.user).not.toHaveProperty('password_hash')
  })

  it('should return 401 when password is wrong', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'badpass@example.com', password: 'correct-pass' })
      .expect(201)

    await request(app)
      .post('/api/auth/login')
      .send({ email: 'badpass@example.com', password: 'wrong-pass' })
      .expect(401)
  })

  it('should return 401 when email is not registered', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'any-pass' })
      .expect(401)
  })
})

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    const db = getDatabase()
    db.prepare('DELETE FROM users').run()
  })

  it('should return 401 when no Authorization header is provided', async () => {
    await request(app)
      .get('/api/auth/me')
      .expect(401)
  })

  it('should return 403 when a malformed token is provided', async () => {
    await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer this.is.not.a.valid.jwt')
      .expect(403)
  })
})
