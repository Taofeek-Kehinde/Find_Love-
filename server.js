
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const fs = require('fs');

const app = express();
const path = require('path');


// Middleware
app.use(cors({
    origin: true, // Allow all origins for development
    credentials: true
}));


// Increase body size limits for large profile updates (e.g., images)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from the project directory
app.use(express.static(path.join(__dirname)));

let mongoConnected = false;

async function connectMongoDB() {
    try {
        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        };

        const MONGO_URI = "mongodb+srv://ktaofeek015:6By4m4GesOLNoWWm@cluster0.jsrsqfv.mongodb.net/FindLove?retryWrites=true&w=majority&appName=Cluster0";

        mongoose.connect(MONGO_URI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
})

        mongoConnected = true;
        console.log(' Connected to MongoDB FindLove database');
        
        mongoose.connection.on('error', err => {
            console.error('MongoDB connection error:', err);
        });

    } catch (error) {
        console.log(' MongoDB not available, using in-memory storage');
        console.error('Connection Error:', error.message);
        mongoConnected = false;
        
        // Additional error details
        if (error.name === 'MongooseServerSelectionError') {
            console.error('Server selection error. Check your network connection and Atlas configuration.');
        }
    }
}

// Initialize MongoDB connection
connectMongoDB();


// User Schema with account settings
const userSchema = new mongoose.Schema({
    fullName: String,
    email: String,
    password: String,
    profileCompleted: { type: Boolean, default: false },
    interests: String,
    location: String,
    bio: String,
    profilePic: String,
    coverPic: String,
    dateOfBirth: Date,
    gender: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },

    // Account Settings
    privacy: {
        whoCanMessage: { type: String, enum: ['anyone', 'matches'], default: 'anyone' },
        hideOnlineStatus: { type: Boolean, default: false },
        hideDistance: { type: Boolean, default: false }
    },
    blockedUsers: [{ type: String }],
    notifications: {
        messages: { type: Boolean, default: true },
        likes: { type: Boolean, default: true },
        matches: { type: Boolean, default: true },
        profileViews: { type: Boolean, default: true },
        all: { type: Boolean, default: true }
    },
    preferences: {
        minAge: { type: Number, default: 18 },
        maxAge: { type: Number, default: 99 },
        maxDistance: { type: Number, default: 50 },
        preferredGender: { type: String, default: 'both' }
    },
    account: {
        phone: String,
        logoutAllDevices: { type: Boolean, default: false },
        deactivated: { type: Boolean, default: false },
        deleted: { type: Boolean, default: false }
    }
}, { strict: false });
const User = mongoose.model('User', userSchema);

// In-memory storage as fallback
let inMemoryUsers = [];
let inMemoryMessages = [];
let inMemoryNotifications = [];
let userIdCounter = 1;
let messageIdCounter = 1;
let inMemoryFriendRequests = [];
let friendRequestIdCounter = 1;
let inMemoryUserStatus = {}; // userId -> { isOnline, lastSeen }

// Persistent file storage for messages as fallback
const messagesFile = 'messages.json';
try {
  if (fs.existsSync(messagesFile)) {
    inMemoryMessages = JSON.parse(fs.readFileSync(messagesFile, 'utf8'));
    messageIdCounter = inMemoryMessages.length > 0 ? Math.max(...inMemoryMessages.map(m => m._id || 0)) + 1 : 1;
    console.log(' Loaded', inMemoryMessages.length, 'messages from file');
  }
} catch (e) {
  console.log(' Failed to load messages from file, starting fresh');
}


const notificationSchema = new mongoose.Schema({
    fromUserId: { type: String, required: true },
    toUserId: { type: String, required: true },
    type: { type: String, required: true }, 
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now }
});
const Notification = mongoose.model('Notification', notificationSchema);

// User Status Schema
const userStatusSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now }
});
const UserStatus = mongoose.model('UserStatus', userStatusSchema);

// Friend Request Schema
const friendRequestSchema = new mongoose.Schema({
    fromUserId: { type: String, required: true },
    toUserId: { type: String, required: true },
    message: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
const FriendRequest = mongoose.model('FriendRequest', friendRequestSchema);

// Message Model
const Message = require('./models/Message');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'Ktaofeek015@gmail.com',
        pass: 'Kehinde@2020'
    }
});


const emailService = {
    async sendResetCode(toEmail, resetCode, userName) {
        console.log(' SENDING REAL EMAIL:');
        console.log('   To:', toEmail);
        console.log('   Code:', resetCode);
        console.log('   User:', userName);

        const mailOptions = {
            from: '"FindLove Support" <findloveapp2024@gmail.com>',
            to: toEmail,
            subject: 'FindLove - Password Reset Code',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #ff4b8b, #ff87ab); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="color: white; margin: 0; font-size: 2rem;">💕 FindLove</h1>
                    </div>
                    <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <h2 style="color: #3a0c3f; margin-bottom: 20px;">Password Reset Code</h2>
                        <p style="color: #666; font-size: 16px; line-height: 1.6;">
                            Hello ${userName},
                        </p>
                        <p style="color: #666; font-size: 16px; line-height: 1.6;">
                            We received a request to reset your password for your FindLove account.
                            Use the following 6-digit code to reset your password:
                        </p>
                        <div style="text-align: center; margin: 30px 0;">
                            <div style="background: #f8f9fa; border: 2px dashed #ff4b8b; padding: 20px; border-radius: 10px; display: inline-block;">
                                <h1 style="color: #ff4b8b; margin: 0; font-size: 2.5rem; letter-spacing: 5px; font-family: monospace;">
                                    ${resetCode}
                                </h1>
                            </div>
                        </div>
                        <p style="color: #666; font-size: 14px; line-height: 1.6;">
                            This code will expire in 10 minutes for security reasons.
                        </p>
                        <p style="color: #666; font-size: 14px; line-height: 1.6;">
                            If you didn't request this password reset, please ignore this email.
                        </p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                        <p style="color: #999; font-size: 12px; text-align: center;">
                            FindLove - Connecting Hearts Around the World
                        </p>
                    </div>
                </div>
            `
        };

        try {
            // Try to send real email using Gmail SMTP
            const info = await transporter.sendMail(mailOptions);
            console.log(' REAL EMAIL SENT SUCCESSFULLY!');
            console.log(' To:', toEmail);
            console.log(' Message ID:', info.messageId);
            console.log(' Reset code sent:', resetCode);
            console.log(' Check your Gmail inbox for the code!');

            return {
                success: true,
                messageId: info.messageId,
                realEmail: true
            };

        } catch (error) {
            console.error(' Gmail SMTP failed:', error.message);

            // Fallback: Use a working email service (Ethereal for testing)
            try {
                console.log(' Trying fallback email service...');

                // Create test account for fallback
                const testAccount = await nodemailer.createTestAccount();
                const testTransporter = nodemailer.createTransport({
                    host: 'smtp.ethereal.email',
                    port: 587,
                    secure: false,
                    auth: {
                        user: testAccount.user,
                        pass: testAccount.pass,
                    },
                });

                const testInfo = await testTransporter.sendMail(mailOptions);
                console.log(' FALLBACK EMAIL SENT!');
                console.log(' Preview URL:', nodemailer.getTestMessageUrl(testInfo));
                console.log(' Reset code:', resetCode);
                console.log(' Copy this code to use:', resetCode);

                return {
                    success: true,
                    messageId: testInfo.messageId,
                    previewUrl: nodemailer.getTestMessageUrl(testInfo),
                    fallback: true
                };

            } catch (fallbackError) {
                console.error(' Fallback email also failed:', fallbackError.message);
                console.log(' EMAIL FAILED - USE THIS CODE:', resetCode);

                return {
                    success: true,
                    messageId: 'console-' + Date.now(),
                    consoleOnly: true
                };
            }
        }
    }
};


const resetTokens = new Map();


app.get('/api/chat-users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        let messages;
        if (mongoConnected) {
            messages = await Message.find({
                $or: [
                    { senderId: userId },
                    { receiverId: userId }
                ]
            });
        } else {
            messages = inMemoryMessages.filter(msg => msg.senderId === userId || msg.receiverId === userId);
        }

        // Collect unique user IDs the current user has chatted with
        const userIds = new Set();
        messages.forEach(msg => {
            if (msg.senderId !== userId) userIds.add(msg.senderId);
            if (msg.receiverId !== userId) userIds.add(msg.receiverId);
        });

        // Only keep valid MongoDB ObjectIds
        const mongoose = require('mongoose');
        const allUserIds = Array.from(userIds);
        const validUserIds = allUserIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        const invalidUserIds = allUserIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
        if (invalidUserIds.length > 0) {
            console.warn(' Skipping invalid user IDs in chat list:', invalidUserIds);
        }
        if (validUserIds.length === 0) {
            return res.json({ success: true, users: [] });
        }

        // Fetch user details for these IDs
        let users = [];
        try {
            users = await User.find({ _id: { $in: validUserIds } });
        } catch (err) {
            console.error(' Error querying users for chat list:', err);
            return res.json({ success: true, users: [] });
        }

        // FIXED: Add online status for friends only
        let enrichedUsers = [];
        if (mongoConnected) {
            // Get friendship status for each user
            for (const user of users) {
                const userObj = user.toObject ? user.toObject() : user;

                // Check if users are friends
                let friendship = null;
                try {
                    friendship = await FriendRequest.findOne({
                        $or: [
                            { fromUserId: userId, toUserId: String(user._id), status: 'accepted' },
                            { fromUserId: String(user._id), toUserId: userId, status: 'accepted' }
                        ]
                    });
                } catch (friendErr) {
                    console.error(' Error checking friendship for chat user:', friendErr);
                }

                if (friendship) {
                    // Users are friends, include online status
                    let status = null;
                    try {
                        status = await UserStatus.findOne({ userId: String(user._id) });
                    } catch (statusErr) {
                        console.error(' Error fetching user status:', statusErr);
                    }
                    userObj.isOnline = !!status?.isOnline;
                    userObj.lastSeen = status?.lastSeen || null;
                } else {
                    // Users are not friends, don't include online status
                    userObj.isOnline = null;
                    userObj.lastSeen = null;
                }

                enrichedUsers.push(userObj);
            }
        } else {
            // For in-memory storage, just return users without online status
            enrichedUsers = users;
        }

        res.json({
            success: true,
            users: enrichedUsers
        });
    } catch (error) {
        console.error(' Error fetching chat users:', error);
        res.status(500).json({ success: false, message: 'Error fetching chat users' });
    }
});

// Test route
app.get('/', (req, res) => {
    res.json({ message: 'FindLove API Server is running!', database: 'mongodb://localhost:27017/FindLove' });
});

// New endpoint to get conversations for a user
app.get('/api/conversations/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        let messages;
        if (mongoConnected) {
            messages = await Message.find({
                $or: [
                    { senderId: userId },
                    { receiverId: userId }
                ]
            }).sort({ timestamp: -1 });
        } else {
            messages = inMemoryMessages.filter(msg => msg.senderId === userId || msg.receiverId === userId)
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        }

        // Map to store latest message and unread count per conversation partner
        const conversationsMap = new Map();

        messages.forEach(msg => {
            const otherUserId = msg.senderId === userId ? msg.receiverId : msg.senderId;
            if (!conversationsMap.has(otherUserId)) {
                conversationsMap.set(otherUserId, {
                    lastMessage: msg,
                    unreadCount: 0
                });
            }
            // Count unread messages sent to current user
            if (msg.receiverId === userId && !msg.read) {
                conversationsMap.get(otherUserId).unreadCount++;
            }
        });

        const conversationUserIds = Array.from(conversationsMap.keys());

        // Fetch user details for conversation partners
        let users = [];
        if (mongoConnected) {
            users = await User.find({ _id: { $in: conversationUserIds } });
        } else {
            users = inMemoryUsers.filter(u => conversationUserIds.includes(u._id));
        }

        // Build response array
        const conversations = users.map(user => {
            const conv = conversationsMap.get(user._id);
            return {
                user: user,
                lastMessage: conv ? conv.lastMessage : null,
                unreadCount: conv ? conv.unreadCount : 0
            };
        });

        res.json({
            success: true,
            conversations
        });
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ success: false, message: 'Error fetching conversations' });
    }
});

// Test endpoint to get all messages
app.get('/api/all-messages', async (req, res) => {
    try {
        const messages = await Message.find({});
        res.json({ success: true, count: messages.length, messages });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Signup route
app.post('/api/signup', async (req, res) => {
    try {
        console.log('=== SIGNUP REQUEST ===');
        console.log('Received signup data:', req.body);
        console.log('Request headers:', req.headers);

        const { fullName, email, password } = req.body;

        // Detailed validation logging
        console.log('Field validation:');
        console.log('- fullName:', fullName ? '' : '', fullName);
        console.log('- email:', email ? '' : '', email);
        console.log('- password:', password ? '' : '', password ? '[HIDDEN]' : 'MISSING');

        // Basic validation (only required fields)
        if (!fullName || !email || !password) {
            console.log(' Validation failed - missing required fields');
            return res.status(400).json({
                success: false,
                message: 'Required fields: fullName, email, password',
                receivedFields: Object.keys(req.body),
                missingFields: ['fullName', 'email', 'password'].filter(field => !req.body[field])
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Create new user (password stored as plain text)
        const userData = {
            fullName,
            email,
            password, // Store password as entered
            profileCompleted: false, // New field to track profile completion
            interests: null,
            location: null,
            bio: null,
            profilePic: null,
            coverPic: null,
            createdAt: new Date()
        };

        console.log('Creating user with data:', { ...userData, password: '[HIDDEN]' });

        const newUser = new User(userData);
        const savedUser = await newUser.save();

        console.log(' User saved successfully:', savedUser._id);

        res.status(201).json({
            success: true,
            message: 'User registered successfully!',
            user: {
                id: savedUser._id,
                fullName: savedUser.fullName,
                email: savedUser.email
            }
        });

    } catch (error) {
        console.error('Signup error:', error);

        // Handle duplicate email error
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'An account with this email already exists. Please use a different email or try logging in.'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error creating user account: ' + error.message
        });
    }
});

// Login route
app.post('/api/login', async (req, res) => {
    try {
        console.log('=== LOGIN REQUEST ===');
        const { email, password } = req.body;
        console.log('Login attempt for email:', email);
        console.log('Password provided:', password ? '[HIDDEN]' : 'MISSING');

        // Find user by email (case-insensitive and trimmed)
        const trimmedEmail = email.trim().toLowerCase();
        console.log('Searching for email (trimmed/lowercase):', trimmedEmail);

        // Try multiple search methods
        let user = await User.findOne({ email: trimmedEmail });
        if (!user) {
            user = await User.findOne({ email: email });
        }
        if (!user) {
            user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
        }
        console.log('User found in database:', user ? 'YES' : 'NO');

        if (!user) {
            console.log(' No user found with email:', email);
            console.log(' Tried trimmed/lowercase:', trimmedEmail);

            // Let's also check all users to see what emails exist
            const allUsers = await User.find({}, { email: 1, fullName: 1 });
            console.log('Available users in database:');
            allUsers.forEach(u => {
                console.log(`  - Email: "${u.email}" (length: ${u.email.length})`);
                console.log(`  - Name: "${u.fullName}"`);
                console.log(`  - Matches input: ${u.email === email ? 'YES' : 'NO'}`);
                console.log(`  - Matches trimmed: ${u.email === trimmedEmail ? 'YES' : 'NO'}`);
                console.log('  ---');
            });

            return res.status(400).json({
                success: false,
                message: 'No account found with this email address. Please check your email or sign up for a new account.',
                errorType: 'email'
            });
        }

        console.log('Found user:', { email: user.email, name: user.fullName });
        console.log('Stored password:', user.password);
        console.log('Provided password:', password);
        console.log('Password match:', password === user.password ? 'YES' : 'NO');

        // Check password (plain text comparison)
        if (password !== user.password) {
            console.log(' Password mismatch');
            return res.status(400).json({
                success: false,
                message: 'Incorrect password. Please check your password and try again.',
                errorType: 'password'
            });
        }

        console.log(' Login successful for:', user.email);

        res.status(200).json({
            success: true,
            message: 'Login successful!',
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                dateOfBirth: user.dateOfBirth,
                gender: user.gender,
                profilePic: user.profilePic,
                location: user.location,
                bio: user.bio,
                interests: user.interests,
                profileCompleted: user.profileCompleted
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Error during login'
        });
    }
});

// Get all users (for testing)
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}); // Include passwords since they're plain text
        console.log('=== FETCHING USERS ===');
        console.log('Found', users.length, 'users');
        if (users.length > 0) {
            console.log('Sample user structure:', {
                id: users[0]._id,
                fullName: users[0].fullName,
                email: users[0].email
            });
        }
        // Merge online status
        let statusMap = {};
        if (mongoConnected) {
            const statuses = await UserStatus.find({ userId: { $in: users.map(u => String(u._id)) } });
            statuses.forEach(s => { statusMap[s.userId] = { isOnline: s.isOnline, lastSeen: s.lastSeen }; });
        } else {
            statusMap = inMemoryUserStatus;
        }
        const enriched = users.map(u => {
            const obj = u.toObject ? u.toObject() : u;
            const s = statusMap[String(u._id)] || {};
            return { ...obj, isOnline: !!s.isOnline, lastSeen: s.lastSeen || null };
        });
        res.json({ success: true, users: enriched, count: users.length });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ success: false, message: 'Error fetching users' });
    }
});

// Clear all users (for testing only)
app.delete('/api/users/clear', async (req, res) => {
    try {
        const result = await User.deleteMany({});
        res.json({
            success: true,
            message: `Deleted ${result.deletedCount} users`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error clearing users' });
    }
});

// Password Reset Routes

// Request password reset
app.post('/api/reset-password', async (req, res) => {
    try {
        const { email } = req.body;
        console.log('=== PASSWORD RESET REQUEST ===');
        console.log('Email:', email);

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email address is required'
            });
        }

        // Find user by email
        const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });

        if (!user) {
            console.log(' No user found with email:', email);
            // For security, we don't reveal if email exists or not
            return res.status(200).json({
                success: true,
                message: 'If an account with this email exists, you will receive a password reset link.'
            });
        }

        console.log(' User found:', user.fullName);

        // Generate 6-digit reset code
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const resetExpires = Date.now() + 600000; // 10 minutes from now

        // Store code (in production, store in database)
        resetTokens.set(resetCode, {
            email: user.email,
            expires: resetExpires
        });

        console.log('Generated reset code for:', user.email, '- Code:', resetCode);

        // Simple working solution - show code directly
        console.log(' RESET CODE GENERATED FOR:', user.email);
        console.log(' CODE:', resetCode);
        console.log(' USER:', user.fullName);

        // Return the code directly to the frontend
        res.status(200).json({
            success: true,
            message: `Reset code generated for ${user.email}`,
            resetCode: resetCode, // Send code directly to frontend
            email: user.email,
            userName: user.fullName
        });

    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing password reset request'
        });
    }
});

// Verify 6-digit code
app.post('/api/verify-code', async (req, res) => {
    try {
        const { code } = req.body;
        console.log('=== CODE VERIFICATION ===');
        console.log('Code received:', code);

        if (!code) {
            return res.status(400).json({
                success: false,
                message: '6-digit code is required'
            });
        }

        // Check if code exists and is valid
        const codeData = resetTokens.get(code);
        if (!codeData) {
            console.log(' Invalid code');
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired code'
            });
        }

        // Check if code has expired
        if (Date.now() > codeData.expires) {
            console.log(' Code expired');
            resetTokens.delete(code); // Clean up expired code
            return res.status(400).json({
                success: false,
                message: 'Code has expired. Please request a new password reset.'
            });
        }

        console.log(' Valid code for email:', codeData.email);

        res.status(200).json({
            success: true,
            message: 'Code verified successfully',
            email: codeData.email
        });

    } catch (error) {
        console.error('Code verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying code'
        });
    }
});

// Update password with verified code
app.post('/api/update-password', async (req, res) => {
    try {
        const { code, newPassword } = req.body;
        console.log('=== PASSWORD UPDATE ===');
        console.log('Code received:', code ? 'YES' : 'NO');

        if (!code || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Code and new password are required'
            });
        }

        // Check if code exists and is valid
        console.log(' Checking code:', code);
        console.log(' Available codes:', Array.from(resetTokens.keys()));

        const codeData = resetTokens.get(code);
        if (!codeData) {
            console.log(' Invalid code - not found in resetTokens');
            console.log(' Current resetTokens:', resetTokens);
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired code'
            });
        }

        // Check if code has expired
        if (Date.now() > codeData.expires) {
            console.log(' Code expired');
            resetTokens.delete(code); // Clean up expired code
            return res.status(400).json({
                success: false,
                message: 'Code has expired. Please request a new password reset.'
            });
        }

        console.log(' Valid code for email:', codeData.email);

        // Find user and update password
        console.log(' Looking for user with email:', codeData.email);
        const user = await User.findOne({ email: codeData.email });
        if (!user) {
            console.log(' User not found in database');
            console.log(' Searching for email:', codeData.email);
            return res.status(400).json({
                success: false,
                message: 'User not found'
            });
        }

        console.log(' User found:', user.fullName, 'Email:', user.email);

        // Update password using direct MongoDB update operation
        const oldPassword = user.password;
        console.log(' BEFORE UPDATE - Old password:', oldPassword);
        console.log(' BEFORE UPDATE - New password to set:', newPassword);

        // Use MongoDB updateOne operation to directly update the password
        const updateResult = await User.updateOne(
            { email: codeData.email },
            { $set: { password: newPassword } }
        );

        console.log(' UPDATE RESULT:', updateResult);
        console.log(' Modified count:', updateResult.modifiedCount);

        // Double-check by fetching the user again from database
        const updatedUser = await User.findOne({ email: codeData.email });
        console.log(' VERIFICATION - Password in database after update:', updatedUser.password);

        // Remove used code
        resetTokens.delete(code);

        console.log(' Password updated for:', user.email);
        console.log(' Old password:', oldPassword);
        console.log(' New password:', newPassword);
        console.log(' Password saved to MongoDB successfully!');

        res.status(200).json({
            success: true,
            message: 'Password has been successfully updated',
            email: user.email,
            userName: user.fullName
        });

    } catch (error) {
        console.error('Password update error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating password'
        });
    }
});

// Test endpoint to manually update password (for testing)
app.post('/api/test-update-password', async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        console.log(' TEST: Updating password for:', email, 'to:', newPassword);

        const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }

        console.log(' TEST: Found user:', user.fullName);
        console.log(' TEST: Old password:', user.password);

        // Use direct MongoDB update operation
        const updateResult = await User.updateOne(
            { email: { $regex: new RegExp(`^${email}$`, 'i') } },
            { $set: { password: newPassword } }
        );

        console.log(' TEST: Update result:', updateResult);

        // Double-check by fetching the user again
        const updatedUser = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
        console.log(' TEST: Password in database after update:', updatedUser.password);

        res.json({
            success: true,
            message: 'Password updated successfully',
            oldPassword: user.password,
            newPassword: newPassword
        });

    } catch (error) {
        console.error(' TEST: Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Test endpoint to check user password
app.get('/api/check-user/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });

        if (user) {
            res.json({
                success: true,
                email: user.email,
                password: user.password,
                fullName: user.fullName
            });
        } else {
            res.json({
                success: false,
                message: 'User not found'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error checking user'
        });
    }
});

// Database info endpoint
app.get('/api/database/info', async (req, res) => {
    try {
        const dbName = mongoose.connection.db.databaseName;
        const collections = await mongoose.connection.db.listCollections().toArray();
        const userCount = await User.countDocuments();

        res.json({
            success: true,
            database: {
                name: dbName,
                connectionString: 'mongodb://localhost:27017/FindLove',
                collections: collections.map(col => col.name),
                userCount: userCount,
                status: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error getting database info',
            error: error.message
        });
    }
});

// Get single user by ID
app.get('/api/user/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { requestingUserId } = req.query; // Get requesting user from query params

        const user = await User.findById(id);

        if (user) {
            const payload = user.toObject ? user.toObject() : user;

            // Only show online status and last seen if users are friends
            if (requestingUserId && requestingUserId !== id) {
                // Check if users are friends
                let friendship = null;
                if (mongoConnected) {
                    friendship = await FriendRequest.findOne({
                        $or: [
                            { fromUserId: requestingUserId, toUserId: id, status: 'accepted' },
                            { fromUserId: id, toUserId: requestingUserId, status: 'accepted' }
                        ]
                    });
                } else {
                    friendship = inMemoryFriendRequests.find(r =>
                        ((r.fromUserId === requestingUserId && r.toUserId === id) ||
                         (r.fromUserId === id && r.toUserId === requestingUserId)) &&
                        r.status === 'accepted'
                    );
                }

                if (friendship) {
                    // Users are friends, include online status
                    let status = null;
                    if (mongoConnected) {
                        status = await UserStatus.findOne({ userId: String(user._id) });
                    } else {
                        status = inMemoryUserStatus[String(user._id)];
                    }
                    payload.isOnline = !!status?.isOnline;
                    payload.lastSeen = status?.lastSeen || null;
                } else {
                    // Users are not friends, don't include online status
                    payload.isOnline = null;
                    payload.lastSeen = null;
                }
            } else {
                // No requesting user specified or requesting own profile, don't include online status
                payload.isOnline = null;
                payload.lastSeen = null;
            }

            res.json({ success: true, user: payload });
        } else {
            res.json({
                success: false,
                message: 'User not found'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching user'
        });
    }
});

// Send message
app.post('/api/send-message', async (req, res) => {
    try {
        const { senderId, receiverId, content, type = 'text' } = req.body;

        console.log('=== SENDING MESSAGE ===');
        console.log('From:', senderId);
        console.log('To:', receiverId);
        console.log('Content:', content);
        console.log('Type:', type);

        if (!senderId || !receiverId || !content) {
            console.log(' Missing required fields');
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: senderId, receiverId, content'
            });
        }

        const messageData = {
            senderId,
            receiverId,
            content,
            type,
            timestamp: new Date(),
            delivered: true,
            read: false
        };

        let savedMessage;

        if (mongoConnected) {
            // Save to MongoDB
            const message = new Message(messageData);
            savedMessage = await message.save();
            console.log(' Message saved to MongoDB with ID:', savedMessage._id);
        } else {
            // Save to in-memory storage
            savedMessage = {
                _id: messageIdCounter++,
                ...messageData
            };
            inMemoryMessages.push(savedMessage);
            console.log(' Message saved to memory with ID:', savedMessage._id);
        }

        // Create a notification for the receiver
        try {
            const senderUser = await User.findById(senderId);
            const senderName = senderUser && senderUser.name ? senderUser.name : 'Someone';
            const notification = new Notification({
                fromUserId: senderId,
                toUserId: receiverId,
                type: 'message',
                message: `${senderName} sent you a message! `,
                timestamp: new Date()
            });
            await notification.save();
            console.log(' Message notification saved');
        } catch (notifError) {
            console.error(' Error creating message notification:', notifError);
        }

        res.json({
            success: true,
            message: 'Message sent successfully',
            messageId: savedMessage._id,
            timestamp: savedMessage.timestamp,
            delivered: savedMessage.delivered,
            read: savedMessage.read
        });

    } catch (error) {
        console.error(' Error sending message:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending message: ' + error.message
        });
    }
});

// Get messages between two users
app.get('/api/messages/:userId1/:userId2', async (req, res) => {
    try {
        const { userId1, userId2 } = req.params;

        console.log('=== FETCHING MESSAGES ===');
        console.log('Between:', userId1, 'and', userId2);

        console.log('userId1:', userId1, 'userId2:', userId2);
        let messages;
        if (mongoConnected) {
            // Allow loading messages regardless of friendship status
            messages = await Message.find({
                senderId: { $in: [userId1, userId2] },
                receiverId: { $in: [userId1, userId2] }
            }).sort({ timestamp: 1 });
        } else {
            messages = inMemoryMessages.filter(m =>
                (m.senderId === userId1 || m.senderId === userId2) &&
                (m.receiverId === userId1 || m.receiverId === userId2)
            ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        }
        console.log('Found messages:', messages.length);
        if (messages.length > 0) console.log('First message:', messages[0]);

        console.log(' Found', messages.length, 'messages');

        res.json({
            success: true,
            messages
        });

    } catch (error) {
        console.error(' Error fetching messages:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching messages'
        });
    }
});

// Get single user by ID for chat
app.get('/api/user/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Validate the ID parameter
        if (!id || id === 'undefined' || id === 'null') {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }

        // Check if it's a valid MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            // Try to find by email instead
            const user = await User.findOne({ email: id });
            if (user) {
                // Attach online status and last seen
                let status = null;
                if (mongoConnected) {
                    status = await UserStatus.findOne({ userId: String(user._id) });
                }
                const payload = user.toObject ? user.toObject() : user;
                payload.isOnline = !!status?.isOnline;
                payload.lastSeen = status?.lastSeen || null;
                return res.json({ success: true, user: payload });
            } else {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
        }

        const user = await User.findById(id);

        if (user) {
            // Attach online status and last seen
            let status = null;
            if (mongoConnected) {
                status = await UserStatus.findOne({ userId: String(user._id) });
            }
            const payload = user.toObject ? user.toObject() : user;
            payload.isOnline = !!status?.isOnline;
            payload.lastSeen = status?.lastSeen || null;
            res.json({ success: true, user: payload });
        } else {
            res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user'
        });
    }
});

// Send message
app.post('/api/send-message', async (req, res) => {
    try {
        const { senderId, receiverId, content, type = 'text' } = req.body;

        console.log('=== SENDING MESSAGE ===');
        console.log('From:', senderId);
        console.log('To:', receiverId);
        console.log('Content:', content);
        console.log('Type:', type);

        if (!senderId || !receiverId || !content) {
            console.log(' Missing required fields');
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: senderId, receiverId, content'
            });
        }

        const message = new Message({
            senderId,
            receiverId,
            content,
            type,
            timestamp: new Date()
        });

        await message.save();

        console.log(' Message saved successfully with ID:', message._id);

        res.json({
            success: true,
            message: 'Message sent successfully',
            messageId: message._id
        });

    } catch (error) {
        console.error(' Error sending message:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending message: ' + error.message
        });
    }
});



// Mark messages as read
app.post('/api/mark-messages-read', async (req, res) => {
    try {
        const { senderId, receiverId } = req.body;

        console.log('=== MARKING MESSAGES AS READ ===');
        console.log('From:', senderId, 'To:', receiverId);

        const result = await Message.updateMany(
            { senderId: senderId, receiverId: receiverId, read: false },
            { read: true, readAt: new Date() }
        );

        console.log(' Marked', result.modifiedCount, 'messages as read');

        res.json({
            success: true,
            message: 'Messages marked as read',
            count: result.modifiedCount
        });

    } catch (error) {
        console.error(' Error marking messages as read:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking messages as read'
        });
    }
});

// Delete a message
app.delete('/api/messages/:messageId', async (req, res) => {
    try {
        const { messageId } = req.params;
        const { userId } = req.body; // User deleting the message

        console.log('=== DELETING MESSAGE ===');
        console.log('Message ID:', messageId);
        console.log('User ID:', userId);

        if (!messageId || !userId) {
            return res.status(400).json({
                success: false,
                message: 'Message ID and user ID are required'
            });
        }

        // Find the message first to check if user is sender or receiver
        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Only allow sender or receiver to delete
        if (message.senderId !== userId && message.receiverId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'You can only delete your own messages'
            });
        }

        // Delete the message
        await Message.findByIdAndDelete(messageId);

        console.log(' Message deleted successfully');

        res.json({
            success: true,
            message: 'Message deleted successfully'
        });

    } catch (error) {
        console.error(' Error deleting message:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting message'
        });
    }
});

// Send like notification
app.post('/api/send-like', async (req, res) => {
    try {
        const { fromUserId, toUserId, fromUserName } = req.body;

        console.log('=== SENDING LIKE NOTIFICATION ===');
        console.log('From:', fromUserId, 'To:', toUserId);

        const notification = new Notification({
            fromUserId,
            toUserId,
            type: 'like',
            message: `${fromUserName} liked your profile! 💕`,
            timestamp: new Date()
        });

        await notification.save();

        console.log(' Like notification saved');

        res.json({
            success: true,
            message: 'Like notification sent'
        });

    } catch (error) {
        console.error(' Error sending like notification:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending like notification'
        });
    }
});

// Send a friend request
app.post('/api/friend-request', async (req, res) => {
    try {
        const { fromUserId, toUserId, message } = req.body;
        if (!fromUserId || !toUserId) {
            return res.status(400).json({ success: false, message: 'fromUserId and toUserId are required' });
        }

        let request = null;
        if (mongoConnected) {
            request = await FriendRequest.findOne({
                $or: [
                    { fromUserId, toUserId },
                    { fromUserId: toUserId, toUserId: fromUserId }
                ]
            });
            if (request && request.status === 'accepted') {
                return res.json({ success: true, message: 'Already friends', status: 'accepted' });
            }
            if (!request) {
                request = new FriendRequest({ fromUserId, toUserId, message: message || '' });
                await request.save();
            } else if (request.status === 'declined') {
                request.status = 'pending';
                request.message = message || request.message;
                request.updatedAt = new Date();
                await request.save();
            }
            await new Notification({
                fromUserId,
                toUserId,
                type: 'friend_request',
                message: 'sent you a friend request',
                timestamp: new Date()
            }).save();
        } else {
            request = inMemoryFriendRequests.find(r =>
                (r.fromUserId === fromUserId && r.toUserId === toUserId) ||
                (r.fromUserId === toUserId && r.toUserId === fromUserId)
            );
            if (request && request.status === 'accepted') {
                return res.json({ success: true, message: 'Already friends', status: 'accepted' });
            }
            if (!request) {
                request = {
                    _id: String(friendRequestIdCounter++),
                    fromUserId,
                    toUserId,
                    message: message || '',
                    status: 'pending',
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                inMemoryFriendRequests.push(request);
            } else if (request.status === 'declined') {
                request.status = 'pending';
                request.message = message || request.message;
                request.updatedAt = new Date();
            }
            inMemoryNotifications.unshift({
                fromUserId,
                toUserId,
                type: 'friend_request',
                message: 'sent you a friend request',
                read: false,
                timestamp: new Date()
            });
        }

        res.json({ success: true, message: 'Friend request sent', status: request.status, request });
    } catch (error) {
        console.error(' Error sending friend request:', error);
        res.status(500).json({ success: false, message: 'Error sending friend request' });
    }
});

// Get pending friend requests for a user
app.get('/api/friend-requests/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        if (mongoConnected) {
            const requests = await FriendRequest.find({ toUserId: userId, status: 'pending' }).sort({ createdAt: -1 });
            res.json({ success: true, requests });
        } else {
            const requests = inMemoryFriendRequests.filter(r => r.toUserId === userId && r.status === 'pending')
                .sort((a,b) => b.createdAt - a.createdAt);
            res.json({ success: true, requests });
        }
    } catch (error) {
        console.error(' Error fetching friend requests:', error);
        res.status(500).json({ success: false, message: 'Error fetching friend requests' });
    }
});

// Accept/decline a friend request
app.post('/api/friend-request/respond', async (req, res) => {
    try {
        const { fromUserId, toUserId, action } = req.body; // 'accept' | 'decline'
        if (!fromUserId || !toUserId || !action) {
            return res.status(400).json({ success: false, message: 'fromUserId, toUserId, and action are required' });
        }
        if (mongoConnected) {
            const request = await FriendRequest.findOne({
                fromUserId: fromUserId,
                toUserId: toUserId,
                status: 'pending'
            });
            if (!request) return res.status(404).json({ success: false, message: 'Pending friend request not found' });
            if (action === 'accept') request.status = 'accepted';
            else if (action === 'decline') request.status = 'declined';
            else return res.status(400).json({ success: false, message: 'Invalid action. Must be "accept" or "decline"' });
            request.updatedAt = new Date();
            await request.save();
            await new Notification({
                fromUserId: request.toUserId,
                toUserId: request.fromUserId,
                type: 'friend_response',
                message: action === 'accept' ? 'accepted your friend request' : 'declined your friend request',
                timestamp: new Date()
            }).save();
            return res.json({ success: true, status: request.status });
        } else {
            const request = inMemoryFriendRequests.find(r =>
                r.fromUserId === fromUserId &&
                r.toUserId === toUserId &&
                r.status === 'pending'
            );
            if (!request) return res.status(404).json({ success: false, message: 'Pending friend request not found' });
            if (action === 'accept') request.status = 'accepted';
            else if (action === 'decline') request.status = 'declined';
            else return res.status(400).json({ success: false, message: 'Invalid action. Must be "accept" or "decline"' });
            request.updatedAt = new Date();
            inMemoryNotifications.unshift({
                fromUserId: request.toUserId,
                toUserId: request.fromUserId,
                type: 'friend_response',
                message: action === 'accept' ? 'accepted your friend request' : 'declined your friend request',
                read: false,
                timestamp: new Date()
            });
            return res.json({ success: true, status: request.status });
        }
    } catch (error) {
        console.error(' Error responding to friend request:', error);
        res.status(500).json({ success: false, message: 'Error responding to friend request' });
    }
});

// Get notifications for user
app.get('/api/notifications/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        console.log('=== FETCHING NOTIFICATIONS ===');
        console.log('For user:', userId);

        const notifications = await Notification.find({ toUserId: userId })
            .sort({ timestamp: -1 })
            .limit(50);

        console.log(' Found', notifications.length, 'notifications');

        res.json({
            success: true,
            notifications: notifications
        });

    } catch (error) {
        console.error(' Error fetching notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching notifications'
        });
    }
});

// Get all friends of a user (accepted friend requests)
app.get('/api/friends/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        let friendRequests = null;
        if (mongoConnected) {
            friendRequests = await FriendRequest.find({
                $or: [
                    { fromUserId: userId, status: 'accepted' },
                    { toUserId: userId, status: 'accepted' }
                ]
            });
        } else {
            friendRequests = inMemoryFriendRequests.filter(r =>
                r.status === 'accepted' &&
                (r.fromUserId === userId || r.toUserId === userId)
            );
        }

        // Get friend user IDs (excluding current user)
        const friendUserIds = friendRequests.map(fr =>
            fr.fromUserId === userId ? fr.toUserId : fr.fromUserId
        );

        if (friendUserIds.length === 0) {
            return res.json({ success: true, friends: [] });
        }

        // Fetch friend user details
        let friends = [];
        if (mongoConnected) {
            friends = await User.find({ _id: { $in: friendUserIds } });
        } else {
            friends = inMemoryUsers.filter(u => friendUserIds.includes(u._id));
        }

        // Add online status
        let statusMap = {};
        if (mongoConnected) {
            const statuses = await UserStatus.find({ userId: { $in: friendUserIds } });
            statuses.forEach(s => { statusMap[s.userId] = { isOnline: s.isOnline, lastSeen: s.lastSeen }; });
        } else {
            statusMap = inMemoryUserStatus;
        }

        const enrichedFriends = friends.map(friend => {
            const obj = friend.toObject ? friend.toObject() : friend;
            const s = statusMap[String(friend._id)] || {};
            return { ...obj, isOnline: !!s.isOnline, lastSeen: s.lastSeen || null };
        });

        res.json({ success: true, friends: enrichedFriends });
    } catch (e) {
        console.error(' Error fetching friends:', e);
        res.status(500).json({ success: false, message: 'Error fetching friends' });
    }
});

// Friendship status between two users
app.get('/api/friendship-status/:userId1/:userId2', async (req, res) => {
    try {
        const { userId1, userId2 } = req.params;
        let fr = null;
        if (mongoConnected) {
            fr = await FriendRequest.findOne({
                $or: [
                    { fromUserId: userId1, toUserId: userId2 },
                    { fromUserId: userId2, toUserId: userId1 }
                ]
            });
        } else {
            fr = inMemoryFriendRequests.find(r =>
                (r.fromUserId === userId1 && r.toUserId === userId2) ||
                (r.fromUserId === userId2 && r.toUserId === userId1)
            );
        }

        if (!fr) return res.json({ success: true, status: 'none' });
        const role = fr.fromUserId === userId1 ? 'sender' : (fr.toUserId === userId1 ? 'receiver' : null);
        return res.json({ success: true, status: fr.status, role, requestId: fr._id });
    } catch (e) {
        console.error(' Error checking friendship status:', e);
        res.status(500).json({ success: false, message: 'Error checking friendship status' });
    }
});

// Cancel a pending friend request (by sender)
app.post('/api/friend-request/cancel', async (req, res) => {
    try {
        const { requestId, fromUserId, toUserId } = req.body;
        let fr = null;
        if (mongoConnected) {
            if (requestId) {
                fr = await FriendRequest.findById(requestId);
            } else if (fromUserId && toUserId) {
                fr = await FriendRequest.findOne({ fromUserId, toUserId, status: 'pending' });
            }
            if (!fr) return res.status(404).json({ success: false, message: 'Pending request not found' });
            if (fr.status !== 'pending') return res.status(400).json({ success: false, message: 'Request is not pending' });
            await FriendRequest.deleteOne({ _id: fr._id });
        } else {
            fr = inMemoryFriendRequests.find(r => requestId ? r._id === requestId : (r.fromUserId === fromUserId && r.toUserId === toUserId && r.status === 'pending'));
            if (!fr) return res.status(404).json({ success: false, message: 'Pending request not found' });
            inMemoryFriendRequests = inMemoryFriendRequests.filter(r => r !== fr);
        }
        return res.json({ success: true, message: 'Friend request canceled' });
    } catch (e) {
        console.error(' Error canceling friend request:', e);
        res.status(500).json({ success: false, message: 'Error canceling friend request' });
    }
});

// Complete user profile
app.post('/api/complete-profile', async (req, res) => {
    try {
        const { userId, profilePic, coverPic, location, interests, bio, dateOfBirth, gender } = req.body;

        console.log('=== COMPLETING PROFILE ===');
        console.log('User ID:', userId);
        console.log('Location:', location);
        console.log('Interests:', interests);
        console.log('Bio length:', bio ? bio.length : 0);
        console.log('Has profile pic:', !!profilePic);
        console.log('Has cover pic:', !!coverPic);
        console.log('Date of Birth:', dateOfBirth);
        console.log('Gender:', gender);

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        const updateData = {
            profileCompleted: true,
            interests: interests ? interests.join(', ') : null,
            location: location || null,
            bio: bio || null,
            profilePic: profilePic || null,
            coverPic: coverPic || null,
            dateOfBirth: dateOfBirth || null,
            gender: gender || null,
            updatedAt: new Date()
        };

        // Try to find user by different methods
        let updatedUser;

        // First try by MongoDB ObjectId
        try {
            updatedUser = await User.findByIdAndUpdate(
                userId,
                updateData,
                { new: true }
            );
        } catch (error) {
            console.log('Failed to find by ID, trying by email...');
        }

        // If not found by ID, try by email
        if (!updatedUser) {
            updatedUser = await User.findOneAndUpdate(
                { email: userId },
                updateData,
                { new: true }
            );
        }

        if (!updatedUser) {
            console.log(' User not found with ID/email:', userId);
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        console.log(' Profile completed successfully for user:', updatedUser.fullName);

        res.json({
            success: true,
            message: 'Profile completed successfully',
            user: {
                id: updatedUser._id,
                fullName: updatedUser.fullName,
                email: updatedUser.email,
                profileCompleted: updatedUser.profileCompleted,
                interests: updatedUser.interests,
                location: updatedUser.location,
                bio: updatedUser.bio,
                profilePic: updatedUser.profilePic,
                coverPic: updatedUser.coverPic,
                dateOfBirth: updatedUser.dateOfBirth,
                gender: updatedUser.gender
            }
        });

    } catch (error) {
        console.error(' Error completing profile:', error);
        res.status(500).json({
            success: false,
            message: 'Error completing profile: ' + error.message
        });
    }
});

// Mark notification as read
app.post('/api/mark-notification-read/:notificationId', async (req, res) => {
    try {
        const { notificationId } = req.params;

        await Notification.findByIdAndUpdate(notificationId, { read: true });

        res.json({
            success: true,
            message: 'Notification marked as read'
        });

    } catch (error) {
        console.error(' Error marking notification as read:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking notification as read'
        });
    }
});

// --- ACCOUNT SETTINGS API ENDPOINTS ---

// Get account settings
app.get('/api/account-settings/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Return only settings-related fields
        const settings = {
            privacy: user.privacy || {},
            blockedUsers: user.blockedUsers || [],
            notifications: user.notifications || {},
            preferences: user.preferences || {},
            account: {
                email: user.email,
                phone: user.account?.phone || ''
            }
        };

        res.json({ success: true, settings });
    } catch (error) {
        console.error('Error getting account settings:', error);
        res.status(500).json({ success: false, message: 'Error getting account settings' });
    }
});

// Update account settings
app.post('/api/account-settings/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { privacy, notifications, preferences, account } = req.body;

        const updateData = {};
        if (privacy) updateData.privacy = privacy;
        if (notifications) updateData.notifications = notifications;
        if (preferences) updateData.preferences = preferences;
        if (account) updateData.account = account;
        updateData.updatedAt = new Date();

        const user = await User.findByIdAndUpdate(userId, updateData, { new: true });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, message: 'Settings updated successfully', settings: user });
    } catch (error) {
        console.error('Error updating account settings:', error);
        res.status(500).json({ success: false, message: 'Error updating account settings' });
    }
});

// Block a user
app.post('/api/block-user', async (req, res) => {
    try {
        const { userId, blockUserId } = req.body;

        if (!userId || !blockUserId) {
            return res.status(400).json({ success: false, message: 'userId and blockUserId are required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (!user.blockedUsers) user.blockedUsers = [];
        if (!user.blockedUsers.includes(blockUserId)) {
            user.blockedUsers.push(blockUserId);
            await user.save();
        }

        res.json({ success: true, message: 'User blocked successfully' });
    } catch (error) {
        console.error('Error blocking user:', error);
        res.status(500).json({ success: false, message: 'Error blocking user' });
    }
});

// Unblock a user
app.post('/api/unblock-user', async (req, res) => {
    try {
        const { userId, unblockUserId } = req.body;

        if (!userId || !unblockUserId) {
            return res.status(400).json({ success: false, message: 'userId and unblockUserId are required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.blockedUsers) {
            user.blockedUsers = user.blockedUsers.filter(id => id !== unblockUserId);
            await user.save();
        }

        res.json({ success: true, message: 'User unblocked successfully' });
    } catch (error) {
        console.error('Error unblocking user:', error);
        res.status(500).json({ success: false, message: 'Error unblocking user' });
    }
});

// Change password
app.post('/api/change-password', async (req, res) => {
    try {
        const { userId, currentPassword, newPassword } = req.body;

        if (!userId || !currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'userId, currentPassword, and newPassword are required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.password !== currentPassword) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect' });
        }

        user.password = newPassword;
        user.updatedAt = new Date();
        await user.save();

        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ success: false, message: 'Error changing password' });
    }
});

// Change email
app.post('/api/change-email', async (req, res) => {
    try {
        const { userId, newEmail, password } = req.body;

        if (!userId || !newEmail || !password) {
            return res.status(400).json({ success: false, message: 'userId, newEmail, and password are required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.password !== password) {
            return res.status(400).json({ success: false, message: 'Password is incorrect' });
        }

        // Check if email is already taken
        const existingUser = await User.findOne({ email: newEmail });
        if (existingUser && existingUser._id.toString() !== userId) {
            return res.status(400).json({ success: false, message: 'Email is already in use' });
        }

        user.email = newEmail;
        user.updatedAt = new Date();
        await user.save();

        res.json({ success: true, message: 'Email changed successfully' });
    } catch (error) {
        console.error('Error changing email:', error);
        res.status(500).json({ success: false, message: 'Error changing email' });
    }
});

// Change phone
app.post('/api/change-phone', async (req, res) => {
    try {
        const { userId, newPhone } = req.body;

        if (!userId || !newPhone) {
            return res.status(400).json({ success: false, message: 'userId and newPhone are required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (!user.account) user.account = {};
        user.account.phone = newPhone;
        user.updatedAt = new Date();
        await user.save();

        res.json({ success: true, message: 'Phone number changed successfully' });
    } catch (error) {
        console.error('Error changing phone:', error);
        res.status(500).json({ success: false, message: 'Error changing phone' });
    }
});

// Deactivate account
app.post('/api/deactivate-account', async (req, res) => {
    try {
        const { userId, password } = req.body;

        if (!userId || !password) {
            return res.status(400).json({ success: false, message: 'userId and password are required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.password !== password) {
            return res.status(400).json({ success: false, message: 'Password is incorrect' });
        }

        if (!user.account) user.account = {};
        user.account.deactivated = true;
        user.updatedAt = new Date();
        await user.save();

        res.json({ success: true, message: 'Account deactivated successfully' });
    } catch (error) {
        console.error('Error deactivating account:', error);
        res.status(500).json({ success: false, message: 'Error deactivating account' });
    }
});

// Delete account
app.post('/api/delete-account', async (req, res) => {
    try {
        const { userId, password } = req.body;

        if (!userId || !password) {
            return res.status(400).json({ success: false, message: 'userId and password are required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.password !== password) {
            return res.status(400).json({ success: false, message: 'Password is incorrect' });
        }

        // Mark as deleted instead of actually deleting
        if (!user.account) user.account = {};
        user.account.deleted = true;
        user.updatedAt = new Date();
        await user.save();

        res.json({ success: true, message: 'Account marked for deletion' });
    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).json({ success: false, message: 'Error deleting account' });
    }
});

// Logout from all devices (set flag)
app.post('/api/logout-all-devices', async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'userId is required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (!user.account) user.account = {};
        user.account.logoutAllDevices = true;
        user.updatedAt = new Date();
        await user.save();

        res.json({ success: true, message: 'Logged out from all devices' });
    } catch (error) {
        console.error('Error logging out from all devices:', error);
        res.status(500).json({ success: false, message: 'Error logging out from all devices' });
    }
});

// Report suspicious activity
app.post('/api/report-activity', async (req, res) => {
    try {
        const { userId, reportedUserId, reason, description } = req.body;

        if (!userId || !reportedUserId || !reason) {
            return res.status(400).json({ success: false, message: 'userId, reportedUserId, and reason are required' });
        }

        // For now, just log the report. In production, save to a reports collection
        console.log('=== SUSPICIOUS ACTIVITY REPORT ===');
        console.log('Reporter:', userId);
        console.log('Reported User:', reportedUserId);
        console.log('Reason:', reason);
        console.log('Description:', description);

        res.json({ success: true, message: 'Report submitted successfully' });
    } catch (error) {
        console.error('Error reporting activity:', error);
        res.status(500).json({ success: false, message: 'Error submitting report' });
    }
});


// --- SOCKET.IO SETUP ---
const http = require('http');
const { Server } = require('socket.io');
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Store online users
let onlineUsers = {};

io.on('connection', (socket) => {
    // User joins with their userId
    socket.on('join', (userId) => {
        onlineUsers[userId] = socket.id;
        socket.userId = userId;
        io.emit('user-online', userId);

        // Persist user online status
        const now = new Date();
        if (mongoConnected) {
            UserStatus.updateOne(
                { userId },
                { $set: { isOnline: true, lastSeen: now } },
                { upsert: true }
            ).catch(() => {});
        } else {
            inMemoryUserStatus[userId] = { isOnline: true, lastSeen: now };
        }
    });

    // Handle sending a message
    socket.on('send-message', async (msg) => {
        // msg: { senderId, receiverId, content, type }
        try {
            console.log(' Socket.IO: Sending message from', msg.senderId, 'to', msg.receiverId);

            const messageData = {
                senderId: msg.senderId,
                receiverId: msg.receiverId,
                content: msg.content,
                type: msg.type || 'text',
                timestamp: new Date(),
                delivered: true,
                read: false
            };

            let savedMessage;

            if (mongoConnected) {
                // Save to MongoDB
                const message = new Message(messageData);
                savedMessage = await message.save();
                console.log(' Message saved to MongoDB');
            } else {
                // Save to in-memory storage and file
                savedMessage = {
                    _id: messageIdCounter++,
                    ...messageData
                };
                inMemoryMessages.push(savedMessage);
                // Save to file for persistence
                fs.writeFileSync(messagesFile, JSON.stringify(inMemoryMessages, null, 2));
                console.log(' Message saved to memory and file');
            }

            // Emit to receiver if online
            const receiverSocketId = onlineUsers[msg.receiverId];
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('receive-message', savedMessage);
                console.log('📤 Message sent to receiver');
            }

            // Also emit to sender for instant UI update
            socket.emit('receive-message', savedMessage);
            console.log('📤 Message confirmed to sender');

        } catch (err) {
            console.error(' Socket.IO message error:', err);
            socket.emit('error', 'Failed to send message: ' + err.message);
        }
    });


    // Typing indicator
    socket.on('typing', ({ toUserId, fromUserName }) => {
        const receiverSocketId = onlineUsers[toUserId];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('typing', { fromUserName });
        }
    });

    // --- WebRTC Signaling Events ---
    // Offer
    socket.on('webrtc-offer', ({ toUserId, offer, callType, fromUserId }) => {
        const receiverSocketId = onlineUsers[toUserId];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('webrtc-offer', { offer, callType, fromUserId });
        }
    });
    // Answer
    socket.on('webrtc-answer', ({ toUserId, answer, fromUserId }) => {
        const receiverSocketId = onlineUsers[toUserId];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('webrtc-answer', { answer, fromUserId });
        }
    });
    // ICE Candidate
    socket.on('webrtc-ice-candidate', ({ toUserId, candidate, fromUserId }) => {
        const receiverSocketId = onlineUsers[toUserId];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('webrtc-ice-candidate', { candidate, fromUserId });
        }
    });
    // Call end
    socket.on('webrtc-end-call', ({ toUserId, fromUserId }) => {
        const receiverSocketId = onlineUsers[toUserId];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('webrtc-end-call', { fromUserId });
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        if (socket.userId) {
            delete onlineUsers[socket.userId];
            io.emit('user-offline', socket.userId);

            // Persist last seen
            const now = new Date();
            if (mongoConnected) {
                UserStatus.updateOne(
                    { userId: socket.userId },
                    { $set: { isOnline: false, lastSeen: now } },
                    { upsert: true }
                ).catch(() => {});
            } else {
                inMemoryUserStatus[socket.userId] = { isOnline: false, lastSeen: now };
            }
        }
    });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
    console.log(` FindLove API Server running on http://localhost:${PORT}`);
    console.log(' Test API: http://localhost:5000');
    console.log(' Chat system ready with Socket.IO!');
});
