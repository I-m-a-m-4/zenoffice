const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../src/lib/i18n/messages');

const translations = {
  en: `    downloadFrom: 'Download from the',
    microsoftStore: 'Microsoft Store',
    getItOn: 'GET IT ON',
    googlePlay: 'Google Play',
    flashSale: 'Flash Sale',
    premiumFor: 'Zeneva Premium for',
    save: '(Save {amount}!)',
    claimOffer: 'Claim offer',`,
  es: `    downloadFrom: 'Descárgalo en',
    microsoftStore: 'Microsoft Store',
    getItOn: 'DISPONIBLE EN',
    googlePlay: 'Google Play',
    flashSale: 'Oferta Flash',
    premiumFor: 'Zeneva Premium por',
    save: '(¡Ahorra {amount}!)',
    claimOffer: 'Reclamar oferta',`,
  fr: `    downloadFrom: 'Télécharger sur',
    microsoftStore: 'Microsoft Store',
    getItOn: 'DISPONIBLE SUR',
    googlePlay: 'Google Play',
    flashSale: 'Vente Flash',
    premiumFor: 'Zeneva Premium pour',
    save: '(Économisez {amount} !)',
    claimOffer: 'Profiter de l’offre',`,
  ar: `    downloadFrom: 'تنزيل من',
    microsoftStore: 'Microsoft Store',
    getItOn: 'تنزيل من',
    googlePlay: 'Google Play',
    flashSale: 'عرض فلاش',
    premiumFor: 'زينيفا بريميوم مقابل',
    save: '(وفر {amount}!)',
    claimOffer: 'احصل على العرض',`,
  de: `    downloadFrom: 'Herunterladen von',
    microsoftStore: 'Microsoft Store',
    getItOn: 'JETZT BEI',
    googlePlay: 'Google Play',
    flashSale: 'Blitzangebot',
    premiumFor: 'Zeneva Premium für',
    save: '({amount} sparen!)',
    claimOffer: 'Angebot sichern',`,
  it: `    downloadFrom: 'Scaricalo da',
    microsoftStore: 'Microsoft Store',
    getItOn: 'DISPONIBILE SU',
    googlePlay: 'Google Play',
    flashSale: 'Offerta Lampo',
    premiumFor: 'Zeneva Premium a',
    save: '(Risparmia {amount}!)',
    claimOffer: 'Richiedi offerta',`,
  pt: `    downloadFrom: 'Baixar na',
    microsoftStore: 'Microsoft Store',
    getItOn: 'DISPONÍVEL NO',
    googlePlay: 'Google Play',
    flashSale: 'Oferta Flash',
    premiumFor: 'Zeneva Premium por',
    save: '(Economize {amount}!)',
    claimOffer: 'Resgatar oferta',`,
  hi: `    downloadFrom: 'यहाँ से डाउनलोड करें',
    microsoftStore: 'Microsoft Store',
    getItOn: 'यहाँ पाएँ',
    googlePlay: 'Google Play',
    flashSale: 'फ्लैश सेल',
    premiumFor: 'ज़ेनेवा प्रीमियम सिर्फ',
    save: '({amount} बचाएं!)',
    claimOffer: 'ऑफर का लाभ उठाएं',`,
  ja: `    downloadFrom: 'ダウンロード',
    microsoftStore: 'Microsoft Store',
    getItOn: '入手先',
    googlePlay: 'Google Play',
    flashSale: 'フラッシュセール',
    premiumFor: 'Zeneva Premiumを',
    save: '（{amount}お得！）',
    claimOffer: 'オファーを獲得',`,
  ko: `    downloadFrom: '다음에서 다운로드',
    microsoftStore: 'Microsoft Store',
    getItOn: '다운로드 하기',
    googlePlay: 'Google Play',
    flashSale: '플래시 세일',
    premiumFor: 'Zeneva Premium',
    save: '({amount} 절약!)',
    claimOffer: '혜택 받기',`,
  zh: `    downloadFrom: '下载自',
    microsoftStore: 'Microsoft Store',
    getItOn: '获取方式',
    googlePlay: 'Google Play',
    flashSale: '限时抢购',
    premiumFor: 'Zeneva Premium 仅需',
    save: '（立省 {amount}！）',
    claimOffer: '获取优惠',`
};

for (const [lang, block] of Object.entries(translations)) {
  const filePath = path.join(dir, `${lang}.ts`);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipped: ${lang}.ts (not found)`);
    continue;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Normalize line endings to LF
  const normalized = content.replace(/\r\n/g, '\n');
  const targetPattern = '  landing: {\n';
  const targetIndex = normalized.indexOf(targetPattern);
  if (targetIndex === -1) {
    console.log(`Could not find landing: { pattern in ${lang}.ts`);
    continue;
  }
  
  const insertPos = targetIndex + targetPattern.length;
  const part1 = normalized.slice(0, insertPos);
  const part2 = normalized.slice(insertPos);
  
  const updatedContent = (part1 + block + '\n' + part2).replace(/\n/g, '\r\n');
  fs.writeFileSync(filePath, updatedContent, 'utf8');
  console.log(`Updated: ${lang}.ts`);
}
