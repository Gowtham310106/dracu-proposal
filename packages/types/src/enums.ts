/**
 * Standardised option lists used by every form, API validator and report.
 * Change a label here and it changes everywhere (web forms, API validation, seeds).
 */

export const GENDERS = ['Male', 'Female', 'Other'] as const;
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'] as const;
export const DURATION_UNITS = ['days', 'weeks', 'months', 'years'] as const;
export const AFFECTED_REGIONS = [
  'Neck', 'Shoulder', 'Upper back', 'Lower back', 'Knee', 'Hip', 'Ankle', 'Wrist',
  'Elbow', 'Head / Migraine', 'Face', 'Abdomen', 'Whole body', 'Other',
] as const;
export const PREVIOUS_TREATMENTS = ['Allopathy', 'Physiotherapy', 'Ayurveda', 'Siddha', 'Homeopathy', 'Surgery', 'None'] as const;
export const MEDICAL_HISTORY = [
  'Diabetes', 'Hypertension', 'Thyroid', 'Cardiac', 'Asthma', 'Arthritis', 'Pregnancy',
  'Pacemaker', 'Bleeding disorder', 'Epilepsy', 'Kidney disease', 'Cancer', 'Other',
] as const;
export const CONTRAINDICATION_FLAGS = ['Pregnancy', 'Pacemaker', 'Anticoagulants', 'Needle phobia', 'Skin infection', 'Immunocompromised'] as const;
export const LIFESTYLES = ['Sedentary', 'Moderate', 'Active'] as const;
export const SLEEP_QUALITY = ['Good', 'Fair', 'Poor'] as const;
export const REFERRAL_SOURCES = ['Instagram', 'Google', 'Walk-in', 'Ads', 'Referral', 'Doctor referral', 'Returning', 'Website', 'Other'] as const;
export const LANGUAGES = ['English', 'Tamil', 'Telugu', 'Hindi'] as const;
export const PATIENT_STATUS = ['Active', 'Inactive'] as const;

export const APPOINTMENT_TYPES = ['Consultation', 'Session', 'Follow-up', 'Review'] as const;
export const APPOINTMENT_STATUS = ['Booked', 'Checked-in', 'In-treatment', 'Completed', 'Cancelled', 'No-show'] as const;

/** Treatment plans offered by Acu Heal, grouped from the conditions listed on acuheal.co.in. */
export const TREATMENT_PRESETS = [
  'Pain management',
  'Arthritis care',
  'Paralysis rehabilitation',
  'Facial palsy',
  'Migraine & vertigo',
  'Weight management',
  'Infertility & PCOS',
  "Men's health",
  'Stress, anxiety & insomnia',
  'Respiratory & allergy',
  'Digestive care',
  'Metabolic care',
  'Skin & cosmetic',
  'De-addiction',
  'Custom',
] as const;
export const SESSION_FREQUENCY = ['Daily', 'Alternate days', 'Twice a week', 'Weekly', 'Custom'] as const;
export const PRICING_MODES = ['Per-session', 'Package'] as const;
export const PACKAGE_STATUS = ['Active', 'Completed', 'Paused', 'Discontinued'] as const;

export const TECHNIQUES = ['Needling', 'Electro-acupuncture', 'Moxibustion', 'Cupping', 'Acupressure', 'Laser', 'Auricular', 'Scalp acupuncture'] as const;
export const PATIENT_RESPONSE = ['Improved', 'Same', 'Worse'] as const;

export const INVOICE_ITEM_TYPES = ['Consultation', 'Session', 'Package', 'Product', 'Other'] as const;
export const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank transfer', 'Other'] as const;
export const PAYMENT_STATUS = ['Paid', 'Partial', 'Unpaid'] as const;

export const LEAD_SOURCES = ['Instagram', 'Google', 'Walk-in', 'Ads', 'Referral', 'Website', 'Other'] as const;
export const LEAD_STATUS = ['New', 'Follow-up', 'Attended', 'Converted', 'Lost'] as const;
export const FOLLOW_UP_CHANNELS = ['Call', 'WhatsApp', 'Visit', 'SMS'] as const;

export const ROLES = ['ADMIN', 'DOCTOR', 'FRONT_DESK', 'ACCOUNTS'] as const;
export const ROLE_LABELS: Record<(typeof ROLES)[number], string> = {
  ADMIN: 'Admin',
  DOCTOR: 'Doctor',
  FRONT_DESK: 'Front-desk',
  ACCOUNTS: 'Accounts',
};
export const PAY_CYCLES = ['Monthly'] as const;

export const EXPENSE_CATEGORIES = ['Rent', 'Utilities', 'Supplies / Needles', 'Salary', 'Marketing', 'Equipment', 'Maintenance', 'Misc'] as const;
export const VENDOR_CATEGORIES = ['Needles / Consumables', 'Equipment', 'Pharmacy', 'Services', 'Other'] as const;

export const MEDIA_KINDS = ['Video', 'Photo'] as const;
export const MEDIA_CATEGORIES = ['Progress', 'Technique', 'Before', 'After', 'Profile', 'Document'] as const;

export const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const ATTENDANCE_STATUS = ['Present', 'Half-day', 'Absent', 'Leave'] as const;
export const ATTENDANCE_SOURCES = ['Biometric', 'Manual', 'CSV'] as const;

export const MESSAGE_TYPES = ['SESSION_REMINDER', 'BIRTHDAY', 'FOLLOW_UP', 'PAYMENT_DUE', 'CUSTOM'] as const;
export const MESSAGE_STATUS = ['Queued', 'Sent', 'Failed', 'Skipped'] as const;

/** Presenting conditions, used for intake tagging and CRM "interested in". */
export const CONDITIONS = [
  'Back pain', 'Neck pain', 'Shoulder pain', 'Knee pain', 'Sciatica', 'Osteoarthritis', 'Rheumatoid arthritis',
  'Paralysis', 'Facial palsy', 'Migraine', 'Vertigo', 'Insomnia', 'Stress / Anxiety', 'Depression',
  'Obesity / Weight loss', 'Diabetes', 'Thyroid', 'Blood pressure', 'Renal failure',
  'Sinusitis', 'Allergy', 'Wheezing / Asthma', 'GERD', 'IBS', 'Poor digestion',
  'Infertility', 'PCOS', 'Irregular periods', 'Impotency', 'Oligospermia',
  'Hair fall', 'Face lift', 'Other',
] as const;

export const INDIAN_STATES = [
  'Tamil Nadu', 'Andhra Pradesh', 'Telangana', 'Karnataka', 'Kerala', 'Puducherry', 'Maharashtra', 'Delhi', 'Other',
] as const;

export type Gender = (typeof GENDERS)[number];
export type Role = (typeof ROLES)[number];
export type AppointmentStatus = (typeof APPOINTMENT_STATUS)[number];
export type AppointmentType = (typeof APPOINTMENT_TYPES)[number];
export type PackageStatus = (typeof PACKAGE_STATUS)[number];
export type PaymentMode = (typeof PAYMENT_MODES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];
export type LeadStatus = (typeof LEAD_STATUS)[number];
export type LeadSource = (typeof LEAD_SOURCES)[number];
export type MediaKind = (typeof MEDIA_KINDS)[number];
export type AttendanceStatus = (typeof ATTENDANCE_STATUS)[number];
export type MessageType = (typeof MESSAGE_TYPES)[number];
export type MessageStatus = (typeof MESSAGE_STATUS)[number];
