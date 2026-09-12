const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });
const key = process.env.PAYSTACK_SECRET_KEY || 'sk_test_6141c2c2f1f534440ec8c818fa8b5321f8a848c7'; // Try to use a test key if no env var
async function run() {
  const authHeader = `Bearer ${key}`;
  const email = `test-terminal-${Date.now()}@zeneva.space`;
  
  console.log('Creating customer...');
  const customerResponse = await fetch('https://api.paystack.co/customer', {
    method: 'POST',
    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, first_name: 'Test', last_name: 'Store', phone: '+2348038416847' })
  });
  const data = await customerResponse.json();
  console.log('Customer POST:', data);
  
  if (data.status) {
    const code = data.data.customer_code;
    console.log('Creating DVA...');
    const dva = await fetch('https://api.paystack.co/dedicated_account', {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer: code, preferred_bank: 'wema-bank' })
    });
    console.log('DVA POST:', await dva.json());
  }
}
run();
