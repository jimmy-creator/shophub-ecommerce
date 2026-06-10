// Kuwait per-area delivery charges (KWD) for store4. Generated from the
// supplied "kuwait areas" sheet. Source of truth for the checkout dropdowns
// AND the server-side delivery fee — keep the two copies (client + server) in
// sync if edited.
export const KUWAIT_GOVERNORATES = [
  { value: 'Aasima', label: 'Al Asimah (Capital)' },
  { value: 'Hawalli', label: 'Hawalli' },
  { value: 'Farwaniya', label: 'Al Farwaniyah' },
  { value: 'Ahmadi', label: 'Al Ahmadi' },
  { value: 'Jahara', label: 'Al Jahra' },
];

// governorate value -> { area name: charge KWD }
export const KUWAIT_DELIVERY = {
  "Ahmadi": {
    "Abu Halifa": 1,
    "Fahaheel": 1,
    "Mangaf": 1,
    "Al-Ahmadi City": 1.5,
    "Daher": 1.5,
    "Egaila": 1.5,
    "Fintas": 1.5,
    "Hadiya": 1.5,
    "Mahboula": 1.5,
    "Riqqa": 1.5,
    "Sabahiya": 1.5,
    "Fahad Al-Ahmad": 1.5,
    "Jaber Al-Ali": 2,
    "Ali Al-Sabah Al-Salem": 2,
    "Shuaiba": 2,
    "Sabah Al-Ahmad City": 4,
    "Wafra": 4,
    "Al-Zour": 4
  },
  "Aasima": {
    "Abdullah Al-Salem": 3,
    "Adiliya": 3,
    "Bneid Al-Qar": 3,
    "Da'iya": 3,
    "Dasma": 3,
    "Dasmān": 3,
    "Faiha": 3,
    "Granada": 3,
    "Jaber Al-Ahmad": 3,
    "Jibla": 3,
    "Kaifan": 3,
    "Khaldiya": 3,
    "Kuwait City": 3,
    "Mansouriyah": 3,
    "Mirgab": 3,
    "Nahdha": 3,
    "Nuzha": 3,
    "Qadisiya": 3,
    "Qurtoba": 3,
    "Rawdah": 3,
    "Salhiya": 3,
    "Sawabir": 3,
    "Shamiya": 3,
    "Sharq": 3,
    "Shuwaikh": 3,
    "Sulaibikhat": 3,
    "Surra": 3,
    "Yarmouk": 3
  },
  "Farwaniya": {
    "Abdullah Al-Mubarak": 3,
    "Abraq Khaitan": 3,
    "Al Andalus": 3,
    "Al Ardiya": 3,
    "Al-Dajeej": 3,
    "Al Farwaniyah": 3,
    "Al Ferdous": 3,
    "Al Omariya": 3,
    "Al Rabiya": 3,
    "Al Rehab": 3,
    "Al Riggae": 3,
    "Ashbelya": 3,
    "Ardiya Industrial": 3,
    "Al Rai Industrial": 3,
    "Jleeb Al-Shuyoukh": 3,
    "Khaitan": 3,
    "Sabah Al-Nasser": 3,
    "Sabaq Al Hajan": 3,
    "Shadadiya": 3
  },
  "Hawalli": {
    "Hawalli": 3,
    "Salmiya": 3,
    "Jabriya": 3,
    "Salwa": 3,
    "Mishref": 3,
    "Mubarak Al-Abdullah Al Jaber": 3,
    "Bayan": 3,
    "Rumaithiya": 3,
    "Al-Salam": 3,
    "Hattin": 3,
    "Al-Zahra": 3,
    "Al-Shuhada": 3,
    "Al-Siddiq": 3,
    "Maidan Hawalli": 3,
    "Shaab": 3,
    "Al-Badae": 3
  },
  "Jahara": {
    "Jahra City": 5,
    "Saad Al Abdullah City": 5,
    "Al-Qasr": 5,
    "Al-Oyoun": 5,
    "Al-Naseem": 5,
    "Taima": 5,
    "Al-Waha": 5,
    "Al-Naeem": 5,
    "Al-Nahda": 5
  }
};

export function areaCharge(governorate, area) {
  const g = KUWAIT_DELIVERY[governorate];
  return g && g[area] != null ? g[area] : null;
}
