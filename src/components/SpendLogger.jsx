import React, { useEffect, useRef, useState } from "react";
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

function groupByDate(entries) {
  return entries.reduce((acc, entry) => {
    if (!acc[entry.date]) acc[entry.date] = [];
    acc[entry.date].push(entry);
    return acc;
  }, {});
}

export default function SpendLogger() {
  const [tokenClient, setTokenClient] = useState(null);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [summary, setSummary] = useState(null);
  const [recentEntriesGrouped, setRecentEntriesGrouped] = useState({});
  const amountInputRef = useRef(null);

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
    script1.onload = gapiLoaded;
    document.body.appendChild(script1);

    const script2 = document.createElement("script");
    script2.src = "https://accounts.google.com/gsi/client";
    script2.onload = gisLoaded;
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

      const entries = [];
      const uniqueCategories = new Set();

      rows.forEach(([entryDate, entryCategory, entryAmount]) => {
        if (!entryDate || !entryAmount) return;
        const cat = normalizeCategoryName(entryCategory);
        const amt = parseFloat(entryAmount);

        uniqueCategories.add(cat);

        if (entryDate.startsWith(currentMonth)) {
          if (!summaryData[cat]) summaryData[cat] = 0;
          summaryData[cat] += amt;
          total += amt;
        }

        entries.push({
          date: entryDate,
          category: entryCategory,
          amount: amt,
        });
      });

      setCategories([...uniqueCategories].sort());
      setCategory([...uniqueCategories][0] || "");
      setSummary({ total, breakdown: summaryData });

      const grouped = groupByDate(entries);
      const sortedGrouped = Object.fromEntries(
        Object.entries(grouped).sort(([a], [b]) => new Date(b) - new Date(a))
      );
      setRecentEntriesGrouped(sortedGrouped);
    } catch (err) {
      console.error("Error loading summary:", err);
      setSummary(null);
      setRecentEntriesGrouped({});
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!category || !amount || isNaN(amount)) return;

    try {
      await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "Sheet1!A:C",
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        resource: {
          values: [[date, category, parseFloat(amount)]],
        },
      });

      setStatus("Expense added successfully!");
      setAmount("");
      loadAndRenderSummary();
    } catch (err) {
      console.error(err);
      setStatus("Failed to save entry.");
    }
  };

  const handleCategoryChange = (e) => {
    setCategory(e.target.value);
    setTimeout(() => amountInputRef.current?.focus(), 100);
  };

  return (
    <div className="max-w-md mx-auto p-4 text-sm">
      <div className="flex justify-between mb-4">
        {!isSignedIn ? (
          <button className="btn btn-primary" onClick={handleAuth}>
            Authorize
          </button>
        ) : (
          <button className="btn btn-danger" onClick={handleSignOut}>
            Sign Out
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <select
          value={category}
          onChange={handleCategoryChange}
          className="form-select w-full"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {displayCategoryName(cat)}
            </option>
          ))}
        </select>

        <input
          ref={amountInputRef}
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount (Rs)"
          className="form-control text-2xl py-3 w-full"
        />

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="form-control w-full"
        />

        <button type="submit" className="btn btn-success w-full">
          Add Expense
        </button>
      </form>

      {status && <div className="alert alert-info mt-4">{status}</div>}

      {summary && (
        <div className="mt-6 p-4 border rounded dark:bg-gray-800">
          <h3 className="font-semibold text-lg mb-2">This Month's Summary</h3>
          <p>
            <strong>Total:</strong> ₹{summary.total.toFixed(2)}
          </p>
          <ul className="mt-2 space-y-1">
            {Object.entries(summary.breakdown).map(([cat, amt]) => (
              <li key={cat}>
                {displayCategoryName(cat)}: ₹{amt.toFixed(2)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {Object.keys(recentEntriesGrouped).length > 0 && (
        <div className="mt-6">
          <h4 className="text-md font-semibold mb-2">Recent Entries</h4>
          {Object.entries(recentEntriesGrouped).map(([dateKey, entries]) => (
            <div key={dateKey} className="mb-3">
              <div className="text-xs text-gray-600 mb-1">{dateKey}</div>
              {entries.map((entry, idx) => (
                <div
                  key={idx}
                  className="flex justify-between border p-2 rounded mb-1"
                >
                  <span>{displayCategoryName(entry.category)}</span>
                  <span>₹{entry.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
