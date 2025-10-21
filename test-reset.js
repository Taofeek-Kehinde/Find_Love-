const fetch = require('node-fetch');

async function testPasswordReset() {
    console.log('🧪 Testing Password Reset...');
    
    try {
        const response = await fetch('http://localhost:3001/api/reset-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: 'ktaofeek015@gmail.com'
            })
        });

        const result = await response.json();
        
        console.log('📊 Response Status:', response.status);
        console.log('📊 Response Data:', JSON.stringify(result, null, 2));
        
        if (result.success) {
            console.log('✅ Password reset request successful!');
            if (result.resetUrl) {
                console.log('🔗 Reset URL:', result.resetUrl);
            }
            if (result.previewUrl) {
                console.log('📧 Email Preview:', result.previewUrl);
            }
        } else {
            console.log('❌ Password reset failed:', result.message);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testPasswordReset();
