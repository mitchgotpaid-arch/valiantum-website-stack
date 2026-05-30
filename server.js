const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const SUBMISSIONS_FILE = path.join(__dirname, 'data', 'submissions.json');

fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
if (!fs.existsSync(SUBMISSIONS_FILE)) {
    fs.writeFileSync(SUBMISSIONS_FILE, '[]', 'utf8');
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.post('/contact', (req, res) => {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    const entry = {
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        submittedAt: new Date().toISOString(),
    };

    try {
        const existing = JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8'));
        existing.push(entry);
        fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(existing, null, 2), 'utf8');
        console.log(`[contact] New submission from ${entry.email}`);
        res.json({ ok: true });
    } catch (err) {
        console.error('[contact] Failed to save submission:', err);
        res.status(500).json({ error: 'Could not save submission. Please try again.' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Valiantum server running on port ${PORT}`);
});
