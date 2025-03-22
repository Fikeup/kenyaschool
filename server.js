require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

const app = express();
const port = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MySQL Connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
    } else {
        console.log('Connected to MySQL database');
    }
});

// Nodemailer Configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});

// Routes

// Register a new student
app.post('/api/students/register', (req, res) => {
    const { fullName, email, password, phone, zone, woreda, school, grade } = req.body;

    // Validate input
    if (!fullName || !email || !password || !phone || !zone || !woreda || !school || !grade) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    // Password validation
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Hash password
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            console.error('Error hashing password:', err);
            return res.status(500).json({ error: 'Failed to register student' });
        }

        // Insert student into the database
        const query = `
            INSERT INTO students (full_name, email, password, phone, zone, woreda, school, grade)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        db.query(query, [fullName, email, hash, phone, zone, woreda, school, grade], (err, result) => {
            if (err) {
                console.error('Error registering student:', err);
                return res.status(500).json({ error: 'Failed to register student', details: err.message });
            }

            // Send welcome email
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Welcome to Kegna School!',
                text: `Hello ${fullName},\n\nWelcome to Kegna School! You have been successfully registered for Grade ${grade}.\n\nBest regards,\nKegna School Team`,
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Error sending welcome email:', error);
                    return res.status(500).json({ error: 'Failed to send welcome email', details: error.message });
                }
                console.log('Welcome email sent:', info.response);
                res.status(201).json({ message: 'Student registered successfully. A welcome email has been sent.' });
            });
        });
    });
});

// Handle contact form submission
app.post('/api/contact', (req, res) => {
    const { name, email, message } = req.body;

    // Validate input
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    const query = 'INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)';
    db.query(query, [name, email, message], (err, result) => {
        if (err) {
            console.error('Error saving contact message:', err);
            res.status(500).json({ error: 'Failed to save message' });
        } else {
            res.status(201).json({ message: 'Message sent successfully' });
        }
    });
});

// Handle sign-up form submission
app.post('/api/signup', (req, res) => {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Basic password validation (e.g., minimum length)
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const query = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
    db.query(query, [name, email, password], (err, result) => {
        if (err) {
            console.error('Error signing up user:', err);
            res.status(500).json({ error: 'Failed to sign up user' });
        } else {
            res.status(201).json({ message: 'Sign up successful' });
        }
    });
});

// Lesson creation
app.post('/api/lessons', (req, res) => {
    const { unitId, title, type, videoUrl, readingUrl } = req.body;

    // Validate input
    if (!unitId || !title || !type) {
        return res.status(400).json({ error: 'Unit ID, title, and type are required' });
    }

    const query = 'INSERT INTO lessons (unit_id, title, type, video_url, reading_url) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [unitId, title, type, videoUrl, readingUrl], (err, result) => {
        if (err) {
            console.error('Error adding lesson:', err);
            res.status(500).json({ error: 'Failed to add lesson' });
        } else {
            res.status(201).json({ message: 'Lesson added successfully', lessonId: result.insertId });
        }
    });
});

// Get courses by grade
app.get('/api/courses/:grade', (req, res) => {
    const grade = req.params.grade;

    const query = 'SELECT * FROM courses WHERE grade = ?';
    db.query(query, [grade], (err, results) => {
        if (err) {
            console.error('Error fetching courses:', err);
            res.status(500).json({ error: 'Failed to fetch courses' });
        } else {
            res.status(200).json(results);
        }
    });
});

// Get units for a course
app.get('/api/courses/:courseId/units', (req, res) => {
    const courseId = req.params.courseId;

    const query = 'SELECT * FROM units WHERE course_id = ?';
    db.query(query, [courseId], (err, results) => {
        if (err) {
            console.error('Error fetching units:', err);
            res.status(500).json({ error: 'Failed to fetch units' });
        } else {
            res.status(200).json(results);
        }
    });
});

// Get lessons for a unit
app.get('/api/units/:unitId/lessons', (req, res) => {
    const unitId = req.params.unitId;

    const query = 'SELECT * FROM lessons WHERE unit_id = ?';
    db.query(query, [unitId], (err, results) => {
        if (err) {
            console.error('Error fetching lessons:', err);
            res.status(500).json({ error: 'Failed to fetch lessons' });
        } else {
            res.status(200).json(results);
        }
    });
});

// Mark lesson as completed
app.post('/api/students/progress', (req, res) => {
    const { studentId, lessonId } = req.body;

    const query = 'INSERT INTO student_progress (student_id, lesson_id) VALUES (?, ?)';
    db.query(query, [studentId, lessonId], (err, result) => {
        if (err) {
            console.error('Error saving progress:', err);
            res.status(500).json({ error: 'Failed to save progress' });
        } else {
            res.status(201).json({ message: 'Progress saved successfully' });
        }
    });
});

// Check if a student can take quizzes for a course
app.get('/api/students/:studentId/can-take-quiz/:courseId', (req, res) => {
    const { studentId, courseId } = req.params;

    const query = `
        SELECT COUNT(*) AS completed_lessons
        FROM student_progress sp
        JOIN lessons l ON sp.lesson_id = l.id
        JOIN units u ON l.unit_id = u.id
        WHERE sp.student_id = ? AND u.course_id = ?
    `;
    db.query(query, [studentId, courseId], (err, results) => {
        if (err) {
            console.error('Error checking quiz access:', err);
            res.status(500).json({ error: 'Failed to check quiz access' });
        } else {
            const completedLessons = results[0].completed_lessons;
            const canTakeQuiz = completedLessons > 0; // Adjust logic as needed
            res.status(200).json({ canTakeQuiz });
        }
    });
});

// Get quizzes by course
app.get('/api/quizzes/:courseId', (req, res) => {
    const courseId = req.params.courseId;

    const query = 'SELECT * FROM quizzes WHERE course_id = ?';
    db.query(query, [courseId], (err, results) => {
        if (err) {
            console.error('Error fetching quizzes:', err);
            res.status(500).json({ error: 'Failed to fetch quizzes' });
        } else {
            res.status(200).json(results);
        }
    });
});

// Get quiz for a lesson
app.get('/api/lessons/:lessonId/quiz', (req, res) => {
    const lessonId = req.params.lessonId;

    const query = 'SELECT * FROM quizzes WHERE lesson_id = ?';
    db.query(query, [lessonId], (err, results) => {
        if (err) {
            console.error('Error fetching quiz:', err);
            res.status(500).json({ error: 'Failed to fetch quiz' });
        } else if (results.length === 0) {
            res.status(404).json({ message: 'No quiz available for this lesson' });
        } else {
            res.status(200).json(results[0]); // Return the first quiz (assuming one quiz per lesson)
        }
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});