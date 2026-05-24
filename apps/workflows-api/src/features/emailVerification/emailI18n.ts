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

// Resubmission-request email — sent when an officer bounces a session back to
// the customer to redo one or more steps. Same locale set + brand
// interpolation as the OTP email.
type ResubmissionBundle = {
  subject: string;
  heading: string;
  intro: string;
  cta: string;
};

const RESUBMISSION_BUNDLES: Record<EmailLocale, ResubmissionBundle> = {
  en: {
    subject: "Action needed on your {brand} verification",
    heading: "We need a bit more from you",
    intro:
      "Your {brand} verification needs a few items resubmitted. Reopen the verification to continue where you left off.",
    cta: "Continue verification",
  },
  sl: {
    subject: "Potrebno je dejanje pri preverjanju {brand}",
    heading: "Potrebujemo še nekaj podatkov",
    intro:
      "Pri preverjanju {brand} je treba znova oddati nekaj elementov. Znova odprite preverjanje in nadaljujte, kjer ste končali.",
    cta: "Nadaljuj preverjanje",
  },
  de: {
    subject: "Aktion für Ihre {brand}-Verifizierung erforderlich",
    heading: "Wir brauchen noch etwas von Ihnen",
    intro:
      "Für Ihre {brand}-Verifizierung müssen einige Punkte erneut eingereicht werden. Öffnen Sie die Verifizierung erneut, um fortzufahren.",
    cta: "Verifizierung fortsetzen",
  },
  fr: {
    subject: "Action requise pour votre vérification {brand}",
    heading: "Il nous manque quelques éléments",
    intro:
      "Votre vérification {brand} nécessite de soumettre à nouveau quelques éléments. Rouvrez la vérification pour continuer.",
    cta: "Continuer la vérification",
  },
  es: {
    subject: "Se requiere una acción en su verificación de {brand}",
    heading: "Necesitamos algo más de usted",
    intro:
      "Su verificación de {brand} requiere reenviar algunos elementos. Vuelva a abrir la verificación para continuar.",
    cta: "Continuar la verificación",
  },
};

export const emailResubmissionT = (
  locale: string | null | undefined,
  key: keyof ResubmissionBundle,
  vars: Record<string, string>,
): string => {
  const resolved =
    locale && isSupported(locale)
      ? RESUBMISSION_BUNDLES[locale]
      : RESUBMISSION_BUNDLES.en;
  return interpolate(resolved[key], vars);
};

// Final decision (approved / rejected) notice — so a customer who closed the
// widget still learns the outcome. Same locale set + brand interpolation.
type DecisionBundle = {
  subject: string;
  heading: string;
  intro: string;
  cta: string;
};

const DECISION_BUNDLES: Record<
  "approved" | "rejected",
  Record<EmailLocale, DecisionBundle>
> = {
  approved: {
    en: {
      subject: "Your {brand} verification is approved",
      heading: "You're verified",
      intro:
        "Your {brand} verification has been approved — you're all set, no further action needed.",
      cta: "View status",
    },
    sl: {
      subject: "Vaše preverjanje {brand} je odobreno",
      heading: "Preverjeni ste",
      intro:
        "Vaše preverjanje {brand} je bilo odobreno — vse je urejeno, nadaljnji koraki niso potrebni.",
      cta: "Poglej stanje",
    },
    de: {
      subject: "Ihre {brand}-Verifizierung ist bestätigt",
      heading: "Sie sind verifiziert",
      intro:
        "Ihre {brand}-Verifizierung wurde genehmigt — alles erledigt, keine weiteren Schritte nötig.",
      cta: "Status ansehen",
    },
    fr: {
      subject: "Votre vérification {brand} est approuvée",
      heading: "Vous êtes vérifié",
      intro:
        "Votre vérification {brand} a été approuvée — tout est en ordre, aucune action supplémentaire requise.",
      cta: "Voir le statut",
    },
    es: {
      subject: "Su verificación de {brand} está aprobada",
      heading: "Está verificado",
      intro:
        "Su verificación de {brand} ha sido aprobada — todo listo, no se requiere ninguna acción más.",
      cta: "Ver estado",
    },
  },
  rejected: {
    en: {
      subject: "Update on your {brand} verification",
      heading: "Your verification wasn't approved",
      intro:
        "Unfortunately your {brand} verification couldn't be approved. If you believe this is a mistake, please contact support.",
      cta: "View status",
    },
    sl: {
      subject: "Posodobitev preverjanja {brand}",
      heading: "Vaše preverjanje ni bilo odobreno",
      intro:
        "Žal vašega preverjanja {brand} ni bilo mogoče odobriti. Če menite, da je to napaka, se obrnite na podporo.",
      cta: "Poglej stanje",
    },
    de: {
      subject: "Update zu Ihrer {brand}-Verifizierung",
      heading: "Ihre Verifizierung wurde nicht genehmigt",
      intro:
        "Leider konnte Ihre {brand}-Verifizierung nicht genehmigt werden. Wenn Sie glauben, dass dies ein Fehler ist, wenden Sie sich an den Support.",
      cta: "Status ansehen",
    },
    fr: {
      subject: "Mise à jour de votre vérification {brand}",
      heading: "Votre vérification n'a pas été approuvée",
      intro:
        "Malheureusement, votre vérification {brand} n'a pas pu être approuvée. Si vous pensez qu'il s'agit d'une erreur, contactez le support.",
      cta: "Voir le statut",
    },
    es: {
      subject: "Actualización sobre su verificación de {brand}",
      heading: "Su verificación no fue aprobada",
      intro:
        "Lamentablemente, su verificación de {brand} no pudo ser aprobada. Si cree que es un error, contacte con soporte.",
      cta: "Ver estado",
    },
  },
};

export const emailDecisionT = (
  decision: "approved" | "rejected",
  locale: string | null | undefined,
  key: keyof DecisionBundle,
  vars: Record<string, string>,
): string => {
  const set = DECISION_BUNDLES[decision];
  const resolved = locale && isSupported(locale) ? set[locale] : set.en;
  return interpolate(resolved[key], vars);
};
