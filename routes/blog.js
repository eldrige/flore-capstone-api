const express = require('express');
const router = express.Router();
const connection = require('../config/db');

// Get all blog posts
router.get('/api/blog-posts', async (req, res) => {
  try {
    const [rows] = await connection.query('SELECT * FROM blog_posts ORDER BY date DESC');
    console.log('Blog posts fetched:', rows); // Add this for debugging
    res.json(rows);
  } catch (err) {
    console.error('Error fetching blog posts:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get blog posts by category
router.get('/api/blog-posts/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const [rows] = await connection.promise().query(
      'SELECT * FROM blog_posts WHERE category = ? ORDER BY date DESC',
      [category]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching blog posts by category:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get featured blog posts
router.get('/api/blog-posts/featured', async (req, res) => {
  try {
    const [rows] = await connection.promise().query(
      'SELECT * FROM blog_posts WHERE featured = TRUE ORDER BY date DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching featured blog posts:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Search blog posts
router.get('/api/blog-posts/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const searchTerm = `%${query}%`;
    const [rows] = await connection.promise().query(
      `SELECT * FROM blog_posts 
       WHERE title LIKE ? 
       OR excerpt LIKE ? 
       OR author LIKE ? 
       OR category LIKE ?
       ORDER BY date DESC`,
      [searchTerm, searchTerm, searchTerm, searchTerm]
    );
    
    res.json(rows);
  } catch (err) {
    console.error('Error searching blog posts:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// In your blog.js routes file
router.get('/api/blog-posts/:id', async (req, res) => {
  try {
    const [rows] = await connection.query(
      'SELECT * FROM blog_posts WHERE id = ?',
      [req.params.id]
    );

    if (rows.length === 0) {
      console.log('No blog post found with ID:', req.params.id);  // Log for debugging
      return res.status(404).json({ error: 'Blog post not found' });
    }

    res.json(rows[0]);  // Return the first result (post) as the response
  } catch (err) {
    console.error('Error fetching blog post:', err);  // Log the error for debugging
    res.status(500).json({ error: 'Server error' });
  }
});

// Subscribe to newsletter
router.post('/api/newsletter/subscribe', async (req, res) => {
  const { email } = req.body;

  // Check if the email is already subscribed
  try {
    const [existingEmail] = await connection.query('SELECT * FROM newsletter_subscribers WHERE email = ?', [email]);

    if (existingEmail.length > 0) {
      return res.status(409).json({ message: 'You are already subscribed!' });
    }

    // Add the new email to the newsletter subscribers table
    await connection.query('INSERT INTO newsletter_subscribers (email) VALUES (?)', [email]);

    res.status(200).json({ message: 'Subscription successful!' });
  } catch (err) {
    console.error('Error subscribing to newsletter:', err);
    res.status(500).json({ message: 'Subscription failed. Please try again later.' });
  }
});

module.exports = router;