import { Hono } from 'hono';

interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  JWT_SECRET: string;
}

const router = new Hono<{ Bindings: Env }>();

// Get current user
router.get('/me', async (c) => {
  try {
    const userId = c.req.header('X-User-Id');
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    const db = c.env.DB;
    const user = await db
      .prepare(`
        SELECT id, username, email, display_name, avatar_url, status
        FROM users WHERE id = ?
      `)
      .bind(userId)
      .first();

    if (!user) return c.json({ error: 'User not found' }, 404);

    return c.json(user);
  } catch (e) {
    console.error('Get current user error:', e);
    return c.json({ error: 'Failed to fetch user' }, 500);
  }
});

// Get user by ID
router.get('/:userId', async (c) => {
  try {
    const { userId } = c.req.param();
    const db = c.env.DB;

    const user = await db
      .prepare(`
        SELECT id, username, email, display_name, avatar_url, status
        FROM users WHERE id = ?
      `)
      .bind(userId)
      .first();

    if (!user) return c.json({ error: 'User not found' }, 404);

    return c.json(user);
  } catch (e) {
    console.error('Get user error:', e);
    return c.json({ error: 'Failed to fetch user' }, 500);
  }
});

// Search users
router.get('', async (c) => {
  try {
    const query = c.req.query('q') || '';
    
    if (query.length < 2) {
      return c.json({ error: 'Query too short' }, 400);
    }

    const db = c.env.DB;
    const results = await db
      .prepare(`
        SELECT id, username, display_name, avatar_url, status
        FROM users
        WHERE username LIKE ? OR display_name LIKE ?
        LIMIT 20
      `)
      .bind(`%${query}%`, `%${query}%`)
      .all();

    return c.json(results.results || []);
  } catch (e) {
    console.error('Search users error:', e);
    return c.json({ error: 'Search failed' }, 500);
  }
});

// Update profile
router.put('/me', async (c) => {
  try {
    const userId = c.req.header('X-User-Id');
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    const { displayName, avatarUrl, status } = await c.req.json();
    const db = c.env.DB;

    const updates: string[] = [];
    const values: any[] = [];

    if (displayName) {
      updates.push('display_name = ?');
      values.push(displayName);
    }
    if (avatarUrl) {
      updates.push('avatar_url = ?');
      values.push(avatarUrl);
    }
    if (status) {
      updates.push('status = ?');
      values.push(status);
    }

    if (updates.length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    await db
      .prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    return c.json({ success: true });
  } catch (e) {
    console.error('Update profile error:', e);
    return c.json({ error: 'Failed to update profile' }, 500);
  }
});

export default router;
