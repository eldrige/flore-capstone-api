const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  difficulty: { 
    type: String, 
    enum: ['Beginner', 'Intermediate', 'Advanced'], 
    required: true 
  },
  prerequisites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Skill' }],
  relatedSkills: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Skill' }],
  assessmentCount: { type: Number, default: 0 },
  averageScore: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const Skill = mongoose.model('Skill', skillSchema);