import { Hono } from 'hono';
import { generateToken, hashPassword, verifyPassword, generateUserId } from '../utils/auth';
import { nanoid } from 'nanoid';

interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  JWT_SECRET: string;
}

const router = new Hono<{ Bindings: Env }>();

// Register
router.post('/register', async (c) => {
  try {
    const { username, email, password, displayName } = await c.req.json();

    if (!username || !email || !password) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const db = c.env.DB;
    const userId = generateUserId();
    const passwordHash = await hashPassword(password);

    // Check if user exists
    const existing = await db
      .prepare('SELECT id FROM users WHERE username = ? OR email = ?')
      .bind(username, email)
      .first();

    if (existing) {
      return c.json({ error: 'User already exists' }, 409);
    }

    // Create user
    await db
      .prepare(`
        INSERT INTO users (id, username, email, password_hash, display_name)
        VALUES (?, ?, ?, ?, ?)
      `)
      .bind(userId, username, email, passwordHash, displayName || username)
      .run();

    const token = await generateToken(userId, c.env.JWT_SECRET);

    return c.json({
      user: { id: userId, username, email, displayName: displayName || username },
      token,
    }, 201);
  } catch (e) {
    console.error('Register error:', e);
    return c.json({ error: 'Registration failed' }, 500);
  }
});

// Login
router.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: 'Missing email or password' }, 400);
    }

    const db = c.env.DB;
    const user = await db
      .prepare('SELECT id, username, email, display_name, password_hash FROM users WHERE email = ?')
      .bind(email)
      .first();

    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const passwordValid = await verifyPassword(password, user.password_hash as string);
    if (!passwordValid) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const token = await generateToken(user.id as string, c.env.JWT_SECRET);

    // Update status
    await db
      .prepare('UPDATE users SET status = ? WHERE id = ?')
      .bind('online', user.id)
      .run();

    return c.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
      },
      token,
    });
  } catch (e) {
    console.error('Login error:', e);
    return c.json({ error: 'Login failed' }, 500);
  }
});

// Logout
router.post('/logout', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
      // Invalidate token (optional)
      const kv = c.env.SESSIONS;
      await kv.put(`blacklist_${token}`, '1', { expirationTtl: 86400 });
    }

    return c.json({ message: 'Logged out successfully' });
  } catch (e) {
    console.error('Logout error:', e);
    return c.json({ error: 'Logout failed' }, 500);
  }
});

// Verify token
router.get('/verify', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return c.json({ error: 'No token provided' }, 401);
    }

    const kv = c.env.SESSIONS;
    const blacklisted = await kv.get(`blacklist_${token}`);
    if (blacklisted) {
      return c.json({ error: 'Token revoked' }, 401);
    }

    // Verify token (implement token verification logic)
    return c.json({ valid: true });
  } catch (e) {
    return c.json({ error: 'Verification failed' }, 500);
  }
});

export default router;
