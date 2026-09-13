/**
 * Seed script.
 *   pnpm --filter @acuheal/api seed         -> branches, admin, message templates (idempotent)
 *   pnpm --filter @acuheal/api seed:demo    -> + demo staff, patients, packages, sessions, invoices, payments, leads, expenses, attendance
 */
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { connectDb, disconnectDb } from '../config/db.js';
import { Branch } from '../models/Branch.js';
import { User } from '../models/User.js';
import { MessageTemplate } from '../models/MessageTemplate.js';
import { Patient } from '../models/Patient.js';
import { Vendor } from '../models/Vendor.js';
import { Expense } from '../models/Expense.js';
import { Lead } from '../models/Lead.js';
import { Appointment } from '../models/Appointment.js';
import { TreatmentPackage } from '../models/TreatmentPackage.js';
import { SessionLog } from '../models/SessionLog.js';
import { Invoice } from '../models/Invoice.js';
import { AttendanceLog } from '../models/AttendanceLog.js';
import { seq } from '../utils/sequence.js';
import { addDaysIso, combine, isoToDate, todayIso } from '../utils/dates.js';
import { recordPayment } from '../modules/billing/billing.service.js';
import { computePackageTotal, computeInvoiceTotals } from '@acuheal/types';

const demo = process.argv.includes('--demo');

// deterministic pseudo-random so demo data is stable between runs
let rngState = 20260912;
const rnd = () => (rngState = (rngState * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]!;
const between = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

/** The three live Acu Heal branches (acuheal.co.in). Street lines are placeholders to confirm with the clinic. */
const BRANCHES = [
  { code: 'ANR', name: 'Acu Heal – Anna Nagar', phone: '9884746916', whatsappNumber: '9884746916', address: 'Anna Nagar', city: 'Chennai', state: 'Tamil Nadu' },
  { code: 'VLS', name: 'Acu Heal – Valasaravakkam', phone: '9884746916', whatsappNumber: '9884746916', address: 'Valasaravakkam', city: 'Chennai', state: 'Tamil Nadu' },
  { code: 'ALP', name: 'Acu Heal – Alwarpet', phone: '9884746916', whatsappNumber: '9884746916', address: 'Alwarpet', city: 'Chennai', state: 'Tamil Nadu' },
] as const;

const TEMPLATES = [
  { type: 'SESSION_REMINDER', name: 'Session reminder (English)', language: 'English', sendOffsetHours: 24, body: 'Dear {{patientName}}, this is a reminder of your acupuncture session {{sessionNo}}/{{totalSessions}} at {{clinicName}} ({{branchName}}) on {{date}} at {{time}} with {{doctorName}}. Reply here or call {{branchPhone}} to reschedule.' },
  { type: 'SESSION_REMINDER', name: 'Session reminder (Tamil)', language: 'Tamil', sendOffsetHours: 24, body: 'அன்புள்ள {{patientName}}, {{clinicName}} ({{branchName}}) இல் உங்கள் அக்குபஞ்சர் சிகிச்சை {{sessionNo}}/{{totalSessions}} {{date}} அன்று {{time}} மணிக்கு {{doctorName}} உடன் உள்ளது. மாற்ற {{branchPhone}} ஐ அழைக்கவும்.' },
  { type: 'BIRTHDAY', name: 'Birthday wish (English)', language: 'English', sendOffsetHours: 8, body: 'Happy birthday, {{patientName}}! 🎂 Wishing you good health and happiness from all of us at {{clinicName}}, {{branchName}}.' },
  { type: 'BIRTHDAY', name: 'Birthday wish (Tamil)', language: 'Tamil', sendOffsetHours: 8, body: 'இனிய பிறந்தநாள் வாழ்த்துக்கள், {{patientName}}! 🎂 {{clinicName}}, {{branchName}} குழுவினரின் அன்பான வாழ்த்துக்கள்.' },
  { type: 'PAYMENT_DUE', name: 'Balance reminder (English)', language: 'English', sendOffsetHours: 0, body: 'Dear {{patientName}}, a balance of ₹{{balance}} is pending on your treatment package at {{clinicName}} ({{branchName}}). Please settle at your next visit. Call {{branchPhone}} for queries.' },
  { type: 'FOLLOW_UP', name: 'Enquiry follow-up (English)', language: 'English', sendOffsetHours: 0, body: 'Hi {{patientName}}, thank you for enquiring at {{clinicName}} ({{branchName}}). Our doctor is available for a free first consultation this week. Call {{branchPhone}} to book.' },
] as const;

async function seedCore() {
  const branches = [];
  for (const b of BRANCHES) {
    const doc = await Branch.findOneAndUpdate({ code: b.code }, { $setOnInsert: { ...b, workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], workingHours: { open: '09:00', close: '19:00' }, slotDurationMinutes: 30, reminderHour: 18 } }, { upsert: true, new: true }).lean();
    branches.push(doc!);
  }
  logger.info(`branches ready: ${branches.map((b) => b.code).join(', ')}`);

  let admin: { _id: unknown } | null = await User.findOne({ email: env.SEED_ADMIN_EMAIL.toLowerCase() }).select('_id').lean();
  if (!admin) {
    admin = (
      await User.create({
        employeeCode: await seq.employeeCode(),
        fullName: 'Dr. Shaji Bharath',
        mobile: '9884746916',
        email: env.SEED_ADMIN_EMAIL.toLowerCase(),
        passwordHash: await bcrypt.hash(env.SEED_ADMIN_PASSWORD, 10),
        role: 'ADMIN',
        branchIds: branches.map((b) => b._id),
        defaultBranchId: branches[0]!._id,
        designation: 'Chief Acupuncturist & Founder',
        qualification: 'PhD (Acupuncture)',
        joiningDate: new Date('2008-04-01'),
        salary: { basic: 0, allowances: 0, deductions: 0, payCycle: 'Monthly' },
      })
    ).toObject();
    logger.info(`admin created: ${env.SEED_ADMIN_EMAIL} / ${env.SEED_ADMIN_PASSWORD}`);
  } else logger.info('admin exists, skipping');

  for (const t of TEMPLATES) {
    await MessageTemplate.updateOne({ type: t.type, language: t.language }, { $setOnInsert: { ...t, active: true } }, { upsert: true });
  }
  logger.info('message templates ready');
  return { branches, admin };
}

const FIRST = ['Arun', 'Priya', 'Karthik', 'Divya', 'Suresh', 'Lakshmi', 'Vijay', 'Meena', 'Rajesh', 'Kavitha', 'Senthil', 'Anitha', 'Mohan', 'Revathi', 'Ganesh', 'Sangeetha', 'Balaji', 'Nithya', 'Ramesh', 'Deepa', 'Prakash', 'Shalini', 'Manoj', 'Bhuvana', 'Dinesh', 'Gayathri', 'Saravanan', 'Pavithra', 'Kumar', 'Yamini'];
const LAST = ['Kumar', 'Raj', 'Krishnan', 'Devi', 'Murugan', 'Subramani', 'Selvam', 'Natarajan', 'Palanisamy', 'Rajan'];
const COMPLAINTS = [
  { c: 'Chronic lower back pain radiating to the left leg', r: ['Lower back', 'Hip'], cond: ['Back pain', 'Sciatica'], plan: 'Pain management' },
  { c: 'Cervical spondylosis with neck stiffness and headaches', r: ['Neck', 'Shoulder', 'Head / Migraine'], cond: ['Neck pain'], plan: 'Pain management' },
  { c: 'Bilateral knee osteoarthritis, difficulty climbing stairs', r: ['Knee'], cond: ['Knee pain', 'Osteoarthritis'], plan: 'Arthritis care' },
  { c: 'Migraine 3–4 episodes per week with photophobia', r: ['Head / Migraine'], cond: ['Migraine'], plan: 'Migraine & vertigo' },
  { c: 'Weight gain, 12 kg over 2 years, sedentary lifestyle', r: ['Abdomen'], cond: ['Obesity / Weight loss'], plan: 'Weight management' },
  { c: 'Right-side hemiparesis after stroke, 4 months', r: ['Whole body'], cond: ['Paralysis'], plan: 'Paralysis rehabilitation' },
  { c: 'Insomnia and anxiety, poor sleep for 6 months', r: ['Whole body'], cond: ['Insomnia', 'Stress / Anxiety'], plan: 'Stress, anxiety & insomnia' },
  { c: 'Frozen shoulder, restricted abduction', r: ['Shoulder'], cond: ['Shoulder pain'], plan: 'Pain management' },
  { c: 'PCOS with irregular cycles, trying to conceive', r: ['Abdomen'], cond: ['PCOS', 'Irregular periods', 'Infertility'], plan: 'Infertility & PCOS' },
  { c: 'Left-side facial palsy, onset 3 weeks ago', r: ['Face'], cond: ['Facial palsy'], plan: 'Facial palsy' },
  { c: 'Chronic sinusitis with seasonal wheezing', r: ['Head / Migraine'], cond: ['Sinusitis', 'Wheezing / Asthma', 'Allergy'], plan: 'Respiratory & allergy' },
  { c: 'GERD with bloating and poor digestion after meals', r: ['Abdomen'], cond: ['GERD', 'Poor digestion'], plan: 'Digestive care' },
  { c: 'Type 2 diabetes with neuropathy in both feet', r: ['Whole body'], cond: ['Diabetes'], plan: 'Metabolic care' },
  { c: 'Diffuse hair fall over 8 months', r: ['Other'], cond: ['Hair fall'], plan: 'Skin & cosmetic' },
  { c: 'Positional vertigo with nausea', r: ['Head / Migraine'], cond: ['Vertigo'], plan: 'Migraine & vertigo' },
];
const SOURCES = ['Instagram', 'Google', 'Walk-in', 'Ads', 'Referral', 'Doctor referral'] as const;

async function seedDemo(core: Awaited<ReturnType<typeof seedCore>>) {
  if (await Patient.exists({})) {
    logger.info('demo data exists (patients found), skipping demo seed');
    return;
  }
  const { branches, admin } = core;
  const pw = await bcrypt.hash('Demo@12345', 10);
  const mk = async (u: { fullName: string; email: string; role: 'DOCTOR' | 'FRONT_DESK' | 'ACCOUNTS'; branchIds: unknown[]; defaultBranchId: unknown; designation: string; basic: number; bio: string }) =>
    (await User.create({ employeeCode: await seq.employeeCode(), fullName: u.fullName, email: u.email, mobile: `98${between(10000000, 99999999)}`, passwordHash: pw, role: u.role, branchIds: u.branchIds, defaultBranchId: u.defaultBranchId, designation: u.designation, joiningDate: new Date('2023-06-01'), biometricUserId: u.bio, salary: { basic: u.basic, allowances: Math.round(u.basic * 0.1), deductions: 0, payCycle: 'Monthly' } })).toObject();

  const all = branches.map((b) => b._id);
  const doctors = [
    await mk({ fullName: 'Dr. Priya Raman', email: 'priya@acuheal.local', role: 'DOCTOR', branchIds: all, defaultBranchId: branches[0]!._id, designation: 'Senior Acupuncturist', basic: 45000, bio: '101' }),
    await mk({ fullName: 'Dr. Arjun Selvam', email: 'arjun@acuheal.local', role: 'DOCTOR', branchIds: [branches[1]!._id, branches[2]!._id], defaultBranchId: branches[1]!._id, designation: 'Acupuncturist', basic: 38000, bio: '102' }),
  ];
  const frontDesk = [];
  for (const [i, b] of branches.entries()) {
    frontDesk.push(await mk({ fullName: ['Kavya S', 'Ramya M', 'Sathish K'][i]!, email: `frontdesk${i + 1}@acuheal.local`, role: 'FRONT_DESK', branchIds: [b._id], defaultBranchId: b._id, designation: 'Front-desk executive', basic: 16000, bio: String(201 + i) }));
  }
  const accounts = await mk({ fullName: 'Muthu Lakshmi', email: 'accounts@acuheal.local', role: 'ACCOUNTS', branchIds: all, defaultBranchId: branches[0]!._id, designation: 'Accounts executive', basic: 22000, bio: '301' });
  logger.info(`demo staff: ${doctors.length} doctors, ${frontDesk.length} front-desk, 1 accounts (password Demo@12345)`);

  const vendors = await Vendor.insertMany([
    { name: 'MedNeedle Supplies', contactPerson: 'Raghu', mobile: '9840011122', category: ['Needles / Consumables'], address: 'Chennai', active: true },
    { name: 'ElectroTherapy India', contactPerson: 'Sunita', mobile: '9840033344', category: ['Equipment'], address: 'Bengaluru', active: true },
    { name: 'CleanCare Services', contactPerson: 'Babu', mobile: '9840055566', category: ['Services'], address: 'Chennai', active: true },
  ]);

  const today = todayIso();
  const patients = [];
  for (let i = 0; i < 27; i++) {
    const branch = branches[i % 3]!;
    const cx = pick(COMPLAINTS);
    const gender = rnd() > 0.5 ? 'Female' : 'Male';
    const dobYear = between(1955, 2002);
    const dobMonth = between(1, 12);
    const dob = i === 0 ? isoToDate(today.slice(0, 5) + today.slice(5)) : new Date(dobYear, dobMonth - 1, between(1, 28)); // patient 0 has birthday today
    const createdDaysAgo = between(0, 120);
    const p = await Patient.create({
      pid: await seq.patientId(String(branch._id), branch.code),
      branchId: branch._id,
      fullName: `${pick(FIRST)} ${pick(LAST)}`,
      mobile: `9${between(600000000, 999999999)}`,
      gender,
      dateOfBirth: dob,
      bloodGroup: pick(['A+', 'B+', 'O+', 'AB+', 'O-']),
      addressLine: `${between(1, 120)}, ${pick(['Anna Nagar', 'Ashok Nagar', 'Valasaravakkam', 'Alwarpet', 'T. Nagar', 'Porur', 'Adyar'])}`,
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: `600${String(between(1, 118)).padStart(3, '0')}`,
      chiefComplaint: cx.c,
      complaintDurationValue: between(1, 24),
      complaintDurationUnit: pick(['weeks', 'months']),
      painScale: between(3, 9),
      affectedRegions: cx.r,
      conditions: cx.cond,
      previousTreatments: [pick(['Allopathy', 'Physiotherapy', 'Ayurveda', 'None'])],
      medicalHistory: rnd() > 0.6 ? [pick(['Diabetes', 'Hypertension', 'Thyroid'])] : [],
      contraindicationFlags: rnd() > 0.9 ? ['Anticoagulants'] : [],
      lifestyle: pick(['Sedentary', 'Moderate', 'Active']),
      sleepQuality: pick(['Good', 'Fair', 'Poor']),
      referralSource: pick(SOURCES),
      preferredLanguage: pick(['Tamil', 'English', 'Tamil']),
      whatsappOptIn: true,
      consentGiven: true,
      consentSignedAt: new Date(),
      status: 'Active',
      tags: rnd() > 0.8 ? ['Senior citizen'] : [],
      createdBy: admin._id,
      createdAt: new Date(Date.now() - createdDaysAgo * 86400000),
    });
    patients.push({ doc: p, plan: cx.plan, branch, createdDaysAgo });
  }
  logger.info(`demo patients: ${patients.length}`);

  // packages, sessions, invoices, payments for ~2/3 of patients
  let pkgCount = 0;
  let sessionCount = 0;
  for (const [i, p] of patients.entries()) {
    if (i % 3 === 2) continue;
    const doctor = p.branch.code === 'RSP' ? doctors[0]! : pick(doctors);
    const totalSessions = pick([6, 10, 12, 15]);
    const pricingMode = rnd() > 0.4 ? 'Package' : 'Per-session';
    const perSessionFee = pick([500, 600, 700]);
    const packageFee = totalSessions * perSessionFee - 500;
    const startDate = addDaysIso(today, -Math.min(p.createdDaysAgo, 40));
    const input = { pricingMode, totalSessions, perSessionFee, packageFee, discount: 0 } as const;
    const totalPayable = computePackageTotal(input);
    const pkg = await TreatmentPackage.create({
      packageNo: await seq.packageNo(String(p.branch._id), p.branch.code),
      patientId: p.doc._id,
      branchId: p.branch._id,
      treatmentPlanName: p.plan,
      assignedDoctorId: doctor._id,
      totalSessions,
      sessionsCompleted: 0,
      sessionFrequency: 'Alternate days',
      startDate,
      expectedEndDate: addDaysIso(startDate, (totalSessions - 1) * 2),
      pricingMode,
      perSessionFee,
      packageFee,
      discount: 0,
      totalPayable,
      totalPaid: 0,
      balance: totalPayable,
      status: 'Active',
      createdBy: admin._id,
    });
    pkgCount++;
    const done = Math.min(totalSessions, between(0, Math.floor(Math.min(p.createdDaysAgo, 40) / 2) + 1));
    for (let s = 1; s <= done; s++) {
      const date = addDaysIso(startDate, (s - 1) * 2);
      if (date > today) break;
      const before = between(4, 9);
      await SessionLog.create({ packageId: pkg._id, patientId: p.doc._id, branchId: p.branch._id, sessionNumber: s, date, doctorId: doctor._id, painScaleBefore: before, painScaleAfter: Math.max(0, before - between(1, 3)), technique: ['Needling', ...(rnd() > 0.6 ? ['Electro-acupuncture'] : [])], pointsUsed: pick([['LI4', 'ST36', 'BL23'], ['GB20', 'GB21', 'LI4'], ['SP6', 'ST36', 'CV4'], ['BL40', 'GB30', 'BL25']]), needleRetentionMinutes: 20, observations: pick(['Good tolerance, mild relief reported after session.', 'Patient reports improved mobility since last visit.', 'Stiffness persists; extended retention time.', 'Marked improvement in sleep quality.']), patientResponse: pick(['Improved', 'Improved', 'Same']), createdBy: doctor._id });
      pkg.sessionsCompleted = s;
      pkg.lastSessionAt = isoToDate(date);
      sessionCount++;
    }
    if (pkg.sessionsCompleted >= totalSessions) pkg.status = 'Completed';
    await pkg.save();

    // invoice for the package + partial/full payment
    const items = [{ description: `${p.plan} package – ${totalSessions} sessions`, type: 'Package' as const, qty: 1, unitPrice: totalPayable, amount: totalPayable }];
    const totals = computeInvoiceTotals({ items, discount: 0, taxPercent: 0 });
    const inv = await Invoice.create({ invoiceNo: await seq.invoiceNo(String(p.branch._id), p.branch.code, isoToDate(startDate)), branchId: p.branch._id, patientId: p.doc._id, packageId: pkg._id, date: startDate, dateAt: isoToDate(startDate), items, ...totals, taxPercent: 0, amountPaid: 0, balance: totals.grandTotal, paymentStatus: 'Unpaid', createdBy: admin._id });
    const payAmount = rnd() > 0.5 ? totals.grandTotal : Math.round(totals.grandTotal * pick([0.3, 0.5]));
    await recordPayment({ invoiceId: String(inv._id), amount: payAmount, mode: pick(['Cash', 'UPI', 'UPI', 'Card']), date: startDate, userId: String(frontDesk[i % 3]!._id) });
    if (payAmount < totals.grandTotal && rnd() > 0.5) {
      await recordPayment({ invoiceId: String(inv._id), amount: Math.min(totals.grandTotal - payAmount, 1000), mode: 'Cash', date: addDaysIso(startDate, 6) > today ? today : addDaysIso(startDate, 6), userId: String(frontDesk[i % 3]!._id) });
    }
  }
  logger.info(`demo packages: ${pkgCount}, sessions: ${sessionCount}`);

  // appointments: yesterday (completed), today, tomorrow
  const slots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '16:00', '16:30', '17:00', '17:30', '18:00'];
  let apptCount = 0;
  for (const offset of [-1, 0, 1]) {
    const date = addDaysIso(today, offset);
    for (const [bi, branch] of branches.entries()) {
      const bp = patients.filter((p) => String(p.branch._id) === String(branch._id));
      const doctor = bi === 0 ? doctors[0]! : doctors[1]!;
      const used = new Set<string>();
      for (let k = 0; k < 5; k++) {
        const slot = pick(slots);
        if (used.has(slot)) continue;
        used.add(slot);
        const p = pick(bp);
        const pkg = await TreatmentPackage.findOne({ patientId: p.doc._id, status: 'Active' }).lean();
        const end = `${String(Number(slot.slice(0, 2)) + (slot.endsWith('30') ? 1 : 0)).padStart(2, '0')}:${slot.endsWith('30') ? '00' : '30'}`;
        await Appointment.create({ branchId: branch._id, patientId: p.doc._id, doctorId: doctor._id, date, slotStart: slot, slotEnd: end, startAt: combine(date, slot), type: pkg ? 'Session' : 'Consultation', treatmentPackageId: pkg?._id, status: offset < 0 ? pick(['Completed', 'Completed', 'No-show']) : offset === 0 && k < 2 ? 'Checked-in' : 'Booked', createdBy: frontDesk[bi]!._id });
        apptCount++;
      }
    }
  }
  logger.info(`demo appointments: ${apptCount}`);

  // leads
  const statuses = ['New', 'New', 'Follow-up', 'Follow-up', 'Attended', 'Converted', 'Lost'] as const;
  for (let i = 0; i < 18; i++) {
    const branch = branches[i % 3]!;
    const status = pick(statuses);
    await Lead.create({ leadNo: await seq.leadNo(), branchId: branch._id, name: `${pick(FIRST)} ${pick(LAST)}`, mobile: `8${between(600000000, 999999999)}`, source: pick(['Instagram', 'Google', 'Walk-in', 'Ads', 'Referral']), interestedIn: pick(COMPLAINTS).plan, complaintSummary: pick(COMPLAINTS).c, status, assignedTo: frontDesk[i % 3]!._id, nextFollowUpAt: ['New', 'Follow-up'].includes(status) ? combine(addDaysIso(today, between(-2, 3)), '11:00') : undefined, followUps: status === 'Follow-up' ? [{ at: new Date(Date.now() - 2 * 86400000), by: frontDesk[i % 3]!._id, byName: frontDesk[i % 3]!.fullName, channel: 'Call', outcome: 'Interested, will visit this week' }] : [], createdBy: frontDesk[i % 3]!._id, createdAt: new Date(Date.now() - between(0, 45) * 86400000) });
  }

  // expenses last 30 days
  const cats = ['Rent', 'Utilities', 'Supplies / Needles', 'Marketing', 'Maintenance', 'Misc'] as const;
  for (let i = 0; i < 24; i++) {
    const branch = branches[i % 3]!;
    const date = addDaysIso(today, -between(0, 30));
    const category = pick(cats);
    await Expense.create({ branchId: branch._id, date, dateAt: isoToDate(date), category, description: { Rent: 'Monthly rent', Utilities: 'EB bill', 'Supplies / Needles': 'Sterile needles 0.25x25mm (10 boxes)', Marketing: 'Instagram ad campaign', Maintenance: 'AC service', Misc: 'Refreshments' }[category], amount: { Rent: 25000, Utilities: between(1800, 4200), 'Supplies / Needles': between(2500, 6000), Marketing: between(1500, 5000), Maintenance: between(800, 2500), Misc: between(200, 900) }[category], mode: pick(['Cash', 'UPI', 'Bank transfer']), vendorId: category === 'Supplies / Needles' ? vendors[0]!._id : undefined, paidBy: accounts._id, createdBy: accounts._id });
  }

  // attendance last 7 days
  const staff = [...doctors, ...frontDesk, accounts];
  for (let dOff = 6; dOff >= 0; dOff--) {
    const date = addDaysIso(today, -dOff);
    for (const s of staff) {
      if (rnd() > 0.92) continue; // absent
      const inH = between(8, 9);
      const inM = pick(['45', '55', '05', '15']);
      const checkIn = `${String(inH).padStart(2, '0')}:${inM}`;
      const checkOut = dOff === 0 ? undefined : `${between(17, 19)}:${pick(['00', '30', '45'])}`;
      const worked = checkOut ? (Number(checkOut.slice(0, 2)) - inH) * 60 : 0;
      await AttendanceLog.create({ staffId: s._id, branchId: s.defaultBranchId, date, checkIn, checkOut, firstPunchAt: combine(date, checkIn), lastPunchAt: checkOut ? combine(date, checkOut) : undefined, workedMinutes: worked, status: worked && worked < 240 ? 'Half-day' : 'Present', source: 'Biometric', deviceUserId: s.biometricUserId });
    }
  }
  logger.info('demo leads, expenses, attendance ready');
}

/** Seeds an already-connected database. Used by the CLI below and by the standalone dev runner. */
export async function seedAll(opts: { demo?: boolean } = {}): Promise<void> {
  const core = await seedCore();
  if (opts.demo) await seedDemo(core);
  logger.info('seed complete');
}

async function main() {
  await connectDb();
  await seedAll({ demo });
  await disconnectDb();
}

// only run as a CLI when invoked directly (not when imported by the standalone runner)
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/seed/seed.ts') || process.argv[1]?.replace(/\\/g, '/').endsWith('/seed/seed.js')) {
  main().catch((err) => {
    logger.error({ err }, 'seed failed');
    process.exit(1);
  });
}
