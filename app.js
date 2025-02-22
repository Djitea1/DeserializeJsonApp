// app.js
require('dotenv').config();

const express = require('express');
// const { Pool } = require('pg');
const bodyParser = require('body-parser');
const path = require('path');
const methodOverride = require('method-override');

const multer = require('multer');
const fs = require('fs');
const upload = multer({ dest: 'uploads/' }); // Files will be temporarily stored in the uploads folder

const app = express();

// Setup middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.use(methodOverride('_method'));

// Home route - displays the home page
app.get('/', (req, res) => {
  res.render('index');
});

// JSON INTERPRETER

// GET: Show the page to upload a JSON file
app.get('/upload', (req, res) => {
  res.render('json_upload');
});

// POST: Process the uploaded JSON file
app.post('/upload', upload.single('jsonFile'), (req, res) => {
  // req.file contains the uploaded file
  fs.readFile(req.file.path, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Error reading file: " + err);
    }
    try {
      const jsonData = JSON.parse(data);
      
      // Process jsonData as before, for example:
      const header = {};
      const details = {}; // keyed by index ("0", "1", etc.)
      const detailColumns = new Set();

      const lowestConfidence = jsonData.LowestConfidence;

      const conf = jsonData.ConfidencePerField;
  
      for (const key in conf) {
        if (/^\d+_/.test(key)) {
          // This key is part of the detail rows.
          const match = key.match(/^(\d+)_(.+)$/);
          if (match) {
            const index = match[1];
            const fieldName = match[2];
            detailColumns.add(fieldName);
            if (!details[index]) {
              details[index] = {};
            }
            details[index][fieldName] = { 
              value: conf[key].Value, 
              confidence: conf[key].Confidence 
            };
          }
        } else {
          // Header field
          header[key] = { 
            value: conf[key].Value, 
            confidence: conf[key].Confidence 
          };
        }
      }
      
      const detailColumnsArray = Array.from(detailColumns);
      const detailRows = Object.keys(details)
        .sort((a, b) => Number(a) - Number(b))
        .map(index => {
          const row = {};
          detailColumnsArray.forEach(col => {
            row[col] = details[index][col] !== undefined ? details[index][col] : { value: "", confidence: "" };
          });
          return row;
        });
      
      // Optionally, delete the uploaded file after processing:
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Failed to remove temp file:", err);
      });
      
      // Render the result view with the deserialized data
      res.render('json_result', { header, detailColumns: detailColumnsArray, detailRows, lowestConfidence });
//      res.render('json_result', { header, detailColumns: detailColumnsArray, detailRows });
    } catch (parseError) {
      console.error(parseError);
      res.status(400).send("Invalid JSON: " + parseError);
    }
  });
});


// GET: Show the page with a textarea to paste JSON
app.get('/deserialize', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.render('json_input');
});

// POST: Process the pasted JSON, deserialize it, and render the result with Value and Confidence
app.post('/deserialize', (req, res) => {
  try {
    // Parse the pasted JSON from the form field named "jsonData"
    const jsonData = JSON.parse(req.body.jsonData);
    
    // We'll store header fields and detail rows with both value and confidence.
    const header = {};
    const details = {}; // keyed by index ("0", "1", etc.)
    
    const lowestConfidence = jsonData.LowestConfidence;const detailColumns = new Set();
    
    const conf = jsonData.ConfidencePerField;
    for (const key in conf) {
      // Save both Value and Confidence for each field
      if (/^\d+_/.test(key)) {
        // This key is part of the detail rows.
        const match = key.match(/^(\d+)_(.+)$/);
        if (match) {
          const index = match[1]; // e.g., "0", "1", etc.
          const fieldName = match[2];
          detailColumns.add(fieldName);
          if (!details[index]) {
            details[index] = {};
          }
          details[index][fieldName] = { 
            value: conf[key].Value, 
            confidence: conf[key].Confidence 
          };
        }
      } else {
        // This key belongs to the header section.
        header[key] = { 
          value: conf[key].Value, 
          confidence: conf[key].Confidence 
        };
      }
    }
    
    // Create an array of detail columns so we have a fixed order.
    const detailColumnsArray = Array.from(detailColumns);
    
    // Build an array of detail rows (sorted by index)
    const detailRows = Object.keys(details)
      .sort((a, b) => Number(a) - Number(b))
      .map(index => {
        const row = {};
        detailColumnsArray.forEach(col => {
          // If a value is missing, show as empty object.
          row[col] = details[index][col] !== undefined ? details[index][col] : { value: "", confidence: "" };
        });
        return row;
      });
    
    // Pass the header, detailColumns, and detailRows to the view.
    res.render('json_result', { header, detailColumns: detailColumnsArray, detailRows, lowestConfidence });
  } catch (err) {
    console.error(err);
    res.status(400).send("Invalid JSON: " + err);
  }
});



// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
