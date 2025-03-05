const request = require('supertest');
const app = require('../server'); // Adjust path if needed

describe('Route Tests', () => {
  it('should test the /api/test endpoint', async () => {
    const response = await request(app).get('/api/test');
    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('API is working');
  });
});
