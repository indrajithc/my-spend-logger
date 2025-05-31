import "./App.css";
import SpendLogger from "./components/SpendLogger";

function App() {
  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-center text-xl mb-4">💸 My Spend Logger</h2>

      <main>
        <SpendLogger />
      </main>
    </div>
  );
}

export default App;
