import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Language = "sl" | "en";

// Page copy in both languages. Slovenian is the default (Alpska Banka is
// pitched as a Slovenian retail bank); English is the toggle. Keep the keys
// flat and descriptive so it's easy to scan when writing JSX.
const TRANSLATIONS: Record<Language, Record<string, string>> = {
  sl: {
    "topbar.regulated": "Pod nadzorom Banke Slovenije",
    "topbar.eu": "Članica bančne unije EU",
    "logo.tagline": "v vsakem koraku z vami",

    "nav.personal": "Osebno",
    "nav.business": "Poslovno",
    "nav.loans": "Krediti",
    "nav.cards": "Kartice",
    "nav.help": "Pomoč",
    "nav.signin": "Prijava",
    "nav.openAccount": "Odpri račun",
    "nav.myAccount": "Moj račun",
    "nav.signOut": "Odjava",

    "login.title": "Prijava v spletno banko",
    "login.subtitle":
      "Vnesite e-pošto, povezano z vašim računom. Poslali vam bomo 6-mestno kodo.",
    "login.email": "E-pošta",
    "login.send": "Pošlji kodo",
    "login.codeTitle": "Vnesite kodo",
    "login.codeSubtitle": "Poslali smo kodo na",
    "login.codeLabel": "6-mestna koda",
    "login.demoHint": "Demo koda:",
    "login.verify": "Potrdi in se prijavi",
    "login.back": "Uporabi drug e-naslov",
    "login.notFound": "Ne najdemo računa s to e-pošto. Najprej odprite račun.",
    "login.invalidCode": "Napačna koda. Poskusite znova.",

    "account.welcome": "Pozdravljeni,",
    "account.subtitle": "Vaš spletni bančni račun na enem mestu.",
    "account.statusLabel": "Preverjanje identitete",
    "account.status.approved": "Potrjeno",
    "account.status.in_review": "V pregledu",
    "account.status.rejected": "Zavrnjeno",
    "account.status.submitted": "Oddano",
    "account.email": "E-pošta",
    "account.customerId": "ID stranke",
    "account.memberSince": "Stranka od",
    "account.signOut": "Odjavi se",
    "account.backHome": "Nazaj na začetno stran",

    "account.balance.label": "Razpoložljivo stanje",
    "account.balance.account": "Tekoči račun",
    "account.balance.iban": "IBAN",
    "account.balance.send": "Pošlji denar",
    "account.balance.pay": "Plačaj račun",

    "account.cards.title": "Vaše kartice in računi",
    "account.cards.debit": "Mastercard Debit",
    "account.cards.debitSub": "Vsakdanji nakupi",
    "account.cards.credit": "Gold Credit",
    "account.cards.creditSub": "Limit: 2.500 €",
    "account.cards.savings": "Plus varčevanje",
    "account.cards.savingsSub": "3,20 % letno",

    "account.tx.title": "Zadnje transakcije",
    "account.tx.viewAll": "Prikaži vse",
    "account.tx.today": "Danes",
    "account.tx.yesterday": "Včeraj",
    "account.tx.daysAgo": "Pred {n} dnevi",
    "account.tx.grocery": "Mercator",
    "account.tx.groceryCat": "Trgovina",
    "account.tx.salary": "Acme d.o.o.",
    "account.tx.salaryCat": "Plača",
    "account.tx.spotify": "Spotify Premium",
    "account.tx.spotifyCat": "Naročnina",
    "account.tx.coffee": "Bar Kavica",
    "account.tx.coffeeCat": "Hrana in pijača",
    "account.tx.transport": "LPP — mestni promet",
    "account.tx.transportCat": "Prevoz",

    "account.qa.title": "Hitre akcije",
    "account.qa.payBill": "Plačaj položnico",
    "account.qa.transfer": "Prenos med računi",
    "account.qa.orderCard": "Naroči novo kartico",
    "account.qa.openSavings": "Odpri varčevanje",

    "account.notice.pending":
      "Vaš tekoči račun bo v celoti aktiviran, ko bo preverjanje identitete potrjeno. Po e-pošti vas obvestimo.",

    "hero.badge": "Popolnoma spletno odpiranje",
    "hero.title.lead": "Odprite svoj račun v",
    "hero.title.minutes": "5 minutah",
    "hero.title.tail": "Iz udobja vašega doma.",
    "hero.subhead":
      "Brez papirjev. Brez obiska poslovalnice. Le z osebnim dokumentom in nekaj minutami časa — in poslujete pri eni najbolj zaupanja vrednih finančnih institucij v Sloveniji.",
    "hero.cta.open": "Odpri račun",
    "hero.cta.explore": "Raziščite produkte",
    "hero.bullet.customers": "Več kot 250.000 strank",
    "hero.bullet.transfers": "Brezplačni prenosi po EU",
    "hero.bullet.banking": "Mobilno bančništvo 24/7",

    "card.balance": "Razpoložljivo stanje",
    "card.tx.grocery": "Trgovina — Mercator",
    "card.tx.salary": "Plača — Acme d.o.o.",
    "card.tx.spotify": "Spotify Premium",
    "card.when.today": "Danes",
    "card.when.yesterday": "Včeraj",
    "card.when.3d": "Pred 3 dnevi",
    "card.cta": "To bi lahko bil vaš račun →",

    "products.eyebrow": "Produkti",
    "products.heading": "Bančništvo, ki raste z vami",
    "products.subhead":
      "Od vsakdanje porabe do nakupa prvega doma — produkti, prilagojeni vašemu življenju, in ne obratno.",
    "product.current.name": "Tekoči račun",
    "product.current.desc":
      "Brez mesečne provizije prvo leto. Brezplačni prenosi po EU, takojšnji SEPA in Mastercard debetna kartica vključeno.",
    "product.current.cta": "Odpri račun",
    "product.savings.name": "Varčevanje",
    "product.savings.desc":
      "Do 3,20 % letno na varčevanju Plus. Vežite sredstva za 12 mesecev in zaslužite več — z dvigom kadar koli.",
    "product.savings.cta": "Začni varčevati",
    "product.mortgage.name": "Stanovanjski kredit",
    "product.mortgage.desc":
      "Fiksne in spremenljive obrestne mere od 3,45 %. Predodobritev v 48 urah in brezplačno svetovanje v najbližji poslovalnici.",
    "product.mortgage.cta": "Pridobi predodobritev",
    "product.card.name": "Kreditna kartica",
    "product.card.desc":
      "Alpska Gold Mastercard z do 1,5 % vračila gotovine v Sloveniji in 0 % menjalne provizije v EU. Brez letne članarine prvo leto.",
    "product.card.cta": "Oddaj vlogo",

    "trust.stat1.big": "42 let",
    "trust.stat1.small":
      "S strankami v Sloveniji od leta 1983 — skozi vsako gospodarsko obdobje.",
    "trust.stat2.big": "4,8 mrd €",
    "trust.stat2.small":
      "Sredstev strank pod upravljanjem. Revidirano in zavarovano do 100.000 € na vlagatelja.",
    "trust.stat3.big": "98 %",
    "trust.stat3.small":
      "Zadovoljstvo strank pri mobilnem, poslovalničnem in telefonskem podporenem v preteklem letu.",

    "bottomCta.heading": "Pripravljeni, ko ste pripravljeni.",
    "bottomCta.subhead":
      "Res traja samo 5 minut — potrebujete le veljaven osebni dokument in dobro osvetljen prostor. Skozi preostanek vas vodimo mi.",
    "bottomCta.cta": "Odpri račun",

    "footer.tagline":
      "Alpska Banka d.d., Ljubljana. Licencirana bančna institucija pod nadzorom Banke Slovenije. Demo stran — ne dejanska banka.",
    "footer.col.personal": "Osebno",
    "footer.col.company": "Podjetje",
    "footer.col.help": "Pomoč",
    "footer.personal.1": "Tekoči račun",
    "footer.personal.2": "Varčevanje",
    "footer.personal.3": "Kartice",
    "footer.personal.4": "Krediti",
    "footer.personal.5": "Stanovanjski kredit",
    "footer.company.1": "O nas",
    "footer.company.2": "Mediji",
    "footer.company.3": "Karierne priložnosti",
    "footer.company.4": "Vlagatelji",
    "footer.company.5": "Kontakt",
    "footer.help.1": "Center za pomoč",
    "footer.help.2": "Poslovalnice",
    "footer.help.3": "Izgubljena kartica",
    "footer.help.4": "Zasebnost",
    "footer.help.5": "Pogoji",
    "footer.copyright": "Alpska Banka d.d.",
    "footer.poweredBy": "Preverjanje identitete zagotavlja UserCore.",

    "kyc.title": "Odprite svoj račun",
    "kyc.subtitle":
      "Vašo identiteto bomo preverili samo enkrat. Pripravite potni list ali osebno izkaznico.",
    "kyc.field.first": "Ime",
    "kyc.field.last": "Priimek",
    "kyc.field.email": "E-pošta",
    "kyc.terms.agree": "Strinjam se s",
    "kyc.terms.tos": "Pogoji uporabe",
    "kyc.terms.and": "in",
    "kyc.terms.privacy": "Politiko zasebnosti",
    "kyc.continueBtn": "Nadaljuj na preverjanje",
    "kyc.poweredHint":
      "Skozi postopek preverjanja identitete vas bo vodil UserCore.",
    "kyc.starting": "Začenjamo preverjanje…",
    "kyc.done.title": "Še malo manjka!",
    "kyc.done.subhead":
      "Vašo vlogo smo prejeli. Naša ekipa bo pregledala podatke in vam v 24 urah odgovorila po e-pošti. Dobrodošli v Alpski Banki.",
    "kyc.done.cta": "Nazaj na začetek",
    "kyc.error.title": "Preverjanja ni bilo mogoče začeti",
    "kyc.error.retry": "Poskusi znova",
  },
  en: {
    "topbar.regulated": "Regulated by Banka Slovenije",
    "topbar.eu": "Member of the EU Banking Union",
    "logo.tagline": "by your side, every step",

    "nav.personal": "Personal",
    "nav.business": "Business",
    "nav.loans": "Loans",
    "nav.cards": "Cards",
    "nav.help": "Help",
    "nav.signin": "Sign in",
    "nav.openAccount": "Open account",
    "nav.myAccount": "My account",
    "nav.signOut": "Sign out",

    "login.title": "Sign in to online banking",
    "login.subtitle":
      "Enter the email linked to your account. We'll send you a 6-digit code.",
    "login.email": "Email",
    "login.send": "Send code",
    "login.codeTitle": "Enter the code",
    "login.codeSubtitle": "We've sent a code to",
    "login.codeLabel": "6-digit code",
    "login.demoHint": "Demo OTP:",
    "login.verify": "Verify and sign in",
    "login.back": "Use a different email",
    "login.notFound":
      "We can't find an account with that email. Open an account first.",
    "login.invalidCode": "Incorrect code. Please try again.",

    "account.welcome": "Welcome,",
    "account.subtitle": "Your online banking, all in one place.",
    "account.statusLabel": "Identity verification",
    "account.status.approved": "Approved",
    "account.status.in_review": "Under review",
    "account.status.rejected": "Rejected",
    "account.status.submitted": "Submitted",
    "account.email": "Email",
    "account.customerId": "Customer ID",
    "account.memberSince": "Customer since",
    "account.signOut": "Sign out",
    "account.backHome": "Back to home",

    "account.balance.label": "Available balance",
    "account.balance.account": "Current account",
    "account.balance.iban": "IBAN",
    "account.balance.send": "Send money",
    "account.balance.pay": "Pay a bill",

    "account.cards.title": "Your cards & accounts",
    "account.cards.debit": "Mastercard Debit",
    "account.cards.debitSub": "Everyday spending",
    "account.cards.credit": "Gold Credit",
    "account.cards.creditSub": "Limit: € 2,500",
    "account.cards.savings": "Plus Savings",
    "account.cards.savingsSub": "3.20% APY",

    "account.tx.title": "Recent transactions",
    "account.tx.viewAll": "View all",
    "account.tx.today": "Today",
    "account.tx.yesterday": "Yesterday",
    "account.tx.daysAgo": "{n} days ago",
    "account.tx.grocery": "Mercator",
    "account.tx.groceryCat": "Groceries",
    "account.tx.salary": "Acme d.o.o.",
    "account.tx.salaryCat": "Salary",
    "account.tx.spotify": "Spotify Premium",
    "account.tx.spotifyCat": "Subscriptions",
    "account.tx.coffee": "Bar Kavica",
    "account.tx.coffeeCat": "Food & drink",
    "account.tx.transport": "LPP — city transit",
    "account.tx.transportCat": "Transport",

    "account.qa.title": "Quick actions",
    "account.qa.payBill": "Pay a bill",
    "account.qa.transfer": "Transfer between accounts",
    "account.qa.orderCard": "Order a new card",
    "account.qa.openSavings": "Open a savings account",

    "account.notice.pending":
      "Your current account will be fully activated as soon as your identity is verified. We'll email you when it's ready.",

    "hero.badge": "Fully online onboarding",
    "hero.title.lead": "Open your account in",
    "hero.title.minutes": "5 minutes",
    "hero.title.tail": "From the comfort of your home.",
    "hero.subhead":
      "No paperwork. No branch visits. Just your ID and a few minutes of your time — and you're banking with one of Slovenia's most trusted financial institutions.",
    "hero.cta.open": "Open my account",
    "hero.cta.explore": "Explore products",
    "hero.bullet.customers": "250,000+ customers",
    "hero.bullet.transfers": "Free EU transfers",
    "hero.bullet.banking": "24/7 mobile banking",

    "card.balance": "Available balance",
    "card.tx.grocery": "Grocery — Mercator",
    "card.tx.salary": "Salary — Acme d.o.o.",
    "card.tx.spotify": "Spotify Premium",
    "card.when.today": "Today",
    "card.when.yesterday": "Yesterday",
    "card.when.3d": "3 days ago",
    "card.cta": "This could be your account →",

    "products.eyebrow": "Products",
    "products.heading": "Banking that grows with you",
    "products.subhead":
      "From everyday spending to buying your first home — find the products built around your life, not the other way around.",
    "product.current.name": "Current account",
    "product.current.desc":
      "Zero monthly fee for the first year. Free EU transfers, instant SEPA, and a Mastercard debit card included.",
    "product.current.cta": "Open account",
    "product.savings.name": "Savings",
    "product.savings.desc":
      "Up to 3.20% APY on Plus Savings. Lock in a 12-month term and earn more — withdraw anytime with one tap.",
    "product.savings.cta": "Start saving",
    "product.mortgage.name": "Mortgage",
    "product.mortgage.desc":
      "Fixed and variable rates from 3.45%. Pre-approval in 48 hours and free advisor consultation in your nearest branch.",
    "product.mortgage.cta": "Get pre-approved",
    "product.card.name": "Credit card",
    "product.card.desc":
      "Alpska Gold Mastercard with up to 1.5% cashback in Slovenia and 0% FX on EU purchases. No annual fee year one.",
    "product.card.cta": "Apply now",

    "trust.stat1.big": "42 years",
    "trust.stat1.small":
      "Serving Slovenia since 1983 — through every economic season.",
    "trust.stat2.big": "€ 4.8 bn",
    "trust.stat2.small":
      "Customer assets under management. Audited and insured up to €100k per depositor.",
    "trust.stat3.big": "98%",
    "trust.stat3.small":
      "Customer satisfaction across mobile, branch, and phone support last year.",

    "bottomCta.heading": "Ready when you are.",
    "bottomCta.subhead":
      "It really does take 5 minutes — and you only need a valid ID and a well-lit room. We'll guide you the rest of the way.",
    "bottomCta.cta": "Open my account",

    "footer.tagline":
      "Alpska Banka d.d., Ljubljana. A licensed deposit-taking institution regulated by the Bank of Slovenia. Demo site — not a real bank.",
    "footer.col.personal": "Personal",
    "footer.col.company": "Company",
    "footer.col.help": "Help",
    "footer.personal.1": "Current account",
    "footer.personal.2": "Savings",
    "footer.personal.3": "Cards",
    "footer.personal.4": "Loans",
    "footer.personal.5": "Mortgage",
    "footer.company.1": "About",
    "footer.company.2": "Press",
    "footer.company.3": "Careers",
    "footer.company.4": "Investors",
    "footer.company.5": "Contact",
    "footer.help.1": "Help centre",
    "footer.help.2": "Branches",
    "footer.help.3": "Lost card",
    "footer.help.4": "Privacy",
    "footer.help.5": "Terms",
    "footer.copyright": "Alpska Banka d.d.",
    "footer.poweredBy": "Verification powered by UserCore.",

    "kyc.title": "Open your account",
    "kyc.subtitle":
      "We'll need to verify your identity once. Have your passport or ID card ready.",
    "kyc.field.first": "First name",
    "kyc.field.last": "Last name",
    "kyc.field.email": "Email",
    "kyc.terms.agree": "I agree to the",
    "kyc.terms.tos": "Terms & Conditions",
    "kyc.terms.and": "and",
    "kyc.terms.privacy": "Privacy Policy",
    "kyc.continueBtn": "Continue to verification",
    "kyc.poweredHint":
      "You'll be guided through identity verification powered by UserCore.",
    "kyc.starting": "Starting verification…",
    "kyc.done.title": "You're almost there!",
    "kyc.done.subhead":
      "We've received your application. Our team will review your details and email you within 24 hours. Welcome to Alpska Banka.",
    "kyc.done.cta": "Back to home",
    "kyc.error.title": "Couldn't start verification",
    "kyc.error.retry": "Try again",
  },
};

type Ctx = {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<Ctx | null>(null);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Language>("sl");
  // Reflect the active locale on <html lang="…"> for screen readers + the
  // browser's "translate this page" prompt. Locale-specific UI changes
  // (Slovenian decimal commas etc.) come from the translation dict itself.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const t = (key: string) => TRANSLATIONS[lang][key] ?? key;
  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useT = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("LanguageProvider missing");
  return ctx;
};
