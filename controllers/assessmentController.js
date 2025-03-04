const db = require("../config/db"); // Ensure db.js exports your database connection

// Controller to get all assessments
const getAllAssessments = async (req, res) => {
  try {
    const [assessments] = await db.query("SELECT * FROM assessments");

    // Always return a JSON response, even if empty
    res.json(assessments.length ? assessments : []);
  } catch (error) {
    console.error("Error fetching assessments:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = { getAllAssessments };
