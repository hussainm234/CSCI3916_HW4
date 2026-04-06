require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const authJwtController = require('./auth_jwt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const User = require('./Users');
const Movie = require('./Movies');
const Review = require('./Reviews'); 
const rp = require('request-promise');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

const router = express.Router();

const GA_TRACKING_ID = process.env.GA_KEY;
const GA_SECRET = process.env.GA_SECRET;

function trackDimension(category, action, label, value, dimension, metric) {
  var options = {
    method: 'POST',
    url: `https://www.google-analytics.com/mp/collect?measurement_id=${GA_TRACKING_ID}&api_secret=${GA_SECRET}`,
    body: JSON.stringify({
      client_id: crypto.randomBytes(16).toString("hex"),
      events: [{
        name: 'movie_review',
        params: {
          event_category: category,   // Genre of movie (e.g. Western)
          event_action: action,       // URL path (e.g. post /reviews)
          event_label: label,         // API Request for Movie Review
          value: value,               // 1
          cd1: dimension,             // Custom Dimension: Movie Name
          cm1: metric                 // Custom Metric: 1
        }
      }]
    }),
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  };
  return rp(options);
}

router.post('/signup', async (req, res) => {
  if (!req.body.username || !req.body.password) {
    return res.status(400).json({ success: false, msg: 'Please include both username and password to signup.' });
  }

  try {
    const user = new User({
      name: req.body.name,
      username: req.body.username,
      password: req.body.password,
    });

    await user.save();
    res.status(201).json({ success: true, msg: 'Successfully created new user.' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'A user with that username already exists.' });
    } else {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' });
    }
  }
});

// SIGNIN
router.post('/signin', function(req, res) {
  var userNew = new User();
  userNew.username = req.body.username;
  userNew.password = req.body.password;

  User.findOne({ username: userNew.username }).select('name username password').exec(function(err, user) {
    if (err) return res.send(err);
    if (!user) return res.status(401).send({ success: false, msg: 'Authentication failed. User not found.' });

    user.comparePassword(userNew.password, function(isMatch) {
      if (isMatch) {
        var userToken = { id: user.id, username: user.username };
        var token = jwt.sign(userToken, process.env.SECRET_KEY);
        res.json({ success: true, token: 'JWT ' + token });
      } else {
        res.status(401).send({ success: false, msg: 'Authentication failed.' });
      }
    });
  });
});

// MOVIES ROUTES
router.route('/movies')
  .get(authJwtController.isAuthenticated, async (req, res) => {
    try {
      const movies = await Movie.find();
      res.status(200).json({ success: true, movies });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Error retrieving movies.' });
    }
  })
  .post(authJwtController.isAuthenticated, async (req, res) => {
    const { title, releaseDate, genre, actors } = req.body;

    if (!title || !releaseDate || !genre || !actors || actors.length === 0) {
      return res.status(400).json({ success: false, message: 'Please include title, releaseDate, genre, and at least one actor.' });
    }

    try {
      const movie = new Movie({ title, releaseDate, genre, actors });
      await movie.save();
      res.status(201).json({ success: true, message: 'Movie created successfully.', movie });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Error saving movie.' });
    }
  })
  .put(authJwtController.isAuthenticated, (req, res) => {
    res.status(405).json({ success: false, message: 'PUT not supported on /movies. Use /movies/:title instead.' });
  })
  .delete(authJwtController.isAuthenticated, (req, res) => {
    res.status(405).json({ success: false, message: 'DELETE not supported on /movies. Use /movies/:title instead.' });
  });

// GET MOVIE BY TITLE — with optional ?reviews=true
router.route('/movies/:title')
  .get(authJwtController.isAuthenticated, async (req, res) => {
    try {
      if (req.query.reviews === 'true') {
        const result = await Movie.aggregate([
          { $match: { title: req.params.title } },
          {
            $lookup: {
              from: 'reviews',
              localField: '_id',
              foreignField: 'movieId',
              as: 'reviews'
            }
          }
        ]);

        if (!result || result.length === 0) {
          return res.status(404).json({ success: false, message: 'Movie not found.' });
        }

        return res.status(200).json({ success: true, movie: result[0] });
      }

      // No reviews param
      const movie = await Movie.findOne({ title: req.params.title });
      if (!movie) return res.status(404).json({ success: false, message: 'Movie not found.' });
      res.status(200).json({ success: true, movie });

    } catch (err) {
      res.status(500).json({ success: false, message: 'Error retrieving movie.' });
    }
  })
  .put(authJwtController.isAuthenticated, async (req, res) => {
    try {
      const updatedMovie = await Movie.findOneAndUpdate(
        { title: req.params.title },
        req.body,
        { new: true, runValidators: true }
      );
      if (!updatedMovie) return res.status(404).json({ success: false, message: 'Movie not found.' });
      res.status(200).json({ success: true, message: 'Movie updated successfully.', movie: updatedMovie });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Error updating movie.' });
    }
  })
  .delete(authJwtController.isAuthenticated, async (req, res) => {
    try {
      const deletedMovie = await Movie.findOneAndDelete({ title: req.params.title });
      if (!deletedMovie) return res.status(404).json({ success: false, message: 'Movie not found.' });
      res.status(200).json({ success: true, message: 'Movie deleted successfully.' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Error deleting movie.' });
    }
  });

// REVIEWS ROUTES
router.route('/reviews')
  .get(authJwtController.isAuthenticated, async (req, res) => {
    try {
      const reviews = await Review.find();
      res.status(200).json({ success: true, reviews });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Error retrieving reviews.' });
    }
  })
  .post(authJwtController.isAuthenticated, async (req, res) => {
    const { movieId, username, review, rating } = req.body;

    if (!movieId || !username || !review || rating === undefined) {
      return res.status(400).json({ success: false, message: 'Please include movieId, username, review, and rating.' });
    }

    try {
      // Verify the movie exists before saving the review
      const movie = await Movie.findById(movieId);
      if (!movie) {
        return res.status(404).json({ success: false, message: 'Movie not found.' });
      }

      const newReview = new Review({ movieId, username, review, rating });
      await newReview.save();

      // Fire GA analytics event — fire-and-forget so GA failure won't break the API
      trackDimension(
        movie.genre,                    // Event Category: genre of movie
        'post /reviews',                // Event Action: URL path
        'API Request for Movie Review', // Event Label
        '1',                            // Event Value
        movie.title,                    // Custom Dimension: movie name
        '1'                             // Custom Metric: 1
      ).catch(err => console.error('GA tracking error:', err));

      res.status(201).json({ message: 'Review created!' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Error saving review.' });
    }
  })
  .delete(authJwtController.isAuthenticated, async (req, res) => {
    const { movieId } = req.body;

    if (!movieId) {
      return res.status(400).json({ success: false, message: 'Please include movieId to delete a review.' });
    }

    try {
      const deletedReview = await Review.findOneAndDelete({ movieId });
      if (!deletedReview) {
        return res.status(404).json({ success: false, message: 'Review not found.' });
      }
      res.status(200).json({ success: true, message: 'Review deleted successfully.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Error deleting review.' });
    }
  });

app.use('/', router);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app; // for testing only