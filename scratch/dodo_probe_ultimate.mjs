
const apiKey = 'YmJkcX1Hr2FG40qI.LmsUjnPvoAmGT9R7O2l-E45m0YtRwit5Kk_E4ShzbkEcY7AG';
const newId = 'pdt_0Ne8DxFd4qtNIJdum6kaB'; // Notice the CAPITAL 'I' in the pasted text!

async function run() {
    const url = `https://live.dodopayments.com/checkouts`;
    const body = {
      product_cart: [{ product_id: newId, quantity: 1 }],
      customer: { email: 'diagnostic@example.com' },
      metadata: { businessId: 'diag', planId: 'diag', cycleMonths: '1' }
    };

    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    
    const data = await resp.json();
    if (resp.ok) {
        console.log("🏆 SUCCESS! The new ID containing the capital 'I' is PERFECTLY VALID!");
    } else {
        console.log("❌ Still failed:", data.message);
    }
}
run();
