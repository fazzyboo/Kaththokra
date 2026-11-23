/*
  Mock data for the frontend. Shapes follow the Overall System Design (§4 schema, §5.7 diagnose
  response). Treatment text is SAMPLE content for UI work only — not agronomist-approved (BR R-7).
*/
import type { Tx } from "./i18n";
import type { ClarifyQuestion, CropId, Diagnosis, Disease, Prescription, Upazila } from "./types";

export const PRICE_RX = 5;
export const PRICE_SUB_MONTHLY = 20;
export const CONFIDENCE_GATE = 0.75;
export const HELPLINE = "16123";
export const USSD_CODE = "*XXX#";
export const MODEL_VERSION = "effb0-2026-11-27";

export const CROPS: { id: CropId; name: Tx; banglish: string; season: Tx }[] = [
  { id: "rice", name: { bn: "ধান", en: "Rice" }, banglish: "Dhan", season: { bn: "আমন, বোরো, আউশ", en: "Aman, Boro, Aus" } },
  { id: "potato", name: { bn: "আলু", en: "Potato" }, banglish: "Alu", season: { bn: "রবি মৌসুম", en: "Rabi season" } },
  { id: "tomato", name: { bn: "টমেটো", en: "Tomato" }, banglish: "Tomato", season: { bn: "শীতকাল", en: "Winter" } },
];

export const cropName = (id: CropId) => CROPS.find((c) => c.id === id)!.name;

const SAFE_GEAR: Tx = {
  bn: "মাস্ক, গ্লাভস ও লম্বা হাতার জামা পরে স্প্রে করুন। বাতাসের উল্টো দিকে স্প্রে করবেন না। লেবেল পড়ুন।",
  en: "Spray wearing a mask, gloves and long sleeves. Never spray into the wind. Read the label.",
};

export const DISEASES: Disease[] = [
  // ---------------- Rice ----------------
  {
    code: "RICE_BLAST",
    crop: "rice",
    name: { bn: "ধানের ব্লাস্ট", en: "Rice blast" },
    banglish: "Blast",
    symptoms: [
      { bn: "পাতায় চোখের মতো দাগ, মাঝখানটা ধূসর", en: "Eye-shaped spots with grey centres" },
      { bn: "দাগের কিনারা বাদামি", en: "Brown margins around the spots" },
      { bn: "শীষের গোড়া কালো হয়ে ভেঙে যেতে পারে", en: "Panicle neck may blacken and break" },
    ],
    cause: { bn: "ছত্রাক (Magnaporthe oryzae)", en: "Fungus (Magnaporthe oryzae)" },
    activeIngredient: { bn: "ট্রাইসাইক্লাজল ৭৫% WP", en: "Tricyclazole 75% WP" },
    dose: { bn: "প্রতি শতকে ৩ লিটার পানিতে ২ গ্রাম", en: "2 g in 3 L water per shotok" },
    timing: { bn: "বিকেলে স্প্রে করুন; ৭–১০ দিন পর আরেকবার", en: "Spray in the afternoon; repeat after 7–10 days" },
    phiDays: 14,
    safety: SAFE_GEAR,
    care: [
      { bn: "অতিরিক্ত ইউরিয়া দেবেন না", en: "Avoid excess urea" },
      { bn: "জমিতে পানি ধরে রাখুন", en: "Keep standing water in the field" },
    ],
    kbVersion: 4,
    kbStatus: "published",
    approvedBy: "Dr. Nasrin Akter",
    approvedAt: "2026-11-21",
  },
  {
    code: "RICE_BROWN_SPOT",
    crop: "rice",
    name: { bn: "ধানের বাদামি দাগ", en: "Brown spot" },
    banglish: "Badami dag",
    symptoms: [
      { bn: "পাতায় ছোট গোল বাদামি দাগ", en: "Small round brown spots on leaves" },
      { bn: "দাগের চারপাশে হলুদ আভা", en: "Yellow halo around spots" },
    ],
    cause: { bn: "ছত্রাক (Bipolaris oryzae), দুর্বল মাটিতে বেশি", en: "Fungus (Bipolaris oryzae), worse in poor soil" },
    activeIngredient: { bn: "প্রোপিকোনাজল ২৫% EC", en: "Propiconazole 25% EC" },
    dose: { bn: "প্রতি শতকে ৩ লিটার পানিতে ২ মিলি", en: "2 ml in 3 L water per shotok" },
    timing: { bn: "দাগ দেখা দিলেই; ১০ দিন পর আরেকবার", en: "As soon as spots appear; repeat after 10 days" },
    phiDays: 21,
    safety: SAFE_GEAR,
    care: [{ bn: "পটাশ ও দস্তা সার দিন", en: "Apply potash and zinc" }],
    kbVersion: 3,
    kbStatus: "published",
    approvedBy: "Dr. Nasrin Akter",
    approvedAt: "2026-11-21",
  },
  {
    code: "RICE_BLB",
    crop: "rice",
    name: { bn: "ব্যাকটেরিয়াজনিত পাতা পোড়া", en: "Bacterial leaf blight" },
    banglish: "Pata pora",
    symptoms: [
      { bn: "পাতার আগা থেকে হলুদ-সাদা হয়ে শুকিয়ে যায়", en: "Leaf tips turn yellow-white and dry" },
      { bn: "সকালে পাতায় হলুদ ফোঁটা দেখা যায়", en: "Yellow droplets on leaves in the morning" },
    ],
    cause: { bn: "ব্যাকটেরিয়া (Xanthomonas oryzae)", en: "Bacteria (Xanthomonas oryzae)" },
    activeIngredient: { bn: "কপার হাইড্রক্সাইড ৭৭% WP", en: "Copper hydroxide 77% WP" },
    dose: { bn: "প্রতি শতকে ৩ লিটার পানিতে ৪ গ্রাম", en: "4 g in 3 L water per shotok" },
    timing: { bn: "জমির পানি সরিয়ে ২–৩ দিন শুকনো রাখুন, তারপর স্প্রে", en: "Drain the field for 2–3 days, then spray" },
    phiDays: 10,
    safety: SAFE_GEAR,
    care: [
      { bn: "ইউরিয়া বন্ধ রাখুন, পটাশ দিন", en: "Stop urea, apply potash" },
      { bn: "আক্রান্ত জমির পানি অন্য জমিতে যেতে দেবেন না", en: "Do not let water flow to other plots" },
    ],
    kbVersion: 3,
    kbStatus: "published",
    approvedBy: "Dr. Nasrin Akter",
    approvedAt: "2026-11-20",
  },
  {
    code: "RICE_SHEATH_BLIGHT",
    crop: "rice",
    name: { bn: "খোল পোড়া", en: "Sheath blight" },
    banglish: "Khol pora",
    symptoms: [
      { bn: "পানির কাছাকাছি খোলে ধূসর-সবুজ লম্বাটে দাগ", en: "Grey-green oval patches on the sheath near water" },
      { bn: "দাগ সাপের চামড়ার মতো ছড়ায়", en: "Patches spread like snake skin" },
    ],
    cause: { bn: "ছত্রাক (Rhizoctonia solani)", en: "Fungus (Rhizoctonia solani)" },
    activeIngredient: { bn: "হেক্সাকোনাজল ৫% SC", en: "Hexaconazole 5% SC" },
    dose: { bn: "প্রতি শতকে ৩ লিটার পানিতে ৬ মিলি", en: "6 ml in 3 L water per shotok" },
    timing: { bn: "গাছের গোড়ায় স্প্রে; ১০–১৫ দিন পর আরেকবার", en: "Spray at the base; repeat after 10–15 days" },
    phiDays: 21,
    safety: SAFE_GEAR,
    care: [{ bn: "ঘন করে চারা লাগাবেন না", en: "Avoid dense planting" }],
    kbVersion: 2,
    kbStatus: "review",
  },
  {
    code: "RICE_HEALTHY",
    crop: "rice",
    healthy: true,
    name: { bn: "সুস্থ ধান গাছ", en: "Healthy rice" },
    banglish: "Sustho",
    symptoms: [{ bn: "রোগের লক্ষণ পাওয়া যায়নি", en: "No disease signs found" }],
    cause: { bn: "—", en: "—" },
    activeIngredient: { bn: "কোনো ওষুধ লাগবে না", en: "No spray needed" },
    dose: { bn: "—", en: "—" },
    timing: { bn: "নিয়মিত জমি দেখুন", en: "Keep checking the field" },
    phiDays: 0,
    safety: { bn: "অপ্রয়োজনে কীটনাশক দেবেন না", en: "Do not spray without need" },
    care: [{ bn: "সুষম সার দিন", en: "Use balanced fertiliser" }],
    kbVersion: 1,
    kbStatus: "published",
    approvedBy: "Dr. Nasrin Akter",
    approvedAt: "2026-11-19",
  },
  // ---------------- Potato ----------------
  {
    code: "POTATO_LATE_BLIGHT",
    crop: "potato",
    name: { bn: "আলুর মড়ক (লেট ব্লাইট)", en: "Potato late blight" },
    banglish: "Morok",
    symptoms: [
      { bn: "পাতায় পানিভেজা কালচে দাগ, দ্রুত বাড়ে", en: "Dark water-soaked patches that spread fast" },
      { bn: "পাতার নিচে সাদা তুলার মতো আস্তরণ", en: "White cottony growth under the leaf" },
    ],
    cause: { bn: "ছত্রাকসদৃশ জীবাণু (Phytophthora infestans), কুয়াশায় বাড়ে", en: "Water mould (Phytophthora infestans), spreads in fog" },
    activeIngredient: { bn: "মেটালাক্সিল + ম্যানকোজেব", en: "Metalaxyl + Mancozeb" },
    dose: { bn: "প্রতি শতকে ৩ লিটার পানিতে ৬ গ্রাম", en: "6 g in 3 L water per shotok" },
    timing: { bn: "এখনই স্প্রে; কুয়াশা থাকলে ৭ দিন পর আবার", en: "Spray now; repeat after 7 days if foggy" },
    phiDays: 14,
    safety: SAFE_GEAR,
    care: [
      { bn: "সেচ বন্ধ রাখুন", en: "Pause irrigation" },
      { bn: "আক্রান্ত গাছ তুলে মাটিতে পুঁতে ফেলুন", en: "Pull and bury badly hit plants" },
    ],
    kbVersion: 5,
    kbStatus: "published",
    approvedBy: "Dr. Kamrul Hasan",
    approvedAt: "2026-11-22",
  },
  {
    code: "POTATO_EARLY_BLIGHT",
    crop: "potato",
    name: { bn: "আলুর আগাম ধসা", en: "Potato early blight" },
    banglish: "Agam dhosa",
    symptoms: [
      { bn: "পুরোনো পাতায় বলয়ের মতো বাদামি দাগ", en: "Brown spots with rings on older leaves" },
      { bn: "দাগের চারপাশ হলুদ", en: "Yellowing around spots" },
    ],
    cause: { bn: "ছত্রাক (Alternaria solani)", en: "Fungus (Alternaria solani)" },
    activeIngredient: { bn: "ম্যানকোজেব ৮০% WP", en: "Mancozeb 80% WP" },
    dose: { bn: "প্রতি শতকে ৩ লিটার পানিতে ৬ গ্রাম", en: "6 g in 3 L water per shotok" },
    timing: { bn: "১০ দিন পরপর ২–৩ বার", en: "2–3 sprays, 10 days apart" },
    phiDays: 7,
    safety: SAFE_GEAR,
    care: [{ bn: "নিচের আক্রান্ত পাতা ফেলে দিন", en: "Remove infected lower leaves" }],
    kbVersion: 3,
    kbStatus: "published",
    approvedBy: "Dr. Kamrul Hasan",
    approvedAt: "2026-11-21",
  },
  {
    code: "POTATO_HEALTHY",
    crop: "potato",
    healthy: true,
    name: { bn: "সুস্থ আলু গাছ", en: "Healthy potato" },
    banglish: "Sustho",
    symptoms: [{ bn: "রোগের লক্ষণ পাওয়া যায়নি", en: "No disease signs found" }],
    cause: { bn: "—", en: "—" },
    activeIngredient: { bn: "কোনো ওষুধ লাগবে না", en: "No spray needed" },
    dose: { bn: "—", en: "—" },
    timing: { bn: "কুয়াশার সময় নিয়মিত জমি দেখুন", en: "Check often during foggy spells" },
    phiDays: 0,
    safety: { bn: "অপ্রয়োজনে কীটনাশক দেবেন না", en: "Do not spray without need" },
    care: [],
    kbVersion: 1,
    kbStatus: "published",
    approvedBy: "Dr. Kamrul Hasan",
    approvedAt: "2026-11-19",
  },
  // ---------------- Tomato ----------------
  {
    code: "TOMATO_EARLY_BLIGHT",
    crop: "tomato",
    name: { bn: "টমেটোর আগাম ধসা", en: "Tomato early blight" },
    banglish: "Agam dhosa",
    symptoms: [
      { bn: "নিচের পাতায় বলয়যুক্ত বাদামি দাগ", en: "Ringed brown spots on lower leaves" },
      { bn: "পাতা হলুদ হয়ে ঝরে পড়ে", en: "Leaves yellow and drop" },
    ],
    cause: { bn: "ছত্রাক (Alternaria solani)", en: "Fungus (Alternaria solani)" },
    activeIngredient: { bn: "ক্লোরোথ্যালোনিল ৭৫% WP", en: "Chlorothalonil 75% WP" },
    dose: { bn: "প্রতি শতকে ৩ লিটার পানিতে ৬ গ্রাম", en: "6 g in 3 L water per shotok" },
    timing: { bn: "৭–১০ দিন পরপর", en: "Every 7–10 days" },
    phiDays: 7,
    safety: SAFE_GEAR,
    care: [{ bn: "গাছে খুঁটি দিন, পাতা মাটি থেকে উপরে রাখুন", en: "Stake plants to keep leaves off the soil" }],
    kbVersion: 2,
    kbStatus: "published",
    approvedBy: "Dr. Kamrul Hasan",
    approvedAt: "2026-11-21",
  },
  {
    code: "TOMATO_LATE_BLIGHT",
    crop: "tomato",
    name: { bn: "টমেটোর নাবি ধসা", en: "Tomato late blight" },
    banglish: "Nabi dhosa",
    symptoms: [
      { bn: "পাতা ও কাণ্ডে কালচে পানিভেজা দাগ", en: "Dark water-soaked patches on leaves and stems" },
      { bn: "ফলে বাদামি শক্ত দাগ", en: "Firm brown patches on fruit" },
    ],
    cause: { bn: "Phytophthora infestans", en: "Phytophthora infestans" },
    activeIngredient: { bn: "সাইমক্সানিল + ম্যানকোজেব", en: "Cymoxanil + Mancozeb" },
    dose: { bn: "প্রতি শতকে ৩ লিটার পানিতে ৬ গ্রাম", en: "6 g in 3 L water per shotok" },
    timing: { bn: "এখনই; ৭ দিন পর আবার", en: "Now; repeat after 7 days" },
    phiDays: 10,
    safety: SAFE_GEAR,
    care: [{ bn: "উপর থেকে পানি দেবেন না", en: "Avoid overhead watering" }],
    kbVersion: 2,
    kbStatus: "approved",
    approvedBy: "Dr. Kamrul Hasan",
    approvedAt: "2026-11-22",
  },
  {
    code: "TOMATO_LEAF_MOLD",
    crop: "tomato",
    name: { bn: "টমেটোর পাতার ছাতা", en: "Tomato leaf mould" },
    banglish: "Pata chhata",
    symptoms: [
      { bn: "পাতার উপরে হালকা হলুদ ছোপ", en: "Pale yellow patches on the upper leaf" },
      { bn: "নিচে জলপাই-সবুজ মখমলের মতো আস্তরণ", en: "Olive-green velvety growth underneath" },
    ],
    cause: { bn: "ছত্রাক (Passalora fulva), আর্দ্রতায় বাড়ে", en: "Fungus (Passalora fulva), likes humidity" },
    activeIngredient: { bn: "কপার অক্সিক্লোরাইড ৫০% WP", en: "Copper oxychloride 50% WP" },
    dose: { bn: "প্রতি শতকে ৩ লিটার পানিতে ৬ গ্রাম", en: "6 g in 3 L water per shotok" },
    timing: { bn: "১০ দিন পরপর ২ বার", en: "Twice, 10 days apart" },
    phiDays: 7,
    safety: SAFE_GEAR,
    care: [{ bn: "গাছের মাঝে বাতাস চলাচল রাখুন", en: "Keep air moving between plants" }],
    kbVersion: 1,
    kbStatus: "draft",
  },
  {
    code: "TOMATO_HEALTHY",
    crop: "tomato",
    healthy: true,
    name: { bn: "সুস্থ টমেটো গাছ", en: "Healthy tomato" },
    banglish: "Sustho",
    symptoms: [{ bn: "রোগের লক্ষণ পাওয়া যায়নি", en: "No disease signs found" }],
    cause: { bn: "—", en: "—" },
    activeIngredient: { bn: "কোনো ওষুধ লাগবে না", en: "No spray needed" },
    dose: { bn: "—", en: "—" },
    timing: { bn: "নিয়মিত জমি দেখুন", en: "Keep checking the field" },
    phiDays: 0,
    safety: { bn: "অপ্রয়োজনে কীটনাশক দেবেন না", en: "Do not spray without need" },
    care: [],
    kbVersion: 1,
    kbStatus: "published",
    approvedBy: "Dr. Kamrul Hasan",
    approvedAt: "2026-11-19",
  },
];

export const disease = (code: string) => DISEASES.find((d) => d.code === code);

export const UPAZILAS: Upazila[] = [
  { code: "SRJ-ULL", num: "101", name: { bn: "উল্লাপাড়া", en: "Ullapara" }, district: { bn: "সিরাজগঞ্জ", en: "Sirajganj" } },
  { code: "SRJ-SHZ", num: "102", name: { bn: "শাহজাদপুর", en: "Shahjadpur" }, district: { bn: "সিরাজগঞ্জ", en: "Sirajganj" } },
  { code: "PBN-CHT", num: "111", name: { bn: "চাটমোহর", en: "Chatmohar" }, district: { bn: "পাবনা", en: "Pabna" } },
  { code: "PBN-ISW", num: "112", name: { bn: "ঈশ্বরদী", en: "Ishwardi" }, district: { bn: "পাবনা", en: "Pabna" } },
  { code: "BOG-SHB", num: "121", name: { bn: "শিবগঞ্জ", en: "Shibganj" }, district: { bn: "বগুড়া", en: "Bogura" } },
  { code: "BOG-SHR", num: "122", name: { bn: "শেরপুর", en: "Sherpur" }, district: { bn: "বগুড়া", en: "Bogura" } },
  { code: "RNG-PIR", num: "131", name: { bn: "পীরগঞ্জ", en: "Pirganj" }, district: { bn: "রংপুর", en: "Rangpur" } },
  { code: "RNG-MIT", num: "132", name: { bn: "মিঠাপুকুর", en: "Mithapukur" }, district: { bn: "রংপুর", en: "Rangpur" } },
  { code: "MUN-SRN", num: "141", name: { bn: "শ্রীনগর", en: "Sreenagar" }, district: { bn: "মুন্সীগঞ্জ", en: "Munshiganj" } },
  { code: "JSR-JKG", num: "151", name: { bn: "ঝিকরগাছা", en: "Jhikargacha" }, district: { bn: "যশোর", en: "Jashore" } },
];

export const upazila = (code: string) => UPAZILAS.find((u) => u.code === code);

/** Up to 2 symptom questions per crop, shared with the USSD tree (SRS DX-5). */
export const CLARIFY: ClarifyQuestion[] = [
  {
    id: "rice-q1",
    crop: "rice",
    q: { bn: "দাগগুলো দেখতে কেমন?", en: "What do the spots look like?" },
    options: [
      { label: { bn: "চোখের মতো, মাঝখান ধূসর", en: "Eye-shaped, grey centre" }, boost: { RICE_BLAST: 0.3 } },
      { label: { bn: "ছোট গোল বাদামি", en: "Small, round, brown" }, boost: { RICE_BROWN_SPOT: 0.3 } },
      { label: { bn: "আগা থেকে হলুদ হয়ে শুকাচ্ছে", en: "Drying yellow from the tip" }, boost: { RICE_BLB: 0.3 } },
      { label: { bn: "এর কোনোটাই না", en: "None of these" }, boost: {} },
    ],
  },
  {
    id: "rice-q2",
    crop: "rice",
    q: { bn: "দাগ গাছের কোন অংশে বেশি?", en: "Where are the spots worst?" },
    options: [
      { label: { bn: "পাতায়", en: "On the leaves" }, boost: { RICE_BLAST: 0.1, RICE_BROWN_SPOT: 0.1 } },
      { label: { bn: "পানির কাছে খোলে", en: "On the sheath near the water" }, boost: { RICE_SHEATH_BLIGHT: 0.35 } },
      { label: { bn: "শীষের গোড়ায়", en: "At the panicle neck" }, boost: { RICE_BLAST: 0.2 } },
    ],
  },
  {
    id: "potato-q1",
    crop: "potato",
    q: { bn: "দাগে কি বলয় (রিং) আছে?", en: "Do the spots have rings?" },
    options: [
      { label: { bn: "হ্যাঁ, গোল বলয়", en: "Yes, target-like rings" }, boost: { POTATO_EARLY_BLIGHT: 0.3 } },
      { label: { bn: "না, ভেজা কালচে ছোপ", en: "No, dark wet patches" }, boost: { POTATO_LATE_BLIGHT: 0.3 } },
      { label: { bn: "বুঝতে পারছি না", en: "Not sure" }, boost: {} },
    ],
  },
  {
    id: "potato-q2",
    crop: "potato",
    q: { bn: "পাতার নিচে সাদা আস্তরণ আছে?", en: "Is there white growth under the leaf?" },
    options: [
      { label: { bn: "হ্যাঁ", en: "Yes" }, boost: { POTATO_LATE_BLIGHT: 0.25 } },
      { label: { bn: "না", en: "No" }, boost: { POTATO_EARLY_BLIGHT: 0.15 } },
    ],
  },
  {
    id: "tomato-q1",
    crop: "tomato",
    q: { bn: "পাতার নিচে কী দেখছেন?", en: "What do you see under the leaf?" },
    options: [
      { label: { bn: "জলপাই-সবুজ মখমল", en: "Olive-green velvet" }, boost: { TOMATO_LEAF_MOLD: 0.35 } },
      { label: { bn: "সাদা আস্তরণ", en: "White growth" }, boost: { TOMATO_LATE_BLIGHT: 0.3 } },
      { label: { bn: "কিছু না", en: "Nothing" }, boost: { TOMATO_EARLY_BLIGHT: 0.2 } },
    ],
  },
  {
    id: "tomato-q2",
    crop: "tomato",
    q: { bn: "কোন পাতায় প্রথম শুরু?", en: "Which leaves were hit first?" },
    options: [
      { label: { bn: "নিচের পুরোনো পাতা", en: "Lower, older leaves" }, boost: { TOMATO_EARLY_BLIGHT: 0.2 } },
      { label: { bn: "উপরের কচি পাতা", en: "Upper, young leaves" }, boost: { TOMATO_LATE_BLIGHT: 0.2 } },
    ],
  },
];

/* ---------------- Farmer-side history ---------------- */

const daysAgo = (d: number, h = 9) => {
  const dt = new Date("2026-11-23T00:00:00+06:00");
  dt.setDate(dt.getDate() - d);
  dt.setHours(h, 12);
  return dt.toISOString();
};
export { daysAgo };

export const DIAGNOSES: Diagnosis[] = [
  {
    id: "d-81f2",
    crop: "rice",
    status: "CONFIDENT",
    createdAt: daysAgo(0, 10),
    top3: [
      { code: "RICE_BLAST", p: 0.86 },
      { code: "RICE_BROWN_SPOT", p: 0.09 },
      { code: "RICE_BLB", p: 0.03 },
    ],
    severity: "moderate",
    ood: 0.08,
    modelVersion: MODEL_VERSION,
    kbVersion: 4,
    channel: "web",
    upazila: "SRJ-ULL",
  },
  {
    id: "d-a17c",
    crop: "potato",
    status: "UNCERTAIN",
    createdAt: daysAgo(0, 11),
    top3: [
      { code: "POTATO_EARLY_BLIGHT", p: 0.52 },
      { code: "POTATO_LATE_BLIGHT", p: 0.39 },
      { code: "POTATO_HEALTHY", p: 0.06 },
    ],
    ood: 0.21,
    modelVersion: MODEL_VERSION,
    kbVersion: 3,
    channel: "web",
    upazila: "MUN-SRN",
  },
  {
    id: "d-x003",
    crop: "tomato",
    status: "RETAKE",
    createdAt: daysAgo(0, 12),
    top3: [{ code: "TOMATO_HEALTHY", p: 0.31 }],
    ood: 0.83,
    modelVersion: MODEL_VERSION,
    kbVersion: 2,
    channel: "web",
    upazila: "JSR-JKG",
    retakeReason: "blurry",
  },
  {
    id: "d-77b0",
    crop: "tomato",
    status: "CONFIDENT",
    createdAt: daysAgo(0, 13),
    top3: [
      { code: "TOMATO_HEALTHY", p: 0.93 },
      { code: "TOMATO_EARLY_BLIGHT", p: 0.04 },
      { code: "TOMATO_LEAF_MOLD", p: 0.02 },
    ],
    ood: 0.05,
    modelVersion: MODEL_VERSION,
    kbVersion: 1,
    channel: "web",
    upazila: "JSR-JKG",
  },
];

export const diagnosisById = (id: string) => DIAGNOSES.find((d) => d.id === id);

export const PRESCRIPTIONS: Prescription[] = [
  {
    ref: "PD-482193",
    diagnosisId: "d-81f2",
    diseaseCode: "RICE_BLAST",
    crop: "rice",
    paidAt: daysAgo(0, 10),
    amount: 5,
    msisdn: "8801912345678",
    kbVersion: 4,
    modelVersion: MODEL_VERSION,
    sms: "DELIVERED",
    channel: "web",
    receiptId: "REF-9001",
  },
  {
    ref: "PD-470552",
    diagnosisId: "d-60aa",
    diseaseCode: "POTATO_LATE_BLIGHT",
    crop: "potato",
    paidAt: daysAgo(6, 8),
    amount: 5,
    msisdn: "8801912345678",
    kbVersion: 5,
    modelVersion: "effb0-2026-11-20",
    sms: "DELIVERED",
    channel: "dealer",
    dealerShop: "Ma Krishi Bitan",
    receiptId: "REF-8712",
  },
  {
    ref: "PD-455019",
    diagnosisId: "d-51c9",
    diseaseCode: "RICE_BLB",
    crop: "rice",
    paidAt: daysAgo(19, 16),
    amount: 5,
    msisdn: "8801912345678",
    kbVersion: 3,
    modelVersion: "effb0-2026-11-02",
    sms: "DELIVERED",
    channel: "ussd",
    receiptId: "REF-8120",
  },
];

export const prescriptionByRef = (ref: string) => PRESCRIPTIONS.find((p) => p.ref === ref);

export const FAQ: { q: Tx; a: Tx }[] = [
  {
    q: { bn: "রোগের নাম জানতে কি টাকা লাগে?", en: "Do I pay to learn the disease name?" },
    a: {
      bn: "না। রোগের নাম ও নিশ্চয়তা বিনামূল্যে। শুধু ওষুধের পূর্ণ প্রেসক্রিপশন SMS-এর জন্য ৳৫ কাটা হয়, আপনার কোড দেওয়ার পরে।",
      en: "No. The disease name and confidence are free. Only the full prescription SMS costs ৳5, charged after you enter your code.",
    },
  },
  {
    q: { bn: "ফল নিশ্চিত না হলে কী হয়?", en: "What if the result is not certain?" },
    a: {
      bn: "অনিশ্চিত ফলে কখনো টাকা কাটা হয় না। আমরা দুটি প্রশ্ন করি, তারপরও নিশ্চিত না হলে কৃষিবিদ দেখবেন বা ১৬১২৩-এ কল করতে বলি।",
      en: "Uncertain results are never charged. We ask two questions; if still unsure, an agronomist reviews it or we suggest calling 16123.",
    },
  },
  {
    q: { bn: "কোন নম্বর থেকে পেমেন্ট করা যায়?", en: "Which numbers can pay?" },
    a: {
      bn: "শুধু বাংলালিংক নম্বর (০১৯ বা ০১৪)। টাকা আপনার মোবাইল ব্যালেন্স থেকে কাটা হয়।",
      en: "Banglalink numbers only (019 or 014). The charge comes from your mobile balance.",
    },
  },
  {
    q: { bn: "স্মার্টফোন না থাকলে?", en: "No smartphone?" },
    a: {
      bn: "যেকোনো ফোন থেকে USSD কোড ডায়াল করুন। লক্ষণ বেছে নিয়ে রোগ জানুন, প্রেসক্রিপশন SMS-এ পাবেন।",
      en: "Dial the USSD code from any phone. Pick the symptoms to find the disease and get the prescription by SMS.",
    },
  },
  {
    q: { bn: "প্রেসক্রিপশন হারিয়ে গেলে?", en: "Lost your prescription?" },
    a: {
      bn: "রেফারেন্স কোড (যেমন PD-482193) শর্টকোডে SMS করুন, বিনামূল্যে আবার পাঠানো হবে।",
      en: "SMS the reference code (e.g. PD-482193) to the short code and we re-send it free.",
    },
  },
  {
    q: { bn: "সতর্কবার্তা কীভাবে বন্ধ করব?", en: "How do I stop alerts?" },
    a: {
      bn: "অ্যাপের সতর্কতা পাতা থেকে বন্ধ করুন, অথবা PD STOP লিখে SMS করুন। সঙ্গে সঙ্গে বন্ধ হয়।",
      en: "Turn them off on the Alerts page, or SMS PD STOP. It stops immediately.",
    },
  },
];
