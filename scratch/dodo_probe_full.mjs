
const apiKey = 'YmJkcX1Hr2FG40qI.LmsUjnPvoAmGT9R7O2l-E45m0YtRwit5Kk_E4ShzbkEcY7AG';
const ids = ['pdt_0Ne8DxFd4qtNlJdum6kaB', 'pdt_0Ne8FzxfnfO0Q55dQ2QuK'];

async function testDodo(env, id) {
    const url = `https://${env}.dodopayments.com/checkouts`;
    const body = {
      product_cart: [{ product_id: id, quantity: 1 }],
      customer: { email: 'diagnostic@example.com' },
      metadata: { businessId: 'diag', planId: 'diag', cycleMonths: '1' }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        if (response.ok) {
            console.log(`✅ ${env.toUpperCase()} accepted ID ${id}`);
        } else {
            console.log(`❌ ${env.toUpperCase()} with ID ${id} -> Status: ${response.status}, Message: ${data.message || JSON.stringify(data)}`);
        }
    } catch (e) { }
}

async function run() {
    console.log("Probing BOTH Product IDs on LIVE environment only (since we verified API key is LIVE)...");
    for (const id of ids) {
        await testDodo('live', id);
    }
}
run();
