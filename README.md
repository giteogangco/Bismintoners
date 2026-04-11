# 🏸 BISMINTONERS
### Badminton Club Management App

A full-featured, mobile-first badminton club management app with sporty UI. Manage sessions, queues, expenses, chip-in payments, player stats, and group projects — all powered by Firebase Firestore.

---

## ✨ Features

| Feature | Description |
|---|---|
| **Queue System** | Auto-generate balanced matchups, schedule 10 matches, track courts |
| **Chip-In / Pay** | Track who paid, outstanding balances, carry-over debts, overpayment offsets |
| **Expenses** | Log court fees, shuttles, food, equipment — split across players |
| **Stats** | Win/loss records, calories burned, player performance |
| **Projects** | Group kitty / racket fund tracking |
| **Members** | Skill levels, avatars, passcode-protected roles |
| **History** | Full session log with match details |
| **Roles** | Super Admin, Admin, Member, Guest — each with PIN protection |

---

## 🚀 Quick Deploy to Vercel

### Step 1 — Set up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **Add Project** → name it (e.g. `bismintoners`)
3. Go to **Firestore Database** → **Create Database** → choose your region → Start in **production mode**
4. Go to **Project Settings** → **Your Apps** → click **</>** (Web)
5. Register app (name it anything) → copy the `firebaseConfig` values

### Step 2 — Push to GitHub

```bash
# Clone or download this repo, then:
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/bismintoners.git
git push -u origin main
```

### Step 3 — Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project** → import your GitHub repo
2. Framework preset: **Vite**
3. Add **Environment Variables** (from your Firebase config):

| Variable | Value |
|---|---|
| `VITE_FIREBASE_API_KEY` | your apiKey |
| `VITE_FIREBASE_AUTH_DOMAIN` | your authDomain |
| `VITE_FIREBASE_PROJECT_ID` | your projectId |
| `VITE_FIREBASE_STORAGE_BUCKET` | your storageBucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | your messagingSenderId |
| `VITE_FIREBASE_APP_ID` | your appId |
| `VITE_FIREBASE_MEASUREMENT_ID` | your measurementId |

4. Click **Deploy** ✅

### Step 4 — Authorize your domain in Firebase

1. Firebase Console → **Authentication** → **Settings** → **Authorized Domains**
2. Add your Vercel domain (e.g. `bismintoners.vercel.app`)

Also update **Firestore Security Rules** (Firebase Console → Firestore → Rules):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // For testing only
    }
  }
}
```

> ⚠️ For production, set up proper auth rules. The above allows all reads/writes.

---

## 💻 Local Development

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local
# → Edit .env.local with your Firebase values

# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 📁 Project Structure

```
bismintoners/
├── index.html              ← Main HTML (modals, login, SVG icons)
├── package.json
├── vite.config.js
├── vercel.json             ← SPA routing for Vercel
├── .env.example            ← Firebase config template
├── .gitignore
├── public/
│   └── favicon.svg
└── src/
    ├── css/
    │   └── main.css        ← All styles (sporty athletic theme)
    └── js/
        └── main.js         ← All app logic (Firebase + UI + pages)
```

---

## 🔐 Default Passcodes

| Role | Default PIN | Change In |
|---|---|---|
| Super Admin | `9999` | Settings → Passcodes |
| Admin | `2222` | Settings → Passcodes |
| Member | `1111` | Settings → Passcodes |

> Passcodes are stored in Firestore (`settings/passcodes` document). Change them immediately after first login.

---

## 🎨 Tech Stack

- **Frontend**: Vanilla JS + HTML + CSS (no framework)
- **Database**: Firebase Firestore (real-time)
- **Build**: Vite
- **Deploy**: Vercel
- **Fonts**: Russo One, Rajdhani, Barlow Condensed (Google Fonts)

---

## 📱 Mobile Installation (PWA-ready)

On mobile browsers:
- **iOS Safari**: Share → Add to Home Screen
- **Android Chrome**: Menu → Add to Home Screen

The app is configured with `apple-mobile-web-app-capable` meta tags for full-screen mode.

---

## 🛠️ Customization

### Change Club Name
Edit `index.html` line with `BISMINTONERS` → replace with your club name.

### Change Colors
Edit `src/css/main.css` → `:root` section:
```css
:root {
  --primary: #e8ff00;   /* Main accent (neon yellow) */
  --accent:  #ff3d00;   /* Secondary accent (fire red) */
  --bg:      #0a0c0f;   /* Background */
}
```

### Add/Remove Sports
The queue and match system is generic — works for any racket sport. Edit court labels and match logic in `src/js/main.js`.
