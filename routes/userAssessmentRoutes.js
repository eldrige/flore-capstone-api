const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Get user assessment history
router.get('/history', async (req, res) => {
    const userId = req.query.userId;
    
    try {
      // Note: Changed $1 to ? for MySQL syntax
      const query = `
        SELECT 
          ua.id as user_assessment_id,
          ua.user_id,
          ua.assessment_id,
          ua.score,
          ua.completed_at,
          a.title,
          ar.id as report_id  /* Explicitly name this as report_id */
        FROM user_assessments ua
        JOIN assessments a ON ua.assessment_id = a.id
        LEFT JOIN assessment_reports ar ON ua.id = ar.user_assessment_id
        WHERE ua.user_id = ?
        ORDER BY ua.completed_at DESC
      `;
      
      const [results] = await pool.query(query, [userId]);
      
      // Log the results to see what we're getting
      console.log('Database results:', results);
      
      // Transform the data before sending
      const formattedResults = results.map(row => ({
        id: row.user_assessment_id,
        report_id: row.report_id, // This is what we'll use for the link
        title: row.title,
        completed_at: row.completed_at,
        score: row.score,
        passed: row.score >= 70
      }));
  
      console.log('Formatted results:', formattedResults);
      res.json(formattedResults);
    } catch (error) {
      console.error('Error fetching assessment history:', error);
      res.status(500).json({ message: 'Error fetching assessment history' });
    }
  });

router.get('/assessment-report/:id', async (req, res) => {
    const assessmentId = req.params.id;
    
    try {
      const query = `
        SELECT 
          ua.id,
          ua.user_id,
          ua.assessment_id,
          ua.score,
          ua.completed_at,
          a.title,
          a.description
        FROM user_assessments ua
        JOIN assessments a ON ua.assessment_id = a.id
        WHERE ua.id = ?
      `;
  
      const [result] = await pool.query(query, [assessmentId]);
      
      if (result.length === 0) {
        return res.status(404).json({ message: 'Assessment not found' });
      }
  
      // Format the data to match the frontend expectations
      const formattedData = {
        assessmentDetails: {
          title: result[0].title,
          completion_date: result[0].completed_at,
          score: result[0].score,
          passed: result[0].score >= 70, // Assuming 70 is passing score
          time_taken: "N/A" // Add if you have this data
        }
      };
  
      res.json(formattedData);
    } catch (error) {
      console.error('Error fetching assessment:', error);
      res.status(500).json({ message: 'Error fetching assessment' });
    }
  });

module.exports = router;