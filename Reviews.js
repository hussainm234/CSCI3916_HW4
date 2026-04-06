var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var express = require('express');
var router = express.Router();
var authJwtController = require('./auth_jwt');
var Movie = require('./Movies');

// Review Schema
var ReviewSchema = new Schema({
  movieId: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true },
  username: { type: String, required: true },
  review: { type: String, required: true },
  rating: { type: Number, min: 0, max: 5, required: true }
});

var Review = mongoose.model('Review', ReviewSchema);

// POST /reviews — JWT protected
router.route('/reviews')
  .post(authJwtController.isAuthenticated, async (req, res) => {
    try {
      const { movieId, username, review, rating } = req.body;

      // Check movie exists
      const movie = await Movie.findById(movieId);
      if (!movie) return res.status(404).json({ success: false, message: 'Movie not found.' });

      const newReview = new Review({ movieId, username, review, rating });
      await newReview.save();

      res.status(201).json({ message: 'Review created!' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

module.exports = { Review, router };