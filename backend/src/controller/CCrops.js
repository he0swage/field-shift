import { readJsonFile, writeJsonFile } from '../utils/jsonStore.js';
import { v4 as uuidv4 } from 'uuid'; // npm install uuid

async function getCropsByCountry(req, res) {
  try {
    const country = req.query.country || req.params.country;
    if (!country) {
      return res.status(400).json({ message: "Missing 'country' parameter" });
    }
    const crops   = readJsonFile();                                       // read all
    const filtered = crops.filter(                                        // replaces: .find({ country })
      (crop) => crop.country === country.trim().toUpperCase()
    );
    res.status(200).json({ status: 'success', country: country.toUpperCase(), total: filtered.length, crops: filtered });
  } catch (error) {
    console.error('Error in getCropsByCountry controller', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
module.exports ={getCropsregion};