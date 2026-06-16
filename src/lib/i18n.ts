export type Lang = "en" | "he";

export const translations = {
  en: {
    appName: "VaultRecord",
    tagline: "Private, local-first meeting assistant",
    privacyNotice:
      "Privacy Mode: This app runs entirely on your device. No data is sent to any server except for the AI processing request you authorize.",

    // Setup
    setupTitle: "Create your Master Password",
    setupDesc:
      "This password encrypts everything stored on this device. It cannot be recovered if lost.",
    password: "Master password",
    confirmPassword: "Confirm password",
    createVault: "Create Vault",
    passwordMin: "Password must be at least 8 characters",
    passwordMismatch: "Passwords do not match",

    // Lock
    lockTitle: "Vault Locked",
    lockDesc: "Enter your master password to continue.",
    unlock: "Unlock",
    wrongPassword: "Incorrect password",
    lock: "Lock",

    // Nav
    dashboard: "Meetings",
    folders: "Folders",
    settings: "Settings",
    newMeeting: "New Meeting",

    // Dashboard
    noMeetings: "No meetings yet. Create one to get started.",
    allMeetings: "All meetings",
    unfiled: "Unfiled",
    addFolder: "New folder",
    folderName: "Folder name",
    create: "Create",
    cancel: "Cancel",
    delete: "Delete",
    rename: "Rename",
    search: "Search meetings…",

    // Meeting
    untitled: "Untitled meeting",
    titlePh: "Meeting title",
    record: "Record",
    stop: "Stop",
    recording: "Recording",
    upload: "Upload audio",
    pasteText: "Paste transcript",
    pasteTextPh: "Paste or type the raw text here…",
    process: "Generate with AI",
    processing: "AI is working…",
    rawTranscript: "Raw Transcript",
    protocol: "Meeting Protocol",
    summary: "Summary",
    participants: "Participants",
    decisions: "Decisions by speaker",
    actionItems: "Action items",
    task: "Task",
    owner: "Owner",
    due: "Due",
    exportPdf: "Download PDF",
    save: "Save",
    saved: "Saved",
    back: "Back",
    missingKey: "Set your Gemini API key in Settings first.",
    aiError: "AI request failed. Check your key and try again.",
    needInput: "Add audio or text first.",
    noProtocol: "No protocol generated yet.",
    notes: "Notes",

    // Settings
    apiKey: "Gemini API Key",
    apiKeyDesc:
      "Stored encrypted in your local browser vault. Never sent anywhere except Google's API.",
    language: "Language",
    english: "English",
    hebrew: "עברית",
    exportDb: "Export Database",
    importDb: "Import Database",
    exportDbDesc: "Download an encrypted backup of all your data.",
    importDbDesc: "Restore from a backup. This will replace your current data.",
    changePassword: "Change Master Password",
    about: "About",
    aboutText:
      "VaultRecord is a 100% local meeting assistant. Your data never leaves this device.",
    confirm: "Confirm",

    listenNote: "Live recording captures microphone audio and sends it to Gemini for transcription.",
  },
  he: {
    appName: "VaultRecord",
    tagline: "עוזר ישיבות פרטי, מקומי לחלוטין",
    privacyNotice:
      "מצב פרטיות: האפליקציה פועלת במלואה על המכשיר שלך. שום מידע לא נשלח לשרת חיצוני מלבד בקשת עיבוד ה-AI שאתה מאשר.",

    setupTitle: "צור סיסמת אב",
    setupDesc:
      "סיסמה זו מצפינה את כל המידע במכשיר. לא ניתן לשחזר אותה במקרה של אובדן.",
    password: "סיסמת אב",
    confirmPassword: "אימות סיסמה",
    createVault: "צור כספת",
    passwordMin: "הסיסמה חייבת להכיל לפחות 8 תווים",
    passwordMismatch: "הסיסמאות אינן תואמות",

    lockTitle: "הכספת נעולה",
    lockDesc: "הזן את סיסמת האב כדי להמשיך.",
    unlock: "פתח",
    wrongPassword: "סיסמה שגויה",
    lock: "נעל",

    dashboard: "ישיבות",
    folders: "תיקיות",
    settings: "הגדרות",
    newMeeting: "ישיבה חדשה",

    noMeetings: "אין ישיבות עדיין. צור אחת כדי להתחיל.",
    allMeetings: "כל הישיבות",
    unfiled: "ללא תיקייה",
    addFolder: "תיקייה חדשה",
    folderName: "שם התיקייה",
    create: "צור",
    cancel: "ביטול",
    delete: "מחק",
    rename: "שנה שם",
    search: "חפש ישיבות…",

    untitled: "ישיבה ללא כותרת",
    titlePh: "כותרת הישיבה",
    record: "הקלט",
    stop: "עצור",
    recording: "מקליט",
    upload: "העלה קובץ אודיו",
    pasteText: "הדבק תמלול",
    pasteTextPh: "הדבק או הקלד את הטקסט כאן…",
    process: "צור באמצעות AI",
    processing: "ה-AI עובד…",
    rawTranscript: "תמלול גולמי",
    protocol: "פרוטוקול הישיבה",
    summary: "סיכום",
    participants: "משתתפים",
    decisions: "החלטות לפי דובר",
    actionItems: "משימות לביצוע",
    task: "משימה",
    owner: "אחראי",
    due: "תאריך יעד",
    exportPdf: "הורד PDF",
    save: "שמור",
    saved: "נשמר",
    back: "חזרה",
    missingKey: "הגדר את מפתח ה-Gemini בהגדרות תחילה.",
    aiError: "בקשת ה-AI נכשלה. בדוק את המפתח ונסה שוב.",
    needInput: "הוסף אודיו או טקסט תחילה.",
    noProtocol: "לא נוצר פרוטוקול עדיין.",
    notes: "הערות",

    apiKey: "מפתח Gemini API",
    apiKeyDesc:
      "נשמר מוצפן בכספת המקומית שלך. לא נשלח לשום מקום מלבד ה-API של גוגל.",
    language: "שפה",
    english: "English",
    hebrew: "עברית",
    exportDb: "ייצוא מסד נתונים",
    importDb: "ייבוא מסד נתונים",
    exportDbDesc: "הורד גיבוי מוצפן של כל הנתונים שלך.",
    importDbDesc: "שחזר מגיבוי. פעולה זו תחליף את הנתונים הנוכחיים.",
    changePassword: "שנה סיסמת אב",
    about: "אודות",
    aboutText:
      "VaultRecord הוא עוזר ישיבות מקומי לחלוטין. הנתונים שלך אף פעם לא עוזבים את המכשיר.",
    confirm: "אשר",

    listenNote: "הקלטה חיה לוכדת שמע מהמיקרופון ושולחת ל-Gemini לתמלול.",
  },
} as const;

export type Dict = (typeof translations)["en"];

export function isRTL(lang: Lang) {
  return lang === "he";
}
