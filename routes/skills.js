const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const auth = require('../middleware/auth'); // Assuming you have auth middleware

// Create a MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Get all skills with pagination and filtering
router.get('/api/all-skills', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const offset = (page - 1) * limit;
    const category = req.query.category;
    const search = req.query.search;

    let query = `
      SELECT 
        s.id,
        s.name,
        s.category,
        s.description,
        s.difficulty,
        COUNT(DISTINCT a.id) as assessment_count
      FROM all_skills s
      LEFT JOIN assessments a ON s.id = a.assessment_id
    `;

    const queryParams = [];

    // Add WHERE clauses for filtering
    const whereConditions = [];
    if (category && category !== 'All') {
      whereConditions.push('s.category = ?');
      queryParams.push(category);
    }
    if (search) {
      whereConditions.push('(s.name LIKE ? OR s.description LIKE ?)');
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }

    // Add GROUP BY, LIMIT and OFFSET
    query += `
      GROUP BY s.id
      ORDER BY s.name
      LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT s.id) as total
      FROM all_skills s
      ${whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''}
    `;

    const connection = await pool.getConnection();
    const [skills] = await connection.query(query, queryParams);
    const [countResult] = await connection.query(countQuery, queryParams.slice(0, -2));
    connection.release();

    const total = countResult[0].total;
    const hasMore = offset + skills.length < total;

    res.json({
      skills,
      total,
      hasMore,
      currentPage: page
    });

  } catch (error) {
    console.error('Error fetching skills:', error);
    res.status(500).json({ message: 'Error fetching skills' });
  }
});

// Get assessment history for a user
router.get('/api/assessment-history', auth, async (req, res) => {
  try {
    const userId = req.user.id; // From auth middleware

    const query = `
      SELECT 
        a.id,
        a.assessment_id,
        a.score,
        a.completion_date,
        s.name as skill_name,
        s.category
      FROM assessments a
      JOIN all_skills s ON a.assessment_id = s.id
      WHERE a.user_id = ?
      ORDER BY a.completion_date DESC
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

// Get recommended skills based on user's assessment history
router.get('/recommended-skills', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const offset = (page - 1) * limit;
    
    const connection = await pool.getConnection();
    
    // 1. Get user's low-scoring assessments (below 70)
    const [lowScoreAssessments] = await connection.query(`
      SELECT 
        ua.assessment_id, 
        ua.score, 
        s.name, 
        s.category, 
        s.description, 
        s.difficulty 
      FROM user_assessments ua
      JOIN all_skills s ON ua.assessment_id = s.id
      WHERE ua.user_id = ? AND ua.score < 70
      ORDER BY ua.score ASC, ua.completed_at DESC
    `, [userId]);
    
    console.log('Low Score Assessments:', lowScoreAssessments);
    
    // Format the low-score skills
    const lowScoreSkills = lowScoreAssessments.map(assessment => ({
      id: assessment.assessment_id,
      name: assessment.name,
      category: assessment.category,
      description: assessment.description,
      difficulty: assessment.difficulty,
      previous_score: assessment.score,
      needs_improvement: true
    }));
    
    // Calculate how many new skills we need to fetch
    const remainingSkillsNeeded = Math.max(0, limit - lowScoreSkills.length);
    
    let recommendedSkills = lowScoreSkills;
    
    // Only fetch new skills if we need more to reach the limit
    if (remainingSkillsNeeded > 0) {
      // 2. Get user's assessment history for category preferences
      const [assessments] = await connection.query(`
        SELECT ua.assessment_id, s.category, s.difficulty
        FROM user_assessments ua
        JOIN all_skills s ON ua.assessment_id = s.id
        WHERE ua.user_id = ?
        ORDER BY ua.completed_at DESC
      `, [userId]);
      
      // Get categories user has shown interest in
      const userCategories = [...new Set(assessments.map(a => a.category))];
      const categoriesForQuery = userCategories.length > 0 ? userCategories : ['Cognitive Skills']; // Default
      
      // Get IDs of all assessments the user has taken (to exclude them)
      const takenAssessmentIds = assessments.map(a => a.assessment_id);
      // Also exclude the low score skills we're already recommending
      const lowScoreIds = lowScoreSkills.map(s => s.id);
      const excludeIds = [...takenAssessmentIds, ...lowScoreIds];
      const excludeIdsPlaceholder = excludeIds.length > 0 ? excludeIds.map(() => '?').join(',') : '0';
      
      // Query for new recommended skills
      const newSkillsQuery = `
        SELECT 
          s.id,
          s.name,
          s.category,
          s.description,
          s.difficulty,
          COUNT(DISTINCT ua.id) AS popularity,
          COALESCE(AVG(ua.score), 0) AS avg_score
        FROM all_skills s
        LEFT JOIN user_assessments ua ON s.id = ua.assessment_id
        WHERE 
          s.id NOT IN (${excludeIdsPlaceholder})
          AND s.category IN (${categoriesForQuery.map(() => '?').join(',')})
        GROUP BY s.id
        ORDER BY
          CASE WHEN s.category IN (${categoriesForQuery.map(() => '?').join(',')}) THEN 1 ELSE 2 END,
          popularity DESC,
          avg_score ASC
        LIMIT ?
      `;
      
      // Combine all query parameters
      const queryParams = [
        ...excludeIds,
        ...categoriesForQuery,
        ...categoriesForQuery,
        remainingSkillsNeeded
      ];
      
      const [newSkills] = await connection.query(newSkillsQuery, queryParams);
      
      // Combine both sets of skills
      recommendedSkills = [
        ...lowScoreSkills,
        ...newSkills.map(skill => ({
          id: skill.id,
          name: skill.name,
          category: skill.category,
          description: skill.description,
          difficulty: skill.difficulty,
          popularity: skill.popularity,
          avg_score: skill.avg_score,
          is_new: true
        }))
      ];
    }
    
    // Apply pagination to the combined results
    const paginatedSkills = recommendedSkills.slice(offset, offset + limit);
    
    // Calculate total for pagination
    const total = recommendedSkills.length;
    const hasMore = offset + paginatedSkills.length < total;
    
    connection.release();
    
    res.json({
      skills: paginatedSkills,
      total,
      hasMore,
      currentPage: page
    });
    
  } catch (error) {
    console.error('Error fetching recommended skills:', error);
    res.status(500).json({ message: 'Error fetching recommended skills' });
  }
});

// Add this temporary route to check your database
router.get('/recommended-skills', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const offset = (page - 1) * limit;
    
    const connection = await pool.getConnection();
    
    // 1. Get user's low-scoring assessments (below 70)
    const [lowScoreAssessments] = await connection.query(`
      SELECT 
        ua.assessment_id, 
        ua.score, 
        s.name, 
        s.category, 
        s.description, 
        s.difficulty 
      FROM user_assessments ua
      JOIN all_skills s ON ua.assessment_id = s.id
      WHERE ua.user_id = ? AND ua.score < 70
      ORDER BY ua.score ASC, ua.completed_at DESC
    `, [userId]);
    
    console.log('Low Score Assessments:', lowScoreAssessments);
    
    // Format the low-score skills
    const lowScoreSkills = lowScoreAssessments.map(assessment => ({
      id: assessment.assessment_id,
      name: assessment.name,
      category: assessment.category,
      description: assessment.description,
      difficulty: assessment.difficulty,
      previous_score: assessment.score,
      needs_improvement: true
    }));
    
    // Calculate how many new skills we need to fetch
    const remainingSkillsNeeded = Math.max(0, limit - lowScoreSkills.length);
    
    let recommendedSkills = lowScoreSkills;
    
    // Only fetch new skills if we need more to reach the limit
    if (remainingSkillsNeeded > 0) {
      // 2. Get user's assessment history for category preferences
      const [assessments] = await connection.query(`
        SELECT ua.assessment_id, s.category, s.difficulty
        FROM user_assessments ua
        JOIN all_skills s ON ua.assessment_id = s.id
        WHERE ua.user_id = ?
        ORDER BY ua.completed_at DESC
      `, [userId]);
      
      // Get categories user has shown interest in
      const userCategories = [...new Set(assessments.map(a => a.category))];
      const categoriesForQuery = userCategories.length > 0 ? userCategories : ['Cognitive Skills']; // Default
      
      // Get IDs of all assessments the user has taken (to exclude them)
      const takenAssessmentIds = assessments.map(a => a.assessment_id);
      // Also exclude the low score skills we're already recommending
      const lowScoreIds = lowScoreSkills.map(s => s.id);
      const excludeIds = [...takenAssessmentIds, ...lowScoreIds];
      const excludeIdsPlaceholder = excludeIds.length > 0 ? excludeIds.map(() => '?').join(',') : '0';
      
      // Query for new recommended skills
      const newSkillsQuery = `
        SELECT 
          s.id,
          s.name,
          s.category,
          s.description,
          s.difficulty,
          COUNT(DISTINCT ua.id) AS popularity,
          COALESCE(AVG(ua.score), 0) AS avg_score
        FROM all_skills s
        LEFT JOIN user_assessments ua ON s.id = ua.assessment_id
        WHERE 
          s.id NOT IN (${excludeIdsPlaceholder})
          AND s.category IN (${categoriesForQuery.map(() => '?').join(',')})
        GROUP BY s.id
        ORDER BY
          CASE WHEN s.category IN (${categoriesForQuery.map(() => '?').join(',')}) THEN 1 ELSE 2 END,
          popularity DESC,
          avg_score ASC
        LIMIT ?
      `;
      
      // Combine all query parameters
      const queryParams = [
        ...excludeIds,
        ...categoriesForQuery,
        ...categoriesForQuery,
        remainingSkillsNeeded
      ];
      
      const [newSkills] = await connection.query(newSkillsQuery, queryParams);
      
      // Combine both sets of skills
      recommendedSkills = [
        ...lowScoreSkills,
        ...newSkills.map(skill => ({
          id: skill.id,
          name: skill.name,
          category: skill.category,
          description: skill.description,
          difficulty: skill.difficulty,
          popularity: skill.popularity,
          avg_score: skill.avg_score,
          is_new: true
        }))
      ];
    }
    
    // Apply pagination to the combined results
    const paginatedSkills = recommendedSkills.slice(offset, offset + limit);
    
    // Calculate total for pagination
    const total = recommendedSkills.length;
    const hasMore = offset + paginatedSkills.length < total;
    
    connection.release();
    
    res.json({
      skills: paginatedSkills,
      total,
      hasMore,
      currentPage: page
    });
    
  } catch (error) {
    console.error('Error fetching recommended skills:', error);
    res.status(500).json({ message: 'Error fetching recommended skills' });
  }
});

module.exports = router;