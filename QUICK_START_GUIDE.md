# Quick Start Guide - Hello Dinesh Web Page

## 🚀 Quick Steps (5 Minutes)

### 1. Install Node.js
- Download from: https://nodejs.org/
- Install with default settings
- Verify: `node --version`

### 2. Create Project
```bash
# Navigate to your project folder
cd C:\Slack Dev

# Initialize project
npm init -y

# Install Express
npm install express
```

### 3. Create Files

**server.js:**
```javascript
const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

**public/index.html:**
```html
<!DOCTYPE html>
<html>
<head>
    <title>Hello Dinesh</title>
    <style>
        body {
            font-family: Arial;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            text-align: center;
        }
        button {
            padding: 15px 30px;
            font-size: 18px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
        }
        #datetime {
            margin-top: 20px;
            font-size: 20px;
            display: none;
        }
        #datetime.show { display: block; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Hello Dinesh</h1>
        <button onclick="showDateTime()">Show Date & Time</button>
        <div id="datetime"></div>
    </div>
    <script>
        function showDateTime() {
            const now = new Date();
            document.getElementById('datetime').textContent = now.toLocaleString();
            document.getElementById('datetime').classList.add('show');
        }
    </script>
</body>
</html>
```

### 4. Run Server
```bash
npm start
```

### 5. Open Browser
- Go to: `http://localhost:3000`
- Click the button to see date/time!

---

## 📁 Project Structure
```
hello-dinesh/
├── server.js          # Server code
├── package.json       # Project config
├── public/
│   └── index.html     # Web page
└── node_modules/      # Dependencies (auto-generated)
```

---

## 🔧 Common Commands
```bash
npm install          # Install dependencies
npm start            # Start server
Ctrl + C             # Stop server
```

---

## 📖 Full Documentation
See `COMPLETE_PROCEDURE_GUIDE.md` for detailed explanations!


