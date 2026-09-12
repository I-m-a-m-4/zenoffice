
'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { usePOS } from '@/context/pos-context';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, addDoc, collection, serverTimestamp, writeBatch } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Loader2, CalendarIcon, ArrowRight, ArrowLeft, Building, MapPin, Globe, CalendarDays, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackLaunchStage } from '@/lib/launch-telemetry';
import { format } from 'date-fns';
import { ALL_CURRENCIES } from '@/lib/constants';
import { Combobox } from '@/components/ui/combobox';
import { useI18n } from '@/context/i18n-context';
import {
  DEFAULT_LOCALE,
  LOCALES,
  getLocaleDefinition,
  isLocaleCode,
  type LocaleCode,
} from '@/lib/i18n/config';

/**
 * The supported codes as a tuple, so `z.enum` types `data.language` as a
 * `LocaleCode` rather than a bare string — the form value goes straight into
 * `settings.language` and into `setLocale`, and both want the narrow type.
 */
const LOCALE_CODES = LOCALES.map(l => l.code) as [LocaleCode, ...LocaleCode[]];

const onboardingSchemaBase = z.object({
  organizationName: z.string(),
  industry: z.string(),
  address: z.string().optional(),
  state: z.string(),
  country: z.string(),
  currency: z.string(),
  language: z.enum(LOCALE_CODES),
});

type OnboardingFormValues = z.infer<typeof onboardingSchemaBase>;

const industries = [
  'Retail & E-commerce', 'Supermarket & Groceries (Multiple Categories)', 'Pharmacy & Health', 'Fashion & Boutique', 'Restaurant & Cafe', 'Electronics & Gadgets', 'Home & Furniture', 'Other'
];
const months = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'
];

// Map of country name -> ISO 3166-1 alpha-2 code for emoji flag generation
const COUNTRY_CODES: Record<string, string> = {
  "Afghanistan": "AF", "Albania": "AL", "Algeria": "DZ", "Andorra": "AD", "Angola": "AO",
  "Antigua & Barbuda": "AG", "Argentina": "AR", "Armenia": "AM", "Australia": "AU", "Austria": "AT",
  "Azerbaijan": "AZ", "Bahamas": "BS", "Bahrain": "BH", "Bangladesh": "BD", "Barbados": "BB",
  "Belarus": "BY", "Belgium": "BE", "Belize": "BZ", "Benin": "BJ", "Bhutan": "BT",
  "Bolivia": "BO", "Bosnia & Herzegovina": "BA", "Botswana": "BW", "Brazil": "BR", "Brunei": "BN",
  "Bulgaria": "BG", "Burkina Faso": "BF", "Burundi": "BI", "Cabo Verde": "CV", "Cambodia": "KH",
  "Cameroon": "CM", "Canada": "CA", "Central African Republic": "CF", "Chad": "TD", "Chile": "CL",
  "China": "CN", "Colombia": "CO", "Comoros": "KM", "Congo": "CG", "Costa Rica": "CR",
  "Croatia": "HR", "Cuba": "CU", "Cyprus": "CY", "Czechia": "CZ", "DR Congo": "CD",
  "Denmark": "DK", "Djibouti": "DJ", "Dominica": "DM", "Dominican Republic": "DO", "Ecuador": "EC",
  "Egypt": "EG", "El Salvador": "SV", "Equatorial Guinea": "GQ", "Eritrea": "ER", "Estonia": "EE",
  "Eswatini": "SZ", "Ethiopia": "ET", "Fiji": "FJ", "Finland": "FI", "France": "FR",
  "Gabon": "GA", "Gambia": "GM", "Georgia": "GE", "Germany": "DE", "Ghana": "GH",
  "Greece": "GR", "Grenada": "GD", "Guatemala": "GT", "Guinea": "GN", "Guinea-Bissau": "GW",
  "Guyana": "GY", "Haiti": "HT", "Honduras": "HN", "Hungary": "HU", "Iceland": "IS",
  "India": "IN", "Indonesia": "ID", "Iran": "IR", "Iraq": "IQ", "Ireland": "IE",
  "Israel": "IL", "Italy": "IT", "Jamaica": "JM", "Japan": "JP", "Jordan": "JO",
  "Kazakhstan": "KZ", "Kenya": "KE", "Kiribati": "KI", "Kuwait": "KW", "Kyrgyzstan": "KG",
  "Laos": "LA", "Latvia": "LV", "Lebanon": "LB", "Lesotho": "LS", "Liberia": "LR",
  "Libya": "LY", "Liechtenstein": "LI", "Lithuania": "LT", "Luxembourg": "LU", "Madagascar": "MG",
  "Malawi": "MW", "Malaysia": "MY", "Maldives": "MV", "Mali": "ML", "Malta": "MT",
  "Mauritania": "MR", "Mauritius": "MU", "Mexico": "MX", "Moldova": "MD", "Monaco": "MC",
  "Mongolia": "MN", "Montenegro": "ME", "Morocco": "MA", "Mozambique": "MZ", "Myanmar": "MM",
  "Namibia": "NA", "Nepal": "NP", "Netherlands": "NL", "New Zealand": "NZ", "Nicaragua": "NI",
  "Niger": "NE", "Nigeria": "NG", "North Korea": "KP", "North Macedonia": "MK", "Norway": "NO",
  "Oman": "OM", "Pakistan": "PK", "Palestine": "PS", "Panama": "PA", "Papua New Guinea": "PG",
  "Paraguay": "PY", "Peru": "PE", "Philippines": "PH", "Poland": "PL", "Portugal": "PT",
  "Qatar": "QA", "Romania": "RO", "Russia": "RU", "Rwanda": "RW", "Saudi Arabia": "SA",
  "Senegal": "SN", "Serbia": "RS", "Seychelles": "SC", "Sierra Leone": "SL", "Singapore": "SG",
  "Slovakia": "SK", "Slovenia": "SI", "Solomon Islands": "SB", "Somalia": "SO", "South Africa": "ZA",
  "South Korea": "KR", "South Sudan": "SS", "Spain": "ES", "Sri Lanka": "LK", "Sudan": "SD",
  "Sweden": "SE", "Switzerland": "CH", "Syria": "SY", "Tajikistan": "TJ", "Tanzania": "TZ",
  "Thailand": "TH", "Togo": "TG", "Trinidad & Tobago": "TT", "Tunisia": "TN", "Turkey": "TR",
  "Turkmenistan": "TM", "Uganda": "UG", "Ukraine": "UA", "United Arab Emirates": "AE",
  "United Kingdom": "GB", "United States": "US", "Uruguay": "UY", "Uzbekistan": "UZ",
  "Venezuela": "VE", "Vietnam": "VN", "Yemen": "YE", "Zambia": "ZM", "Zimbabwe": "ZW",
};

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  "Afghanistan": "AFN", "Albania": "ALL", "Algeria": "DZD", "Andorra": "EUR", "Angola": "AOA",
  "Antigua & Barbuda": "XCD", "Argentina": "ARS", "Armenia": "AMD", "Australia": "AUD", "Austria": "EUR",
  "Azerbaijan": "AZN", "Bahamas": "BSD", "Bahrain": "BHD", "Bangladesh": "BDT", "Barbados": "BBD",
  "Belarus": "BYN", "Belgium": "EUR", "Belize": "BZD", "Benin": "XOF", "Bhutan": "BTN",
  "Bolivia": "BOB", "Bosnia & Herzegovina": "BAM", "Botswana": "BWP", "Brazil": "BRL", "Brunei": "BND",
  "Bulgaria": "BGN", "Burkina Faso": "XOF", "Burundi": "BIF", "Cabo Verde": "CVE", "Cambodia": "KHR",
  "Cameroon": "XAF", "Canada": "CAD", "Central African Republic": "XAF", "Chad": "XAF", "Chile": "CLP",
  "China": "CNY", "Colombia": "COP", "Comoros": "KMF", "Congo": "XAF", "Costa Rica": "CRC",
  "Croatia": "EUR", "Cuba": "CUP", "Cyprus": "EUR", "Czechia": "CZK", "DR Congo": "CDF",
  "Denmark": "DKK", "Djibouti": "DJF", "Dominica": "XCD", "Dominican Republic": "DOP", "Ecuador": "USD",
  "Egypt": "EGP", "El Salvador": "USD", "Equatorial Guinea": "XAF", "Eritrea": "ERN", "Estonia": "EUR",
  "Eswatini": "SZL", "Ethiopia": "ETB", "Fiji": "FJD", "Finland": "EUR", "France": "EUR",
  "Gabon": "XAF", "Gambia": "GMD", "Georgia": "GEL", "Germany": "EUR", "Ghana": "GHS",
  "Greece": "EUR", "Grenada": "XCD", "Guatemala": "GTQ", "Guinea": "GNF", "Guinea-Bissau": "XOF",
  "Guyana": "GYD", "Haiti": "HTG", "Honduras": "HNL", "Hungary": "HUF", "Iceland": "ISK",
  "India": "INR", "Indonesia": "IDR", "Iran": "IRR", "Iraq": "IQD", "Ireland": "EUR",
  "Israel": "ILS", "Italy": "EUR", "Jamaica": "JMD", "Japan": "JPY", "Jordan": "JOD",
  "Kazakhstan": "KZT", "Kenya": "KES", "Kiribati": "AUD", "Kuwait": "KWD", "Kyrgyzstan": "KGS",
  "Laos": "LAK", "Latvia": "EUR", "Lebanon": "LBP", "Lesotho": "LSL", "Liberia": "LRD",
  "Libya": "LYD", "Liechtenstein": "CHF", "Lithuania": "EUR", "Luxembourg": "EUR", "Madagascar": "MGA",
  "Malawi": "MWK", "Malaysia": "MYR", "Maldives": "MVR", "Mali": "XOF", "Malta": "EUR",
  "Mauritania": "MRU", "Mauritius": "MUR", "Mexico": "MXN", "Moldova": "MDL", "Monaco": "EUR",
  "Mongolia": "MNT", "Montenegro": "EUR", "Morocco": "MAD", "Mozambique": "MZN", "Myanmar": "MMK",
  "Namibia": "NAD", "Nepal": "NPR", "Netherlands": "EUR", "New Zealand": "NZD", "Nicaragua": "NIO",
  "Niger": "XOF", "Nigeria": "NGN", "North Korea": "KPW", "North Macedonia": "MKD", "Norway": "NOK",
  "Oman": "OMR", "Pakistan": "PKR", "Palestine": "ILS", "Panama": "PAB", "Papua New Guinea": "PGK",
  "Paraguay": "PYG", "Peru": "PEN", "Philippines": "PHP", "Poland": "PLN", "Portugal": "EUR",
  "Qatar": "QAR", "Romania": "RON", "Russia": "RUB", "Rwanda": "RWF", "Saudi Arabia": "SAR",
  "Senegal": "XOF", "Serbia": "RSD", "Seychelles": "SCR", "Sierra Leone": "SLL", "Singapore": "SGD",
  "Slovakia": "EUR", "Slovenia": "EUR", "Solomon Islands": "SBD", "Somalia": "SOS", "South Africa": "ZAR",
  "South Korea": "KRW", "South Sudan": "SSP", "Spain": "EUR", "Sri Lanka": "LKR", "Sudan": "SDG",
  "Sweden": "SEK", "Switzerland": "CHF", "Syria": "SYP", "Tajikistan": "TJS", "Tanzania": "TZS",
  "Thailand": "THB", "Togo": "XOF", "Trinidad & Tobago": "TTD", "Tunisia": "TND", "Turkey": "TRY",
  "Turkmenistan": "TMT", "Uganda": "UGX", "Ukraine": "UAH", "United Arab Emirates": "AED",
  "United Kingdom": "GBP", "United States": "USD", "Uruguay": "UYU", "Uzbekistan": "UZS",
  "Venezuela": "VES", "Vietnam": "VND", "Yemen": "YER", "Zambia": "ZMW", "Zimbabwe": "ZWL",
};

// Convert ISO code to flag emoji (uses regional indicator symbols)
// Generate flagcdn.com URL from ISO code (same approach used in the admin dashboard)
const getFlagUrl = (code: string) =>
  `https://flagcdn.com/w40/${code.toLowerCase()}.png`;

const COUNTRY_OPTIONS = Object.keys(COUNTRY_CODES).map((name) => ({
  label: name,
  value: name,
  flag: getFlagUrl(COUNTRY_CODES[name]),
}));

/**
 * Language options, in the same shape and order as the Settings switcher.
 *
 * `nativeLabel (label)` rather than either alone: somebody who has landed on an
 * English form needs "Français (French)" to find their own language *and* to be
 * sure of what they picked. Showing only the endonym makes the list unsearchable
 * for anyone whose keyboard does not produce it.
 */
const LANGUAGE_OPTIONS = LOCALES.map((l) => ({
  value: l.code,
  label: `${l.nativeLabel} (${l.label})`,
}));

/** The Combobox hands back a plain string; narrow it before hitting the registry. */
const localeDefinitionFor = (value: string) =>
  getLocaleDefinition(isLocaleCode(value) ? value : DEFAULT_LOCALE);

const ONBOARDING_TRANSLATIONS: Record<string, {
  title: string;
  subtitle: string;
  stepProfile: string;
  stepLocation: string;
  stepCurrency: string;
  storeName: string;
  industry: string;
  address: string;
  state: string;
  country: string;
  currency: string;
  language: string;
  next: string;
  back: string;
  finish: string;
  noteCurrency: string;
  noteLanguage: string;
  selectIndustry: string;
  searchIndustries: string;
  selectCountry: string;
  searchCountries: string;
  selectCurrency: string;
  searchCurrencies: string;
  selectLanguage: string;
  searchLanguages: string;
  orgNameMin: string;
  industryMin: string;
  stateMin: string;
  countryMin: string;
  currencyMin: string;
}> = {
  en: {
    title: "Set Up Your Zeneva Store, {name}",
    subtitle: "Quick setup — you can always edit these details later in Settings.",
    stepProfile: "Business Profile",
    stepLocation: "Store Location",
    stepCurrency: "Store Currency",
    storeName: "Store / Business Name",
    industry: "Business Industry",
    address: "Business Address",
    state: "State/Province",
    country: "Country",
    currency: "Store Currency",
    language: "App Language",
    next: "Next",
    back: "Back",
    finish: "Finish Setup",
    noteCurrency: "The currency you select will be used for all register sales, receipt printing, and invoices.",
    noteLanguage: "Zeneva is set to English by default. If another language suits you better, pick it here — you can change it any time in Settings → General.",
    selectIndustry: "Select an industry",
    searchIndustries: "Search industries...",
    selectCountry: "Select Country",
    searchCountries: "Search countries...",
    selectCurrency: "Select Currency",
    searchCurrencies: "Search currencies...",
    selectLanguage: "Select a language",
    searchLanguages: "Search languages...",
    orgNameMin: "Organization name is required.",
    industryMin: "Please select an industry.",
    stateMin: "State is required.",
    countryMin: "Country is required.",
    currencyMin: "Currency is required."
  },
  es: {
    title: "Configura tu tienda Zeneva, {name}",
    subtitle: "Configuración rápida — siempre puedes editar estos detalles más tarde en Ajustes.",
    stepProfile: "Perfil de la empresa",
    stepLocation: "Ubicación de la tienda",
    stepCurrency: "Moneda de la tienda",
    storeName: "Nombre de la tienda / negocio",
    industry: "Sector comercial",
    address: "Dirección del negocio",
    state: "Estado / Provincia",
    country: "País",
    currency: "Moneda de la tienda",
    language: "Idioma de la aplicación",
    next: "Siguiente",
    back: "Atrás",
    finish: "Completar configuración",
    noteCurrency: "La moneda que selecciones se utilizará para todas las ventas del registro, impresión de recibos y facturas.",
    noteLanguage: "Zeneva está configurado en inglés por defecto. Si otro idioma te conviene más, selecciónalo aquí; puedes cambiarlo en cualquier momento en Ajustes → General.",
    selectIndustry: "Selecciona un sector",
    searchIndustries: "Buscar sectores...",
    selectCountry: "Seleccionar país",
    searchCountries: "Buscar países...",
    selectCurrency: "Seleccionar moneda",
    searchCurrencies: "Buscar monedas...",
    selectLanguage: "Seleccionar idioma",
    searchLanguages: "Buscar idiomas...",
    orgNameMin: "El nombre de la organización es obligatorio.",
    industryMin: "Por favor selecciona un sector.",
    stateMin: "El estado es obligatorio.",
    countryMin: "El país es obligatorio.",
    currencyMin: "La moneda es obligatoria."
  },
  fr: {
    title: "Configurez votre boutique Zeneva, {name}",
    subtitle: "Configuration rapide — vous pouvez modifier ces détails à tout moment dans Paramètres.",
    stepProfile: "Profil de l'entreprise",
    stepLocation: "Emplacement de la boutique",
    stepCurrency: "Devise de la boutique",
    storeName: "Nom de la boutique / entreprise",
    industry: "Secteur d'activité",
    address: "Adresse de l'entreprise",
    state: "État / Province",
    country: "Pays",
    currency: "Devise de la boutique",
    language: "Langue de l'application",
    next: "Suivant",
    back: "Retour",
    finish: "Terminer la configuration",
    noteCurrency: "La devise sélectionnée sera utilisée pour toutes les ventes de caisse, l'impression des reçus et les factures.",
    noteLanguage: "Zeneva est configuré en anglais par défaut. Si une autre langue vous convient mieux, choisissez-la ici — vous pouvez la changer à tout moment dans Paramètres → Général.",
    selectIndustry: "Sélectionnez un secteur",
    searchIndustries: "Rechercher des secteurs...",
    selectCountry: "Sélectionner le pays",
    searchCountries: "Rechercher des pays...",
    selectCurrency: "Sélectionner la devise",
    searchCurrencies: "Rechercher des devises...",
    selectLanguage: "Sélectionner une langue",
    searchLanguages: "Rechercher des langues...",
    orgNameMin: "Le nom de l'organisation est requis.",
    industryMin: "Veuillez sélectionner un secteur.",
    stateMin: "L'État est requis.",
    countryMin: "Le pays est requis.",
    currencyMin: "La devise est requise."
  },
  de: {
    title: "Richten Sie Ihren Zeneva-Shop ein, {name}",
    subtitle: "Schnelle Einrichtung — Sie können diese Angaben später in den Einstellungen ändern.",
    stepProfile: "Geschäftsprofil",
    stepLocation: "Standort des Shops",
    stepCurrency: "Währung des Shops",
    storeName: "Name des Shops / Geschäfts",
    industry: "Branche",
    address: "Geschäftsadresse",
    state: "Bundesland / Provinz",
    country: "Land",
    currency: "Währung des Shops",
    language: "App-Sprache",
    next: "Weiter",
    back: "Zurück",
    finish: "Einrichtung abschließen",
    noteCurrency: "Die gewählte Währung wird für alle Registrierkassenverkäufe, den Belegdruck und Rechnungen verwendet.",
    noteLanguage: "Zeneva ist standardmäßig auf Englisch eingestellt. Wenn eine andere Sprache besser passt, wählen Sie sie hier aus — Sie können sie jederzeit unter Einstellungen → Allgemein ändern.",
    selectIndustry: "Branche auswählen",
    searchIndustries: "Branchen suchen...",
    selectCountry: "Land auswählen",
    searchCountries: "Länder suchen...",
    selectCurrency: "Währung auswählen",
    searchCurrencies: "Währungen suchen...",
    selectLanguage: "Sprache auswählen",
    searchLanguages: "Sprachen suchen...",
    orgNameMin: "Name der Organisation ist erforderlich.",
    industryMin: "Bitte wählen Sie eine branche aus.",
    stateMin: "Bundesland ist erforderlich.",
    countryMin: "Land ist erforderlich.",
    currencyMin: "Währung ist erforderlich."
  },
  it: {
    title: "Configura il tuo negozio Zeneva, {name}",
    subtitle: "Configurazione rapida — puoi sempre modificare questi dettagli in seguito in Impostazioni.",
    stepProfile: "Profilo aziendale",
    stepLocation: "Posizione del negozio",
    stepCurrency: "Valuta del negozio",
    storeName: "Nome del negozio / attività",
    industry: "Settore commerciale",
    address: "Indirizzo dell'attività",
    state: "Stato / Provincia",
    country: "Paese",
    currency: "Valuta del negozio",
    language: "Lingua dell'applicazione",
    next: "Avanti",
    back: "Indietro",
    finish: "Completa la configurazione",
    noteCurrency: "La valuta selezionata verrà utilizzata per tutte le vendite di cassa, la stampa delle ricevute e le fatture.",
    noteLanguage: "Zeneva è impostato su Inglese come predefinito. Se preferisci un'altra lingua, selezionala qui — puoi cambiarla in qualsiasi momento in Impostazioni → Generale.",
    selectIndustry: "Seleziona un settore",
    searchIndustries: "Cerca settori...",
    selectCountry: "Seleziona Paese",
    searchCountries: "Cerca paesi...",
    selectCurrency: "Seleziona valuta",
    searchCurrencies: "Cerca valute...",
    selectLanguage: "Seleziona una lingua",
    searchLanguages: "Cerca lingue...",
    orgNameMin: "Il nome dell'organizzazione è richiesto.",
    industryMin: "Seleziona un settore.",
    stateMin: "Lo stato è richiesto.",
    countryMin: "Il paese è richiesto.",
    currencyMin: "La valuta è richiesta."
  },
  pt: {
    title: "Configure sua loja Zeneva, {name}",
    subtitle: "Configuração rápida — você sempre pode editar esses detalhes mais tarde em Configurações.",
    stepProfile: "Perfil do negócio",
    stepLocation: "Localização da loja",
    stepCurrency: "Moeda da loja",
    storeName: "Nome da loja / empresa",
    industry: "Setor comercial",
    address: "Endereço comercial",
    state: "Estado / Província",
    country: "País",
    currency: "Moeda da loja",
    language: "Idioma do aplicativo",
    next: "Avançar",
    back: "Voltar",
    finish: "Concluir configuração",
    noteCurrency: "A moeda selecionada será usada para todas as vendas no PDV, impressão de recibos e faturas.",
    noteLanguage: "Zeneva está configurado em Inglês por padrão. Se outro idioma for melhor para você, escolha-o aqui — você pode mudar a qualquer momento em Configurações → Geral.",
    selectIndustry: "Selecione um setor",
    searchIndustries: "Buscar setores...",
    selectCountry: "Selecione o País",
    searchCountries: "Buscar países...",
    selectCurrency: "Selecione a moeda",
    searchCurrencies: "Buscar moedas...",
    selectLanguage: "Selecione um idioma",
    searchLanguages: "Buscar idiomas...",
    orgNameMin: "O nome da organização é obrigatório.",
    industryMin: "Por favor, selecione um setor.",
    stateMin: "O estado é obrigatório.",
    countryMin: "O país é obrigatório.",
    currencyMin: "A moeda é obrigatória."
  },
  ar: {
    title: "إعداد متجر Zeneva الخاص بك، {name}",
    subtitle: "إعداد سريع — يمكنك دائمًا تعديل هذه التفاصيل لاحقًا في الإعدادات.",
    stepProfile: "ملف تعريف النشاط التجاري",
    stepLocation: "موقع المتجر",
    stepCurrency: "عملة المتجر",
    storeName: "اسم المتجر / النشاط التجاري",
    industry: "مجال العمل",
    address: "عنوان النشاط التجاري",
    state: "الولاية / المقاطعة",
    country: "البلد",
    currency: "عملة المتجر",
    language: "لغة التطبيق",
    next: "التالي",
    back: "السابق",
    finish: "إنهاء الإعداد",
    noteCurrency: "سيتم استخدام العملة التي تحددها لجميع مبيعات الكاشير وطباعة الإيصالات والفواتير.",
    noteLanguage: "تم إعداد Zeneva باللغة الإنجليزية افتراضيًا. إذا كانت هناك لغة أخرى تناسبك بشكل أفضل، فاخترها من هنا — يمكنك تغييرها في أي وقت في الإعدادات ← عام.",
    selectIndustry: "اختر مجال العمل",
    searchIndustries: "البحث في مجالات العمل...",
    selectCountry: "اختر البلد",
    searchCountries: "البحث عن البلدان...",
    selectCurrency: "اختر العملة",
    searchCurrencies: "البحث عن العملات...",
    selectLanguage: "اختر اللغة",
    searchLanguages: "البحث عن اللغات...",
    orgNameMin: "اسم المؤسسة مطلوب.",
    industryMin: "يرجى اختيار مجال العمل.",
    stateMin: "الولاية مطلوبة.",
    countryMin: "البلد مطلوب.",
    currencyMin: "العملة مطلوبة."
  },
  hi: {
    title: "अपना Zeneva स्टोर सेटअप करें, {name}",
    subtitle: "त्वरित सेटअप — आप हमेशा सेटिंग में बाद में इन विवरणों को संपादित कर सकते हैं।",
    stepProfile: "व्यापार प्रोफ़ाइल",
    stepLocation: "स्टोर स्थान",
    stepCurrency: "स्टोर मुद्रा",
    storeName: "स्टोर / व्यापार का नाम",
    industry: "व्यापार उद्योग",
    address: "व्यापार का पता",
    state: "राज्य / प्रांत",
    country: "देश",
    currency: "स्टोर मुद्रा",
    language: "ऐप की भाषा",
    next: "अगला",
    back: "पीछे",
    finish: "सेटअप समाप्त करें",
    noteCurrency: "आपके द्वारा चुनी गई मुद्रा का उपयोग सभी रजिस्टर बिक्री, रसीद छपाई और इनवॉइस के लिए किया जाएगा।",
    noteLanguage: "Zeneva डिफ़ॉल्ट रूप से अंग्रेजी पर सेट है। यदि कोई अन्य भाषा आपके लिए बेहतर है, तो उसे यहाँ चुनें — आप इसे किसी भी समय सेटिंग → सामान्य में बदल सकते हैं।",
    selectIndustry: "उद्योग चुनें",
    searchIndustries: "उद्योग खोजें...",
    selectCountry: "देश चुनें",
    searchCountries: "देश खोजें...",
    selectCurrency: "मुद्रा चुनें",
    searchCurrencies: "मुद्रा खोजें...",
    selectLanguage: "भाषा चुनें",
    searchLanguages: "भाषा खोजें...",
    orgNameMin: "संगठन का नाम आवश्यक है।",
    industryMin: "कृपया एक उद्योग चुनें।",
    stateMin: "राज्य आवश्यक है।",
    countryMin: "देश आवश्यक है।",
    currencyMin: "मुद्रा आवश्यक है।"
  },
  ja: {
    title: "Zenevaストアを設定する、{name}さん",
    subtitle: "クイック設定 — これらの詳細は後で設定画面からいつでも変更できます。",
    stepProfile: "ビジネス情報",
    stepLocation: "店舗の所在地",
    stepCurrency: "店舗の通貨",
    storeName: "店舗名 / 会社名",
    industry: "業種",
    address: "店舗の住所",
    state: "都道府県 / 地域",
    country: "国",
    currency: "店舗の通貨",
    language: "アプリの言語",
    next: "次へ",
    back: "戻る",
    finish: "設定を完了する",
    noteCurrency: "選択した通貨は、すべてのレジ販売、レシート印刷、および請求書で使用されます。",
    noteLanguage: "Zenevaはデフォルトで英語に設定されています。他の言語をご希望の場合はこちらで選択してください。設定 → 一般 からいつでも変更できます。",
    selectIndustry: "業種を選択してください",
    searchIndustries: "業種を検索...",
    selectCountry: "国を選択してください",
    searchCountries: "国を検索...",
    selectCurrency: "通貨を選択してください",
    searchCurrencies: "通貨を検索...",
    selectLanguage: "言語を選択してください",
    searchLanguages: "言語を検索...",
    orgNameMin: "組織名は必須です。",
    industryMin: "業種を選択してください。",
    stateMin: "都道府県は必須です。",
    countryMin: "国は必須です。",
    currencyMin: "通貨は必須です。"
  },
  ko: {
    title: "Zeneva 상점 설정하기, {name}님",
    subtitle: "빠른 설정 — 나중에 설정에서 언제든지 수정하실 수 있습니다.",
    stepProfile: "비즈니스 프로필",
    stepLocation: "상점 위치",
    stepCurrency: "상점 통화",
    storeName: "상점 / 회사명",
    industry: "업종",
    address: "상점 주소",
    state: "시/도",
    country: "국가",
    currency: "상점 통화",
    language: "앱 언어",
    next: "다음",
    back: "이전",
    finish: "설정 완료",
    noteCurrency: "선택하신 통화는 모든 포스 판매, 영수증 출력 및 인보이스에 사용됩니다.",
    noteLanguage: "Zeneva는 기본적으로 영어로 설정되어 있습니다. 다른 언어가 더 편하시다면 여기서 선택해 주세요. 설정 → 일반 에서 언제든지 변경하실 수 있습니다.",
    selectIndustry: "업종 선택",
    searchIndustries: "업종 검색...",
    selectCountry: "국가 선택",
    searchCountries: "국가 검색...",
    selectCurrency: "통화 선택",
    searchCurrencies: "통화 검색...",
    selectLanguage: "언어 선택",
    searchLanguages: "언어 검색...",
    orgNameMin: "회사명은 필수 입력 항목입니다.",
    industryMin: "업종을 선택해 주세요.",
    stateMin: "시/도는 필수 입력 항목입니다.",
    countryMin: "국가는 필수 입력 항목입니다.",
    currencyMin: "통화는 필수 입력 항목입니다."
  },
  zh: {
    title: "设置您的 Zeneva 商店，{name}",
    subtitle: "快速设置 — 您稍后随时可以在“设置”中修改这些信息。",
    stepProfile: "商家资料",
    stepLocation: "商店地址",
    stepCurrency: "商店货币",
    storeName: "商店 / 商家名称",
    industry: "行业类别",
    address: "商家地址",
    state: "省份 / 州",
    country: "国家 / 地区",
    currency: "商店货币",
    language: "应用语言",
    next: "下一步",
    back: "上一步",
    finish: "完成设置",
    noteCurrency: "您选择的货币将用于所有收银销售、收据打印和发票。",
    noteLanguage: "Zeneva 默认设置为英文。如果您更偏好其他语言，请在此处选择 — 您可以随时在“设置 → 常规”中进行更改。",
    selectIndustry: "选择行业",
    searchIndustries: "搜索行业...",
    selectCountry: "选择国家",
    searchCountries: "搜索国家...",
    selectCurrency: "选择货币",
    searchCurrencies: "搜索货币...",
    selectLanguage: "选择语言",
    searchLanguages: "搜索语言...",
    orgNameMin: "组织名称是必填项。",
    industryMin: "请选择一个行业。",
    stateMin: "省份是必填项。",
    countryMin: "国家是必填项。",
    currencyMin: "货币是必填项。"
  }
};

const OnboardingStepper = ({ currentStep, steps }: { currentStep: number, steps: { name: string, icon: any }[] }) => (
  <nav aria-label="Progress" className="w-full max-w-xl mx-auto px-4 relative mb-12">
    <ol role="list" className="flex items-center justify-between w-full relative">
      {/* Background connecting line */}
      <div className="absolute top-5 left-4 right-4 h-0.5 bg-muted z-0" />
      
      {/* Active progress line */}
      <div 
        className="absolute top-5 left-4 h-0.5 bg-primary transition-all duration-500 ease-in-out z-0" 
        style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 96}%` }}
      />

      {steps.map((step, stepIdx) => {
        const isCompleted = stepIdx < currentStep - 1;
        const isActive = stepIdx === currentStep - 1;
        
        return (
          <li key={step.name} className="relative flex flex-col items-center flex-1 z-10">
            {isCompleted ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all duration-300 shadow-md">
                <step.icon className="h-5 w-5" />
              </div>
            ) : isActive ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary bg-background ring-4 ring-primary/20 transition-all duration-300 shadow-md">
                <step.icon className="h-5 w-5 text-primary" />
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-border bg-background transition-all duration-300">
                <step.icon className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            
            <span className={cn(
              "mt-3 text-xs font-semibold whitespace-nowrap transition-colors duration-300",
              isActive ? "text-primary font-bold" : "text-muted-foreground"
            )}>
              {step.name}
            </span>
          </li>
        );
      })}
    </ol>
  </nav>
);

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { business, currentUserProfile, triggerRefresh } = usePOS();
  /*
   * `locale` seeds the field and `setLocale` applies the choice.
   *
   * The provider has already resolved a locale by the time this page renders —
   * device choice, then browser language, then English — so seeding from it means
   * somebody arriving from a `fr-FR` browser, or who used the marketing header's
   * switcher before signing up, finds French already selected rather than having to
   * set it a second time. It falls back to English, which is what makes this an
   * opt-out rather than a question with no good default.
   */
  const { locale, setLocale } = useI18n();

  const t = React.useMemo(() => {
    return ONBOARDING_TRANSLATIONS[locale] || ONBOARDING_TRANSLATIONS.en;
  }, [locale]);

  const schema = React.useMemo(() => {
    return z.object({
      organizationName: z.string().min(3, t.orgNameMin),
      industry: z.string().min(1, t.industryMin),
      address: z.string().optional(),
      state: z.string().min(2, t.stateMin),
      country: z.string().min(2, t.countryMin),
      currency: z.string().min(1, t.currencyMin),
      language: z.enum(LOCALE_CODES),
    });
  }, [t]);

  const steps = React.useMemo(() => [
    { name: t.stepProfile, icon: Building, fields: ['organizationName', 'industry', 'language'] },
    { name: t.stepLocation, icon: MapPin, fields: ['address', 'state', 'country'] },
    { name: t.stepCurrency, icon: Landmark, fields: ['currency'] },
  ], [t]);

  const [mounted, setMounted] = React.useState(false);
  const [step, setStep] = React.useState(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const authUser = getAuth().currentUser;
    if (authUser && firestore && mounted) {
      import('firebase/firestore').then(({ setDoc, doc, serverTimestamp }) => {
        setDoc(doc(firestore, 'users', authUser.uid), {
          onboardingStep: step,
          onboardingLastActive: serverTimestamp()
        }, { merge: true }).catch(() => {});
      });
    }
  }, [step, firestore, mounted]);



  const [currencies, setCurrencies] = React.useState(ALL_CURRENCIES);

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      organizationName: business?.name || '',
      industry: '',
      address: '',
      state: '',
      country: '',
      currency: 'NGN',
      language: locale,
    },
  });

  const selectedCountry = form.watch('country');

  React.useEffect(() => {
    if (selectedCountry && COUNTRY_TO_CURRENCY[selectedCountry]) {
      form.setValue('currency', COUNTRY_TO_CURRENCY[selectedCountry], { shouldValidate: true });
    }
  }, [selectedCountry, form]);

  /*
   * Follow the provider's resolved locale until the owner touches the field.
   *
   * `defaultValues` alone is not enough: the provider deliberately starts at English
   * so the client's first paint matches the server-rendered markup, and applies the
   * real locale in an effect. So a French browser's locale arrives *after* this form
   * is constructed, and without this the field would sit on English while the rest of
   * the app had already switched — the one combination guaranteed to look broken.
   *
   * A ref rather than react-hook-form's `dirtyFields`, because dirty is defined
   * against `defaultValues`: somebody on a French browser who deliberately picks
   * English would set the field back to its default value, RHF would drop it from
   * `dirtyFields`, and their explicit choice would look untouched to this effect. A
   * ref set in `onChange` records *that they chose*, which is the actual question.
   */
  const languageTouchedRef = React.useRef(false);

  React.useEffect(() => {
    if (languageTouchedRef.current) return;
    if (form.getValues('language') === locale) return;
    form.setValue('language', locale);
  }, [locale, form]);


  const onSubmit = async (data: OnboardingFormValues) => {
    /*
     * Only the last step may submit.
     *
     * The footer renders "Next" and "Finish Setup" at the same position, so React
     * reconciled them as one element and patched the existing <button> in place -
     * `type` flipped from "button" to "submit" and the onClick was dropped, while
     * the node kept its focus and stayed under the cursor. A second click on a
     * "Next" that felt unresponsive (`form.trigger` is awaited, and the step
     * cross-fades for 200ms) therefore landed on a submit button and finished
     * setup on its own. Distinct `key`s on those two buttons stop the node being
     * reused; this is the backstop, because the form is valid from step 3 onward
     * and anything that submits early would succeed rather than fail loudly.
     */
    if (step < steps.length) return;

    const authUser = getAuth().currentUser;
    const bId = currentUserProfile?.businessId || business?.id;

    if (!authUser || !bId) {
      toast({ variant: 'destructive', title: 'Session Error', description: 'Your session has expired. Please log in again.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const batch = writeBatch(firestore);
      
      let localTimezone = 'Africa/Lagos';
      try {
        localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos';
      } catch {}
      
      // 1. Update Business Instance
      const businessDocRef = doc(firestore, 'businessInstances', bId);
      batch.update(businessDocRef, {
        name: data.organizationName,
        address: data.address,
        'settings.industry': data.industry,
        'settings.state': data.state,
        'settings.country': data.country,
        'settings.currency': data.currency,
        /*
         * A locale **code**, not a display name.
         *
         * This used to be the literal string `'English'` regardless of anything —
         * which is why `resolveLocale` carries an alias table for display names, and
         * why every shop that ever completed onboarding has `'English'` on its
         * business record. The aliases stay for those records; new ones get `'fr'`.
         * `LanguageSwitcher` in Settings has always written the code.
         */
        'settings.language': data.language,
        'settings.timezone': localTimezone,
        'settings.inventoryStartDate': new Date(),
        'settings.fiscalYearStart': 'January',
      });

      // 2. Update User Profile
      const userDocRef = doc(firestore, 'users', authUser.uid);
      batch.update(userDocRef, {
        surveyCompleted: true,
      });

      // 3. Create Welcome Notification
      const notifRef = doc(collection(firestore, `users/${authUser.uid}/notifications`));
      batch.set(notifRef, {
          title: "Welcome to Zeneva",
          body: `Hi ${currentUserProfile?.name || 'there'}, your organization setup for ${data.organizationName} is complete. Explore your dashboard to get started!`,
          createdAt: serverTimestamp(),
          read: false,
          type: 'system',
          clickable: false
      });

      await batch.commit();

      /*
       * Belt and braces: the field's `onChange` already applied this.
       *
       * It used to be applied only here, deliberately, on two arguments that did
       * not survive contact with users. The first was that this page is hardcoded
       * English so a live switch "would visibly change nothing" - but a control
       * that appears to do nothing when you use it is the complaint, not the
       * defence, and `setLocale` does flip `document.dir` for the RTL locales. The
       * second was that a failed batch would leave the language changed while the
       * owner retried; that is a device preference they just chose on purpose, and
       * it is cheap next to a language picker that looks dead.
       *
       * Kept as a no-op for the path where the field was never touched and the
       * provider's resolved locale is what gets written. `setLocale` marks an
       * explicit device choice, which is what makes it stick: `LocaleSync` calls
       * `adoptLocale`, and that deliberately yields to an explicit choice.
       */
      if (data.language !== locale) setLocale(data.language);

      // Set a bypass flag so the layout guard doesn't block the redirect
      // while the Firestore real-time listener catches up with the surveyCompleted change
      sessionStorage.setItem('zeneva_onboarding_complete', 'true');
      localStorage.setItem('zeneva_needs_tour', 'true');

      toast({ variant: 'success', title: 'Setup Complete!', description: 'Welcome to your Zeneva dashboard.' });
      void trackLaunchStage('onboarding_completed');
      router.push('/inventory');
    } catch (error) {
      console.error('Onboarding submission error:', error);
      void trackLaunchStage('signup_failed', 'onboarding-submit');
      toast({ variant: 'destructive', title: 'Submission Failed', description: 'Could not save your preferences. Please try again.' });
      setIsSubmitting(false);
    }
  };

  /** Latch so an impatient second click cannot advance two steps at once. */
  const advancingRef = React.useRef(false);

  const handleNextStep = async () => {
    // `form.trigger` is awaited and the step transition cross-fades for 200ms, so
    // the button feels unresponsive and gets clicked again. Unlatched, that ran
    // `setStep(prev => prev + 1)` twice and `steps[step - 1]` then read past the
    // end of the array; the clamp is the second half of that guard.
    if (advancingRef.current) return;
    advancingRef.current = true;
    try {
      const fieldsToValidate = steps[step - 1].fields as (keyof OnboardingFormValues)[];
      const isValid = await form.trigger(fieldsToValidate);
      if (isValid) {
        setStep(prev => Math.min(prev + 1, steps.length));
      }
    } finally {
      advancingRef.current = false;
    }
  };

  const handlePrevStep = () => {
    setStep(prev => prev - 1);
  };

  if (!mounted || !business || !currentUserProfile) {
    return <div className="flex justify-center items-center h-screen bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="fixed inset-0 z-50 w-full flex flex-col items-center justify-center min-h-screen py-8 px-4 lg:px-8 bg-background/40 overflow-y-auto backdrop-blur-sm">
      
      <div className="w-full max-w-4xl space-y-5 sm:space-y-6 bg-gradient-to-b from-orange-500/10 via-card/95 to-card/95 dark:via-card/80 dark:to-card/80 backdrop-blur-xl border border-dashed border-orange-500/40 p-6 sm:p-8 rounded-xl my-auto shadow-none">
        <div className="text-center mb-6 relative z-10">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            {t.title.replace('{name}', currentUserProfile?.name ? currentUserProfile.name.split(' ')[0] : 'Merchant')}
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm max-w-xl mx-auto">
            {t.subtitle}
          </p>
        </div>

        <OnboardingStepper currentStep={step} steps={steps} />

        <Card className="mt-4 sm:mt-6 bg-transparent border-0 shadow-none">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  {step === 1 && (
                    <CardContent className="pt-2 pb-2 space-y-5">
                      <CardTitle className="flex items-center gap-3 text-lg sm:text-2xl font-bold"><Building className="text-primary h-5 w-5 sm:h-6 sm:w-6" /> {t.stepProfile}</CardTitle>
                      <FormField control={form.control} name="organizationName" render={({ field }) => (
                        <FormItem className="space-y-2"><FormLabel className="text-xs sm:text-sm font-semibold">{t.storeName} <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="e.g. Zenith Supermarket" className="h-10 sm:h-12 text-sm shadow-none" {...field} /></FormControl><FormMessage className="text-[11px]" /></FormItem>
                      )} />
                      <FormField control={form.control} name="industry" render={({ field }) => (
                        <FormItem className="space-y-2"><FormLabel className="text-xs sm:text-sm font-semibold">{t.industry} <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Combobox
                              options={industries.map(i => ({ label: i, value: i }))}
                              value={field.value}
                              onChange={field.onChange}
                              placeholder={t.selectIndustry}
                              searchPlaceholder={t.searchIndustries}
                              triggerClassName="h-10 sm:h-12 text-sm font-normal justify-between w-full"
                              avoidCollisions={false}
                            />
                          </FormControl>
                          <FormMessage className="text-[11px]" /></FormItem>
                      )} />
                      <FormField control={form.control} name="language" render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-xs sm:text-sm font-semibold">{t.language}</FormLabel>
                          <FormControl>
                            <Combobox
                              options={LANGUAGE_OPTIONS}
                              value={field.value}
                              onChange={(value) => {
                                if (!isLocaleCode(value)) return;
                                languageTouchedRef.current = true;
                                field.onChange(value);
                                if (value !== locale) setLocale(value);
                              }}
                              placeholder={t.selectLanguage}
                              searchPlaceholder={t.searchLanguages}
                              triggerClassName="h-10 sm:h-12 text-sm font-normal justify-between w-full"
                              avoidCollisions={false}
                              renderSelected={(opt) => (
                                <span className="flex items-center gap-2">
                                  <img
                                    src={`https://flagcdn.com/w40/${localeDefinitionFor(opt.value).flag}.png`}
                                    alt=""
                                    className="w-5 h-3.5 rounded-sm object-cover shrink-0"
                                  />
                                  <span>{localeDefinitionFor(opt.value).nativeLabel}</span>
                                </span>
                              )}
                              renderItem={(opt) => (
                                <span className="flex items-center gap-2">
                                  <img
                                    src={`https://flagcdn.com/w40/${localeDefinitionFor(opt.value).flag}.png`}
                                    alt=""
                                    className="w-5 h-3.5 rounded-sm object-cover shrink-0"
                                  />
                                  <span>{opt.label}</span>
                                </span>
                              )}
                            />
                          </FormControl>
                          <FormMessage className="text-[11px]" />
                        </FormItem>
                      )} />
                      <div className="text-[10px] sm:text-xs text-muted-foreground p-3 sm:p-4 bg-muted/50 rounded-xl border border-muted">
                        <strong>Note:</strong> {t.noteLanguage}
                      </div>
                    </CardContent>
                  )}
                  {step === 2 && (
                    <CardContent className="pt-2 pb-2 space-y-5">
                      <CardTitle className="flex items-center gap-3 text-lg sm:text-2xl font-bold"><MapPin className="text-primary h-5 w-5 sm:h-6 sm:w-6" /> {t.stepLocation}</CardTitle>
                      <FormField control={form.control} name="address" render={({ field }) => (
                        <FormItem className="space-y-2"><FormLabel className="text-xs sm:text-sm font-semibold">{t.address}</FormLabel><FormControl><Input className="h-10 sm:h-12 text-sm shadow-none" placeholder="Street Address" {...field} /></FormControl><FormMessage className="text-[11px]" /></FormItem>
                      )} />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <FormField control={form.control} name="state" render={({ field }) => (
                          <FormItem className="space-y-2"><FormLabel className="text-xs sm:text-sm font-semibold">{t.state} <span className="text-destructive">*</span></FormLabel><FormControl><Input className="h-10 sm:h-12 text-sm shadow-none" placeholder="State" {...field} /></FormControl><FormMessage className="text-[11px]" /></FormItem>
                        )} />
                        <FormField control={form.control} name="country" render={({ field }) => (
                          <FormItem className="space-y-2 flex flex-col justify-end"><FormLabel className="text-xs sm:text-sm font-semibold">{t.country} <span className="text-destructive">*</span></FormLabel>
                            <FormControl>
                              <Combobox
                                options={COUNTRY_OPTIONS}
                                value={field.value}
                                onChange={field.onChange}
                                placeholder={t.selectCountry}
                                searchPlaceholder={t.searchCountries}
                                triggerClassName="h-10 sm:h-12 text-sm font-normal justify-between w-full"
                                avoidCollisions={false}
                                renderSelected={(opt) => (
                                  <span className="flex items-center gap-2">
                                    <img src={opt.flag} alt={opt.label} className="w-5 h-3.5 rounded-sm object-cover shrink-0" />
                                    <span>{opt.label}</span>
                                  </span>
                                )}
                                renderItem={(opt) => (
                                  <span className="flex items-center gap-2">
                                    <img src={opt.flag} alt={opt.label} className="w-5 h-3.5 rounded-sm object-cover shrink-0" />
                                    <span>{opt.label}</span>
                                  </span>
                                )}
                              />
                            </FormControl>
                            <FormMessage className="text-[11px]" /></FormItem>
                        )} />
                      </div>
                    </CardContent>
                  )}
                  {step === 3 && (
                    <CardContent className="pt-2 pb-2 space-y-5">
                      <CardTitle className="flex items-center gap-3 text-lg sm:text-2xl font-bold"><Landmark className="text-primary h-5 w-5 sm:h-6 sm:w-6" /> {t.stepCurrency}</CardTitle>
                      <FormField control={form.control} name="currency" render={({ field }) => (
                        <FormItem className="space-y-2"><FormLabel className="text-xs sm:text-sm font-semibold">{t.currency} <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Combobox
                              options={currencies}
                              value={field.value}
                              onChange={field.onChange}
                              placeholder={t.selectCurrency}
                              searchPlaceholder={t.searchCurrencies}
                              triggerClassName="h-10 sm:h-12 text-sm font-normal justify-between w-full"
                            />
                          </FormControl>
                          <FormMessage className="text-[11px]" /></FormItem>
                      )} />
                      <div className="text-[10px] sm:text-xs text-muted-foreground p-3 sm:p-4 bg-muted/50 rounded-xl border border-muted">
                        <strong>Note:</strong> {t.noteCurrency}
                      </div>
                    </CardContent>
                  )}
                </motion.div>
              </AnimatePresence>
              <CardContent className="flex justify-between pt-4 sm:pt-6">
                {step > 1 ? (<Button type="button" variant="outline" size="sm" className="sm:size-default" onClick={handlePrevStep}><ArrowLeft className="mr-2 h-4 w-4" /> {t.back}</Button>) : (<div />)}
                {step < steps.length ? (<Button key="next-step" type="button" size="sm" className="sm:size-default" onClick={handleNextStep}>{t.next} <ArrowRight className="ml-2 h-4 w-4" /></Button>) : (
                  <Button key="finish-setup" type="submit" size="sm" className="sm:size-default" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t.finish}
                  </Button>)}
              </CardContent>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  );
}
