const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database setup
const db = new sqlite3.Database(':memory:');

// Initialize database tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT,
    bio TEXT,
    avatar TEXT DEFAULT 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=400',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Posts table
  db.run(`CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Likes table
  db.run(`CREATE TABLE likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (post_id) REFERENCES posts (id),
    UNIQUE(user_id, post_id)
  )`);

  // Comments table
  db.run(`CREATE TABLE comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (post_id) REFERENCES posts (id)
  )`);

  // Follows table
  db.run(`CREATE TABLE follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    follower_id INTEGER NOT NULL,
    following_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (follower_id) REFERENCES users (id),
    FOREIGN KEY (following_id) REFERENCES users (id),
    UNIQUE(follower_id, following_id)
  )`);

  // Insert sample data
  const sampleUsers = [
    ['john_doe', 'john@example.com', bcrypt.hashSync('password123', 10), 'John Doe', 'Software developer passionate about technology', 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=400'],
    ['jane_smith', 'jane@example.com', bcrypt.hashSync('password123', 10), 'Jane Smith', 'Designer and coffee enthusiast', 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=400'],
    ['mike_wilson', 'mike@example.com', bcrypt.hashSync('password123', 10), 'Mike Wilson', 'Travel blogger and photographer', 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=400']
  ];

  sampleUsers.forEach(user => {
    db.run('INSERT INTO users (username, email, password, full_name, bio, avatar) VALUES (?, ?, ?, ?, ?, ?)', user);
  });

  // Sample posts
  const samplePosts = [
    [1, 'Just finished working on an amazing project! #coding #javascript', 'https://images.pexels.com/photos/1181472/pexels-photo-1181472.jpeg?auto=compress&cs=tinysrgb&w=800'],
    [2, 'Beautiful sunset today! Sometimes you need to stop and appreciate the little things.', 'https://images.pexels.com/photos/158163/clouds-cloudporn-weather-lookup-158163.jpeg?auto=compress&cs=tinysrgb&w=800'],
    [3, 'Exploring the mountains this weekend. Nature never fails to inspire me!', 'https://images.pexels.com/photos/417074/pexels-photo-417074.jpeg?auto=compress&cs=tinysrgb&w=800'],
    [1, 'Learning something new every day keeps the mind sharp. What did you learn today?', null],
    [2, 'Great coffee and good company make the perfect morning!', 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=800']
  ];

  samplePosts.forEach(post => {
    db.run('INSERT INTO posts (user_id, content, image_url) VALUES (?, ?, ?)', post);
  });
});

// Authentication middleware
const authenticate = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid token.' });
  }
};

// API Routes

// User registration
app.post('/api/register', async (req, res) => {
  const { username, email, password, fullName, bio } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  db.run(
    'INSERT INTO users (username, email, password, full_name, bio) VALUES (?, ?, ?, ?, ?)',
    [username, email, hashedPassword, fullName || '', bio || ''],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Username or email already exists' });
        }
        return res.status(500).json({ error: err.message });
      }

      const token = jwt.sign({ userId: this.lastID, username }, JWT_SECRET);
      res.json({ 
        token, 
        user: { 
          id: this.lastID, 
          username, 
          email, 
          full_name: fullName || '', 
          bio: bio || '' 
        } 
      });
    }
  );
});

// User login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET);
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email, 
        full_name: user.full_name, 
        bio: user.bio,
        avatar: user.avatar 
      } 
    });
  });
});

// Get current user
app.get('/api/me', authenticate, (req, res) => {
  db.get('SELECT id, username, email, full_name, bio, avatar FROM users WHERE id = ?', [req.user.userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(user);
  });
});

// Get all posts for feed
app.get('/api/posts', authenticate, (req, res) => {
  const query = `
    SELECT 
      p.id, p.content, p.image_url, p.created_at,
      u.username, u.full_name, u.avatar,
      COUNT(DISTINCT l.id) as like_count,
      COUNT(DISTINCT c.id) as comment_count,
      EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND post_id = p.id) as is_liked
    FROM posts p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN likes l ON p.id = l.post_id
    LEFT JOIN comments c ON p.id = c.post_id
    GROUP BY p.id, u.id
    ORDER BY p.created_at DESC
  `;

  db.all(query, [req.user.userId], (err, posts) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(posts);
  });
});

// Create a new post
app.post('/api/posts', authenticate, (req, res) => {
  const { content, imageUrl } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }

  db.run(
    'INSERT INTO posts (user_id, content, image_url) VALUES (?, ?, ?)',
    [req.user.userId, content, imageUrl],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID, content, image_url: imageUrl });
    }
  );
});

// Like/unlike a post
app.post('/api/posts/:id/like', authenticate, (req, res) => {
  const postId = req.params.id;

  // Check if already liked
  db.get('SELECT * FROM likes WHERE user_id = ? AND post_id = ?', [req.user.userId, postId], (err, existingLike) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (existingLike) {
      // Unlike
      db.run('DELETE FROM likes WHERE user_id = ? AND post_id = ?', [req.user.userId, postId], (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ liked: false });
      });
    } else {
      // Like
      db.run('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [req.user.userId, postId], (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ liked: true });
      });
    }
  });
});

// Get comments for a post
app.get('/api/posts/:id/comments', authenticate, (req, res) => {
  const query = `
    SELECT 
      c.id, c.content, c.created_at,
      u.username, u.full_name, u.avatar
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `;

  db.all(query, [req.params.id], (err, comments) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(comments);
  });
});

// Add a comment to a post
app.post('/api/posts/:id/comments', authenticate, (req, res) => {
  const { content } = req.body;
  const postId = req.params.id;

  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }

  db.run(
    'INSERT INTO comments (user_id, post_id, content) VALUES (?, ?, ?)',
    [req.user.userId, postId, content],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID, content });
    }
  );
});

// Get user profile
app.get('/api/users/:username', authenticate, (req, res) => {
  const query = `
    SELECT 
      u.id, u.username, u.full_name, u.bio, u.avatar,
      COUNT(DISTINCT p.id) as post_count,
      COUNT(DISTINCT f1.id) as followers_count,
      COUNT(DISTINCT f2.id) as following_count,
      EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id) as is_following
    FROM users u
    LEFT JOIN posts p ON u.id = p.user_id
    LEFT JOIN follows f1 ON u.id = f1.following_id
    LEFT JOIN follows f2 ON u.id = f2.follower_id
    WHERE u.username = ?
    GROUP BY u.id
  `;

  db.get(query, [req.user.userId, req.params.username], (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  });
});

// Follow/unfollow a user
app.post('/api/users/:id/follow', authenticate, (req, res) => {
  const userId = req.params.id;

  if (userId == req.user.userId) {
    return res.status(400).json({ error: 'Cannot follow yourself' });
  }

  // Check if already following
  db.get('SELECT * FROM follows WHERE follower_id = ? AND following_id = ?', [req.user.userId, userId], (err, existingFollow) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (existingFollow) {
      // Unfollow
      db.run('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [req.user.userId, userId], (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ following: false });
      });
    } else {
      // Follow
      db.run('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)', [req.user.userId, userId], (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ following: true });
      });
    }
  });
});

// Search users
app.get('/api/search/users', authenticate, (req, res) => {
  const { q } = req.query;
  
  if (!q) {
    return res.json([]);
  }

  db.all(
    'SELECT id, username, full_name, avatar FROM users WHERE username LIKE ? OR full_name LIKE ? LIMIT 10',
    [`%${q}%`, `%${q}%`],
    (err, users) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(users);
    }
  );
});

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Handle client-side routing - serve index.html for all non-API routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});