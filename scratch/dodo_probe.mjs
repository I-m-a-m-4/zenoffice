
const apiKey = 'YmJkcX1Hr2FG40qI.LmsUjnPvoAmGT9R7O2l-E45m0YtRwit5Kk_E4ShzbkEcY7AG';
const productId = 'pdt_0Ne8DxFd4qtNlJdum6kaB';

async function testDodo(env) {
    const url = `https://${env}.dodopayments.com/checkouts`;
    console.log(`\n[Diagnostic] Probing ${env.toUpperCase()} endpoint: ${url}`);
    
    const body = {
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: { email: 'diagnostic@example.com' },
      metadata: { businessId: 'diagnostic', planId: 'diagnostic', cycleMonths: '1' }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log(`✅ SUCCESS in ${env.toUpperCase()} mode! This indicates the Product ID IS valid here.`);
            console.log(`Checkout URL:`, data.checkout_url);
        } else {
            console.log(`❌ FAILED in ${env.toUpperCase()} mode (HTTP ${response.status})`);
            console.log(`Error: ${data.message || JSON.stringify(data)}`);
        }
    } catch (e) {
        console.log(`💥 CRASHED attempting ${env.toUpperCase()}:`, e.message);
    }
}

async function run() {
    console.log("Starting Dodo Configuration Diagnostic...");
    await testDodo('live');
    await testDodo('test');
}

run();
