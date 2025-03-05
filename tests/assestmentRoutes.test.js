const request = require('supertest');
const app = require('../server');
const connection = require('../config/db'); // Import your database connection

describe('Assessment Routes', () => {
  // Mock the database query function
  jest.mock('../config/db', () => ({
    promise: () => ({
      query: jest.fn(),
    }),
  }));

  it('should GET /api/assessments and return assessments', async () => {
    // Mock the database response
    connection
      .promise()
      .query.mockResolvedValueOnce([[{ id: 1, name: 'Test Assessment' }]]);

    const response = await request(app).get('/api/assessments');
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([{ id: 1, name: 'Test Assessment' }]);
  });

  // Test the POST /api/assessments/:assessmentId/submit route
  it('should POST /api/assessments/:assessmentId/submit and return success', async () => {
    const assessmentId = 1;
    const userId = 1;
    const score = 80;
    const total = 100;

    // Mock the database query and insertId
    connection.promise().query.mockResolvedValueOnce([{ insertId: 123 }]);

    const response = await request(app)
      .post(`/api/assessments/${assessmentId}/submit`)
      .send({ userId, score, total });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'Assessment submitted successfully',
      assessmentId: assessmentId,
      score: score,
      total: total,
      id: 123,
    });
  });
});
