const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3001; // Choose a port different from your backend server (8000)

// Enable CORS
app.use(cors());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Route to serve the frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Frontend server running at http://localhost:${port}`);
});
