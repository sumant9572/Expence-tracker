/* =========================================================
   ExpenseFlow — Smart Personal Expense Tracker
   Vanilla JavaScript (no frameworks)
   - State + LocalStorage persistence
   - CRUD for transactions & budgets
   - Dynamic financial calculations
   - Chart.js charts (CDN)
   - Search / filter / sort
   - CSV export + print
   - Dark/light theme
   - Toasts, animations, responsive sidebar
   ========================================================= */

(function () {
  'use strict';

  /* ---------------- Constants ---------------- */
  const STORAGE = {
    transactions: 'expenseflow_transactions',
    budgets: 'expenseflow_budgets',
    theme: 'expenseflow_theme',
    seeded: 'expenseflow_seeded_v1',
  };

  // Category metadata: color + lucide icon for each category
  const CATEGORY_META = {
    // income
    Salary:        { color: '#16a34a', icon: 'briefcase' },
    Freelancing:   { color: '#0ea5e9', icon: 'laptop' },
    Business:      { color: '#8b5cf6', icon: 'store' },
    Investments:   { color: '#f59e0b', icon: 'trending-up' },
    // expense
    Food:           { color: '#ef4444', icon: 'utensils' },
    Shopping:       { color: '#ec4899', icon: 'shopping-bag' },
    Transportation: { color: '#0ea5e9', icon: 'car' },
    Education:      { color: '#8b5cf6', icon: 'graduation-cap' },
    Entertainment:  { color: '#f59e0b', icon: 'film' },
    Healthcare:     { color: '#14b8a6', icon: 'heart-pulse' },
    Bills:          { color: '#f97316', icon: 'receipt' },
    Travel:         { color: '#06b6d4', icon: 'plane' },
    // shared
    Other:          { color: '#64748b', icon: 'circle' },
  };

  const INCOME_CATEGORIES = ['Salary', 'Freelancing', 'Business', 'Investments', 'Other'];
  const EXPENSE_CATEGORIES = ['Food', 'Shopping', 'Transportation', 'Education', 'Entertainment', 'Healthcare', 'Bills', 'Travel', 'Other'];

  /* ---------------- State ---------------- */
  const state = {
    transactions: [],
    budgets: [],
    theme: 'light',
    page: 'dashboard',
    // transaction filters
    search: '',
    typeFilter: 'all',
    categoryFilter: 'all',
    dateFilter: 'all',
    sort: 'newest',
    // chart date ranges
    dashRange: 'all',
    analyticsRange: '30d',
    charts: {},
    editTxId: null,
    editBudgetId: null,
    confirmCb: null,
  };

  /* ---------------- Utils ---------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const num = (v) => {
    const n = parseFloat(v);
    return isNaN(n) || !isFinite(n) ? 0 : n;
  };

  function fmtMoney(n) {
    const v = num(n);
    const formatted = new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(Math.abs(v));
    return '₹' + formatted;
  }

  function fmtSigned(n, type) {
    const v = num(n);
    const sign = type === 'income' ? '+' : '-';
    return sign + fmtMoney(v);
  }

  function fmtDate(dStr) {
    if (!dStr) return '—';
    const d = parseDate(dStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function parseDate(dStr) {
    // Treat YYYY-MM-DD as local date (avoid UTC shift)
    return new Date(dStr + 'T00:00:00');
  }

  function todayISO() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  function daysAgoISO(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function categoryColor(cat) {
    return (CATEGORY_META[cat] && CATEGORY_META[cat].color) || '#64748b';
  }
  function categoryIcon(cat) {
    return (CATEGORY_META[cat] && CATEGORY_META[cat].icon) || 'circle';
  }

  /* ---------------- Storage ---------------- */
  function loadData() {
    try {
      state.transactions = JSON.parse(localStorage.getItem(STORAGE.transactions)) || [];
      state.budgets = JSON.parse(localStorage.getItem(STORAGE.budgets)) || [];
    } catch (e) {
      state.transactions = [];
      state.budgets = [];
      console.warn('Failed to parse stored data, resetting.', e);
    }
    state.theme = localStorage.getItem(STORAGE.theme) || 'light';

    // basic sanitization
    state.transactions = state.transactions.filter(
      (t) => t && t.id && t.title && ['income', 'expense'].includes(t.type) && !isNaN(num(t.amount))
    );
    state.budgets = state.budgets.filter((b) => b && b.id && b.category && !isNaN(num(b.amount)));
  }

  function saveTransactions() {
    localStorage.setItem(STORAGE.transactions, JSON.stringify(state.transactions));
  }
  function saveBudgets() {
    localStorage.setItem(STORAGE.budgets, JSON.stringify(state.budgets));
  }

  /* ---------------- Date ranges ---------------- */
  function inRange(dateStr, range) {
    if (range === 'all') return true;
    const now = new Date();
    const d = parseDate(dateStr);
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (range === '7d') return d >= new Date(startToday.getTime() - 6 * 86400000);
    if (range === '30d') return d >= new Date(startToday.getTime() - 29 * 86400000);
    if (range === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    if (range === 'lastmonth') {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth();
    }
    if (range === 'year') return d.getFullYear() === now.getFullYear();
    return true;
  }

  function rangeDays(range) {
    switch (range) {
      case '7d': return 7;
      case '30d': return 30;
      case 'month': return new Date().getDate();
      case 'lastmonth': return new Date(new Date().getFullYear(), new Date().getMonth(), 0).getDate();
      case 'year': return Math.ceil((Date.now() - new Date(new Date().getFullYear(), 0, 1)) / 86400000) || 1;
      case 'all': return 1;
      default: return 1;
    }
  }

  function filterByRange(txs, range) {
    return txs.filter((t) => inRange(t.date, range));
  }

  /* ---------------- Calculations ---------------- */
  function sumByType(txs, type) {
    return txs.filter((t) => t.type === type).reduce((s, t) => s + num(t.amount), 0);
  }

  function monthOf(dStr) {
    const d = parseDate(dStr);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function currentMonthKey() {
    const n = new Date();
    return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0');
  }
  function lastMonthKey() {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function totals(txs) {
    const income = sumByType(txs, 'income');
    const expense = sumByType(txs, 'expense');
    return { income, expense, balance: income - expense, savings: income - expense };
  }

  function savingsRate(txs) {
    const { income, savings } = totals(txs);
    if (income <= 0) return 0;
    return (savings / income) * 100;
  }

  // percentage change this month vs last month for a given type
  function monthOverMonth(type) {
    const cur = state.transactions.filter((t) => t.type === type && monthOf(t.date) === currentMonthKey())
      .reduce((s, t) => s + num(t.amount), 0);
    const last = state.transactions.filter((t) => t.type === type && monthOf(t.date) === lastMonthKey())
      .reduce((s, t) => s + num(t.amount), 0);
    return { cur, last, change: pctChange(cur, last) };
  }

  function pctChange(cur, last) {
    if (last === 0) return cur === 0 ? 0 : 100;
    return ((cur - last) / Math.abs(last)) * 100;
  }

  // expense by category for a set of transactions
  function expensesByCategory(txs) {
    const map = {};
    txs.filter((t) => t.type === 'expense').forEach((t) => {
      map[t.category] = (map[t.category] || 0) + num(t.amount);
    });
    return map;
  }

  // monthly series (income & expense) for last N months from given txs
  function monthlySeries(txs, maxMonths = 6) {
    const map = {};
    txs.forEach((t) => {
      const k = monthOf(t.date);
      if (!map[k]) map[k] = { income: 0, expense: 0 };
      map[k][t.type] += num(t.amount);
    });
    const now = new Date();
    const keys = [];
    for (let i = maxMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
    }
    return keys.map((k) => {
      const d = new Date(k + '-01T00:00:00');
      const lbl = d.toLocaleDateString('en-IN', { month: 'short' });
      const m = map[k] || { income: 0, expense: 0 };
      return { key: k, label: lbl, income: m.income, expense: m.expense };
    });
  }

  /* ---------------- Charts ---------------- */
  // Center-text plugin for doughnut (savings rate)
  const centerTextPlugin = {
    id: 'centerText',
    afterDraw(chart) {
      const opt = chart.options.plugins && chart.options.plugins.centerText;
      if (!opt || !opt.display) return;
      const meta = chart.getDatasetMeta(0);
      if (!meta || !meta.data.length) return;
      const el = meta.data[0];
      const { ctx } = chart;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = opt.color || cssVar('--text');
      ctx.font = opt.font || '700 26px Poppins, sans-serif';
      ctx.fillText(opt.text || '', el.x, el.y - 6);
      ctx.fillStyle = opt.subColor || cssVar('--text-muted');
      ctx.font = '500 12px Inter, sans-serif';
      ctx.fillText(opt.sub || '', el.x, el.y + 18);
      ctx.restore();
    },
  };

  function chartTheme() {
    return {
      text: cssVar('--text-muted'),
      grid: cssVar('--border'),
      primary: cssVar('--c-primary'),
      success: cssVar('--c-success'),
      expense: cssVar('--c-expense'),
      warning: cssVar('--c-warning'),
    };
  }

  function destroyCharts() {
    Object.values(state.charts).forEach((c) => { try { c.destroy(); } catch (e) {} });
    state.charts = {};
  }

  function renderAllCharts() {
    if (typeof Chart === 'undefined') return;
    // Register the center-text plugin once (for doughnut savings chart)
    if (!window.__efPluginRegistered) { Chart.register(centerTextPlugin); window.__efPluginRegistered = true; }
    destroyCharts();
    const t = chartTheme();
    const dashTxs = filterByRange(state.transactions, state.dashRange);
    const anaTxs = filterByRange(state.transactions, state.analyticsRange);

    // base options
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = t.text;

    // 1) Dashboard: Income vs Expense (bar)
    const ds = monthlySeries(dashTxs, 6);
    state.charts.incomeExpense = new Chart($('#incomeExpenseChart'), {
      type: 'bar',
      data: {
        labels: ds.map((d) => d.label),
        datasets: [
          { label: 'Income', data: ds.map((d) => d.income), backgroundColor: t.success, borderRadius: 8, barPercentage: 0.6 },
          { label: 'Expense', data: ds.map((d) => d.expense), backgroundColor: t.expense, borderRadius: 8, barPercentage: 0.6 },
        ],
      },
      options: barOptions(t),
    });

    // 2) Dashboard: Expense Categories (doughnut)
    const catMap = expensesByCategory(dashTxs);
    state.charts.category = doughnutChart('categoryChart', catMap, t);

    // 3) Dashboard: Monthly Spending Trend (line)
    state.charts.trend = new Chart($('#trendChart'), {
      type: 'line',
      data: {
        labels: ds.map((d) => d.label),
        datasets: [{
          label: 'Expenses',
          data: ds.map((d) => d.expense),
          borderColor: t.primary,
          backgroundColor: hexA(t.primary, 0.12),
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 4,
          pointBackgroundColor: t.primary,
          pointHoverRadius: 6,
        }],
      },
      options: lineOptions(t),
    });

    // 4) Dashboard: Savings Overview (doughnut w/ center %)
    const { income, expense, savings } = totals(dashTxs);
    const rate = income > 0 ? Math.round((savings / income) * 100) : 0;
    state.charts.savings = new Chart($('#savingsChart'), {
      type: 'doughnut',
      data: {
        labels: ['Savings', 'Expenses'],
        datasets: [{
          data: [Math.max(0, savings), expense],
          backgroundColor: [t.success, t.expense],
          borderWidth: 0,
          hoverOffset: 6,
        }],
      },
      options: {
        cutout: '72%',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16 } },
          tooltip: { callbacks: { label: (c) => c.label + ': ' + fmtMoney(c.raw) } },
          centerText: { display: true, text: rate + '%', sub: 'savings rate', color: cssVar('--text') },
        },
      },
    });

    // ---- Analytics charts ----
    // ana income vs expense
    const anaDs = monthlySeries(anaTxs, 6);
    state.charts.anaIE = new Chart($('#anaIncomeExpenseChart'), {
      type: 'bar',
      data: {
        labels: anaDs.map((d) => d.label),
        datasets: [
          { label: 'Income', data: anaDs.map((d) => d.income), backgroundColor: t.success, borderRadius: 8 },
          { label: 'Expense', data: anaDs.map((d) => d.expense), backgroundColor: t.expense, borderRadius: 8 },
        ],
      },
      options: barOptions(t),
    });
    // ana category doughnut
    const anaCatMap = expensesByCategory(anaTxs);
    state.charts.anaCat = doughnutChart('anaCategoryChart', anaCatMap, t);
    // ana trend
    state.charts.anaTrend = new Chart($('#anaTrendChart'), {
      type: 'line',
      data: {
        labels: anaDs.map((d) => d.label),
        datasets: [{
          label: 'Expenses',
          data: anaDs.map((d) => d.expense),
          borderColor: t.primary,
          backgroundColor: hexA(t.primary, 0.12),
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 4,
          pointBackgroundColor: t.primary,
        }],
      },
      options: lineOptions(t),
    });
    // ana top categories (horizontal bar)
    const topCats = Object.entries(anaCatMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
    state.charts.anaTop = new Chart($('#anaTopCategoryChart'), {
      type: 'bar',
      data: {
        labels: topCats.map((c) => c[0]),
        datasets: [{
          label: 'Spent',
          data: topCats.map((c) => c[1]),
          backgroundColor: topCats.map((c) => categoryColor(c[0])),
          borderRadius: 8,
          barPercentage: 0.6,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fmtMoney(c.raw) } } },
        scales: {
          x: { grid: { color: t.grid }, ticks: { color: t.text, callback: (v) => '₹' + (v >= 1000 ? (v / 1000) + 'k' : v) } },
          y: { grid: { display: false }, ticks: { color: cssVar('--text-soft') } },
        },
      },
    });
  }

  function doughnutChart(canvasId, catMap, t) {
    const entries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
    return new Chart($('#' + canvasId), {
      type: 'doughnut',
      data: {
        labels: entries.map((e) => e[0]),
        datasets: [{
          data: entries.map((e) => e[1]),
          backgroundColor: entries.map((e) => categoryColor(e[0])),
          borderWidth: 0,
          hoverOffset: 6,
        }],
      },
      options: {
        cutout: '62%',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, padding: 14, boxWidth: 10 } },
          tooltip: {
            callbacks: {
              label: (c) => {
                const total = c.dataset.data.reduce((s, v) => s + v, 0);
                const pct = total ? Math.round((c.raw / total) * 100) : 0;
                return c.label + ': ' + fmtMoney(c.raw) + ' (' + pct + '%)';
              },
            },
          },
        },
      },
    });
  }

  function barOptions(t) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', align: 'end', labels: { usePointStyle: true, padding: 16, boxWidth: 10 } },
        tooltip: { callbacks: { label: (c) => c.dataset.label + ': ' + fmtMoney(c.raw) } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: t.text } },
        y: { grid: { color: t.grid }, ticks: { color: t.text, callback: (v) => '₹' + (v >= 1000 ? (v / 1000) + 'k' : v) } },
      },
    };
  }
  function lineOptions(t) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => c.dataset.label + ': ' + fmtMoney(c.raw) } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: t.text } },
        y: { grid: { color: t.grid }, ticks: { color: t.text, callback: (v) => '₹' + (v >= 1000 ? (v / 1000) + 'k' : v) } },
      },
    };
  }

  // add alpha to a hex color
  function hexA(hex, a) {
    const h = hex.replace('#', '');
    if (h.length !== 6) return hex;
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  /* ---------------- Rendering: Dashboard ---------------- */
  function renderDashboard() {
    const tot = totals(state.transactions);
    $('#totalBalance').textContent = fmtMoney(tot.balance);
    $('#totalIncome').textContent = fmtMoney(tot.income);
    $('#totalExpenses').textContent = fmtMoney(tot.expense);
    $('#totalSavings').textContent = fmtMoney(tot.savings);

    // % change cards
    const inc = monthOverMonth('income');
    const exp = monthOverMonth('expense');
    const balCur = inc.cur - exp.cur;
    const balLast = inc.last - exp.last;
    const balChange = pctChange(balCur, balLast);

    setChangeBadge($('#incomeChange'), inc.change);
    setChangeBadge($('#expenseChange'), exp.change, true); // higher expense = bad
    setChangeBadge($('#balanceChange'), balChange);

    const rate = savingsRate(state.transactions);
    $('#savingsRate').textContent = Math.round(rate) + '%';
    $('#savingsRate').className = 'stat-change ' + (rate >= 20 ? '' : rate > 0 ? 'neutral' : 'down');
    $('#incomeSub').textContent = inc.cur > 0 ? '₹' + fmtMoney(inc.cur).slice(1) + ' this month' : 'no income this month';
    $('#expenseSub').textContent = exp.cur > 0 ? '₹' + fmtMoney(exp.cur).slice(1) + ' this month' : 'no expenses this month';
    $('#balanceSub').textContent = balChange >= 0 ? 'up vs last month' : 'down vs last month';

    // recent transactions (latest 6)
    const recent = [...state.transactions]
      .sort((a, b) => parseDate(b.date) - parseDate(a.date) || b.createdAt - a.createdAt)
      .slice(0, 6);
    $('#recentTransactionsBody').innerHTML = recent.length
      ? recent.map(txRow).join('')
      : emptyRow(7, 'No transactions yet');
    refreshIcons();
  }

  function setChangeBadge(el, val, invert) {
    const rounded = Math.round(Math.abs(val));
    const up = val >= 0;
    // for expense, "up" (increase) is bad unless invert logic: invert=true means increase => down style
    let cls = up ? '' : 'down';
    if (invert) cls = up ? 'down' : '';
    if (val === 0) cls = 'neutral';
    el.className = 'stat-change ' + cls;
    el.textContent = (up ? '+' : '-') + rounded + '%';
  }

  /* ---------------- Rendering: Transactions table ---------------- */
  function getFilteredTx() {
    let list = [...state.transactions];

    // search by name or category
    if (state.search.trim()) {
      const q = state.search.trim().toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
    }
    // type filter
    if (state.typeFilter !== 'all') list = list.filter((t) => t.type === state.typeFilter);
    // category filter
    if (state.categoryFilter !== 'all') list = list.filter((t) => t.category === state.categoryFilter);
    // date filter
    if (state.dateFilter !== 'all') list = filterByRange(list, state.dateFilter);

    // sort
    list.sort((a, b) => {
      switch (state.sort) {
        case 'oldest': return parseDate(a.date) - parseDate(b.date) || a.createdAt - b.createdAt;
        case 'highest': return num(b.amount) - num(a.amount);
        case 'lowest': return num(a.amount) - num(b.amount);
        case 'newest':
        default: return parseDate(b.date) - parseDate(a.date) || b.createdAt - a.createdAt;
      }
    });
    return list;
  }

  function renderTransactions() {
    const list = getFilteredTx();
    const body = $('#transactionsBody');
    body.innerHTML = list.length ? list.map(txRow).join('') : '';
    $('#txEmpty').hidden = list.length > 0;
    $('#txCount').textContent = 'Showing ' + list.length + ' transaction' + (list.length !== 1 ? 's' : '');
    refreshIcons();
  }

  function txRow(t) {
    const inc = t.type === 'income';
    const icon = categoryIcon(t.category);
    return `
      <tr data-id="${t.id}">
        <td>
          <div class="tx-name">
            <div class="tx-icon ${inc ? 'inc' : 'exp'}"><i data-lucide="${icon}"></i></div>
            <div>
              <span class="tx-title-cell">${escapeHtml(t.title)}</span>
              ${t.description ? '<span class="tx-desc">' + escapeHtml(t.description) + '</span>' : ''}
            </div>
          </div>
        </td>
        <td><span class="pill pill-cat"><i data-lucide="${icon}"></i>${escapeHtml(t.category)}</span></td>
        <td>${fmtDate(t.date)}</td>
        <td>${escapeHtml(t.method || '—')}</td>
        <td><span class="pill ${inc ? 'pill-income' : 'pill-expense'}"><i data-lucide="${inc ? 'trending-up' : 'trending-down'}"></i>${inc ? 'Income' : 'Expense'}</span></td>
        <td class="amount ${inc ? 'inc' : 'exp'}">${fmtSigned(t.amount, t.type)}</td>
        <td>
          <div class="row-actions">
            <button class="action-btn edit" data-action="edit" title="Edit"><i data-lucide="pencil"></i></button>
            <button class="action-btn delete" data-action="delete" title="Delete"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>`;
  }

  function emptyRow(colspan, msg) {
    return `<tr><td colspan="${colspan}" style="text-align:center;padding:32px;color:var(--text-muted)">${msg}</td></tr>`;
  }

  /* ---------------- Rendering: Income & Expense pages ---------------- */
  function renderIncome() {
    const list = state.transactions.filter((t) => t.type === 'income')
      .sort((a, b) => parseDate(b.date) - parseDate(a.date) || b.createdAt - a.createdAt);
    const total = sumByType(state.transactions, 'income');
    const monthTotal = state.transactions.filter((t) => t.type === 'income' && monthOf(t.date) === currentMonthKey())
      .reduce((s, t) => s + num(t.amount), 0);
    $('#incomeTotal').textContent = fmtMoney(total);
    $('#incomeMonth').textContent = fmtMoney(monthTotal);
    $('#incomeCount').textContent = list.length;
    $('#incomeCountBadge').textContent = list.length;
    const body = $('#incomeBody');
    body.innerHTML = list.length ? list.map(incRow).join('') : '';
    $('#incomeEmpty').hidden = list.length > 0;
    refreshIcons();
  }

  function renderExpenses() {
    const list = state.transactions.filter((t) => t.type === 'expense')
      .sort((a, b) => parseDate(b.date) - parseDate(a.date) || b.createdAt - a.createdAt);
    const total = sumByType(state.transactions, 'expense');
    const monthTotal = state.transactions.filter((t) => t.type === 'expense' && monthOf(t.date) === currentMonthKey())
      .reduce((s, t) => s + num(t.amount), 0);
    // avg daily spending based on all-time days with data (fallback to this month)
    const expTx = state.transactions.filter((t) => t.type === 'expense');
    let avg = 0;
    if (expTx.length) {
      const dates = expTx.map((t) => t.date).sort();
      const span = Math.max(1, Math.round((parseDate(dates[dates.length - 1]) - parseDate(dates[0])) / 86400000) + 1);
      avg = total / span;
    }
    $('#expenseTotal').textContent = fmtMoney(total);
    $('#expenseMonth').textContent = fmtMoney(monthTotal);
    $('#expenseAvgDaily').textContent = fmtMoney(avg);
    $('#expenseCountBadge').textContent = list.length;
    const body = $('#expenseBody');
    body.innerHTML = list.length ? list.map(incRow).join('') : '';
    $('#expenseEmpty').hidden = list.length > 0;
    refreshIcons();
  }

  function incRow(t) {
    const icon = categoryIcon(t.category);
    return `
      <tr data-id="${t.id}">
        <td><div class="tx-name"><div class="tx-icon ${t.type === 'income' ? 'inc' : 'exp'}"><i data-lucide="${icon}"></i></div><span class="tx-title-cell">${escapeHtml(t.title)}</span></div></td>
        <td><span class="pill pill-cat"><i data-lucide="${icon}"></i>${escapeHtml(t.category)}</span></td>
        <td>${fmtDate(t.date)}</td>
        <td>${escapeHtml(t.method || '—')}</td>
        <td class="amount ${t.type === 'income' ? 'inc' : 'exp'}">${fmtSigned(t.amount, t.type)}</td>
        <td><div class="row-actions">
          <button class="action-btn edit" data-action="edit" title="Edit"><i data-lucide="pencil"></i></button>
          <button class="action-btn delete" data-action="delete" title="Delete"><i data-lucide="trash-2"></i></button>
        </div></td>
      </tr>`;
  }

  /* ---------------- Rendering: Categories ---------------- */
  function renderCategories() {
    const catMap = expensesByCategory(state.transactions);
    const entries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, e) => s + e[1], 0);
    const container = $('#categoryCards');
    if (!entries.length) {
      container.innerHTML = '';
      $('#categoryEmpty').hidden = false;
      return;
    }
    $('#categoryEmpty').hidden = true;
    container.innerHTML = entries.map(([cat, amt]) => {
      const pct = total ? Math.round((amt / total) * 100) : 0;
      const color = categoryColor(cat);
      const count = state.transactions.filter((t) => t.type === 'expense' && t.category === cat).length;
      return `
        <div class="card cat-card">
          <div class="cat-card__head">
            <div class="cat-card__icon" style="background:${hexA(color, 0.15)};color:${color}"><i data-lucide="${categoryIcon(cat)}"></i></div>
            <div><div class="cat-card__name">${escapeHtml(cat)}</div><div class="cat-card__count">${count} transaction${count !== 1 ? 's' : ''}</div></div>
          </div>
          <div class="cat-card__amount" style="color:${color}">${fmtMoney(amt)}</div>
          <div class="cat-bar"><div class="cat-bar__fill" style="background:${color}" data-w="${pct}"></div></div>
          <div class="cat-card__pct">${pct}% of total spending</div>
        </div>`;
    }).join('');
    refreshIcons();
    // animate bars
    requestAnimationFrame(() => {
      $$('.cat-bar__fill').forEach((bar) => { bar.style.width = (bar.dataset.w || 0) + '%'; });
    });
  }

  /* ---------------- Rendering: Budgets ---------------- */
  function renderBudgets() {
    const list = state.budgets;
    const container = $('#budgetList');
    const monthExpenses = state.transactions.filter((t) => t.type === 'expense' && monthOf(t.date) === currentMonthKey());
    const catSpent = {};
    monthExpenses.forEach((t) => { catSpent[t.category] = (catSpent[t.category] || 0) + num(t.amount); });

    const totalBudget = list.reduce((s, b) => s + num(b.amount), 0);
    const totalSpent = list.reduce((s, b) => s + (catSpent[b.category] || 0), 0);
    $('#totalBudget').textContent = fmtMoney(totalBudget);
    $('#budgetSpent').textContent = fmtMoney(totalSpent);

    if (!list.length) {
      container.innerHTML = '';
      $('#budgetEmpty').hidden = false;
      return;
    }
    $('#budgetEmpty').hidden = true;
    container.innerHTML = list.map((b) => {
      const spent = catSpent[b.category] || 0;
      const limit = num(b.amount);
      const remain = limit - spent;
      const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
      let cls = 'safe', statusCls = 'safe', status = 'On track', fillCls = '';
      if (pct >= 100) { cls = 'over'; statusCls = 'over'; status = 'Budget exceeded'; fillCls = 'over'; }
      else if (pct >= 80) { cls = 'warn'; statusCls = 'warn'; status = 'Approaching limit'; fillCls = 'warn'; }
      const color = categoryColor(b.category);
      return `
        <div class="budget-item" data-id="${b.id}">
          <div class="budget-item__head">
            <div class="budget-item__left">
              <div class="budget-icon" style="background:${hexA(color, 0.15)};color:${color}"><i data-lucide="${categoryIcon(b.category)}"></i></div>
              <div><div class="budget-name">${escapeHtml(b.category)}</div><div class="budget-limit">Monthly limit ${fmtMoney(limit)}</div></div>
            </div>
            <div class="budget-amounts">
              <div class="budget-spent">${fmtMoney(spent)}</div>
              <div class="budget-remain ${remain < 0 ? 'over' : ''}">${remain < 0 ? 'Over by ' + fmtMoney(Math.abs(remain)) : 'Remaining ' + fmtMoney(remain)}</div>
            </div>
          </div>
          <div class="progress"><div class="progress__fill ${fillCls}" data-w="${pct}" style="background:${fillCls ? '' : color}"></div></div>
          <div class="budget-item__foot">
            <span class="budget-status ${statusCls}">${Math.round(pct)}% used · ${status}</span>
            <div class="budget-actions">
              <button class="action-btn edit" data-action="edit-budget" title="Edit"><i data-lucide="pencil"></i></button>
              <button class="action-btn delete" data-action="delete-budget" title="Delete"><i data-lucide="trash-2"></i></button>
            </div>
          </div>
        </div>`;
    }).join('');
    refreshIcons();
    requestAnimationFrame(() => {
      $$('.budget-item .progress__fill').forEach((bar) => { bar.style.width = (bar.dataset.w || 0) + '%'; });
    });
  }

  /* ---------------- Rendering: Analytics ---------------- */
  function renderAnalytics() {
    const anaTxs = filterByRange(state.transactions, state.analyticsRange);
    const expTotal = sumByType(anaTxs, 'expense');

    // fixed-window stats
    const todayStr = todayISO();
    const daily = state.transactions.filter((t) => t.type === 'expense' && t.date === todayStr).reduce((s, t) => s + num(t.amount), 0);
    const weekly = state.transactions.filter((t) => t.type === 'expense' && inRange(t.date, '7d')).reduce((s, t) => s + num(t.amount), 0);
    const monthly = state.transactions.filter((t) => t.type === 'expense' && inRange(t.date, 'month')).reduce((s, t) => s + num(t.amount), 0);

    // avg daily spending: for open-ended ranges use the actual date span of data
    let days;
    const expTx = anaTxs.filter((t) => t.type === 'expense');
    if (state.analyticsRange === 'all' || state.analyticsRange === 'year') {
      if (expTx.length) {
        const dates = expTx.map((t) => t.date).sort();
        days = Math.max(1, Math.round((parseDate(dates[dates.length - 1]) - parseDate(dates[0])) / 86400000) + 1);
      } else days = 1;
    } else {
      days = rangeDays(state.analyticsRange);
    }
    const avgDaily = days > 0 ? expTotal / days : 0;

    $('#anaDaily').textContent = fmtMoney(daily);
    $('#anaWeekly').textContent = fmtMoney(weekly);
    $('#anaMonthly').textContent = fmtMoney(monthly);
    $('#anaAvgDaily').textContent = fmtMoney(avgDaily);
  }

  /* ---------------- Render All ---------------- */
  function renderAll() {
    renderDashboard();
    renderTransactions();
    renderIncome();
    renderExpenses();
    renderCategories();
    renderBudgets();
    renderAnalytics();
    populateCategoryFilters();
    renderAllCharts();
    updateNotifDot();
  }

  /* ---------------- Category filter dropdowns ---------------- */
  function populateCategoryFilters() {
    const txCatSelect = $('#txCategoryFilter');
    const allCats = [...new Set([...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES])];
    const current = txCatSelect.value;
    txCatSelect.innerHTML = '<option value="all">All Categories</option>' +
      allCats.map((c) => `<option value="${c}">${c}</option>`).join('');
    txCatSelect.value = current;
  }

  function populateModalCategories(type, selected) {
    const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    $('#txCategory').innerHTML = cats.map((c) => `<option value="${c}">${c}</option>`).join('');
    if (selected && cats.includes(selected)) $('#txCategory').value = selected;
  }

  function populateBudgetCategories(selected) {
    const used = state.budgets.map((b) => b.category);
    // allow editing existing one; for new, exclude already-budgeted categories
    const cats = EXPENSE_CATEGORIES;
    $('#budgetCategory').innerHTML = cats.map((c) => {
      const disabled = (state.editBudgetId && c === selected) ? false : used.includes(c);
      return `<option value="${c}" ${disabled ? 'disabled' : ''}>${c}${disabled && c !== selected ? ' (set)' : ''}</option>`;
    }).join('');
    if (selected) $('#budgetCategory').value = selected;
  }

  /* ---------------- Transaction Modal ---------------- */
  function openTxModal(id, presetType) {
    state.editTxId = id || null;
    const form = $('#txForm');
    form.reset();
    $('#txId').value = '';
    const type = id ? state.transactions.find((t) => t.id === id).type : (presetType || 'expense');
    setTypeActive(type);
    populateModalCategories(type, id ? state.transactions.find((t) => t.id === id).category : null);

    if (id) {
      const t = state.transactions.find((x) => x.id === id);
      $('#txModalTitle').textContent = 'Edit Transaction';
      $('#txId').value = t.id;
      $('#txTitle').value = t.title;
      $('#txAmount').value = t.amount;
      $('#txCategory').value = t.category;
      $('#txDate').value = t.date;
      $('#txMethod').value = t.method || 'Cash';
      $('#txDesc').value = t.description || '';
      $('#txSaveBtn').textContent = 'Update Transaction';
    } else {
      $('#txModalTitle').textContent = 'Add Transaction';
      $('#txDate').value = todayISO();
      $('#txSaveBtn').textContent = 'Save Transaction';
    }
    showModal('#txModal');
  }

  function setTypeActive(type) {
    $$('.type-btn').forEach((b) => b.classList.toggle('active', b.dataset.type === type));
  }

  function handleTxSubmit(e) {
    e.preventDefault();
    const title = $('#txTitle').value.trim();
    const amount = num($('#txAmount').value);
    const type = $$('.type-btn.active')[0]?.dataset.type || 'expense';
    const category = $('#txCategory').value;
    const date = $('#txDate').value;
    const method = $('#txMethod').value;
    const description = $('#txDesc').value.trim();

    if (!title) { toast('Please enter a title', 'error'); return; }
    if (amount <= 0) { toast('Amount must be greater than 0', 'error'); return; }
    if (!date) { toast('Please select a date', 'error'); return; }

    if (state.editTxId) {
      const t = state.transactions.find((x) => x.id === state.editTxId);
      Object.assign(t, { title, amount, type, category, date, method, description });
      toast('Transaction updated', 'success');
    } else {
      state.transactions.push({
        id: uid(), title, amount, type, category, date, method, description, createdAt: Date.now(),
      });
      toast(type === 'income' ? 'Income added' : 'Expense added', 'success');
    }
    saveTransactions();
    closeModal('#txModal');
    renderAll();
  }

  /* ---------------- Budget Modal ---------------- */
  function openBudgetModal(id) {
    state.editBudgetId = id || null;
    $('#budgetForm').reset();
    $('#budgetId').value = '';
    if (id) {
      const b = state.budgets.find((x) => x.id === id);
      $('#budgetModalTitle').textContent = 'Edit Budget';
      $('#budgetId').value = b.id;
      populateBudgetCategories(b.category);
      $('#budgetAmount').value = b.amount;
    } else {
      $('#budgetModalTitle').textContent = 'Set Budget';
      populateBudgetCategories();
      $('#budgetAmount').value = '';
    }
    showModal('#budgetModal');
  }

  function handleBudgetSubmit(e) {
    e.preventDefault();
    const category = $('#budgetCategory').value;
    const amount = num($('#budgetAmount').value);
    if (!category) { toast('Please select a category', 'error'); return; }
    if (amount <= 0) { toast('Budget must be greater than 0', 'error'); return; }

    if (state.editBudgetId) {
      const b = state.budgets.find((x) => x.id === state.editBudgetId);
      Object.assign(b, { category, amount });
      toast('Budget updated', 'success');
    } else {
      if (state.budgets.some((b) => b.category === category)) {
        toast('Budget already set for ' + category, 'error');
        return;
      }
      state.budgets.push({ id: uid(), category, amount });
      toast('Budget added', 'success');
    }
    saveBudgets();
    closeModal('#budgetModal');
    renderAll();
  }

  /* ---------------- Delete / Confirm ---------------- */
  function deleteTransaction(id) {
    const t = state.transactions.find((x) => x.id === id);
    if (!t) return;
    confirmAction('Delete transaction?', `“${t.title}” will be permanently removed.`, 'Delete', () => {
      state.transactions = state.transactions.filter((x) => x.id !== id);
      saveTransactions();
      renderAll();
      toast('Transaction deleted', 'info');
    });
  }

  function deleteBudget(id) {
    const b = state.budgets.find((x) => x.id === id);
    if (!b) return;
    confirmAction('Delete budget?', `Budget for ${b.category} will be removed.`, 'Delete', () => {
      state.budgets = state.budgets.filter((x) => x.id !== id);
      saveBudgets();
      renderAll();
      toast('Budget deleted', 'info');
    });
  }

  function confirmAction(title, msg, okText, cb) {
    $('#confirmTitle').textContent = title;
    $('#confirmMsg').textContent = msg;
    $('#confirmOk').textContent = okText || 'Confirm';
    state.confirmCb = cb;
    showModal('#confirmModal');
  }

  /* ---------------- Modals helpers ---------------- */
  function showModal(sel) { $(sel).classList.add('show'); }
  function closeModal(sel) { $(sel).classList.remove('show'); }
  function closeAllModals() { $$('.modal-overlay').forEach((m) => m.classList.remove('show')); }

  /* ---------------- Toast ---------------- */
  function toast(msg, type) {
    type = type || 'info';
    const icons = { success: 'check-circle-2', error: 'alert-circle', info: 'info', warning: 'alert-triangle' };
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = `<div class="toast__icon"><i data-lucide="${icons[type]}"></i></div><div class="toast__msg">${escapeHtml(msg)}</div><button class="toast__close"><i data-lucide="x"></i></button>`;
    $('#toastContainer').appendChild(el);
    refreshIcons();
    const remove = () => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 350);
    };
    el.querySelector('.toast__close').addEventListener('click', remove);
    setTimeout(remove, 3400);
  }

  /* ---------------- Theme ---------------- */
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem(STORAGE.theme, state.theme);
  }
  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
    renderAllCharts(); // refresh chart colors
    toast(state.theme === 'dark' ? 'Dark mode on' : 'Light mode on', 'info');
  }

  /* ---------------- Navigation ---------------- */
  function navigateTo(page) {
    state.page = page;
    $$('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.page === page));
    $$('.page').forEach((p) => p.classList.toggle('active', p.dataset.page === page));
    closeSidebar();
    // scroll content to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // re-render charts when entering chart-heavy pages (ensure canvas sized)
    if (page === 'analytics' || page === 'dashboard') renderAllCharts();
    refreshIcons();
  }

  function closeSidebar() {
    $('#sidebar').classList.remove('open');
    $('#sidebarOverlay').classList.remove('show');
  }
  function toggleSidebar() {
    const open = $('#sidebar').classList.toggle('open');
    $('#sidebarOverlay').classList.toggle('show', open);
  }

  /* ---------------- Export & Print ---------------- */
  function exportCSV() {
    const list = getFilteredTx();
    if (!list.length) { toast('No transactions to export', 'warning'); return; }
    const headers = ['Title', 'Type', 'Category', 'Date', 'Payment Method', 'Amount', 'Description'];
    const rows = list.map((t) => [
      t.title, t.type, t.category, t.date, t.method || '', t.amount, (t.description || '').replace(/\n/g, ' '),
    ]);
    const csv = [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'expenseflow_transactions_' + todayISO() + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('CSV exported (' + list.length + ' rows)', 'success');
  }

  function csvCell(v) {
    const s = String(v ?? '');
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function printReport() {
    navigateTo('transactions');
    setTimeout(() => window.print(), 300);
  }

  /* ---------------- Settings actions ---------------- */
  function clearAllData() {
    confirmAction('Clear all data?', 'This will permanently delete all transactions and budgets. This cannot be undone.', 'Clear All', () => {
      state.transactions = [];
      state.budgets = [];
      saveTransactions();
      saveBudgets();
      // keep seeded flag set so the empty state persists on refresh (no re-seed)
      localStorage.setItem(STORAGE.seeded, '1');
      renderAll();
      toast('All data cleared', 'info');
    });
  }

  function loadSampleData() {
    confirmAction('Load sample data?', 'This will replace your current data with demo transactions and budgets.', 'Load Sample', () => {
      seedSample(true);
      saveTransactions();
      saveBudgets();
      renderAll();
      toast('Sample data loaded', 'success');
    });
  }

  /* ---------------- Notification dot ---------------- */
  function updateNotifDot() {
    // show dot if any budget exceeded or at 80%+
    const monthExpenses = state.transactions.filter((t) => t.type === 'expense' && monthOf(t.date) === currentMonthKey());
    const catSpent = {};
    monthExpenses.forEach((t) => { catSpent[t.category] = (catSpent[t.category] || 0) + num(t.amount); });
    const warn = state.budgets.some((b) => {
      const pct = num(b.amount) > 0 ? (catSpent[b.category] || 0) / num(b.amount) : 0;
      return pct >= 0.8;
    });
    $('#notifDot').style.display = warn ? 'block' : 'none';
  }

  function showNotifications() {
    const monthExpenses = state.transactions.filter((t) => t.type === 'expense' && monthOf(t.date) === currentMonthKey());
    const catSpent = {};
    monthExpenses.forEach((t) => { catSpent[t.category] = (catSpent[t.category] || 0) + num(t.amount); });
    const exceeded = state.budgets.filter((b) => num(b.amount) > 0 && (catSpent[b.category] || 0) / num(b.amount) >= 1);
    const warning = state.budgets.filter((b) => {
      const p = num(b.amount) > 0 ? (catSpent[b.category] || 0) / num(b.amount) : 0;
      return p >= 0.8 && p < 1;
    });
    if (exceeded.length) toast('Budget exceeded: ' + exceeded.map((b) => b.category).join(', '), 'error');
    if (warning.length) toast('Approaching limit: ' + warning.map((b) => b.category).join(', '), 'warning');
    if (!exceeded.length && !warning.length) toast('No budget alerts. You are on track!', 'success');
  }

  /* ---------------- Sample data ---------------- */
  function seedSample(force) {
    if (!force && localStorage.getItem(STORAGE.seeded)) return;
    const tx = [];
    const add = (title, amount, type, category, daysAgo, method, desc) => {
      tx.push({
        id: uid(), title, amount, type, category, date: daysAgoISO(daysAgo),
        method, description: desc || '', createdAt: Date.now() - daysAgo * 1000,
      });
    };
    // Income
    add('Monthly Salary', 65000, 'income', 'Salary', 2, 'Bank Transfer', 'October salary');
    add('Freelance Project', 18000, 'income', 'Freelancing', 8, 'UPI', 'Logo design project');
    add('Stock Dividend', 3200, 'income', 'Investments', 15, 'Bank Transfer', 'Quarterly dividend');
    add('Side Business', 9500, 'income', 'Business', 20, 'Cash', 'Local shop sales');
    // Expenses (current month)
    add('Grocery Shopping', 3200, 'expense', 'Food', 1, 'UPI', 'Weekly groceries');
    add('Movie Night', 800, 'expense', 'Entertainment', 3, 'Card', 'Cinema with friends');
    add('Uber Rides', 650, 'expense', 'Transportation', 4, 'UPI', 'Office commute');
    add('Electricity Bill', 2100, 'expense', 'Bills', 5, 'Bank Transfer', 'Monthly electricity');
    add('New Shoes', 4200, 'expense', 'Shopping', 6, 'Card', 'Running shoes');
    add('Restaurant Dinner', 1500, 'expense', 'Food', 7, 'Card', 'Dinner outing');
    add('Online Course', 3500, 'expense', 'Education', 9, 'Card', 'JavaScript course');
    add('Pharmacy', 450, 'expense', 'Healthcare', 11, 'UPI', 'Medicines');
    // Expenses (last month for trend)
    add('Monthly Salary', 65000, 'income', 'Salary', 32, 'Bank Transfer', 'September salary');
    add('Grocery Shopping', 2800, 'expense', 'Food', 34, 'UPI', 'Weekly groceries');
    add('Internet Bill', 999, 'expense', 'Bills', 35, 'UPI', 'Monthly internet');
    add('Weekend Trip', 8500, 'expense', 'Travel', 38, 'Card', 'Hill station trip');
    add('Fuel', 2200, 'expense', 'Transportation', 40, 'Card', 'Petrol');

    state.transactions = tx;
    state.budgets = [
      { id: uid(), category: 'Food', amount: 6000 },
      { id: uid(), category: 'Shopping', amount: 5000 },
      { id: uid(), category: 'Transportation', amount: 3000 },
      { id: uid(), category: 'Bills', amount: 4000 },
      { id: uid(), category: 'Entertainment', amount: 2000 },
    ];
    localStorage.setItem(STORAGE.seeded, '1');
  }

  /* ---------------- Icons refresh ---------------- */
  function refreshIcons() {
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  }

  /* ---------------- Event binding ---------------- */
  function bindEvents() {
    // Navigation
    $$('.nav-item').forEach((n) => n.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(n.dataset.page);
    }));
    $$('[data-nav]').forEach((b) => b.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(b.dataset.nav);
    }));

    // Sidebar mobile
    $('#menuToggle').addEventListener('click', toggleSidebar);
    $('#sidebarOverlay').addEventListener('click', closeSidebar);

    // Header actions
    $('#themeToggle').addEventListener('click', toggleTheme);
    $('#themeSwitch').addEventListener('click', toggleTheme);
    $('#notifBtn').addEventListener('click', showNotifications);
    $('#addTransactionBtn').addEventListener('click', () => openTxModal());
    $('#addTxPageBtn').addEventListener('click', () => openTxModal());

    // Global search → transactions page
    $('#globalSearch').addEventListener('input', (e) => {
      state.search = e.target.value;
      $('#txSearch').value = state.search;
      navigateTo('transactions');
      renderTransactions();
    });

    // Transactions toolbar
    $('#txSearch').addEventListener('input', (e) => { state.search = e.target.value; renderTransactions(); });
    $('#txTypeFilter').addEventListener('change', (e) => { state.typeFilter = e.target.value; renderTransactions(); });
    $('#txCategoryFilter').addEventListener('change', (e) => { state.categoryFilter = e.target.value; renderTransactions(); });
    $('#txDateFilter').addEventListener('change', (e) => { state.dateFilter = e.target.value; renderTransactions(); });
    $('#txSort').addEventListener('change', (e) => { state.sort = e.target.value; renderTransactions(); });

    // Income / Expense add buttons
    $('#addIncomeBtn').addEventListener('click', () => openTxModal(null, 'income'));
    $('#addExpenseBtn').addEventListener('click', () => openTxModal(null, 'expense'));
    $('#addBudgetBtn').addEventListener('click', () => openBudgetModal());

    // Table delegation (transactions, income, expense)
    document.body.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const row = btn.closest('tr');
      const id = row ? row.dataset.id : (btn.closest('.budget-item') ? btn.closest('.budget-item').dataset.id : null);
      const action = btn.dataset.action;
      if (action === 'edit') openTxModal(id);
      else if (action === 'delete') deleteTransaction(id);
      else if (action === 'edit-budget') openBudgetModal(id);
      else if (action === 'delete-budget') deleteBudget(id);
    });

    // Export / print
    $('#exportCsvBtn').addEventListener('click', exportCSV);
    $('#printReportBtn').addEventListener('click', printReport);
    $('#settingsExportBtn').addEventListener('click', exportCSV);

    // Settings
    $('#clearDataBtn').addEventListener('click', clearAllData);
    $('#loadSampleBtn').addEventListener('click', loadSampleData);

    // Transaction modal
    $('#txModalClose').addEventListener('click', () => closeModal('#txModal'));
    $('#txCancelBtn').addEventListener('click', () => closeModal('#txModal'));
    $('#txForm').addEventListener('submit', handleTxSubmit);
    $$('.type-btn').forEach((b) => b.addEventListener('click', () => {
      setTypeActive(b.dataset.type);
      populateModalCategories(b.dataset.type, $('#txCategory').value);
    }));

    // Budget modal
    $('#budgetModalClose').addEventListener('click', () => closeModal('#budgetModal'));
    $('#budgetCancelBtn').addEventListener('click', () => closeModal('#budgetModal'));
    $('#budgetForm').addEventListener('submit', handleBudgetSubmit);

    // Confirm modal
    $('#confirmCancel').addEventListener('click', () => closeModal('#confirmModal'));
    $('#confirmOk').addEventListener('click', () => {
      closeModal('#confirmModal');
      if (state.confirmCb) { state.confirmCb(); state.confirmCb = null; }
    });

    // Close modals on overlay click
    $$('.modal-overlay').forEach((overlay) => overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal('#' + overlay.id);
    }));

    // Keyboard: Escape closes modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAllModals();
    });

    // Dashboard date filter chips
    $('#dashDateFilter').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      $$('#dashDateFilter .chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      state.dashRange = chip.dataset.range;
      renderAllCharts();
      renderDashboard();
    });

    // Analytics date filter chips
    $('#analyticsDateFilter').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      $$('#analyticsDateFilter .chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      state.analyticsRange = chip.dataset.range;
      renderAnalytics();
      renderAllCharts();
    });

    // Responsive: close sidebar when resizing to desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth > 860) closeSidebar();
    });
  }

  /* ---------------- Init ---------------- */
  function init() {
    loadData();
    applyTheme();

    // Welcome + date
    const now = new Date();
    $('#currentDate').textContent = now.toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    const hour = now.getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    $('#welcomeMsg').textContent = greet + ' 👋';

    // Seed sample data on first run
    if (!state.transactions.length && !state.budgets.length) {
      seedSample(false);
      saveTransactions();
      saveBudgets();
    }

    bindEvents();
    renderAll();
    refreshIcons();
  }

  // Wait for DOM + deferred libs
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
