const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/UserModel');
const jwtSecret = process.env.JWT_SECRET;
const connection = require('../config/db');
require('dotenv').config();

const router = express.Router();

// Register Route
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existingUser = await User.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.createUser(name, email, hashedPassword);

    res.status(201).json({ message: 'User registered successfully',
      token,
      user: {
        id: userId,
        name,
        email
      }
     });
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


// Login Route
router.post('/login', async (req, res) => {
  console.log('Login attempt with:', req.body);
  const { email, password } = req.body;

  try {
      const user = await User.findUserByEmail(email);
      console.log('User from database:', user);

      if (!user) {
          return res.status(401).json({ message: "Invalid credentials" });
      }

      console.log('About to compare:');
      console.log('Plain password:', password);
      console.log('Stored hash:', user.password);
      
      const isMatch = await bcrypt.compare(password, user.password);
      console.log('Password match result:', isMatch);

      if (!isMatch) {
          return res.status(401).json({ message: "Invalid credentials" });
      }

      if (!jwtSecret) {
        return res.status(500).json({ message: 'Server error: JWT_SECRET is not defined' });
      }

      // Create the token
      const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, jwtSecret, { expiresIn: '1h' });

      //send the token
      res.json({
        message: "Login successful",
        token: token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      });

  } catch (error) {
      console.error("Error during login:", error);
      res.status(500).json({ message: "Server error" });
  }
});

// Protected Route Example
router.get('/profile', verifyToken, async (req, res) => {
    try {
        const user = await User.findUserByEmail(req.user.email);
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// Middleware for verifying JWT token
function verifyToken(req, res, next) {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ message: 'Access Denied' });

  try {
    const verified = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    res.status(400).json({ message: 'Invalid Token' });
  }
}

module.exports = router;
