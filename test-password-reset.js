const fetch = require('node-fetch');

async function testPasswordReset() {
    console.log('🧪 Testing Complete Password Reset Flow...');
    
    const email = 'ktaofeek015@gmail.com';
    const newPassword = 'newpassword123';
    
    try {
        // Step 1: Request reset code
        console.log('\n📧 Step 1: Requesting reset code...');
        const resetResponse = await fetch('http://localhost:3001/api/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        const resetResult = await resetResponse.json();
        console.log('Reset Response:', resetResult);
        
        if (!resetResult.success) {
            console.log('❌ Reset request failed');
            return;
        }
        
        const resetCode = resetResult.resetCode;
        console.log('✅ Reset code generated:', resetCode);
        
        // Step 2: Verify code
        console.log('\n🔍 Step 2: Verifying code...');
        const verifyResponse = await fetch('http://localhost:3001/api/verify-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: resetCode })
        });
        
        const verifyResult = await verifyResponse.json();
        console.log('Verify Response:', verifyResult);
        
        if (!verifyResult.success) {
            console.log('❌ Code verification failed');
            return;
        }
        
        console.log('✅ Code verified successfully');
        
        // Step 3: Update password
        console.log('\n🔐 Step 3: Updating password...');
        const updateResponse = await fetch('http://localhost:3001/api/update-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: resetCode, newPassword })
        });
        
        const updateResult = await updateResponse.json();
        console.log('Update Response:', updateResult);
        
        if (!updateResult.success) {
            console.log('❌ Password update failed');
            return;
        }
        
        console.log('✅ Password updated successfully');
        
        // Step 4: Verify password was actually updated
        console.log('\n🔍 Step 4: Checking if password was updated in database...');
        const checkResponse = await fetch(`http://localhost:3001/api/check-user/${email}`);
        const checkResult = await checkResponse.json();
        
        console.log('Current user data:', checkResult);
        
        if (checkResult.password === newPassword) {
            console.log('✅ SUCCESS: Password was updated in MongoDB!');
            console.log('📝 New password in database:', checkResult.password);
        } else {
            console.log('❌ FAILED: Password was NOT updated in MongoDB');
            console.log('📝 Expected:', newPassword);
            console.log('📝 Actual:', checkResult.password);
        }
        
        // Step 5: Test login with new password
        console.log('\n🔑 Step 5: Testing login with new password...');
        const loginResponse = await fetch('http://localhost:3001/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: newPassword })
        });
        
        const loginResult = await loginResponse.json();
        console.log('Login Response:', loginResult);
        
        if (loginResult.success) {
            console.log('✅ SUCCESS: Can login with new password!');
        } else {
            console.log('❌ FAILED: Cannot login with new password');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testPasswordReset();
