// controllers/assessmentReportController.js

const pool = require('../config/db');

const generateAndStoreAssessmentReport = async (userAssessmentId) => {
    try {
      // First, fetch the assessment details
      const fetchAssessmentQuery = `
        SELECT 
          ua.id AS user_assessment_id,
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
  
      const [assessmentRows] = await pool.query(fetchAssessmentQuery, [userAssessmentId]);
      
      if (assessmentRows.length === 0) {
        throw new Error('Assessment not found');
      }
  
      const assessment = assessmentRows[0];
      const feedback = generateFeedback(assessment.score);
  
      // Insert into assessment_reports table
      const insertReportQuery = `
        INSERT INTO assessment_reports (
          user_assessment_id,
          user_id,
          assessment_id,
          score,
          completed_at,
          title,
          description,
          feedback
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
  
      const reportValues = [
        assessment.user_assessment_id,
        assessment.user_id,
        assessment.assessment_id,
        assessment.score,
        assessment.completed_at,
        assessment.title,
        assessment.description,
        feedback
      ];
  
      console.log('Inserting report with values:', reportValues);
  
      const [result] = await pool.query(insertReportQuery, reportValues);
  
      return {
        success: true,
        message: 'Assessment report generated successfully',
        reportId: result.insertId
      };
    } catch (error) {
      console.error('Error in generateAndStoreAssessmentReport:', error);
      throw error;
    }
  };
  
  // Helper function to generate feedback
  
  const generateFeedback = (score) => {
    if (score >= 8) return "Excellent performance! Keep up the great work.";
    if (score >= 5) return "Good job! You can improve with more practice.";
    return "Needs improvement. Consider reviewing the material again.";
  };
  
module.exports = { generateAndStoreAssessmentReport };
