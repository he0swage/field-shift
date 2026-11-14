import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const DATA_PATH = join(__dirname, '../data/crops.data.json');

// Equivalent to: await Model.find()
export function readJsonFile() {
  const raw = readFileSync(DATA_PATH, 'utf-8');
  return JSON.parse(raw);
}

// Equivalent to: await doc.save()
export function writeJsonFile(data) {
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}