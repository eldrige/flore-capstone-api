const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Get questions by assessment ID
router.get('/assessments/:id/questions', async (req, res) => {
  const { id } = req.params;
  try {
    const [questions] = await db.execute(
      'SELECT id, question_text, type, options FROM questions WHERE assessment_id = ?',
      [id]
    );
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching questions' });
  }
});

module.exports = router;
