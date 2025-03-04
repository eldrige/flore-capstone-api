// middleware/auth.js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // Get token from header
  const authHeader = req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

  // Check if no token
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    // Verify token
    const secret = process.env.JWT_SECRET || 'your_jwt_secret';
    console.log("Using secret:", secret.substring(0, 3) + "...");
    
    const decoded = jwt.verify(token, secret);
    console.log("Token verified successfully for user:", decoded.id || decoded.userId);
    
    // Attach user to request object
    req.user = {
      id: decoded.id || decoded.userId
    };
    
    next();
  } catch (err) {
    console.error("Token verification failed:", err.message);
    res.status(401).json({ message: 'Token is not valid' });
  }
};