const express = require('express');
const router = express.Router();
const Assessment = require('../models/AssessmentModel');
const pool = require('../config/db');
const { getAllAssessments } = require("../controllers/assessmentController");
const { generateAndStoreAssessmentReport } = require('../controllers/assessmentReportController');

// 1. GET /api/assessments/all - Returns all available assessments

router.get("/all", getAllAssessments);
  
  // Create a new assessment
router.post('/create', async (req, res) => {
    const { title, description } = req.body;
    try {
        const assessmentId = await Assessment.createAssessment(title, description);
        res.json({ message: "Assessment created successfully", assessmentId });
    } catch (error) {
        console.error("Error creating assessment:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Get all assessments
router.get('/all', async (req, res) => {
    try {
        const assessments = await Assessment.getAllAssessments();
        res.json(assessments);
    } catch (error) {
        console.error("Error fetching assessments:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Get questions for an assessment
router.get('/:id/questions', async (req, res) => {
    const { id } = req.params;
    try {
        const questions = await Assessment.getQuestionsByAssessmentId(id);
        res.json(questions);
    } catch (error) {
        console.error("Error fetching questions:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Add a question to an assessment
router.post('/:id/add-question', async (req, res) => {
    const { id } = req.params;
    const { question_text, correct_answer, options } = req.body;

    try {
        const questionId = await Assessment.addQuestion(id, question_text, correct_answer, options);
        res.json({ message: "Question added successfully", questionId });
    } catch (error) {
        console.error("Error adding question:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Get user assessment history
router.get('/api/user-assessment-history', async (req, res) => {
    try {
      const userId = req.user.id; // Assuming auth middleware adds user info
      
      const query = `
        SELECT 
          ua.id,
          ua.user_id,
          ua.assessment_id,
          ua.score,
          ua.completed_at,
          a.title
        FROM user_assessments ua
        LEFT JOIN assessments a ON ua.assessment_id = a.id
        WHERE ua.user_id = ?
        ORDER BY ua.completed_at DESC
      `;
  
      const connection = await pool.getConnection();
      const [assessments] = await connection.query(query, [userId]);
      connection.release();
  
      res.json(assessments);
    } catch (error) {
      console.error('Error fetching assessment history:', error);
      res.status(500).json({ message: 'Error fetching assessment history' });
    }
  });

router.post('/:assessmentId/submit', async (req, res) => {
    const { assessmentId } = req.params;
    const { userId, score } = req.body;
    const completedAt = new Date();
  
    try {
      // Step 1: Insert assessment result
      const insertAssessmentQuery = `
        INSERT INTO user_assessments (user_id, assessment_id, score, completed_at) 
        VALUES (?, ?, ?, ?)
      `;
  
      const [results] = await pool.query(insertAssessmentQuery, [userId, assessmentId, score, completedAt]);
      const userAssessmentId = results.insertId;
  
      // Step 2: Generate and store report
      const reportResult = await generateAndStoreAssessmentReport(userAssessmentId);
  
      res.json({
        success: true,
        message: 'Assessment submitted and report generated successfully',
        assessmentId,
        score,
        userAssessmentId,
        reportId: reportResult.reportId
      });
  
    } catch (error) {
      console.error('Error in assessment submission:', error);
      res.status(500).json({ error: 'Failed to submit assessment and generate report' });
    }
});

module.exports = router;
