// Email-side i18n. The widget already supports en/de/fr/es/sl; mirror those
// here so the OTP email arrives in whatever language the customer was using
// when they hit "Send code". A non-native sender name confused at-risk
// elderly customers ("why is this English-only 'UserCore' email arriving
// during my NLB onboarding?") — every visible string here goes through t().

export const EMAIL_LOCALES = ["en", "de", "fr", "es", "sl"] as const;
export type EmailLocale = (typeof EMAIL_LOCALES)[number];

type Bundle = {
  subject: string;
  heading: string;
  intro: string;
  expiresIn: string;
  scamNote: string;
};

const EN: Bundle = {
  subject: "Your {brand} verification code",
  heading: "Verify your email",
  intro: "Enter this code in the {brand} verification you just started.",
  expiresIn: "This code expires in 10 minutes.",
  scamNote:
    "If you didn't start a {brand} verification, ignore this email — nobody can use this code without it.",
};

const SL: Bundle = {
  subject: "Vaša koda za potrditev — {brand}",
  heading: "Potrdite svoj e-naslov",
  intro: "Vnesite to kodo v postopku preverjanja {brand}, ki ste ga začeli.",
  expiresIn: "Koda velja 10 minut.",
  scamNote:
    "Če preverjanja {brand} niste začeli sami, to e-pošto prezrite — brez vašega sodelovanja kode ne more nihče uporabiti.",
};

const DE: Bundle = {
  subject: "Ihr {brand}-Verifizierungscode",
  heading: "Bestätigen Sie Ihre E-Mail-Adresse",
  intro:
    "Geben Sie diesen Code in der gerade gestarteten {brand}-Verifizierung ein.",
  expiresIn: "Dieser Code läuft in 10 Minuten ab.",
  scamNote:
    "Wenn Sie keine {brand}-Verifizierung gestartet haben, ignorieren Sie diese E-Mail — ohne Ihr Zutun kann den Code niemand verwenden.",
};

const FR: Bundle = {
  subject: "Votre code de vérification {brand}",
  heading: "Vérifiez votre adresse e-mail",
  intro:
    "Saisissez ce code dans la vérification {brand} que vous venez de lancer.",
  expiresIn: "Ce code expire dans 10 minutes.",
  scamNote:
    "Si vous n'avez pas lancé de vérification {brand}, ignorez cet e-mail — sans votre action personne ne peut utiliser ce code.",
};

const ES: Bundle = {
  subject: "Su código de verificación de {brand}",
  heading: "Verifique su correo electrónico",
  intro:
    "Introduzca este código en la verificación de {brand} que acaba de iniciar.",
  expiresIn: "El código caduca en 10 minutos.",
  scamNote:
    "Si no ha iniciado una verificación de {brand}, ignore este correo — sin su intervención nadie puede usar este código.",
};

const BUNDLES: Record<EmailLocale, Bundle> = {
  en: EN,
  sl: SL,
  de: DE,
  fr: FR,
  es: ES,
};

const isSupported = (s: string): s is EmailLocale =>
  (EMAIL_LOCALES as readonly string[]).includes(s);

const interpolate = (template: string, vars: Record<string, string>) => {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(v);
  }
  return out;
};

export const emailT = (
  locale: string | null | undefined,
  key: keyof Bundle,
  vars: Record<string, string>,
): string => {
  const resolved = locale && isSupported(locale) ? BUNDLES[locale] : BUNDLES.en;
  return interpolate(resolved[key], vars);
};
