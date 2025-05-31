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
  const icons = {
    food: "🍽️",
    transport: "🚌",
    utilities: "💡",
    entertainment: "🎉",
    shopping: "🛍️",
    healthcare: "🏥",
    education: "📚",
    other: "🤷",
  };
  const normalizedId = normalizeCategoryName(id);
  const icon = icons[normalizedId] || "";
  return `${icon} ${id
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase())}`.trim();
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

  // === React-driven Dark Mode State ===
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Initialize from localStorage or default to true (dark mode)
    const savedTheme = localStorage.getItem("theme");
    return savedTheme === "light" ? false : true; // Default to dark if no saved theme or 'dark'
  });

  // Effect to apply/remove 'dark' class on <html> element and save preference
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]); // Re-run whenever isDarkMode state changes

  // Initialize gapi and gis libraries
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
    window.gisLoaded = gisLoaded; // Make gisLoaded globally accessible for the script

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
      setRecentEntriesGrouped({});
      setCategories([]); // Clear categories on sign out
      setCategory("");
    }
  };

  const loadAndRenderSummary = async () => {
    if (!isSignedIn) return; // Only load if signed in

    try {
      const res = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Sheet1!A:C",
      });

      const rows = res.result.values || [];
      const today = new Date();
      const currentMonth = today.toISOString().slice(0, 7);

      const summaryData = {};
      let total = 0;

      const entries = [];
      const uniqueCategories = new Set();

      rows.forEach(([entryDate, entryCategory, entryAmount]) => {
        if (!entryDate || !entryAmount) return;
        const amt = parseFloat(entryAmount);
        if (isNaN(amt)) return;

        uniqueCategories.add(entryCategory);

        if (entryDate.startsWith(currentMonth)) {
          if (!summaryData[entryCategory]) summaryData[entryCategory] = 0;
          summaryData[entryCategory] += amt;
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
      setStatus("Failed to load data. Please sign in again.");
      setSummary(null);
      setRecentEntriesGrouped({});
    }
  };

  useEffect(() => {
    if (isSignedIn) {
      loadAndRenderSummary();
    }
  }, [isSignedIn]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isSignedIn) {
      setStatus("Please sign in to add an expense.");
      return;
    }
    if (
      !category ||
      !amount ||
      isNaN(parseFloat(amount)) ||
      parseFloat(amount) <= 0
    ) {
      setStatus("Please select a category and enter a valid amount.");
      return;
    }

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
      setStatus("Failed to save entry. Check permissions or network.");
    }
  };

  const handleCategoryChange = (e) => {
    setCategory(e.target.value);
    if (amountInputRef.current) {
      amountInputRef.current.focus();
    }
  };

  const currentMonthName = new Date().toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    // This div now fully controls the background and text color for the app
    <div className="min-h-screen p-4 font-sans text-base sm:text-lg bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-gray-100 transition-colors duration-300">
      {/* Top Bar */}
      <header className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-4 sm:space-y-0">
        <h1 className="text-3xl sm:text-4xl font-bold text-center sm:text-left">
          Daily Expense Tracker
        </h1>
        <div className="flex items-center space-x-4">
          {/* Light/Dark Mode Toggle */}
          <div className="flex items-center space-x-2">
            <span className="text-sm">Light</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                id="darkModeToggle"
                checked={isDarkMode} // Controlled by React state
                onChange={() => setIsDarkMode(!isDarkMode)} // Toggles the state
              />
              <span className="slider"></span>
            </label>
            <span className="text-sm">Dark</span>
          </div>
          {/* Sign In/Out Button */}
          {!isSignedIn ? (
            <button
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition duration-300 text-sm sm:text-base"
              onClick={handleAuth}
            >
              Sign In
            </button>
          ) : (
            <button
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-300 text-sm sm:text-base"
              onClick={handleSignOut}
            >
              Sign Out
            </button>
          )}
        </div>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Log Expense Card */}
        <section className="card p-6 col-span-1 md:col-span-1 bg-white dark:bg-gray-800 shadow-md rounded-xl">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
            Log New Expense
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="category"
                className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300"
              >
                Category
              </label>
              <div className="relative">
                <select
                  id="category"
                  name="category"
                  value={category}
                  onChange={handleCategoryChange}
                  className="block w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 transition duration-300 text-base"
                  disabled={!isSignedIn || categories.length === 0}
                >
                  <option value="">
                    {categories.length > 0
                      ? "Select a category"
                      : isSignedIn
                      ? "Loading categories..."
                      : "Sign in to load categories"}
                  </option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {displayCategoryName(cat)}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                  <svg
                    className="h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
            </div>
            <div>
              <label
                htmlFor="amount"
                className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300"
              >
                Amount (₹)
              </label>
              <input
                type="number"
                id="amount"
                name="amount"
                ref={amountInputRef}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g., 25.50"
                className="block w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 transition duration-300 text-base"
                disabled={!isSignedIn}
              />
            </div>
            <div>
              <label
                htmlFor="date"
                className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300"
              >
                Date
              </label>
              <input
                type="date"
                id="date"
                name="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="block w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 transition duration-300 text-base"
                disabled={!isSignedIn}
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 transition duration-300 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!isSignedIn}
            >
              Add Expense
            </button>
          </form>
          {status && (
            <div className="mt-4 p-3 text-sm rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {status}
            </div>
          )}
        </section>

        {/* Monthly Summary Card */}
        <section className="card p-6 col-span-1 md:col-span-1 lg:col-span-2 bg-white dark:bg-gray-800 shadow-md rounded-xl">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
            Monthly Summary ({currentMonthName})
          </h2>
          {isSignedIn && summary ? (
            <>
              <div className="mb-4">
                <p className="text-lg">
                  Total Spent:{" "}
                  <span className="text-indigo-500 font-bold text-2xl">
                    ₹ {summary.total.toFixed(2)}
                  </span>
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(summary.breakdown).map(([cat, amt]) => (
                  <div
                    key={cat}
                    className="bg-gray-100 dark:bg-gray-700 p-3 rounded-md text-gray-800 dark:text-gray-200"
                  >
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {displayCategoryName(cat)}
                    </p>
                    <p className="font-medium">₹ {amt.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-gray-600 dark:text-gray-400">
              Sign in to view your monthly summary.
            </p>
          )}
        </section>

        {/* Recent Entries Log Card */}
        <section className="card p-6 col-span-1 lg:col-span-3 bg-white dark:bg-gray-800 shadow-md rounded-xl">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
            Recent Entries
          </h2>
          {isSignedIn && Object.keys(recentEntriesGrouped).length > 0 ? (
            <div className="space-y-6">
              {Object.entries(recentEntriesGrouped).map(
                ([dateKey, entries]) => (
                  <div key={dateKey}>
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      {new Date(dateKey + "T00:00:00").toLocaleDateString(
                        "en-IN",
                        { year: "numeric", month: "long", day: "numeric" }
                      )}
                    </h3>
                    <ul className="space-y-2">
                      {entries.map((entry, idx) => (
                        <li
                          key={idx}
                          className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-3 rounded-md text-gray-800 dark:text-gray-200"
                        >
                          <span className="text-sm md:text-base">
                            {displayCategoryName(entry.category)}
                          </span>
                          <span className="font-medium text-red-500 dark:text-red-400">
                            ₹ {entry.amount.toFixed(2)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              )}
            </div>
          ) : (
            <p className="text-gray-600 dark:text-gray-400">
              Sign in to view your recent expenses.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
