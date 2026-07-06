const http = require('http');

async function runTest() {
  // 1. Login
  const loginData = JSON.stringify({ email: 's6604062663124@email.kmutnb.ac.th', password: 'AdminPassword123!' });
  const loginReq = http.request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': loginData.length
    }
  }, (res) => {
    let cookie = res.headers['set-cookie'] ? res.headers['set-cookie'][0].split(';')[0] : '';
    
    // Test 1: Wrong OTP
    const verifyData = JSON.stringify({ otp: '999999', newPassword: 'NewPassword123!' });
    const verifyReq = http.request({
      hostname: 'localhost',
      port: 8080,
      path: '/api/auth/force-reset/verify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': verifyData.length,
        'Cookie': cookie
      }
    }, (verifyRes) => {
      let body = '';
      verifyRes.on('data', chunk => body += chunk);
      verifyRes.on('end', () => {
        console.log('--- TEST 1: Wrong OTP ---');
        console.log('Status:', verifyRes.statusCode);
        console.log('Response:', body);
        
        // Test 2: Resend OTP
        const resendReq = http.request({
          hostname: 'localhost',
          port: 8080,
          path: '/api/auth/force-reset/resend-otp',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': cookie
          }
        }, (resendRes) => {
          let body2 = '';
          resendRes.on('data', chunk => body2 += chunk);
          resendRes.on('end', () => {
            console.log('\n--- TEST 2: Resend OTP ---');
            console.log('Status:', resendRes.statusCode);
            console.log('Response:', body2);
          });
        });
        resendReq.end();
      });
    });
    verifyReq.write(verifyData);
    verifyReq.end();
  });
  
  loginReq.write(loginData);
  loginReq.end();
}

runTest();
