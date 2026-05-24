// Tiny in-house i18n for the widget. The language is resolved on boot from
// (1) `?lang=` URL param, (2) localStorage (the customer's prior pick),
// (3) `navigator.language`, falling back to English. At runtime the in-widget
// language picker calls setLocale() which notifies React subscribers so every
// `t()`-using component re-renders. Translations are flat key→string maps;
// values can use `{var}` placeholders substituted by t(key, vars).

import { useSyncExternalStore } from "react";

export const SUPPORTED_LOCALES = ["en", "de", "fr", "es", "sl"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

// Native names for the picker — customers can recognise their own language
// without speaking the currently-selected one.
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  sl: "Slovenščina",
};

const LOCALE_STORAGE_KEY = "usercore.widget.locale";

type Bundle = Record<string, string>;

const EN: Bundle = {
  // Shell
  "shell.defaultBrand": "UserCore Verification",
  "shell.poweredBy": "Powered by",
  "shell.loading": "Loading verification…",
  "shell.noSubsteps":
    "No sub-steps are enabled for this workflow yet — ask your admin to turn at least one on.",
  "shell.stepOfTotal": "Step {step} of {total}",
  "shell.close": "Close",

  // Overview
  "overview.titleSteps": "Verification steps",
  "overview.titleKeepGoing": "Keep going",
  "overview.titleAllSet": "All set — ready to submit",
  "overview.subtitleAllDone":
    "Review what we've collected, then submit for review.",
  "overview.subtitleProgress": "{count} of {total} complete",
  "overview.subtitleOneLeft": "One more step to complete.",
  "overview.subtitleManyLeft": "{count} steps to complete.",
  "overview.upNext": "Up next",
  "overview.continue": "Continue",
  "overview.submit": "Submit for review",
  "overview.continueOnPhone": "Continue on phone",

  // QR handoff (inside overview)
  "qr.title": "Continue on your phone",
  "qr.subtitle":
    "Scan the QR with your phone camera. The flow will pick up exactly where you left off.",
  "qr.directUrl": "Direct URL",
  "qr.copy": "Copy",
  "qr.back": "Back",
  "qr.backToSteps": "Back to steps",

  // Handed-off (desktop after phone took over)
  "handoff.title": "Session continued on a phone",
  "handoff.subtitle":
    "The customer is finishing the verification on their mobile device. Steps below update as they progress.",
  "handoff.progress": "{count} of {total} complete",
  "handoff.canClose":
    "You can close this window — the result will land in the review queue when the customer finishes.",

  // Step labels (used by overview + handed-off list)
  "step.terms": "Terms & conditions",
  "step.email": "Email verification",
  "step.idScan": "Identity document",
  "step.faceScan": "Face scan",
  "step.por": "Proof of residence",
  "step.contact": "Contact information",

  // Terms
  "terms.title": "Terms & conditions",
  "terms.subtitle": "Please review and accept before continuing.",
  "terms.checkbox": "I have read and agree to the terms above.",
  "terms.continue": "Agree and continue",
  "terms.saving": "Saving…",
  "terms.error": "Could not record your acceptance. Please try again.",
  "terms.defaultText": `UserCore identity verification — consent

By proceeding, you authorise UserCore and the operator of this workflow to collect, process and store the personal information you provide for the purpose of verifying your identity. This may include identity documents, a selfie video, contact details and proof of residence.

Your data is retained for as long as required to meet applicable regulatory obligations and is processed in accordance with the operator's privacy policy. You may withdraw consent at any time by contacting the operator, in which case the verification cannot be completed.

You confirm that the information and documents you submit belong to you and are accurate. Submitting forged or stolen documents is a criminal offence in most jurisdictions.`,

  // Email
  "email.title": "Email verification",
  "email.subtitle": "We'll send a 6-digit code to confirm your address.",
  "email.label": "Email address",
  "email.placeholder": "you@example.com",
  "email.send": "Send code",
  "email.sending": "Sending…",
  "email.codeTitle": "Enter the code",
  "email.codeSubtitle":
    "We sent a 6-digit code to {email}. It expires in 10 minutes.",
  "email.codeLabel": "Verification code",
  "email.differentEmail": "Use a different email",
  "email.verify": "Verify and continue",
  "email.verifying": "Verifying…",
  "email.sendError": "Could not send code",
  "email.verifyError": "Verification failed",

  // Document
  "doc.title": "Identity document",
  "doc.subtitle": "Upload a clear photo of your government-issued ID.",
  "doc.country": "Document country",
  "doc.type": "Document type",
  "doc.passport": "Passport",
  "doc.idCard": "National ID",
  "doc.driverLicense": "Driver's licence",
  "doc.front": "Front",
  "doc.back": "Back",
  "doc.photoPage": "Photo page",
  "doc.clickToUpload": "Click to upload",
  "doc.uploadHint": "JPG or PNG",
  "doc.takePhoto": "Take photo with camera",
  "doc.continue": "Continue",
  "doc.uploading": "Uploading…",
  "doc.errorMissingFront": "Please add a photo of the document.",
  "doc.errorMissingBack": "Please add a photo of the back of the document.",
  "doc.errorUpload": "Upload failed. Please try again.",

  // Liveness
  "liveness.title": "Face scan",
  "liveness.subtitleIdle":
    "We'll detect liveness with your camera. Nothing leaves your device until you submit.",
  "liveness.subtitleSaving": "Hold still while we save your selfie…",
  "liveness.almostDone": "Almost there…",
  "liveness.instructFace": "Centre your face in the frame",
  "liveness.instructBlink": "Now blink your eyes",
  "liveness.instructTurn": "Slowly turn your head left, then right",
  "liveness.checkFace": "Face detected",
  "liveness.checkBlink": "Blink detected",
  "liveness.checkTurn": "Head turn",
  "liveness.cameraReady": "Camera ready — press start below",
  "liveness.verified": "Liveness verified",
  "liveness.start": "Start camera",
  "liveness.loadingModel": "Loading model…",
  "liveness.cameraDenied":
    "Camera access denied. Please allow camera access and try again.",
  "liveness.modelFailed": "Failed to load face landmarker model.",
  "liveness.submitError":
    "Failed to submit liveness results. Please try again.",

  // Proof of residence
  "por.title": "Proof of residence",
  "por.subtitle":
    "A document dated within the last 3 months that shows your name and home address.",
  "por.type": "Document type",
  "por.gasBill": "Gas bill",
  "por.internetBill": "Internet bill",
  "por.electricityBill": "Electricity bill",
  "por.rentAgreement": "Rent agreement",
  "por.bankStatement": "Bank statement",
  "por.clickToUpload": "Click to upload",
  "por.uploadHint": "JPG, PNG or PDF",
  "por.takePhoto": "Take photo with camera",
  "por.street": "Street address",
  "por.streetPlaceholder": "123 Main Street",
  "por.city": "City",
  "por.cityPlaceholder": "Ljubljana",
  "por.postalCode": "Postal code",
  "por.postalCodePlaceholder": "1000",
  "por.country": "Country",
  "por.continue": "Continue",
  "por.uploading": "Uploading…",
  "por.errorMissing": "Please upload the document and fill in your address.",
  "por.errorUpload": "Upload failed. Please try again.",

  // Contact
  "contact.title": "Contact information",
  "contact.subtitle":
    "We may use these details to reach you about your verification.",
  "contact.phone": "Phone",
  "contact.phonePlaceholder": "+1 555 123 4567",
  "contact.email": "Email",
  "contact.emailPlaceholder": "you@example.com",
  "contact.continue": "Continue",
  "contact.saving": "Saving…",
  "contact.error": "Failed to submit. Please try again.",
  "contact.phoneCountryRequired":
    "Please select a country code for your phone number.",
  "resubmission.title": "A reviewer asked you to update a few things:",

  // Success
  "success.title": "Verification submitted",
  "success.subtitle":
    "Your information is on its way to our review team. You'll be notified once a decision is made.",
  "success.nextHeading": "What happens next",
  "success.next1": "Our team reviews your submission",
  "success.next2": "You receive an email with the decision",
  "success.next3": "Typically reviewed within 1–2 business days",
  "success.notifyPrompt": "Want an update by email? (optional)",
  "success.emailPlaceholder": "you@example.com",
  "success.notifyButton": "Notify me",
  "success.notifySaving": "Saving…",
  "success.notifySaved": "Thanks — we'll email you when there's an update.",
  "success.approvedTitle": "You're verified",
  "success.approvedSubtitle":
    "Your identity has been approved. You can close this window.",
  "success.rejectedTitle": "Verification not approved",
  "success.rejectedSubtitle":
    "We couldn't approve your verification. Please contact support if you think this is a mistake.",

  // Common widgets / pickers
  "common.search": "Search…",
  "common.searchCountries": "Search countries…",
  "common.selectCountry": "Select country",
  "common.noMatches": "No matches.",
  "common.allPicked": "All countries already picked.",
  "common.select": "Select…",
  "common.code": "Code",
  "common.phoneSearch": "Search country or +code…",
  "common.remove": "Remove",
};

// ---------- Slovenian -----------------------------------------------------
const SL: Bundle = {
  "shell.defaultBrand": "UserCore preverjanje",
  "shell.poweredBy": "Storitev omogoča",
  "shell.loading": "Nalaganje preverjanja…",
  "shell.noSubsteps":
    "Za ta potek še ni omogočen noben podkorak — prosite skrbnika, da vsaj enega vklopi.",
  "shell.stepOfTotal": "Korak {step} od {total}",
  "shell.close": "Zapri",

  "overview.titleSteps": "Koraki preverjanja",
  "overview.titleKeepGoing": "Nadaljuj",
  "overview.titleAllSet": "Vse pripravljeno — pošlji v pregled",
  "overview.subtitleAllDone": "Preglej zbrane podatke in jih pošlji v pregled.",
  "overview.subtitleProgress": "{count} od {total} dokončano",
  "overview.subtitleOneLeft": "Ostane še en korak.",
  "overview.subtitleManyLeft": "Ostane še {count} korakov.",
  "overview.upNext": "Naslednji",
  "overview.continue": "Naprej",
  "overview.submit": "Pošlji v pregled",
  "overview.continueOnPhone": "Nadaljuj na telefonu",

  "qr.title": "Nadaljuj na telefonu",
  "qr.subtitle":
    "S kamero telefona skeniraj QR kodo. Postopek se bo nadaljeval tam, kjer si končal.",
  "qr.directUrl": "Neposredna povezava",
  "qr.copy": "Kopiraj",
  "qr.back": "Nazaj",
  "qr.backToSteps": "Nazaj na korake",

  "handoff.title": "Seja se nadaljuje na telefonu",
  "handoff.subtitle":
    "Stranka zaključuje preverjanje na svojem telefonu. Stanje korakov se posodablja sproti.",
  "handoff.progress": "{count} od {total} dokončano",
  "handoff.canClose":
    "To okno lahko zapreš — rezultat bo v čakalni vrsti za pregled, ko stranka konča.",

  "step.terms": "Pogoji uporabe",
  "step.email": "Preverjanje e-pošte",
  "step.idScan": "Osebni dokument",
  "step.faceScan": "Skeniranje obraza",
  "step.por": "Dokazilo o prebivališču",
  "step.contact": "Kontaktni podatki",

  "terms.title": "Pogoji uporabe",
  "terms.subtitle": "Pred nadaljevanjem prosimo preglej in sprejmi pogoje.",
  "terms.checkbox": "Prebral/-a sem zgornje pogoje in se z njimi strinjam.",
  "terms.continue": "Sprejmi in nadaljuj",
  "terms.saving": "Shranjevanje…",
  "terms.error": "Soglasja nismo mogli zabeležiti. Prosim, poskusi znova.",
  "terms.defaultText": `UserCore preverjanje identitete — soglasje

S potrditvijo pooblaščaš UserCore in upravljavca tega postopka, da zbira, obdeluje in shranjuje osebne podatke, ki jih posreduješ z namenom preverjanja tvoje identitete. To lahko vključuje osebne dokumente, posnetek obraza, kontaktne podatke in dokazilo o prebivališču.

Tvoji podatki se hranijo, dokler je to potrebno za izpolnitev zakonskih obveznosti, in se obdelujejo v skladu s politiko zasebnosti upravljavca. Soglasje lahko kadar koli prekličeš pri upravljavcu, v tem primeru preverjanja ne bo mogoče dokončati.

Potrjuješ, da podatki in dokumenti, ki jih oddajaš, pripadajo tebi in so točni. Predložitev ponarejenih ali ukradenih dokumentov je v večini držav kaznivo dejanje.`,

  "email.title": "Preverjanje e-pošte",
  "email.subtitle":
    "Poslali ti bomo 6-mestno kodo za potrditev tvojega e-poštnega naslova.",
  "email.label": "E-poštni naslov",
  "email.placeholder": "ime@primer.si",
  "email.send": "Pošlji kodo",
  "email.sending": "Pošiljanje…",
  "email.codeTitle": "Vnesi kodo",
  "email.codeSubtitle":
    "Na {email} smo poslali 6-mestno kodo. Veljavna je 10 minut.",
  "email.codeLabel": "Potrditvena koda",
  "email.differentEmail": "Uporabi drug e-naslov",
  "email.verify": "Potrdi in nadaljuj",
  "email.verifying": "Preverjanje…",
  "email.sendError": "Kode ni bilo mogoče poslati",
  "email.verifyError": "Preverjanje ni uspelo",

  "doc.title": "Osebni dokument",
  "doc.subtitle": "Naloži jasno fotografijo osebnega dokumenta.",
  "doc.country": "Država dokumenta",
  "doc.type": "Vrsta dokumenta",
  "doc.passport": "Potni list",
  "doc.idCard": "Osebna izkaznica",
  "doc.driverLicense": "Vozniško dovoljenje",
  "doc.front": "Sprednja stran",
  "doc.back": "Zadnja stran",
  "doc.photoPage": "Stran s fotografijo",
  "doc.clickToUpload": "Klikni za nalaganje",
  "doc.uploadHint": "JPG ali PNG",
  "doc.takePhoto": "Posnemi sliko s kamero",
  "doc.continue": "Naprej",
  "doc.uploading": "Nalaganje…",
  "doc.errorMissingFront": "Prosim, dodaj fotografijo dokumenta.",
  "doc.errorMissingBack": "Prosim, dodaj fotografijo zadnje strani dokumenta.",
  "doc.errorUpload": "Nalaganje ni uspelo. Prosim, poskusi znova.",

  "liveness.title": "Skeniranje obraza",
  "liveness.subtitleIdle":
    "Z uporabo kamere bomo preverili, da si resnična oseba. Posnetek ostane na tvoji napravi, dokler ne potrdiš.",
  "liveness.subtitleSaving": "Mirno počakaj, da shranimo selfi…",
  "liveness.almostDone": "Skoraj končano…",
  "liveness.instructFace": "Postavi obraz v okvir",
  "liveness.instructBlink": "Pomežikni",
  "liveness.instructTurn": "Počasi obrni glavo levo in desno",
  "liveness.checkFace": "Obraz zaznan",
  "liveness.checkBlink": "Mežik zaznan",
  "liveness.checkTurn": "Obrat glave",
  "liveness.cameraReady": "Kamera pripravljena — pritisni za zagon",
  "liveness.verified": "Preverjanje uspešno",
  "liveness.start": "Zaženi kamero",
  "liveness.loadingModel": "Nalaganje modela…",
  "liveness.cameraDenied":
    "Dostop do kamere zavrnjen. Prosim, dovoli dostop in poskusi znova.",
  "liveness.modelFailed":
    "Modela za prepoznavanje obraza ni bilo mogoče naložiti.",
  "liveness.submitError":
    "Rezultatov preverjanja ni bilo mogoče poslati. Prosim, poskusi znova.",

  "por.title": "Dokazilo o prebivališču",
  "por.subtitle":
    "Dokument, izdan v zadnjih 3 mesecih, ki vsebuje tvoje ime in domači naslov.",
  "por.type": "Vrsta dokumenta",
  "por.gasBill": "Račun za plin",
  "por.internetBill": "Račun za internet",
  "por.electricityBill": "Račun za elektriko",
  "por.rentAgreement": "Najemna pogodba",
  "por.bankStatement": "Izpis bančnega računa",
  "por.clickToUpload": "Klikni za nalaganje",
  "por.uploadHint": "JPG, PNG ali PDF",
  "por.takePhoto": "Posnemi sliko s kamero",
  "por.street": "Ulica in hišna številka",
  "por.streetPlaceholder": "Slovenska cesta 1",
  "por.city": "Mesto",
  "por.cityPlaceholder": "Ljubljana",
  "por.postalCode": "Poštna številka",
  "por.postalCodePlaceholder": "1000",
  "por.country": "Država",
  "por.continue": "Naprej",
  "por.uploading": "Nalaganje…",
  "por.errorMissing": "Prosim, naloži dokument in izpolni naslov.",
  "por.errorUpload": "Nalaganje ni uspelo. Prosim, poskusi znova.",

  "contact.title": "Kontaktni podatki",
  "contact.subtitle":
    "Te podatke lahko uporabimo, da te obvestimo o preverjanju.",
  "contact.phone": "Telefon",
  "contact.phonePlaceholder": "+386 41 123 456",
  "contact.email": "E-pošta",
  "contact.emailPlaceholder": "ime@primer.si",
  "contact.continue": "Naprej",
  "contact.saving": "Shranjevanje…",
  "contact.error": "Pošiljanje ni uspelo. Prosim, poskusi znova.",
  "contact.phoneCountryRequired":
    "Prosim, izberi klicno kodo države za telefonsko številko.",
  "resubmission.title": "Pregledovalec te prosi, da posodobiš nekaj stvari:",

  "success.title": "Preverjanje oddano",
  "success.subtitle":
    "Tvoji podatki so na poti naši ekipi za pregled. Obvestili te bomo, ko bo odločitev sprejeta.",
  "success.nextHeading": "Kaj sledi",
  "success.next1": "Naša ekipa pregleda tvojo oddajo",
  "success.next2": "Po e-pošti prejmeš odločitev",
  "success.next3": "Pregled običajno traja 1–2 delovna dneva",
  "success.notifyPrompt": "Želiš obvestilo po e-pošti? (neobvezno)",
  "success.emailPlaceholder": "ti@primer.com",
  "success.notifyButton": "Obvesti me",
  "success.notifySaving": "Shranjujem…",
  "success.notifySaved": "Hvala — obvestili te bomo po e-pošti ob spremembi.",
  "success.approvedTitle": "Preverjanje uspešno",
  "success.approvedSubtitle":
    "Tvoja istovetnost je potrjena. To okno lahko zapreš.",
  "success.rejectedTitle": "Preverjanje ni odobreno",
  "success.rejectedSubtitle":
    "Tvojega preverjanja nismo mogli odobriti. Če meniš, da gre za napako, se obrni na podporo.",

  "common.search": "Iskanje…",
  "common.searchCountries": "Iskanje držav…",
  "common.selectCountry": "Izberi državo",
  "common.noMatches": "Ni zadetkov.",
  "common.allPicked": "Vse države so že izbrane.",
  "common.select": "Izberi…",
  "common.code": "Koda",
  "common.phoneSearch": "Išči državo ali +kodo…",
  "common.remove": "Odstrani",
};

// ---------- German --------------------------------------------------------
const DE: Bundle = {
  "shell.defaultBrand": "UserCore Verifizierung",
  "shell.poweredBy": "Bereitgestellt von",
  "shell.loading": "Verifizierung wird geladen…",
  "shell.noSubsteps":
    "Für diesen Ablauf sind noch keine Unterschritte aktiviert — bitten Sie Ihre Administratorin, mindestens einen einzuschalten.",
  "shell.stepOfTotal": "Schritt {step} von {total}",
  "shell.close": "Schließen",

  "overview.titleSteps": "Verifizierungsschritte",
  "overview.titleKeepGoing": "Weiter so",
  "overview.titleAllSet": "Alles bereit — zur Prüfung einreichen",
  "overview.subtitleAllDone":
    "Überprüfen Sie die erfassten Daten und reichen Sie sie zur Prüfung ein.",
  "overview.subtitleProgress": "{count} von {total} abgeschlossen",
  "overview.subtitleOneLeft": "Noch ein Schritt.",
  "overview.subtitleManyLeft": "Noch {count} Schritte.",
  "overview.upNext": "Als Nächstes",
  "overview.continue": "Weiter",
  "overview.submit": "Zur Prüfung einreichen",
  "overview.continueOnPhone": "Auf dem Telefon fortfahren",

  "qr.title": "Auf Ihrem Telefon fortfahren",
  "qr.subtitle":
    "Scannen Sie den QR-Code mit der Kamera Ihres Telefons. Der Vorgang wird genau dort fortgesetzt, wo Sie aufgehört haben.",
  "qr.directUrl": "Direkter Link",
  "qr.copy": "Kopieren",
  "qr.back": "Zurück",
  "qr.backToSteps": "Zurück zu den Schritten",

  "handoff.title": "Sitzung auf einem Telefon fortgesetzt",
  "handoff.subtitle":
    "Die Kundin schließt die Verifizierung auf ihrem Mobilgerät ab. Die Schritte unten werden aktualisiert, sobald sie Fortschritte macht.",
  "handoff.progress": "{count} von {total} abgeschlossen",
  "handoff.canClose":
    "Sie können dieses Fenster schließen — das Ergebnis landet in der Prüfungswarteschlange, sobald die Kundin fertig ist.",

  "step.terms": "Nutzungsbedingungen",
  "step.email": "E-Mail-Verifizierung",
  "step.idScan": "Ausweisdokument",
  "step.faceScan": "Gesichtsscan",
  "step.por": "Adressnachweis",
  "step.contact": "Kontaktdaten",

  "terms.title": "Nutzungsbedingungen",
  "terms.subtitle":
    "Bitte lesen und akzeptieren Sie die Bedingungen, bevor Sie fortfahren.",
  "terms.checkbox":
    "Ich habe die obigen Bedingungen gelesen und stimme ihnen zu.",
  "terms.continue": "Zustimmen und fortfahren",
  "terms.saving": "Speichern…",
  "terms.error":
    "Ihre Zustimmung konnte nicht erfasst werden. Bitte erneut versuchen.",
  "terms.defaultText": `UserCore Identitätsprüfung — Einwilligung

Durch Fortfahren ermächtigen Sie UserCore und den Betreiber dieses Ablaufs, Ihre angegebenen personenbezogenen Daten zur Identitätsprüfung zu erheben, zu verarbeiten und zu speichern. Dazu können Ausweisdokumente, ein Selfie-Video, Kontaktdaten und ein Adressnachweis gehören.

Ihre Daten werden so lange aufbewahrt, wie es zur Erfüllung der geltenden regulatorischen Pflichten erforderlich ist, und gemäß der Datenschutzrichtlinie des Betreibers verarbeitet. Sie können Ihre Einwilligung jederzeit widerrufen, indem Sie den Betreiber kontaktieren; in diesem Fall kann die Verifizierung nicht abgeschlossen werden.

Sie bestätigen, dass die übermittelten Informationen und Dokumente Ihnen gehören und korrekt sind. Das Einreichen gefälschter oder gestohlener Dokumente ist in den meisten Rechtsordnungen eine Straftat.`,

  "email.title": "E-Mail-Verifizierung",
  "email.subtitle":
    "Wir senden Ihnen einen 6-stelligen Code zur Bestätigung Ihrer Adresse.",
  "email.label": "E-Mail-Adresse",
  "email.placeholder": "sie@beispiel.de",
  "email.send": "Code senden",
  "email.sending": "Senden…",
  "email.codeTitle": "Code eingeben",
  "email.codeSubtitle":
    "Wir haben einen 6-stelligen Code an {email} gesendet. Er läuft in 10 Minuten ab.",
  "email.codeLabel": "Verifizierungscode",
  "email.differentEmail": "Andere E-Mail-Adresse verwenden",
  "email.verify": "Bestätigen und fortfahren",
  "email.verifying": "Überprüfung…",
  "email.sendError": "Code konnte nicht gesendet werden",
  "email.verifyError": "Verifizierung fehlgeschlagen",

  "doc.title": "Ausweisdokument",
  "doc.subtitle": "Laden Sie ein scharfes Foto Ihres amtlichen Ausweises hoch.",
  "doc.country": "Land des Dokuments",
  "doc.type": "Dokumentart",
  "doc.passport": "Reisepass",
  "doc.idCard": "Personalausweis",
  "doc.driverLicense": "Führerschein",
  "doc.front": "Vorderseite",
  "doc.back": "Rückseite",
  "doc.photoPage": "Bildseite",
  "doc.clickToUpload": "Zum Hochladen klicken",
  "doc.uploadHint": "JPG oder PNG",
  "doc.takePhoto": "Mit Kamera aufnehmen",
  "doc.continue": "Weiter",
  "doc.uploading": "Hochladen…",
  "doc.errorMissingFront": "Bitte fügen Sie ein Foto des Dokuments hinzu.",
  "doc.errorMissingBack":
    "Bitte fügen Sie ein Foto der Rückseite des Dokuments hinzu.",
  "doc.errorUpload": "Hochladen fehlgeschlagen. Bitte erneut versuchen.",

  "liveness.title": "Gesichtsscan",
  "liveness.subtitleIdle":
    "Wir prüfen mit Ihrer Kamera, dass Sie live sind. Nichts verlässt Ihr Gerät, bis Sie es einreichen.",
  "liveness.subtitleSaving":
    "Bitte stillhalten, während wir Ihr Selfie speichern…",
  "liveness.almostDone": "Fast geschafft…",
  "liveness.instructFace": "Zentrieren Sie Ihr Gesicht im Rahmen",
  "liveness.instructBlink": "Jetzt blinzeln Sie",
  "liveness.instructTurn":
    "Drehen Sie den Kopf langsam nach links, dann nach rechts",
  "liveness.checkFace": "Gesicht erkannt",
  "liveness.checkBlink": "Blinzeln erkannt",
  "liveness.checkTurn": "Kopfdrehung",
  "liveness.cameraReady": "Kamera bereit — unten zum Starten drücken",
  "liveness.verified": "Lebendigkeit bestätigt",
  "liveness.start": "Kamera starten",
  "liveness.loadingModel": "Modell wird geladen…",
  "liveness.cameraDenied":
    "Kamerazugriff verweigert. Bitte erlauben Sie den Zugriff und versuchen Sie es erneut.",
  "liveness.modelFailed":
    "Gesichtserkennungsmodell konnte nicht geladen werden.",
  "liveness.submitError":
    "Lebendigkeitsergebnisse konnten nicht gesendet werden. Bitte erneut versuchen.",

  "por.title": "Adressnachweis",
  "por.subtitle":
    "Ein Dokument, das in den letzten 3 Monaten ausgestellt wurde und Ihren Namen und Ihre Heimatadresse enthält.",
  "por.type": "Dokumentart",
  "por.gasBill": "Gasrechnung",
  "por.internetBill": "Internetrechnung",
  "por.electricityBill": "Stromrechnung",
  "por.rentAgreement": "Mietvertrag",
  "por.bankStatement": "Kontoauszug",
  "por.clickToUpload": "Zum Hochladen klicken",
  "por.uploadHint": "JPG, PNG oder PDF",
  "por.takePhoto": "Mit Kamera aufnehmen",
  "por.street": "Straße und Hausnummer",
  "por.streetPlaceholder": "Hauptstraße 1",
  "por.city": "Stadt",
  "por.cityPlaceholder": "Berlin",
  "por.postalCode": "Postleitzahl",
  "por.postalCodePlaceholder": "10115",
  "por.country": "Land",
  "por.continue": "Weiter",
  "por.uploading": "Hochladen…",
  "por.errorMissing":
    "Bitte laden Sie das Dokument hoch und füllen Sie Ihre Adresse aus.",
  "por.errorUpload": "Hochladen fehlgeschlagen. Bitte erneut versuchen.",

  "contact.title": "Kontaktdaten",
  "contact.subtitle":
    "Wir können diese Daten verwenden, um Sie zu Ihrer Verifizierung zu kontaktieren.",
  "contact.phone": "Telefon",
  "contact.phonePlaceholder": "+49 30 1234 5678",
  "contact.email": "E-Mail",
  "contact.emailPlaceholder": "sie@beispiel.de",
  "contact.continue": "Weiter",
  "contact.saving": "Speichern…",
  "contact.error": "Senden fehlgeschlagen. Bitte erneut versuchen.",
  "contact.phoneCountryRequired":
    "Bitte wähle eine Ländervorwahl für deine Telefonnummer.",
  "resubmission.title":
    "Ein Prüfer bittet dich, einige Angaben zu aktualisieren:",

  "success.title": "Verifizierung eingereicht",
  "success.subtitle":
    "Ihre Daten sind unterwegs zu unserem Prüfungsteam. Sie werden benachrichtigt, sobald eine Entscheidung getroffen wurde.",
  "success.nextHeading": "Wie es weitergeht",
  "success.next1": "Unser Team prüft Ihre Einreichung",
  "success.next2": "Sie erhalten eine E-Mail mit der Entscheidung",
  "success.next3": "Die Prüfung dauert in der Regel 1–2 Werktage",
  "success.notifyPrompt": "Update per E-Mail erhalten? (optional)",
  "success.emailPlaceholder": "sie@beispiel.com",
  "success.notifyButton": "Benachrichtigen",
  "success.notifySaving": "Wird gespeichert…",
  "success.notifySaved":
    "Danke — wir benachrichtigen Sie per E-Mail bei einer Aktualisierung.",
  "success.approvedTitle": "Sie sind verifiziert",
  "success.approvedSubtitle":
    "Ihre Identität wurde bestätigt. Sie können dieses Fenster schließen.",
  "success.rejectedTitle": "Verifizierung nicht genehmigt",
  "success.rejectedSubtitle":
    "Wir konnten Ihre Verifizierung nicht genehmigen. Bitte kontaktieren Sie den Support, wenn Sie dies für einen Fehler halten.",

  "common.search": "Suchen…",
  "common.searchCountries": "Länder suchen…",
  "common.selectCountry": "Land auswählen",
  "common.noMatches": "Keine Treffer.",
  "common.allPicked": "Alle Länder bereits ausgewählt.",
  "common.select": "Auswählen…",
  "common.code": "Code",
  "common.phoneSearch": "Land oder +Code suchen…",
  "common.remove": "Entfernen",
};

// ---------- French --------------------------------------------------------
const FR: Bundle = {
  "shell.defaultBrand": "Vérification UserCore",
  "shell.poweredBy": "Propulsé par",
  "shell.loading": "Chargement de la vérification…",
  "shell.noSubsteps":
    "Aucune sous-étape n'est encore activée pour ce flux — demandez à votre administrateur d'en activer au moins une.",
  "shell.stepOfTotal": "Étape {step} sur {total}",
  "shell.close": "Fermer",

  "overview.titleSteps": "Étapes de vérification",
  "overview.titleKeepGoing": "Continuez",
  "overview.titleAllSet": "Tout est prêt — soumettre pour examen",
  "overview.subtitleAllDone":
    "Vérifiez les informations recueillies, puis soumettez-les pour examen.",
  "overview.subtitleProgress": "{count} sur {total} terminés",
  "overview.subtitleOneLeft": "Encore une étape à compléter.",
  "overview.subtitleManyLeft": "Encore {count} étapes à compléter.",
  "overview.upNext": "Suivant",
  "overview.continue": "Continuer",
  "overview.submit": "Soumettre pour examen",
  "overview.continueOnPhone": "Continuer sur le téléphone",

  "qr.title": "Continuer sur votre téléphone",
  "qr.subtitle":
    "Scannez le QR avec l'appareil photo de votre téléphone. Le flux reprendra exactement où vous l'avez laissé.",
  "qr.directUrl": "Lien direct",
  "qr.copy": "Copier",
  "qr.back": "Retour",
  "qr.backToSteps": "Retour aux étapes",

  "handoff.title": "Session poursuivie sur un téléphone",
  "handoff.subtitle":
    "Le client termine la vérification sur son appareil mobile. Les étapes ci-dessous sont mises à jour à mesure de sa progression.",
  "handoff.progress": "{count} sur {total} terminés",
  "handoff.canClose":
    "Vous pouvez fermer cette fenêtre — le résultat apparaîtra dans la file d'attente d'examen une fois le client terminé.",

  "step.terms": "Conditions générales",
  "step.email": "Vérification de l'e-mail",
  "step.idScan": "Pièce d'identité",
  "step.faceScan": "Scan facial",
  "step.por": "Justificatif de domicile",
  "step.contact": "Coordonnées",

  "terms.title": "Conditions générales",
  "terms.subtitle":
    "Veuillez lire et accepter les conditions avant de continuer.",
  "terms.checkbox": "J'ai lu et j'accepte les conditions ci-dessus.",
  "terms.continue": "Accepter et continuer",
  "terms.saving": "Enregistrement…",
  "terms.error":
    "Votre acceptation n'a pas pu être enregistrée. Veuillez réessayer.",
  "terms.defaultText": `Vérification d'identité UserCore — consentement

En continuant, vous autorisez UserCore et l'opérateur de ce flux à collecter, traiter et stocker les données personnelles que vous fournissez aux fins de la vérification de votre identité. Cela peut inclure des pièces d'identité, une vidéo selfie, des coordonnées et un justificatif de domicile.

Vos données sont conservées aussi longtemps que nécessaire pour satisfaire aux obligations réglementaires applicables et sont traitées conformément à la politique de confidentialité de l'opérateur. Vous pouvez retirer votre consentement à tout moment en contactant l'opérateur, auquel cas la vérification ne pourra pas être finalisée.

Vous confirmez que les informations et documents que vous soumettez vous appartiennent et sont exacts. La présentation de documents falsifiés ou volés constitue une infraction pénale dans la plupart des juridictions.`,

  "email.title": "Vérification de l'e-mail",
  "email.subtitle":
    "Nous vous enverrons un code à 6 chiffres pour confirmer votre adresse.",
  "email.label": "Adresse e-mail",
  "email.placeholder": "vous@exemple.fr",
  "email.send": "Envoyer le code",
  "email.sending": "Envoi…",
  "email.codeTitle": "Saisissez le code",
  "email.codeSubtitle":
    "Nous avons envoyé un code à 6 chiffres à {email}. Il expire dans 10 minutes.",
  "email.codeLabel": "Code de vérification",
  "email.differentEmail": "Utiliser une autre adresse e-mail",
  "email.verify": "Vérifier et continuer",
  "email.verifying": "Vérification…",
  "email.sendError": "Impossible d'envoyer le code",
  "email.verifyError": "La vérification a échoué",

  "doc.title": "Pièce d'identité",
  "doc.subtitle":
    "Téléchargez une photo nette de votre pièce d'identité officielle.",
  "doc.country": "Pays du document",
  "doc.type": "Type de document",
  "doc.passport": "Passeport",
  "doc.idCard": "Carte nationale d'identité",
  "doc.driverLicense": "Permis de conduire",
  "doc.front": "Recto",
  "doc.back": "Verso",
  "doc.photoPage": "Page photo",
  "doc.clickToUpload": "Cliquez pour téléverser",
  "doc.uploadHint": "JPG ou PNG",
  "doc.takePhoto": "Prendre une photo avec l'appareil",
  "doc.continue": "Continuer",
  "doc.uploading": "Téléversement…",
  "doc.errorMissingFront": "Veuillez ajouter une photo du document.",
  "doc.errorMissingBack": "Veuillez ajouter une photo du verso du document.",
  "doc.errorUpload": "Le téléversement a échoué. Veuillez réessayer.",

  "liveness.title": "Scan facial",
  "liveness.subtitleIdle":
    "Nous vérifions votre présence avec votre caméra. Rien ne quitte votre appareil avant la soumission.",
  "liveness.subtitleSaving":
    "Restez immobile pendant que nous enregistrons votre selfie…",
  "liveness.almostDone": "Presque terminé…",
  "liveness.instructFace": "Centrez votre visage dans le cadre",
  "liveness.instructBlink": "Clignez maintenant des yeux",
  "liveness.instructTurn": "Tournez lentement la tête à gauche, puis à droite",
  "liveness.checkFace": "Visage détecté",
  "liveness.checkBlink": "Clignement détecté",
  "liveness.checkTurn": "Rotation de la tête",
  "liveness.cameraReady": "Caméra prête — appuyez ci-dessous pour démarrer",
  "liveness.verified": "Vivacité confirmée",
  "liveness.start": "Démarrer la caméra",
  "liveness.loadingModel": "Chargement du modèle…",
  "liveness.cameraDenied":
    "Accès à la caméra refusé. Veuillez autoriser l'accès et réessayer.",
  "liveness.modelFailed":
    "Impossible de charger le modèle de détection faciale.",
  "liveness.submitError":
    "Impossible d'envoyer les résultats. Veuillez réessayer.",

  "por.title": "Justificatif de domicile",
  "por.subtitle":
    "Un document daté des 3 derniers mois indiquant votre nom et votre adresse personnelle.",
  "por.type": "Type de document",
  "por.gasBill": "Facture de gaz",
  "por.internetBill": "Facture Internet",
  "por.electricityBill": "Facture d'électricité",
  "por.rentAgreement": "Contrat de location",
  "por.bankStatement": "Relevé bancaire",
  "por.clickToUpload": "Cliquez pour téléverser",
  "por.uploadHint": "JPG, PNG ou PDF",
  "por.takePhoto": "Prendre une photo avec l'appareil",
  "por.street": "Adresse",
  "por.streetPlaceholder": "1 rue Principale",
  "por.city": "Ville",
  "por.cityPlaceholder": "Paris",
  "por.postalCode": "Code postal",
  "por.postalCodePlaceholder": "75001",
  "por.country": "Pays",
  "por.continue": "Continuer",
  "por.uploading": "Téléversement…",
  "por.errorMissing":
    "Veuillez téléverser le document et renseigner votre adresse.",
  "por.errorUpload": "Le téléversement a échoué. Veuillez réessayer.",

  "contact.title": "Coordonnées",
  "contact.subtitle":
    "Nous pouvons utiliser ces informations pour vous contacter au sujet de votre vérification.",
  "contact.phone": "Téléphone",
  "contact.phonePlaceholder": "+33 1 23 45 67 89",
  "contact.email": "E-mail",
  "contact.emailPlaceholder": "vous@exemple.fr",
  "contact.continue": "Continuer",
  "contact.saving": "Enregistrement…",
  "contact.error": "L'envoi a échoué. Veuillez réessayer.",
  "contact.phoneCountryRequired":
    "Veuillez sélectionner un indicatif de pays pour votre numéro de téléphone.",
  "resubmission.title":
    "Un examinateur vous demande de mettre à jour certains éléments :",

  "success.title": "Vérification soumise",
  "success.subtitle":
    "Vos informations sont en route vers notre équipe d'examen. Vous serez notifié dès qu'une décision sera prise.",
  "success.nextHeading": "Ce qui se passe ensuite",
  "success.next1": "Notre équipe examine votre soumission",
  "success.next2": "Vous recevez un e-mail avec la décision",
  "success.next3": "L'examen prend généralement 1 à 2 jours ouvrés",
  "success.notifyPrompt": "Recevoir une mise à jour par e-mail ? (facultatif)",
  "success.emailPlaceholder": "vous@exemple.com",
  "success.notifyButton": "Me notifier",
  "success.notifySaving": "Enregistrement…",
  "success.notifySaved":
    "Merci — nous vous enverrons un e-mail dès qu'il y a du nouveau.",
  "success.approvedTitle": "Vous êtes vérifié",
  "success.approvedSubtitle":
    "Votre identité a été approuvée. Vous pouvez fermer cette fenêtre.",
  "success.rejectedTitle": "Vérification non approuvée",
  "success.rejectedSubtitle":
    "Nous n'avons pas pu approuver votre vérification. Contactez le support si vous pensez qu'il s'agit d'une erreur.",

  "common.search": "Rechercher…",
  "common.searchCountries": "Rechercher un pays…",
  "common.selectCountry": "Sélectionner un pays",
  "common.noMatches": "Aucun résultat.",
  "common.allPicked": "Tous les pays sont déjà sélectionnés.",
  "common.select": "Sélectionner…",
  "common.code": "Code",
  "common.phoneSearch": "Rechercher un pays ou un +code…",
  "common.remove": "Supprimer",
};

// ---------- Spanish -------------------------------------------------------
const ES: Bundle = {
  "shell.defaultBrand": "Verificación UserCore",
  "shell.poweredBy": "Impulsado por",
  "shell.loading": "Cargando verificación…",
  "shell.noSubsteps":
    "Aún no hay subpasos habilitados para este flujo — pídele a tu administrador que active al menos uno.",
  "shell.stepOfTotal": "Paso {step} de {total}",
  "shell.close": "Cerrar",

  "overview.titleSteps": "Pasos de verificación",
  "overview.titleKeepGoing": "Sigue así",
  "overview.titleAllSet": "Todo listo — enviar para revisión",
  "overview.subtitleAllDone":
    "Revisa los datos que hemos recopilado y envíalos para revisión.",
  "overview.subtitleProgress": "{count} de {total} completados",
  "overview.subtitleOneLeft": "Un paso más por completar.",
  "overview.subtitleManyLeft": "Quedan {count} pasos por completar.",
  "overview.upNext": "Siguiente",
  "overview.continue": "Continuar",
  "overview.submit": "Enviar para revisión",
  "overview.continueOnPhone": "Continuar en el teléfono",

  "qr.title": "Continuar en tu teléfono",
  "qr.subtitle":
    "Escanea el QR con la cámara de tu teléfono. El flujo continuará exactamente donde lo dejaste.",
  "qr.directUrl": "Enlace directo",
  "qr.copy": "Copiar",
  "qr.back": "Volver",
  "qr.backToSteps": "Volver a los pasos",

  "handoff.title": "Sesión continuada en un teléfono",
  "handoff.subtitle":
    "El cliente está terminando la verificación en su dispositivo móvil. Los pasos a continuación se actualizan a medida que avanza.",
  "handoff.progress": "{count} de {total} completados",
  "handoff.canClose":
    "Puedes cerrar esta ventana — el resultado aparecerá en la cola de revisión cuando el cliente termine.",

  "step.terms": "Términos y condiciones",
  "step.email": "Verificación de correo",
  "step.idScan": "Documento de identidad",
  "step.faceScan": "Escaneo facial",
  "step.por": "Comprobante de domicilio",
  "step.contact": "Información de contacto",

  "terms.title": "Términos y condiciones",
  "terms.subtitle": "Por favor lee y acepta los términos antes de continuar.",
  "terms.checkbox": "He leído y acepto los términos anteriores.",
  "terms.continue": "Aceptar y continuar",
  "terms.saving": "Guardando…",
  "terms.error":
    "No pudimos registrar tu aceptación. Por favor, inténtalo de nuevo.",
  "terms.defaultText": `Verificación de identidad UserCore — consentimiento

Al continuar, autorizas a UserCore y al operador de este flujo a recopilar, procesar y almacenar la información personal que proporciones con el fin de verificar tu identidad. Esto puede incluir documentos de identidad, un vídeo selfi, datos de contacto y un comprobante de domicilio.

Tus datos se conservan durante el tiempo necesario para cumplir con las obligaciones regulatorias aplicables y se procesan de acuerdo con la política de privacidad del operador. Puedes retirar tu consentimiento en cualquier momento poniéndote en contacto con el operador, en cuyo caso la verificación no podrá completarse.

Confirmas que la información y los documentos que envías te pertenecen y son exactos. Presentar documentos falsificados o robados es un delito en la mayoría de jurisdicciones.`,

  "email.title": "Verificación de correo",
  "email.subtitle":
    "Te enviaremos un código de 6 dígitos para confirmar tu dirección.",
  "email.label": "Correo electrónico",
  "email.placeholder": "tu@ejemplo.com",
  "email.send": "Enviar código",
  "email.sending": "Enviando…",
  "email.codeTitle": "Introduce el código",
  "email.codeSubtitle":
    "Hemos enviado un código de 6 dígitos a {email}. Expira en 10 minutos.",
  "email.codeLabel": "Código de verificación",
  "email.differentEmail": "Usar otro correo",
  "email.verify": "Verificar y continuar",
  "email.verifying": "Verificando…",
  "email.sendError": "No se pudo enviar el código",
  "email.verifyError": "La verificación ha fallado",

  "doc.title": "Documento de identidad",
  "doc.subtitle": "Sube una foto nítida de tu documento de identidad oficial.",
  "doc.country": "País del documento",
  "doc.type": "Tipo de documento",
  "doc.passport": "Pasaporte",
  "doc.idCard": "DNI",
  "doc.driverLicense": "Carné de conducir",
  "doc.front": "Anverso",
  "doc.back": "Reverso",
  "doc.photoPage": "Página de la foto",
  "doc.clickToUpload": "Haz clic para subir",
  "doc.uploadHint": "JPG o PNG",
  "doc.takePhoto": "Hacer foto con la cámara",
  "doc.continue": "Continuar",
  "doc.uploading": "Subiendo…",
  "doc.errorMissingFront": "Por favor, añade una foto del documento.",
  "doc.errorMissingBack":
    "Por favor, añade una foto del reverso del documento.",
  "doc.errorUpload": "La subida ha fallado. Inténtalo de nuevo.",

  "liveness.title": "Escaneo facial",
  "liveness.subtitleIdle":
    "Detectaremos la vivacidad con tu cámara. Nada sale de tu dispositivo hasta que envíes.",
  "liveness.subtitleSaving": "Mantente quieto mientras guardamos tu selfi…",
  "liveness.almostDone": "Casi listo…",
  "liveness.instructFace": "Centra tu cara en el marco",
  "liveness.instructBlink": "Ahora parpadea",
  "liveness.instructTurn":
    "Gira la cabeza lentamente a la izquierda y luego a la derecha",
  "liveness.checkFace": "Cara detectada",
  "liveness.checkBlink": "Parpadeo detectado",
  "liveness.checkTurn": "Giro de cabeza",
  "liveness.cameraReady": "Cámara lista — pulsa abajo para empezar",
  "liveness.verified": "Vivacidad verificada",
  "liveness.start": "Iniciar cámara",
  "liveness.loadingModel": "Cargando modelo…",
  "liveness.cameraDenied":
    "Acceso a la cámara denegado. Por favor, permite el acceso e inténtalo de nuevo.",
  "liveness.modelFailed": "No se pudo cargar el modelo de detección facial.",
  "liveness.submitError":
    "No se pudieron enviar los resultados. Inténtalo de nuevo.",

  "por.title": "Comprobante de domicilio",
  "por.subtitle":
    "Un documento con fecha de los últimos 3 meses que muestre tu nombre y dirección.",
  "por.type": "Tipo de documento",
  "por.gasBill": "Factura del gas",
  "por.internetBill": "Factura de internet",
  "por.electricityBill": "Factura de la luz",
  "por.rentAgreement": "Contrato de alquiler",
  "por.bankStatement": "Extracto bancario",
  "por.clickToUpload": "Haz clic para subir",
  "por.uploadHint": "JPG, PNG o PDF",
  "por.takePhoto": "Hacer foto con la cámara",
  "por.street": "Calle y número",
  "por.streetPlaceholder": "Calle Mayor 1",
  "por.city": "Ciudad",
  "por.cityPlaceholder": "Madrid",
  "por.postalCode": "Código postal",
  "por.postalCodePlaceholder": "28001",
  "por.country": "País",
  "por.continue": "Continuar",
  "por.uploading": "Subiendo…",
  "por.errorMissing": "Por favor, sube el documento y rellena tu dirección.",
  "por.errorUpload": "La subida ha fallado. Inténtalo de nuevo.",

  "contact.title": "Información de contacto",
  "contact.subtitle":
    "Podemos usar estos datos para contactarte sobre tu verificación.",
  "contact.phone": "Teléfono",
  "contact.phonePlaceholder": "+34 600 123 456",
  "contact.email": "Correo electrónico",
  "contact.emailPlaceholder": "tu@ejemplo.com",
  "contact.continue": "Continuar",
  "contact.saving": "Guardando…",
  "contact.error": "El envío ha fallado. Inténtalo de nuevo.",
  "contact.phoneCountryRequired":
    "Selecciona un código de país para tu número de teléfono.",
  "resubmission.title": "Un revisor te pidió que actualices algunos datos:",

  "success.title": "Verificación enviada",
  "success.subtitle":
    "Tu información está en camino a nuestro equipo de revisión. Te avisaremos cuando se tome una decisión.",
  "success.nextHeading": "Qué sigue",
  "success.next1": "Nuestro equipo revisa tu envío",
  "success.next2": "Recibes un correo con la decisión",
  "success.next3": "La revisión suele tardar 1–2 días laborables",
  "success.notifyPrompt": "¿Quieres una actualización por correo? (opcional)",
  "success.emailPlaceholder": "tu@ejemplo.com",
  "success.notifyButton": "Avísame",
  "success.notifySaving": "Guardando…",
  "success.notifySaved":
    "Gracias — te enviaremos un correo cuando haya novedades.",
  "success.approvedTitle": "Estás verificado",
  "success.approvedSubtitle":
    "Tu identidad ha sido aprobada. Puedes cerrar esta ventana.",
  "success.rejectedTitle": "Verificación no aprobada",
  "success.rejectedSubtitle":
    "No pudimos aprobar tu verificación. Contacta con soporte si crees que es un error.",

  "common.search": "Buscar…",
  "common.searchCountries": "Buscar países…",
  "common.selectCountry": "Seleccionar país",
  "common.noMatches": "Sin resultados.",
  "common.allPicked": "Ya se han seleccionado todos los países.",
  "common.select": "Seleccionar…",
  "common.code": "Código",
  "common.phoneSearch": "Buscar país o +código…",
  "common.remove": "Quitar",
};

const TRANSLATIONS: Record<Locale, Bundle> = {
  en: EN,
  sl: SL,
  de: DE,
  fr: FR,
  es: ES,
};

let currentLocale: Locale = "en";
const listeners = new Set<() => void>();

export const setLocale = (locale: Locale) => {
  if (currentLocale === locale) return;
  currentLocale = locale;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore — private mode, SSR, etc.
  }
  listeners.forEach((l) => l());
};

export const getCurrentLocale = (): Locale => currentLocale;

// React hook — components that call t() during render should call useLocale()
// somewhere above the call site so they re-render when the picker fires
// setLocale. The Shell does this once, so every descendant re-renders too.
export const useLocale = (): Locale =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getCurrentLocale,
    getCurrentLocale,
  );

const isSupported = (s: string): s is Locale =>
  (SUPPORTED_LOCALES as readonly string[]).includes(s);

export const resolveInitialLocale = (): Locale => {
  // 1. ?lang= URL param (used by tests and dashboard preview)
  try {
    const param = new URLSearchParams(window.location.search).get("lang");
    if (param) {
      const lower = param.toLowerCase();
      if (isSupported(lower)) return lower;
    }
  } catch {
    // ignore — non-browser environment
  }
  // 2. Customer's prior pick, persisted from the in-widget picker.
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && isSupported(stored)) return stored;
  } catch {
    // ignore
  }
  // 3. navigator.language two-letter prefix
  try {
    const nav = navigator.language?.toLowerCase().slice(0, 2);
    if (nav && isSupported(nav)) return nav;
  } catch {
    // ignore
  }
  return "en";
};

export const t = (key: string, vars?: Record<string, string>): string => {
  const bundle = TRANSLATIONS[currentLocale] ?? EN;
  let value = bundle[key] ?? EN[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.split(`{${k}}`).join(v);
    }
  }
  return value;
};
