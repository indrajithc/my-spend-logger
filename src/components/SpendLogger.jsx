import React, { useEffect, useState } from "react";
import { gapi } from "gapi-script";

const CLIENT_ID = import.meta.env.VITE_CLIENT_ID;
const API_KEY = import.meta.env.VITE_API_KEY;
const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";

function normalizeCategoryName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/ +/g, "_");
}

function displayCategoryName(id) {
  return id.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

const defaultCategories = [
  "food",
  "transport",
  "entertainment",
  "shopping",
  "bills",
];

export default function SpendLogger() {
  const [tokenClient, setTokenClient] = useState(null);
  const [categories, setCategories] = useState(defaultCategories);
  const [category, setCategory] = useState("food");
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [summary, setSummary] = useState(null);
  const [recentEntries, setRecentEntries] = useState([]);

  useEffect(() => {
    function gapiLoaded() {
      gapi.load("client", async () => {
        await gapi.client.init({
          apiKey: API_KEY,
          discoveryDocs: [
            "https://sheets.googleapis.com/$discovery/rest?version=v4",
          ],
        });
        const savedToken = localStorage.getItem("gapi_token");
        if (savedToken) {
          gapi.client.setToken(JSON.parse(savedToken));
          setIsSignedIn(true);
          loadAndRenderSummary();
        }
      });
    }

    function gisLoaded() {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (resp) => {
          if (resp.error) return;
          const token = gapi.client.getToken();
          localStorage.setItem("gapi_token", JSON.stringify(token));
          setIsSignedIn(true);
          setStatus("Signed in!");
          loadAndRenderSummary();
        },
      });
      setTokenClient(client);
    }

    gapiLoaded();
    window.gisLoaded = gisLoaded;

    const script1 = document.createElement("script");
    script1.src = "https://apis.google.com/js/api.js";
    script1.onload = () => gapiLoaded();
    document.body.appendChild(script1);

    const script2 = document.createElement("script");
    script2.src = "https://accounts.google.com/gsi/client";
    script2.onload = () => gisLoaded();
    document.body.appendChild(script2);
  }, []);

  const handleAuth = () => {
    if (tokenClient) tokenClient.requestAccessToken();
  };

  const handleSignOut = () => {
    const token = gapi.client.getToken();
    if (token) {
      window.google.accounts.oauth2.revoke(token.access_token);
      gapi.client.setToken(null);
      localStorage.removeItem("gapi_token");
      setIsSignedIn(false);
      setStatus("Signed out");
      setSummary(null);
      setRecentEntries([]);
    }
  };

  const loadAndRenderSummary = async () => {
    try {
      const res = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Sheet1!A:C",
      });

      const rows = res.result.values || [];
      const currentMonth = new Date().toISOString().slice(0, 7);
      const summaryData = {};
      let total = 0;

      rows.forEach(([entryDate, entryCategory, entryAmount]) => {
        if (entryDate && entryDate.startsWith(currentMonth)) {
          const cat = normalizeCategoryName(entryCategory);
          const amt = parseFloat(entryAmount);
          if (!summaryData[cat]) summaryData[cat] = 0;
          summaryData[cat] += amt;
          total += amt;
        }
      });

      const recent = [...rows]
        .reverse()
        .slice(0, 5)
        .map(([entryDate, entryCategory, entryAmount]) => ({
          date: entryDate,
          category: entryCategory,
          amount: parseFloat(entryAmount),
        }));

      setSummary({ total, breakdown: summaryData });
      setRecentEntries(recent);
    } catch (err) {
      console.error("Error loading summary:", err);
      setSummary(null);
      setRecentEntries([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const selectedCategory =
      category === "other" ? normalizeCategoryName(newCategory) : category;
    if (!selectedCategory || !amount || isNaN(amount)) return;

    if (category === "other" && !categories.includes(selectedCategory)) {
      setCategories([...categories, selectedCategory]);
    }

    try {
      await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "Sheet1!A:C",
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        resource: {
          values: [[date, selectedCategory, parseFloat(amount)]],
        },
      });

      setStatus("Expense added successfully!");
      setAmount("");
      setNewCategory("");
      setShowNewCategoryInput(false);
      loadAndRenderSummary();
    } catch (err) {
      console.error(err);
      setStatus("Failed to save entry.");
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 text-sm dark:text-white">
      <div className="flex justify-between mb-4">
        {!isSignedIn ? (
          <button className="btn btn-primary w-full" onClick={handleAuth}>
            Sign in with Google
          </button>
        ) : (
          <button className="btn btn-danger w-full" onClick={handleSignOut}>
            Sign Out
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-xs uppercase">Category</label>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            if (e.target.value === "other") setShowNewCategoryInput(true);
            else setShowNewCategoryInput(false);
          }}
          className="form-select w-full rounded p-2 text-black"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {displayCategoryName(cat)}
            </option>
          ))}
          <option value="other">Other</option>
        </select>

        {showNewCategoryInput && (
          <input
            type="text"
            autoFocus
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="New Category"
            className="form-control w-full rounded p-2 text-black"
          />
        )}

        <label className="block text-xs uppercase">Amount</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="₹0.00"
          className="form-control w-full text-2xl rounded p-3 text-center text-black"
        />

        <label className="block text-xs uppercase">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="form-control w-full rounded p-2 text-black"
        />

        <button type="submit" className="btn btn-success w-full text-lg">
          Add Expense
        </button>
      </form>

      {status && <div className="alert alert-info mt-4">{status}</div>}

      {summary && (
        <div className="mt-6 p-4 border rounded bg-white dark:bg-gray-800">
          <h3 className="font-semibold text-lg mb-2">This Month's Summary</h3>
          <p className="mb-2">
            <strong>Total:</strong> ₹{summary.total.toFixed(2)}
          </p>
          <ul className="space-y-1">
            {Object.entries(summary.breakdown).map(([cat, amt]) => (
              <li key={cat}>
                {displayCategoryName(cat)}: ₹{amt.toFixed(2)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {recentEntries.length > 0 && (
        <div className="mt-6 p-4 border rounded bg-white dark:bg-gray-800">
          <h3 className="font-semibold text-lg mb-2">Recent Entries</h3>
          <ul className="space-y-1">
            {recentEntries.map((entry, idx) => (
              <li key={idx} className="flex justify-between text-sm">
                <span>{entry.date}</span>
                <span>
                  {displayCategoryName(normalizeCategoryName(entry.category))}
                </span>
                <span>₹{entry.amount.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
