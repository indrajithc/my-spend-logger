# 💸 My Spend Logger

**My Spend Logger** is a mobile-friendly expense tracking app built with React that connects to **Google Sheets** as a backend. Easily log your daily expenses by category and see a summary of your spending for the current month.

## ✨ Features

- 📆 Track expenses with date, category, and amount
- ➕ Add new custom categories on the fly
- 🔒 Sign in with Google OAuth
- 📊 View monthly summaries with totals and category breakdowns
- ☁️ Data stored in Google Sheets — no separate backend required

## 🚀 Demo

> _Live demo coming soon_ (or add GitHub Pages/Netlify/Vercel link here)

## 🛠 Setup

### 1. Create a Google Sheet

- Go to [Google Sheets](https://sheets.google.com) and create a new sheet named `Sheet1`.
- Create columns: `Date`, `Category`, `Amount`.

### 2. Set up Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project.
3. Enable **Google Sheets API** and **OAuth 2.0 Client IDs**.
4. Create credentials:
   - **OAuth client ID** (Web Application)
   - **API Key**

### 3. Update Config

In the `SpendLogger` component, replace these constants with your credentials:

```js
const CLIENT_ID = '<YOUR_CLIENT_ID>';
const API_KEY = '<YOUR_API_KEY>';
const SPREADSHEET_ID = '<YOUR_SPREADSHEET_ID>';
````

> You can find your `SPREADSHEET_ID` in the URL of your Google Sheet:
> `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`

### 4. Run the App

Install dependencies and start your dev server:

```bash
npm install
npm run dev
```

or

```bash
yarn install
yarn dev
```

The app will open at `http://localhost:3000`.

## 📷 Screenshots

> *(Optional: Add screenshots of the app UI and summary view)*

## 📦 Tech Stack

* React
* Tailwind CSS (for styling)
* Google Sheets API
* Google Identity Services

## ✅ Todo

* [ ] Add chart visualizations
* [ ] Support multiple months and filters
* [ ] Export to CSV
* [ ] Offline mode

## 📄 License

MIT

---

> Built with ❤️ by \indrajithc

 
