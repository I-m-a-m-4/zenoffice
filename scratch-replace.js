const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Users\\Bello Imam\\Documents\\zen-office\\src\\app\\page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
  ['Real‑Time Market Data', 'Real‑Time Collaboration'],
  ['AAPL', 'DOC'],
  ['TSLA', 'PDF'],
  ['MSFT', 'XLSX'],
  ['GOOGL', 'PPTX'],
  ['WATCHLIST', 'RECENT FILES'],
  ['MOBILE', 'CLOUD'],
  ['Advanced Charting', 'Advanced Editing'],
  ['Professional-grade technical analysis tools with real-time candlestick patterns.', 'Professional-grade document formatting tools with real-time markdown support.'],
  ['Smart Watchlists', 'Smart Folders'],
  ['Curated stock tracking with instant performance updates and alerts.', 'Curated file tracking with instant access and permission alerts.'],
  ['Start trading', 'Start collaborating'],
  ['Industry‑leading precision, professionally certified', 'Industry‑leading security, professionally certified'],
  ['Real-time Processing', 'Real-time Syncing'],
  ['Sub-second color analysis with continuous calibration and temperature compensation for consistent results.', 'Sub-second file syncing with continuous version control and conflict resolution for consistent teamwork.'],
  ['Advanced Algorithms', 'Advanced AI Search'],
  ['Machine learning-enhanced color matching with proprietary spectral analysis for superior accuracy.', 'Machine learning-enhanced document search with proprietary semantic analysis for superior accuracy.'],
  ['Technical\n            Specifications', 'Platform\n            Capabilities'],
  ['Technical Specifications', 'Platform Capabilities'],
  ['Precision engineered with cutting-edge hardware and software integration for professional color analysis workflows.', 'Precision engineered with cutting-edge software integration for professional document management workflows.'],
  ['Hardware Specifications', 'Software Capabilities'],
  ['Spectral Range', 'Storage Limit'],
  ['380-780 nm', 'Unlimited (Enterprise)'],
  ['Accuracy', 'Uptime'],
  ['±0.03 ΔE*ab', '99.99% SLA'],
  ['Measurement Time', 'Search Speed'],
  ['0.5 seconds', '< 50ms'],
  ['Illumination', 'Encryption'],
  ['LED D65/A/C/D50/D55/F2/F7/F11', 'AES-256 at rest and in transit'],
  ['Observer Angle', 'Max File Size'],
  ['2°/10° standard observer', '5GB per file'],
  ['Repeatability', 'Version History'],
  ['ΔE*ab ≤ 0.04 (σ)', 'Unlimited Revisions'],
  ['Connectivity &amp; Power', 'Integrations &amp; Security'],
  ['Interface', 'API Support'],
  ['USB-C 3.0, Bluetooth 5.2, Wi-Fi 6', 'REST, GraphQL, Webhooks'],
  ['Battery Life', 'SSO Integrations'],
  ['8 hours continuous use', 'Okta, Google, Microsoft'],
  ['Operating Temperature', 'Data Centers'],
  ['0°C to 40°C (32°F to 104°F)', 'US, EU, AP (SOC2 Type II)'],
  ['Dimensions', 'Supported Formats'],
  ['95 × 65 × 28 mm', 'PDF, DOCX, XLSX, PPTX, MD'],
  ['Weight', 'Max Users'],
  ['280g (9.9 oz)', 'Unlimited'],
  ['Certifications &amp; Standards', 'Compliance &amp; Standards'],
  ['Meets and exceeds international standards for color measurement and professional certification requirements.', 'Meets and exceeds international standards for data privacy and professional security requirements.'],
  ['ISO 11664', 'SOC 2 Type II'],
  ['Colorimetry Standards', 'Security & Privacy'],
  ['CIE Standard', 'ISO 27001'],
  ['Illuminant D65', 'Information Security Management'],
  ['ASTM E308', 'GDPR Ready'],
  ['Standard Practice for Computing Colors', 'EU Data Protection Compliant'],
  ['DIN 5033', 'HIPAA Compliant'],
  ['Colorimetry Guidelines', 'Health Insurance Portability and Accountability Act'],
  ['FDA Approved', 'Enterprise Ready'],
  ['Medical device classification for clinical use', 'Role-based access control with audit logging'],
];

for (const [search, replace] of replacements) {
  content = content.replace(search, replace);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Replaced content successfully');
