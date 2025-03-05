const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../server'); // Adjust path if needed

describe('Auth Middleware', () => {
  it('should pass if token is valid', async () => {
    const token = jwt.sign({ user: { id: 1 } }, process.env.JWT_SECRET); // Replace with a valid secret

    const response = await request(app)
      .get('/api/profile') // Assuming /api/profile uses this middleware
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).not.toBe(401);
  });

  it('should fail if no token is provided', async () => {
    const response = await request(app).get('/api/profile');

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('No token, authorization denied');
  });

  it('should fail if token is invalid', async () => {
    const response = await request(app)
      .get('/api/profile')
      .set('Authorization', 'Bearer invalidtoken');

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('Token is not valid');
  });
});
