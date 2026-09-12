const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../src/lib/i18n/messages');

const translations = {
  es: `  tour: {
    skip: 'Saltar',
    done: '¡Vamos!',
    next: 'Siguiente',
    back: 'Atrás',
    welcomeTitle: 'Bienvenido a Zeneva',
    welcomeDesc: 'Tu tienda está oficialmente configurada. Hagamos un recorrido rápido de 3 pasos para ayudarte a comenzar.',
    inventoryTitle: '1. Gestionar Inventario',
    inventoryDesc: 'Aquí es donde agregarás tus productos, realizarás el seguimiento de los niveles de stock y organizarás las categorías.',
    posTitle: '2. Punto de Venta (POS)',
    posDesc: '¿Listo para vender? Usa el POS para cobrar rápidamente a los clientes e imprimir recibos digitales.',
    dashboardTitle: '3. Seguimiento de Análisis',
    dashboardDesc: 'Regresa aquí en cualquier momento para ver tus ventas diarias, el crecimiento de los ingresos y la información de la tienda.',
  },`,
  fr: `  tour: {
    skip: 'Passer',
    done: 'C’est parti !',
    next: 'Suivant',
    back: 'Retour',
    welcomeTitle: 'Bienvenue sur Zeneva',
    welcomeDesc: 'Votre boutique est officiellement configurée. Faisons un tour rapide en 3 étapes pour vous aider à démarrer.',
    inventoryTitle: '1. Gérer l’inventaire',
    inventoryDesc: 'C’est ici que vous ajouterez vos produits, suivrez les niveaux de stock et organiserez les catégories.',
    posTitle: '2. Point de vente (POS)',
    posDesc: 'Prêt à vendre ? Utilisez le POS pour encaisser rapidement les clients et imprimer des reçus numériques.',
    dashboardTitle: '3. Suivi des analyses',
    dashboardDesc: 'Revenez ici à tout moment pour voir vos ventes quotidiennes, la croissance de vos revenus et les insights de votre boutique.',
  },`,
  ar: `  tour: {
    skip: 'تخطي',
    done: 'لنبدأ!',
    next: 'التالي',
    back: 'رجوع',
    welcomeTitle: 'مرحباً بك في زينيفا',
    welcomeDesc: 'تم إعداد متجرك رسمياً. لنأخذ جولة سريعة من 3 خطوات لمساعدتك في البدء.',
    inventoryTitle: '١. إدارة المخزون',
    inventoryDesc: 'هذا هو المكان الذي ستضيف فيه منتجاتك، وتتبع مستويات المخزون، وتنظم الفئات.',
    posTitle: '٢. نقطة البيع (POS)',
    posDesc: 'جاهز للبيع؟ استخدم نقطة البيع لمحاسبة العملاء بسرعة وطباعة الإيصالات الرقمية.',
    dashboardTitle: '٣. تتبع التحليلات',
    dashboardDesc: 'ارجع إلى هنا في أي وقت لرؤية مبيعاتك اليومية، ونمو الإيرادات، ورؤى المتجر.',
  },`,
  de: `  tour: {
    skip: 'Überspringen',
    done: 'Los geht’s!',
    next: 'Weiter',
    back: 'Zurück',
    welcomeTitle: 'Willkommen bei Zeneva',
    welcomeDesc: 'Ihr Geschäft ist offiziell eingerichtet. Machen wir eine kurze 3-Schritte-Tour, um Ihnen den Einstieg zu erleichtern.',
    inventoryTitle: '1. Inventar verwalten',
    inventoryDesc: 'Hier fügen Sie Ihre Produkte hinzu, verfolgen den Lagerbestand und organisieren Kategorien.',
    posTitle: '2. Kasse (POS)',
    posDesc: 'Bereit zum Verkauf? Nutzen Sie die Kasse, um Kunden schnell zu bedienen und digitale Belege zu drucken.',
    dashboardTitle: '3. Analysen verfolgen',
    dashboardDesc: 'Kehren Sie jederzeit hierher zurück, um Ihre täglichen Verkäufe, das Umsatzwachstum und Store-Insights zu sehen.',
  },`,
  it: `  tour: {
    skip: 'Salta',
    done: 'Andiamo!',
    next: 'Avanti',
    back: 'Indietro',
    welcomeTitle: 'Benvenuto in Zeneva',
    welcomeDesc: 'Il tuo negozio è ufficialmente configurato. Facciamo un rapido tour in 3 passaggi per aiutarti a iniziare.',
    inventoryTitle: '1. Gestisci inventario',
    inventoryDesc: 'Qui è dove aggiungerai i tuoi prodotti, monitorerai i livelli di stock e organizzerai le categorie.',
    posTitle: '2. Punto Vendita (POS)',
    posDesc: 'Pronto a vendere? Usa il POS per registrare rapidamente i clienti e stampare ricevute digitali.',
    dashboardTitle: '3. Monitora analisi',
    dashboardDesc: 'Torna qui in qualsiasi momento per vedere le tue vendite giornaliere, la crescita dei ricavi e le informazioni sul negozio.',
  },`,
  pt: `  tour: {
    skip: 'Pular',
    done: 'Vamos lá!',
    next: 'Avançar',
    back: 'Voltar',
    welcomeTitle: 'Bem-vindo ao Zeneva',
    welcomeDesc: 'Sua loja está configurada oficialmente. Vamos fazer um tour rápido de 3 etapas para ajudar você a começar.',
    inventoryTitle: '1. Gerenciar estoque',
    inventoryDesc: 'Aqui é onde você adicionará seus produtos, acompanhará os níveis de estoque e organizará as categorias.',
    posTitle: '2. Ponto de venda (POS)',
    posDesc: 'Pronto para vender? Use o POS para cobrar os clientes rapidamente e imprimir recibos digitais.',
    dashboardTitle: '3. Acompanhar relatórios',
    dashboardDesc: 'Volte aqui a qualquer momento para ver suas vendas diárias, crescimento de receita e insights da loja.',
  },`,
  hi: `  tour: {
    skip: 'छोड़ें',
    done: 'चलो शुरू करें!',
    next: 'आगे',
    back: 'पीछे',
    welcomeTitle: 'ज़ेनेवा में आपका स्वागत है',
    welcomeDesc: 'आपकी दुकान आधिकारिक रूप से सेट हो गई है। शुरू करने में आपकी सहायता के लिए आइए 3-चरणों का एक त्वरित टूर लें।',
    inventoryTitle: '1. इन्वेंटरी प्रबंधित करें',
    inventoryDesc: 'यह वह जगह है जहां आप अपने उत्पाद जोड़ेंगे, स्टॉक स्तरों को ट्रैक करेंगे और श्रेणियों को व्यवस्थित करेंगे।',
    posTitle: '2. पॉइंट ऑफ सेल (POS)',
    posDesc: 'बेचने के लिए तैयार हैं? ग्राहकों को जल्दी से बिल देने और डिजिटल रसीदें प्रिंट करने के लिए POS का उपयोग करें।',
    dashboardTitle: '3. विश्लेषण ट्रैक करें',
    dashboardDesc: 'दैनिक बिक्री, राजस्व वृद्धि और दुकान की जानकारी देखने के लिए किसी भी समय यहाँ वापस आएँ।',
  },`,
  ja: `  tour: {
    skip: 'スキップ',
    done: '始めましょう！',
    next: '次へ',
    back: '戻る',
    welcomeTitle: 'Zenevaへようこそ',
    welcomeDesc: '店舗のセットアップが完了しました。開始をスムーズにするための簡単な3ステップのツアーをご案内します。',
    inventoryTitle: '1. 在庫管理',
    inventoryDesc: 'ここでは、商品の追加、在庫レベルの追跡、カテゴリの整理を行います。',
    posTitle: '2. レジ (POS)',
    posDesc: '販売の準備はできましたか？ POSを使用して迅速に会計を行い、デジタルレシートを発行します。',
    dashboardTitle: '3. 分析の確認',
    dashboardDesc: 'いつでもここに戻って、日々の売上、売上成長、店舗のインサイトを確認できます。',
  },`,
  ko: `  tour: {
    skip: '건너뛰기',
    done: '시작하기!',
    next: '다음',
    back: '이전',
    welcomeTitle: 'Zeneva에 오신 것을 환영합니다',
    welcomeDesc: '상점 설정이 공식적으로 완료되었습니다. 시작하는 데 도움이 되는 간단한 3단계 투어를 진행해 보겠습니다.',
    inventoryTitle: '1. 재고 관리',
    inventoryDesc: '여기에서 상품을 추가하고 재고 수준을 추적하며 카테고리를 구성합니다.',
    posTitle: '2. 판매 시점 관리 (POS)',
    posDesc: '판매할 준비가 되셨나요? POS를 사용하여 신속하게 결제하고 디지털 영수증을 인쇄하세요.',
    dashboardTitle: '3. 분석 추적',
    dashboardDesc: '언제든지 여기로 돌아와 일일 매출, 매출 성장 및 상점 분석 정보를 확인하세요.',
  },`,
  zh: `  tour: {
    skip: '跳过',
    done: '开始吧！',
    next: '下一步',
    back: '上一步',
    welcomeTitle: '欢迎使用 Zeneva',
    welcomeDesc: '您的店铺已正式设置完毕。让我们进行一次简短的3步向导，帮助您快速上手。',
    inventoryTitle: '1. 管理库存',
    inventoryDesc: '在此处添加商品、跟踪库存水平并管理分类。',
    posTitle: '2. 收银台 (POS)',
    posDesc: '准备好销售了吗？使用 POS 快速为顾客结账并打印电子小票。',
    dashboardTitle: '3. 查看数据分析',
    dashboardDesc: '随时回到这里查看您的每日销售额、营业额增长和店铺洞察。',
  },`
};

for (const [lang, block] of Object.entries(translations)) {
  const filePath = path.join(dir, `${lang}.ts`);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipped: ${lang}.ts (not found)`);
    continue;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Normalize line endings to LF to find index, then write back
  const normalized = content.replace(/\r\n/g, '\n');
  const lastIndex = normalized.lastIndexOf('  },\n};');
  if (lastIndex === -1) {
    console.log(`Could not find closing pattern in ${lang}.ts`);
    continue;
  }
  
  const part1 = normalized.slice(0, lastIndex + 5); // include "  },\n"
  const part2 = normalized.slice(lastIndex + 5);
  
  // Add block and restore CRLF if the original file had CRLF
  const updatedContent = (part1 + block + '\n' + part2).replace(/\n/g, '\r\n');
  fs.writeFileSync(filePath, updatedContent, 'utf8');
  console.log(`Updated: ${lang}.ts`);
}
