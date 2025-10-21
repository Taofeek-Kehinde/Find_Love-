const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));

// MongoDB connection with error handling
async function connectDB() {
    try {
        await mongoose.connect('mongodb://localhost:27017/FindLove');
        console.log('✅ Connected to MongoDB FindLove database');
    } catch (error) {
        console.log('❌ MongoDB connection failed, using in-memory storage');
        console.log('Error:', error.message);
    }
}

// Simple User Schema
const userSchema = new mongoose.Schema({
    fullName: String,
    email: String,
    password: String,
    dateOfBirth: String,
    gender: String,
    profileCompleted: { type: Boolean, default: false },
    interests: String,
    location: String,
    bio: String,
    profilePic: String,
    coverPic: String,
    createdAt: { type: Date, default: Date.now }
}, { strict: false });

const User = mongoose.model('User', userSchema);

// In-memory storage as fallback
let inMemoryUsers = [];
let userIdCounter = 1;

// Helper function to save user
async function saveUser(userData) {
    try {
        if (mongoose.connection.readyState === 1) {
            // MongoDB is connected
            const user = new User(userData);
            const savedUser = await user.save();
            return {
                id: savedUser._id,
                ...savedUser.toObject()
            };
        } else {
            // Use in-memory storage
            const user = {
                id: userIdCounter++,
                ...userData,
                _id: userIdCounter
            };
            inMemoryUsers.push(user);
            return user;
        }
    } catch (error) {
        console.error('Error saving user:', error);
        // Fallback to in-memory
        const user = {
            id: userIdCounter++,
            ...userData,
            _id: userIdCounter
        };
        inMemoryUsers.push(user);
        return user;
    }
}

// Helper function to find user
async function findUser(query) {
    try {
        if (mongoose.connection.readyState === 1) {
            return await User.findOne(query);
        } else {
            // Search in-memory
            return inMemoryUsers.find(user => {
                if (query.email) return user.email === query.email;
                if (query._id) return user._id == query._id;
                if (query.id) return user.id == query.id;
                return false;
            });
        }
    } catch (error) {
        console.error('Error finding user:', error);
        return inMemoryUsers.find(user => {
            if (query.email) return user.email === query.email;
            if (query._id) return user._id == query._id;
            if (query.id) return user.id == query.id;
            return false;
        });
    }
}

// Helper function to update user
async function updateUser(query, updateData) {
    try {
        if (mongoose.connection.readyState === 1) {
            return await User.findOneAndUpdate(query, updateData, { new: true });
        } else {
            // Update in-memory
            const userIndex = inMemoryUsers.findIndex(user => {
                if (query.email) return user.email === query.email;
                if (query._id) return user._id == query._id;
                if (query.id) return user.id == query.id;
                return false;
            });
            
            if (userIndex !== -1) {
                inMemoryUsers[userIndex] = { ...inMemoryUsers[userIndex], ...updateData };
                return inMemoryUsers[userIndex];
            }
            return null;
        }
    } catch (error) {
        console.error('Error updating user:', error);
        return null;
    }
}

// Routes
app.get('/', (req, res) => {
    res.json({ 
        message: 'FindLove API Server is running!', 
        database: mongoose.connection.readyState === 1 ? 'MongoDB Connected' : 'In-Memory Storage',
        timestamp: new Date().toISOString()
    });
});

// Signup route
app.post('/api/signup', async (req, res) => {
    try {
        const { fullName, email, password, dateOfBirth, gender } = req.body;
        
        console.log('=== SIGNUP REQUEST ===');
        console.log('Data:', { fullName, email, dateOfBirth, gender });
        
        // Check if user exists
        const existingUser = await findUser({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }
        
        // Create user
        const userData = {
            fullName,
            email,
            password,
            dateOfBirth,
            gender,
            profileCompleted: false,
            createdAt: new Date()
        };
        
        const savedUser = await saveUser(userData);
        
        console.log('✅ User created:', savedUser.fullName);
        
        res.json({
            success: true,
            message: 'User created successfully',
            user: {
                id: savedUser.id || savedUser._id,
                fullName: savedUser.fullName,
                email: savedUser.email,
                dateOfBirth: savedUser.dateOfBirth,
                gender: savedUser.gender,
                profileCompleted: savedUser.profileCompleted
            }
        });
        
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating user: ' + error.message
        });
    }
});

// Login route
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log('=== LOGIN REQUEST ===');
        console.log('Email:', email);
        
        const user = await findUser({ email });
        
        if (!user || user.password !== password) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }
        
        console.log('✅ Login successful:', user.fullName);
        
        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user.id || user._id,
                fullName: user.fullName,
                email: user.email,
                dateOfBirth: user.dateOfBirth,
                gender: user.gender,
                profileCompleted: user.profileCompleted,
                interests: user.interests,
                location: user.location,
                bio: user.bio,
                profilePic: user.profilePic,
                coverPic: user.coverPic
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Error during login: ' + error.message
        });
    }
});

// Complete profile route
app.post('/api/complete-profile', async (req, res) => {
    try {
        const { userId, profilePic, coverPic, location, interests, bio } = req.body;
        
        console.log('=== COMPLETE PROFILE REQUEST ===');
        console.log('User ID:', userId);
        console.log('Location:', location);
        console.log('Interests:', interests);
        console.log('Bio length:', bio ? bio.length : 0);
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }
        
        const updateData = {
            profileCompleted: true,
            interests: Array.isArray(interests) ? interests.join(', ') : interests,
            location: location || '',
            bio: bio || '',
            profilePic: profilePic || null,
            coverPic: coverPic || null,
            updatedAt: new Date()
        };
        
        // Try different ways to find and update user
        let updatedUser = await updateUser({ _id: userId }, updateData);
        if (!updatedUser) {
            updatedUser = await updateUser({ id: userId }, updateData);
        }
        if (!updatedUser) {
            updatedUser = await updateUser({ email: userId }, updateData);
        }
        
        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        console.log('✅ Profile completed for:', updatedUser.fullName);
        
        res.json({
            success: true,
            message: 'Profile completed successfully',
            user: {
                id: updatedUser.id || updatedUser._id,
                fullName: updatedUser.fullName,
                email: updatedUser.email,
                dateOfBirth: updatedUser.dateOfBirth,
                gender: updatedUser.gender,
                profileCompleted: updatedUser.profileCompleted,
                interests: updatedUser.interests,
                location: updatedUser.location,
                bio: updatedUser.bio,
                profilePic: updatedUser.profilePic,
                coverPic: updatedUser.coverPic
            }
        });
        
    } catch (error) {
        console.error('Complete profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Error completing profile: ' + error.message
        });
    }
});

// Get all users
app.get('/api/users', async (req, res) => {
    try {
        let users;
        if (mongoose.connection.readyState === 1) {
            users = await User.find({});
        } else {
            users = inMemoryUsers;
        }
        
        res.json({
            success: true,
            users: users,
            count: users.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching users'
        });
    }
});

// Start server
async function startServer() {
    await connectDB();
    
    app.listen(PORT, () => {
        console.log(`🚀 FindLove API Server running on http://localhost:${PORT}`);
        console.log('📊 Database:', mongoose.connection.readyState === 1 ? 'MongoDB Connected' : 'In-Memory Storage');
        console.log('🌐 Ready to accept requests!');
        console.log('💬 Profile system ready!');
    });
}

startServer();
