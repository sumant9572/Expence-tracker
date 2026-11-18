# 💸 ExpenseFlow — Smart Personal Expense Tracker

A premium, privacy-first personal finance tracker built with **vanilla JavaScript**, **HTML5**, **CSS3**, and **Chart.js**. Track your income, expenses, budgets, and analytics — all stored locally in your browser. No backend, no signup, no data leaves your device.

🔗 **Live Demo:** [https://sumant9572.github.io/Expence-tracker/](https://sumant9572.github.io/Expence-tracker/)

---

## ✨ Features

- **📊 Dashboard** — At-a-glance summary cards for Total Balance, Income, Expenses, and Savings with month-over-month change indicators.
- **📈 Interactive Charts** — Income vs Expenses (bar), Expense Categories (doughnut), Monthly Spending Trend (line), and Savings Overview (doughnut with savings rate).
- **🧾 Transactions** — Full CRUD for income & expense entries with search, type/category/date filters, and sorting (newest, oldest, highest, lowest).
- **💰 Income & Expense Pages** — Dedicated views with totals, monthly stats, and entry counts.
- **🏷️ Categories** — Auto-generated spending breakdown by category with progress bars.
- **🐷 Budgets** — Set monthly category budgets and track spending with progress bars and on-track / warning / over-budget status.
- **📉 Analytics** — Deep-dive view with daily, weekly, monthly, and average-daily spending plus four charts and a date-range selector.
- **🌗 Dark / Light Theme** — Persisted theme toggle with smooth transitions.
- **🔍 Global Search** — Search transactions from the header.
- **📤 Export & Print** — Download all transactions as CSV or print a report.
- **🔔 Toast Notifications** — Non-intrusive success, error, info, and warning toasts.
- **📱 Fully Responsive** — Works on desktop, tablet, and mobile with a collapsible sidebar.
- **🔒 Privacy-First** — All data is stored in `localStorage`; nothing is sent to any server.

## 🛠️ Tech Stack

| Layer       | Technology                          |
| ----------- | ----------------------------------- |
| Markup      | HTML5                               |
| Styling     | CSS3 (custom design system, CSS variables, grid/flex) |
| Logic       | Vanilla JavaScript (no frameworks)  |
| Charts      | [Chart.js](https://www.chartjs.org/) v4.4.1 (CDN) |
| Icons       | [Lucide](https://lucide.dev/) (CDN) |
| Fonts       | Poppins + Inter (Google Fonts)      |
| Storage     | Browser `localStorage`              |

## 📁 Project Structure

```
Expence-tracker/
├── index.html          # Main app shell & all pages
├── css/
│   └── style.css       # Design system, themes, layout, components
├── js/
│   └── script.js       # State, storage, CRUD, charts, rendering, events
└── assets/
    └── icons/          # (reserved for future static icons)
```

## 🚀 Getting Started

This is a fully static site — no build step required.

1. **Clone the repository**
   ```bash
   git clone https://github.com/sumant9572/Expence-tracker.git
   cd Expence-tracker
   ```

2. **Open `index.html`** in your browser, or serve the folder with any static server:
   ```bash
   # Python
   python -m http.server 5500
   # or VS Code Live Server extension
   ```

3. **Start tracking** — add transactions, set budgets, and explore the dashboard.

## 🌐 Deploying to GitHub Pages

This repo is already configured for GitHub Pages:

1. Go to **Settings → Pages** on the repository.
2. Under **Build and deployment**, set **Source** to `Deploy from a branch`.
3. Select the `main` branch and `/ (root)` folder, then **Save**.
4. Wait a minute — your site will be live at:
   `https://sumant9572.github.io/Expence-tracker/`

## 💾 Data & Privacy

- All transactions and budgets are stored in your browser's `localStorage` under the `expenseflow_*` keys.
- Clearing your browser data or using **Settings → Clear All Data** will permanently remove your data.
- Use **Settings → Export Data (CSV)** to back up your transactions.

## 📜 License

This project is open source and available under the [MIT License](LICENSE).

## 👤 Author

**Lavkush** — [GitHub @sumant9572](https://github.com/sumant9572)

---

Built with ❤️ using HTML5, CSS3, Vanilla JavaScript & Chart.js.
