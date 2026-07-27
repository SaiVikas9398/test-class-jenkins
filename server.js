// Converter Hub — Node.js/Express backend with SQLite history log
// Built for classroom deployment practice: EC2 + Nginx reverse proxy + PM2 + Let's Encrypt

const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------------------------------------------------------------
// Database setup — SQLite, single file, zero external DB server
// (this is the "db" component of the single-instance project)
// ---------------------------------------------------------------
const db = new Database(path.join(__dirname, "converter-hub.db"));
db.exec(`
  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    from_unit TEXT NOT NULL,
    to_unit TEXT NOT NULL,
    input_value REAL NOT NULL,
    result REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

const insertHistory = db.prepare(`
  INSERT INTO history (category, from_unit, to_unit, input_value, result)
  VALUES (@category, @from_unit, @to_unit, @input_value, @result)
`);
const recentHistory = db.prepare(`
  SELECT category, from_unit, to_unit, input_value, result, created_at
  FROM history ORDER BY id DESC LIMIT 15
`);

// ---------------------------------------------------------------
// Conversion definitions
// Every category (except temperature) converts via a common base unit:
//   value_in_base = input * factor[fromUnit]
//   result        = value_in_base / factor[toUnit]
// ---------------------------------------------------------------
const CATEGORIES = {
  length: {
    label: "Length",
    base: "meter",
    units: {
      mm: { label: "Millimeter", factor: 0.001 },
      cm: { label: "Centimeter", factor: 0.01 },
      m:  { label: "Meter",      factor: 1 },
      km: { label: "Kilometer",  factor: 1000 },
      in: { label: "Inch",       factor: 0.0254 },
      ft: { label: "Foot",       factor: 0.3048 },
      yd: { label: "Yard",       factor: 0.9144 },
      mi: { label: "Mile",       factor: 1609.344 },
    },
  },
  weight: {
    label: "Weight",
    base: "gram",
    units: {
      mg:  { label: "Milligram",  factor: 0.001 },
      g:   { label: "Gram",       factor: 1 },
      kg:  { label: "Kilogram",   factor: 1000 },
      oz:  { label: "Ounce",      factor: 28.3495 },
      lb:  { label: "Pound",      factor: 453.592 },
      ton: { label: "Metric Ton", factor: 1000000 },
    },
  },
  temperature: {
    label: "Temperature",
    base: null, // special-cased
    units: {
      c: { label: "Celsius" },
      f: { label: "Fahrenheit" },
      k: { label: "Kelvin" },
    },
  },
  area: {
    label: "Area",
    base: "sqm",
    units: {
      sqmm:    { label: "sq millimeter", factor: 0.000001 },
      sqcm:    { label: "sq centimeter", factor: 0.0001 },
      sqm:     { label: "sq meter",      factor: 1 },
      sqkm:    { label: "sq kilometer",  factor: 1000000 },
      sqft:    { label: "sq foot",       factor: 0.092903 },
      sqyd:    { label: "sq yard",       factor: 0.836127 },
      acre:    { label: "Acre",          factor: 4046.86 },
      hectare: { label: "Hectare",       factor: 10000 },
    },
  },
  volume: {
    label: "Volume",
    base: "liter",
    units: {
      ml:   { label: "Milliliter",  factor: 0.001 },
      l:    { label: "Liter",       factor: 1 },
      gal:  { label: "Gallon (US)", factor: 3.78541 },
      qt:   { label: "Quart",       factor: 0.946353 },
      pt:   { label: "Pint",        factor: 0.473176 },
      cup:  { label: "Cup",         factor: 0.24 },
      floz: { label: "Fluid Ounce", factor: 0.0295735 },
      cum:  { label: "Cubic Meter", factor: 1000 },
    },
  },
  speed: {
    label: "Speed",
    base: "mps",
    units: {
      mps:  { label: "Meters/sec",     factor: 1 },
      kmph: { label: "Km/hour",        factor: 0.277778 },
      mph:  { label: "Miles/hour",     factor: 0.44704 },
      knot: { label: "Knot",           factor: 0.514444 },
      fps:  { label: "Feet/sec",       factor: 0.3048 },
    },
  },
  time: {
    label: "Time",
    base: "second",
    units: {
      ms:   { label: "Millisecond", factor: 0.001 },
      s:    { label: "Second",      factor: 1 },
      min:  { label: "Minute",      factor: 60 },
      hr:   { label: "Hour",        factor: 3600 },
      day:  { label: "Day",         factor: 86400 },
      week: { label: "Week",        factor: 604800 },
    },
  },
  data: {
    label: "Digital Storage",
    base: "byte",
    units: {
      bit:  { label: "Bit",      factor: 0.125 },
      byte: { label: "Byte",     factor: 1 },
      kb:   { label: "Kilobyte", factor: 1024 },
      mb:   { label: "Megabyte", factor: 1048576 },
      gb:   { label: "Gigabyte", factor: 1073741824 },
      tb:   { label: "Terabyte", factor: 1099511627776 },
    },
  },
};

function convertTemperature(value, from, to) {
  if (from === to) return value;
  // normalize to Celsius first
  let celsius;
  if (from === "c") celsius = value;
  else if (from === "f") celsius = (value - 32) * (5 / 9);
  else if (from === "k") celsius = value - 273.15;

  if (to === "c") return celsius;
  if (to === "f") return celsius * (9 / 5) + 32;
  if (to === "k") return celsius + 273.15;
}

function convert(categoryKey, fromUnit, toUnit, value) {
  const category = CATEGORIES[categoryKey];
  if (!category) throw new Error(`Unknown category: ${categoryKey}`);
  if (!category.units[fromUnit] || !category.units[toUnit]) {
    throw new Error("Unknown unit for this category");
  }
  if (categoryKey === "temperature") {
    return convertTemperature(value, fromUnit, toUnit);
  }
  const baseValue = value * category.units[fromUnit].factor;
  return baseValue / category.units[toUnit].factor;
}

// ---------------------------------------------------------------
// API routes
// ---------------------------------------------------------------

// Health check — the same style endpoint used for ALB target group checks
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// List all categories + their units (frontend uses this to build the UI)
app.get("/api/categories", (req, res) => {
  const payload = {};
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    payload[key] = {
      label: cat.label,
      units: Object.fromEntries(
        Object.entries(cat.units).map(([uKey, u]) => [uKey, u.label])
      ),
    };
  }
  res.json(payload);
});

// Perform a conversion + log it to SQLite history
app.post("/api/convert", (req, res) => {
  try {
    const { category, from, to, value } = req.body;
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) {
      return res.status(400).json({ error: "Value must be a number" });
    }
    const result = convert(category, from, to, numericValue);

    insertHistory.run({
      category,
      from_unit: from,
      to_unit: to,
      input_value: numericValue,
      result,
    });

    res.json({ result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Recent conversion history (last 15) — proves the DB is really being used
app.get("/api/history", (req, res) => {
  res.json(recentHistory.all());
});

app.listen(PORT, () => {
  console.log(`Converter Hub running on http://localhost:${PORT}`);
});
