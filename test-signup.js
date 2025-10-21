const fetch = require('node-fetch');

async function testSignup() {
    const userData = {
        fullName: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        dateOfBirth: '1990-01-01',
        gender: 'male',
        interests: 'testing, debugging'
    };

    try {
        console.log('Testing signup with data:', userData);
        
        const response = await fetch('http://localhost:5000/api/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData)
        });

        const result = await response.json();
        
        console.log('Response status:', response.status);
        console.log('Response data:', result);
        
        if (result.success) {
            console.log('✅ Signup successful!');
        } else {
            console.log('❌ Signup failed:', result.message);
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testSignup();
