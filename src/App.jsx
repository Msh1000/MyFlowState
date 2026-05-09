import { useEffect, useMemo, useRef, useState } from "react";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { motion } from "framer-motion";
import {
  Wallet,
  TrendingUp,
  Settings,
  Plus,
  Trash2,
  Moon,
  Sun,
  Search,
  Download,
  Upload,
  PieChart,
  BarChart3,
  CalendarDays,
  CreditCard,
  Landmark,
  Tags,
  Pencil,
  CheckCircle2,
  PauseCircle,
  Sparkles,
  ChevronRight,
  Grid2X2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart as RPieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { parseNaturalTransaction } from "./aiTransactions";
import { auth, db, googleProvider } from "./firebase";

const STORAGE_KEY = "budgetflow_web_v1";
const AI_AUTO_CONFIRM_KEY = "budgetflow_ai_auto_confirm";
const AI_PROMPT_LIMIT = 300;
const CLOUD_DATA_VERSION = "1";
const CLOUD_SYNC_KEYS = [
  "settings",
  "incomes",
  "expenses",
  "recurring",
  "investments",
  "contributions",
  "savingGoals",
  "savingTransactions",
  "investmentTransactions",
  "cycleSnapshots",
  "categories",
  "categoryColors",
  "incomeTypes",
];

const defaultCategories = [
  "Groceries",
  "Food",
  "Transport",
  "Rent/Bond",
  "Utilities",
  "Subscriptions",
  "Debt",
  "Medical",
  "Shopping",
  "Entertainment",
  "Family",
  "Savings",
  "Investments",
];

const defaultIncomeTypes = ["Salary", "Side Income", "Bonus", "Allowance", "Rental Income", "Other"];
const defaultInvestmentTypes = ["TFSA", "ETF", "Stocks", "Retirement Annuity", "Fixed Deposit", "Savings", "Crypto", "Other"];
const frequencyOptions = ["Weekly", "Monthly", "Yearly", "Custom"];
const categoryColorPool = ["#14b8a6", "#f97316", "#3b82f6", "#a855f7", "#ef4444", "#eab308", "#22c55e", "#64748b", "#ec4899", "#06b6d4", "#f43f5e", "#84cc16", "#6366f1", "#f59e0b", "#0ea5e9", "#d946ef"];
const paletteOptions = ["emerald", "ocean", "plum", "graphite", "pink"];
const SHOW_LIMIT = 2;
const NOTIFIED_REMINDERS_KEY = `${STORAGE_KEY}_notified_reminders`;
const palettes = {
  emerald: {
    label: "Green",
    accent: "#047857",
    accentStrong: "#065f46",
    accentSoft: "#ecfdf5",
    expense: "#be123c",
    expenseSoft: "#fff1f2",
    graphIncome: "#34d399",
    graphExpense: "#065f46",
    graphMoney: "#0ea5e9",
    heroLight: "linear-gradient(135deg, #ecfdf5 0%, #ffffff 52%, #d1fae5 100%)",
    heroDark: "linear-gradient(135deg, #022c22 0%, #09090b 62%, #111827 100%)",
    appLight: "linear-gradient(135deg, #f7f8fb 0%, #ffffff 48%, #eefdf6 100%)",
    appDark: "linear-gradient(135deg, #09090b 0%, #111113 48%, #052e2b 100%)",
  },
  ocean: {
    label: "Blue",
    accent: "#0369a1",
    accentStrong: "#075985",
    accentSoft: "#e0f2fe",
    expense: "#ea580c",
    expenseSoft: "#fff7ed",
    graphIncome: "#38bdf8",
    graphExpense: "#1d4ed8",
    graphMoney: "#a855f7",
    heroLight: "linear-gradient(135deg, #e0f2fe 0%, #ffffff 52%, #bae6fd 100%)",
    heroDark: "linear-gradient(135deg, #082f49 0%, #020617 60%, #111827 100%)",
    appLight: "linear-gradient(135deg, #f8fafc 0%, #ffffff 48%, #e0f2fe 100%)",
    appDark: "linear-gradient(135deg, #020617 0%, #111827 52%, #082f49 100%)",
  },
  plum: {
    label: "Purple",
    accent: "#7c3aed",
    accentStrong: "#6d28d9",
    accentSoft: "#f3e8ff",
    expense: "#db2777",
    expenseSoft: "#fdf2f8",
    graphIncome: "#a78bfa",
    graphExpense: "#6d28d9",
    graphMoney: "#22c55e",
    heroLight: "linear-gradient(135deg, #f3e8ff 0%, #ffffff 52%, #e9d5ff 100%)",
    heroDark: "linear-gradient(135deg, #2e1065 0%, #09090b 58%, #111827 100%)",
    appLight: "linear-gradient(135deg, #faf7ff 0%, #ffffff 48%, #f3e8ff 100%)",
    appDark: "linear-gradient(135deg, #09090b 0%, #181026 55%, #2e1065 100%)",
  },
  graphite: {
    label: "Grey",
    accent: "#52525b",
    accentStrong: "#27272a",
    accentSoft: "#f4f4f5",
    expense: "#a16207",
    expenseSoft: "#fefce8",
    graphIncome: "#a1a1aa",
    graphExpense: "#3f3f46",
    graphMoney: "#f59e0b",
    heroLight: "linear-gradient(135deg, #f4f4f5 0%, #ffffff 52%, #e4e4e7 100%)",
    heroDark: "linear-gradient(135deg, #09090b 0%, #18181b 62%, #27272a 100%)",
    appLight: "linear-gradient(135deg, #fafafa 0%, #ffffff 48%, #f4f4f5 100%)",
    appDark: "linear-gradient(135deg, #09090b 0%, #111113 52%, #27272a 100%)",
  },
  pink: {
    label: "Pink",
    accent: "#db2777",
    accentStrong: "#be185d",
    accentSoft: "#fce7f3",
    expense: "#7c2d12",
    expenseSoft: "#ffedd5",
    graphIncome: "#f9a8d4",
    graphExpense: "#be185d",
    graphMoney: "#06b6d4",
    heroLight: "linear-gradient(135deg, #fce7f3 0%, #ffffff 52%, #fbcfe8 100%)",
    heroDark: "linear-gradient(135deg, #500724 0%, #09090b 58%, #18181b 100%)",
    appLight: "linear-gradient(135deg, #fff7fb 0%, #ffffff 48%, #fce7f3 100%)",
    appDark: "linear-gradient(135deg, #09090b 0%, #1f1118 52%, #500724 100%)",
  },
};

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const pad = (value) => String(value).padStart(2, "0");
const formatDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const today = () => formatDate(new Date());

function formatAmount(value) {
  const number = Number(value || 0);
  const sign = number < 0 ? "-" : "";
  const [whole, decimal] = Math.abs(number).toFixed(2).split(".");
  return `${sign}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}.${decimal}`;
}

function parseAmount(value) {
  const normalized = String(value ?? "").replace(/\s+/g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

const money = (value, currency = "R") => `${currency}${formatAmount(value)}`;
const chartTooltipStyle = {
  backgroundColor: "var(--chart-tooltip-bg)",
  border: "1px solid var(--chart-tooltip-border)",
  borderRadius: 8,
  color: "var(--chart-text)",
  fontWeight: 700,
};
const chartTooltipLabelStyle = { color: "var(--chart-text)", fontWeight: 800 };
const chartTooltipItemStyle = { color: "var(--chart-text)" };

function fileTimestamp(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function maskedMoney(currency = "R") {
  return `${currency}*****`;
}

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function uniqueList(items) {
  return [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];
}

function normalizeCategories(categories) {
  const next = uniqueList(categories || []).filter((category) => category !== "Other");
  return next.length ? next : [...defaultCategories];
}

function nextCategoryColor(usedColors = []) {
  const used = new Set(usedColors);
  const available = categoryColorPool.find((color) => !used.has(color));
  if (available) return available;
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue} 72% 48%)`;
}

function normalizeCategoryColors(categories, colors = {}) {
  const next = {};
  categories.forEach((category) => {
    next[category] = colors[category] || nextCategoryColor(Object.values(next));
  });
  return next;
}

function getPalette(key) {
  return palettes[key] || palettes.emerald;
}

function getPaletteVars(key, isDark) {
  const palette = getPalette(key);
  return {
    "--accent": palette.accent,
    "--accent-strong": palette.accentStrong,
    "--accent-soft": palette.accentSoft,
    "--income": palette.accent,
    "--expense": palette.expense,
    "--expense-soft": palette.expenseSoft,
    "--hero-text": isDark ? "#ffffff" : "#18181b",
    "--hero-muted": isDark ? "#d4d4d8" : "#52525b",
    "--chart-text": isDark ? "#f4f4f5" : "#52525b",
    "--chart-tooltip-bg": isDark ? "#09090b" : "#ffffff",
    "--chart-tooltip-border": isDark ? "rgba(244, 244, 245, 0.2)" : "rgba(82, 82, 91, 0.2)",
    "--hero-chip": isDark ? "rgba(255, 255, 255, 0.1)" : palette.accentSoft,
    "--hero-panel": isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.68)",
    "--hero-panel-border": isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(24, 24, 27, 0.12)",
    "--hero-track": isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(24, 24, 27, 0.14)",
    "--money-left": palette.graphMoney || palette.accent,
    "--graph-income": palette.graphIncome || palette.accent,
    "--graph-expense": palette.graphExpense || palette.expense,
    "--hero-positive": "#8b5cf6",
    "--hero-negative": isDark ? "#fecdd3" : "#be123c",
    "--app-background": isDark ? palette.appDark : palette.appLight,
    "--hero-background": isDark ? palette.heroDark : palette.heroLight,
    "--header-background": isDark ? "rgba(9, 9, 11, 0.88)" : "rgba(255, 255, 255, 0.88)",
    "--border-color": isDark ? "rgba(39, 39, 42, 0.86)" : "rgba(228, 228, 231, 0.86)",
  };
}

function parseDate(value) {
  if (!value) return parseDate(today());
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return parseDate(today());
  return new Date(year, month - 1, day);
}

function displayDate(value) {
  const date = parseDate(value);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function displayRange(start, end) {
  return `${displayDate(start)} - ${displayDate(end)}`;
}

function ordinalDay(value) {
  const day = clampStartDay(value);
  const suffix = day % 100 >= 11 && day % 100 <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[day % 10] || "th";
  return `${day}${suffix}`;
}

function parseDisplayDate(value) {
  const trimmed = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return "";

  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const parsed = new Date(year, month - 1, day);

  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return "";
  return formatDate(parsed);
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function clampStartDay(value) {
  return Math.min(31, Math.max(1, Number(value || 1)));
}

function dateFromDay(year, monthIndex, day) {
  const safeDay = Math.min(clampStartDay(day), daysInMonth(year, monthIndex));
  return new Date(year, monthIndex, safeDay);
}

function previousWorkingDay(date) {
  const next = new Date(date);
  const day = next.getDay();
  if (day === 6) next.setDate(next.getDate() - 1);
  if (day === 0) next.setDate(next.getDate() - 2);
  return next;
}

function adjustedFinancialStart(date, settings) {
  return settings?.adjustFinancialWeekends ? previousWorkingDay(date) : new Date(date);
}

function getFinancialStartDay(settings) {
  if (settings?.financialStartDate) return clampStartDay(parseDate(settings.financialStartDate).getDate());
  return clampStartDay(settings?.financialStartDay || 25);
}

function getCurrentFinancialStartDate(startDay) {
  const now = new Date();
  let start = dateFromDay(now.getFullYear(), now.getMonth(), startDay);
  if (now < start) start = dateFromDay(now.getFullYear(), now.getMonth() - 1, startDay);
  return formatDate(start);
}

function getFinancialRange(settings) {
  const startDay = getFinancialStartDay(settings);
  const now = new Date();
  let nominalStart = dateFromDay(now.getFullYear(), now.getMonth(), startDay);
  if (now < nominalStart) nominalStart = dateFromDay(now.getFullYear(), now.getMonth() - 1, startDay);

  const nextNominalStart = dateFromDay(nominalStart.getFullYear(), nominalStart.getMonth() + 1, startDay);
  const start = adjustedFinancialStart(nominalStart, settings);
  const nextStart = adjustedFinancialStart(nextNominalStart, settings);
  const end = new Date(nextStart);
  end.setDate(end.getDate() - 1);
  return { start: formatDate(start), end: formatDate(end), startDay };
}

function inRange(date, start, end) {
  return date >= start && date <= end;
}

function isFutureDate(date) {
  return date > today();
}

function getTransactionStatus(date, status) {
  if (status === "pending" || status === "applied") return status;
  return isFutureDate(date) ? "pending" : "applied";
}

function isApplied(item) {
  return item.status !== "pending";
}

function appliedAtFor(status, date, appliedAt) {
  if (appliedAt) return appliedAt;
  return status === "applied" ? date || today() : "";
}

function movementDelta(type, amount) {
  return type === "withdrawal" ? -Number(amount || 0) : Number(amount || 0);
}

function contributionDelta(type, amount) {
  return type === "withdrawal" ? -Number(amount || 0) : Number(amount || 0);
}

function monthsRemainingUntil(dateValue) {
  if (!dateValue) return 0;
  const now = parseDate(today());
  const goalDate = parseDate(dateValue);
  if (goalDate < now) return -1;
  const years = goalDate.getFullYear() - now.getFullYear();
  const months = years * 12 + goalDate.getMonth() - now.getMonth();
  return Math.max(1, months + (goalDate.getDate() >= now.getDate() ? 1 : 0));
}

function suggestedMonthlySaving(goalAmount, currentBalance, goalDate) {
  const months = monthsRemainingUntil(goalDate);
  if (months < 0) return null;
  return Math.max(0, (Number(goalAmount || 0) - Number(currentBalance || 0)) / months);
}

function calculateCycleTotals(data, range, carryOverOverride) {
  const carryOver = Number(carryOverOverride ?? data.settings?.carryOverBalance ?? 0);
  const income = data.incomes
    .filter((item) => isApplied(item) && inRange(item.date, range.start, range.end))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expenses = data.expenses
    .filter((item) => isApplied(item) && inRange(item.date, range.start, range.end))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const savingsDeposited = data.savingTransactions
    .filter((item) => isApplied(item) && item.type === "deposit" && inRange(item.date, range.start, range.end))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const savingsWithdrawn = data.savingTransactions
    .filter((item) => isApplied(item) && item.type === "withdrawal" && inRange(item.date, range.start, range.end))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const investmentContributed = data.investmentTransactions
    .filter((item) => isApplied(item) && item.affectsCash !== false && item.type === "contribution" && inRange(item.date, range.start, range.end))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const investmentWithdrawn = data.investmentTransactions
    .filter((item) => isApplied(item) && item.affectsCash !== false && item.type === "withdrawal" && inRange(item.date, range.start, range.end))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const currentSaved = data.savingGoals.reduce((sum, item) => sum + Number(item.currentBalance || 0), 0);
  const currentInvested = data.investments.reduce((sum, item) => sum + Number(item.currentBalance || 0), 0);
  const cycleMoneyLeft = income - expenses - savingsDeposited - investmentContributed + savingsWithdrawn + investmentWithdrawn;
  const moneyLeft = carryOver + cycleMoneyLeft;
  const daysLeft = Math.max(1, Math.ceil((parseDate(range.end) - parseDate(today())) / 86400000) + 1);
  return {
    income,
    expenses,
    savingsDeposited,
    savingsWithdrawn,
    investmentContributed,
    investmentWithdrawn,
    savingsInvestments: savingsDeposited + investmentContributed,
    savingsInvestmentsExpenses: savingsDeposited + investmentContributed + expenses,
    carryOver,
    currentSaved,
    currentInvested,
    netWorth: currentSaved + currentInvested + moneyLeft,
    cycleMoneyLeft,
    moneyLeft,
    safeToSpend: moneyLeft / daysLeft,
    daysLeft,
  };
}

function runDevAssertions() {
  const totals = calculateCycleTotals(
    {
      incomes: [{ amount: 1000, date: "2026-05-05" }],
      expenses: [{ amount: 200, date: "2026-05-05" }],
      savingTransactions: [{ type: "deposit", amount: 100, date: "2026-05-05" }],
      investmentTransactions: [{ type: "contribution", amount: 50, date: "2026-05-05" }],
      savingGoals: [{ currentBalance: 400 }],
      investments: [{ currentBalance: 600 }],
    },
    { start: "2026-05-01", end: "2026-05-31" },
  );
  console.assert(totals.moneyLeft === 650, "money-left formula failed");
  console.assert(totals.netWorth === 1000, "net worth formula failed");
  console.assert(suggestedMonthlySaving(1200, 600, "2026-11-30") > 0, "monthly saving suggestion failed");
  console.assert(formatDate(previousWorkingDay(new Date(2026, 4, 30))) === "2026-05-29", "weekend adjustment failed");
  const futureTotals = calculateCycleTotals(
    {
      incomes: [{ amount: 1000, date: today(), status: "applied" }, { amount: 500, date: "2999-01-01", status: "pending" }],
      expenses: [],
      savingTransactions: [{ type: "deposit", amount: 200, date: "2999-01-01", status: "pending" }],
      investmentTransactions: [{ type: "contribution", amount: 300, date: "2999-01-01", status: "pending" }],
      savingGoals: [],
      investments: [],
    },
    { start: "2000-01-01", end: "2999-12-31" },
  );
  console.assert(futureTotals.moneyLeft === 1000, "future transaction should not affect money left");
  console.assert(getTransactionStatus(today()) === "applied", "transaction dated today should apply");
  const dueData = applyPendingTransactions({
    incomes: [],
    expenses: [],
    savingGoals: [{ id: "goal", currentBalance: 0 }],
    savingTransactions: [{ id: "tx", savingGoalId: "goal", type: "deposit", amount: 50, date: today(), status: "pending" }],
    investments: [{ id: "inv", currentBalance: 0 }],
    investmentTransactions: [{ id: "itx", investmentId: "inv", type: "contribution", amount: 75, date: today(), status: "pending" }],
  });
  console.assert(dueData.savingTransactions[0].status === "applied" && dueData.savingGoals[0].currentBalance === 50, "pending saving transaction should apply when due");
  console.assert(normalizeInvestment({ openingBalance: 999 }).currentBalance === 0, "investment openingBalance should be ignored");
  console.assert(advanceRecurringDate("2026-05-08", "Monthly") > "2026-05-08", "recurring item should schedule next due date");
}

function projection(currentBalance, monthlyContribution, annualReturn, years) {
  const months = years * 12;
  const monthlyRate = annualReturn / 100 / 12;
  let value = Number(currentBalance || 0);
  for (let i = 0; i < months; i += 1) {
    value = value * (1 + monthlyRate) + Number(monthlyContribution || 0);
  }
  return value;
}

function nextDueDate(startDate, frequency, customDays = 30) {
  const date = parseDate(startDate || today());
  const now = parseDate(today());
  while (date < now) {
    if (frequency === "Weekly") date.setDate(date.getDate() + 7);
    else if (frequency === "Yearly") date.setFullYear(date.getFullYear() + 1);
    else if (frequency === "Custom") date.setDate(date.getDate() + Number(customDays || 30));
    else date.setMonth(date.getMonth() + 1);
  }
  return formatDate(date);
}

function advanceRecurringDate(startDate, frequency, customDays = 30) {
  const date = parseDate(startDate || today());
  if (frequency === "Weekly") date.setDate(date.getDate() + 7);
  else if (frequency === "Yearly") date.setFullYear(date.getFullYear() + 1);
  else if (frequency === "Custom") date.setDate(date.getDate() + Number(customDays || 30));
  else date.setMonth(date.getMonth() + 1);
  return formatDate(date);
}

function addRecurringTransaction(draft, item, dueDate = today()) {
  const amount = parseAmount(item.amount);
  if (item.kind === "income") {
    draft.incomes.push({
      id: uid(),
      name: item.title || item.type,
      amount,
      date: dueDate,
      type: item.type,
      notes: item.notes,
      recurringId: item.id,
      recurringDueDate: dueDate,
      status: "applied",
      appliedAt: today(),
    });
  } else {
    draft.expenses.push({
      id: uid(),
      title: item.title || item.category,
      amount,
      date: dueDate,
      category: item.category,
      paymentMethod: "Recurring",
      notes: item.notes,
      recurringId: item.id,
      recurringDueDate: dueDate,
      status: "applied",
      appliedAt: today(),
    });
  }
}

function materializeDueRecurring(data) {
  const current = today();
  data.recurring
    .filter((item) => item.active && item.startDate <= current)
    .forEach((item) => {
      let guard = 0;
      while (item.active && item.startDate <= current && guard < 60) {
        const exists = [...data.incomes, ...data.expenses, ...data.investmentTransactions].some(
          (entry) => entry.recurringId === item.id && entry.recurringDueDate === item.startDate,
        );
        if (!exists) addRecurringTransaction(data, item, item.startDate);
        item.startDate = advanceRecurringDate(item.startDate, item.frequency, item.customDays);
        guard += 1;
      }
    });
  return data;
}

function applyPendingTransactions(data) {
  const current = today();
  data.incomes.forEach((item) => {
    if (item.status === "pending" && item.date <= current) {
      item.status = "applied";
      item.appliedAt = today();
    }
  });
  data.expenses.forEach((item) => {
    if (item.status === "pending" && item.date <= current) {
      item.status = "applied";
      item.appliedAt = today();
    }
  });
  data.savingTransactions.forEach((item) => {
    if (item.status === "pending" && item.date <= current) {
      const goal = data.savingGoals.find((entry) => entry.id === item.savingGoalId);
      if (goal) goal.currentBalance = Math.max(0, Number(goal.currentBalance || 0) + movementDelta(item.type, item.amount));
      item.status = "applied";
      item.appliedAt = today();
    }
  });
  data.investmentTransactions.forEach((item) => {
    if (item.status === "pending" && item.date <= current) {
      const investment = data.investments.find((entry) => entry.id === item.investmentId);
      if (investment) investment.currentBalance = Math.max(0, Number(investment.currentBalance || 0) + contributionDelta(item.type, item.amount));
      item.status = "applied";
      item.appliedAt = today();
    }
  });
  return data;
}

function cycleSnapshotId(start, end) {
  return `${start}:${end}`;
}

function createCycleSnapshot(data, range, carryOver = 0) {
  const totals = calculateCycleTotals(data, range, carryOver);
  return {
    id: cycleSnapshotId(range.start, range.end),
    start: range.start,
    end: range.end,
    income: totals.income,
    expenses: totals.expenses,
    savings: totals.savingsDeposited,
    investments: totals.investmentContributed,
    moneyLeft: totals.moneyLeft,
    safeToSpend: totals.safeToSpend,
    netWorth: totals.netWorth,
    carryOver: totals.carryOver,
    createdAt: today(),
  };
}

function normalizeSnapshot(item) {
  const start = item.start || item.cycleStart || today();
  const end = item.end || item.cycleEnd || start;
  return {
    id: item.id || cycleSnapshotId(start, end),
    start,
    end,
    income: parseAmount(item.income),
    expenses: parseAmount(item.expenses),
    savings: parseAmount(item.savings),
    investments: parseAmount(item.investments),
    moneyLeft: parseAmount(item.moneyLeft),
    safeToSpend: parseAmount(item.safeToSpend),
    netWorth: parseAmount(item.netWorth),
    carryOver: parseAmount(item.carryOver),
    createdAt: item.createdAt || today(),
  };
}

function finalizeCycleState(data) {
  const currentRange = getFinancialRange(data.settings);
  const activeStart = data.settings.activeCycleStart || currentRange.start;
  const activeEnd = data.settings.activeCycleEnd || currentRange.end;

  if (activeEnd < currentRange.start) {
    const previousRange = { start: activeStart, end: activeEnd };
    const previousCarryOver = Number(data.settings.carryOverBalance || 0);
    const snapshot = createCycleSnapshot(data, previousRange, previousCarryOver);
    if (!data.cycleSnapshots.some((item) => item.id === snapshot.id)) data.cycleSnapshots.push(snapshot);
    data.settings.carryOverBalance = Math.max(0, Number(snapshot.moneyLeft || 0));
    data.settings.activeCycleStart = currentRange.start;
    data.settings.activeCycleEnd = currentRange.end;
  } else {
    data.settings.activeCycleStart = activeStart;
    data.settings.activeCycleEnd = activeEnd;
  }

  return data;
}

function createInitialState() {
  const financialStartDay = 25;
  const initialRange = getFinancialRange({ financialStartDay, financialStartDate: getCurrentFinancialStartDate(financialStartDay), adjustFinancialWeekends: false });
  return {
    settings: {
      currency: "R",
      theme: "system",
      palette: "emerald",
      financialStartDay,
      financialStartDate: getCurrentFinancialStartDate(financialStartDay),
      paymentReminders: false,
      adjustFinancialWeekends: false,
      showExpenseLegend: true,
      hideHeroIncome: false,
      hideHeroNetWorth: false,
      carryOverBalance: 0,
      activeCycleStart: initialRange.start,
      activeCycleEnd: initialRange.end,
      userName: "",
    },
    incomes: [],
    expenses: [],
    recurring: [],
    investments: [],
    contributions: [],
    savings: [],
    savingsContributions: [],
    savingGoals: [],
    savingTransactions: [],
    investmentTransactions: [],
    categories: [...defaultCategories],
    categoryColors: normalizeCategoryColors(defaultCategories),
    incomeTypes: [...defaultIncomeTypes],
    cycleSnapshots: [],
  };
}

function normalizeRecurring(item) {
  const kind = item.kind === "income" ? "income" : "expense";
  return {
    id: item.id || uid(),
    kind,
    title: item.title || item.name || "",
    amount: parseAmount(item.amount),
    category: item.category || "Subscriptions",
    type: item.type || "Salary",
    startDate: item.startDate || item.date || today(),
    frequency: item.frequency || "Monthly",
    customDays: Number(item.customDays || 30),
    notes: item.notes || "",
    active: item.active !== false,
  };
}

function normalizeSavings(item) {
  return {
    id: item.id || uid(),
    name: item.name || "Savings account",
    currentBalance: Number(item.currentBalance || item.balance || 0),
    goal: Number(item.goal || 0),
    monthlyTarget: Number(item.monthlyTarget || 0),
    notes: item.notes || "",
  };
}

function normalizeSavingGoal(item) {
  const currentBalance = parseAmount(item.currentBalance ?? item.balance ?? item.openingBalance ?? 0);
  const goalAmount = parseAmount(item.goalAmount ?? item.goal ?? 0);
  return {
    id: item.id || uid(),
    name: item.name || "Saving goal",
    goalAmount,
    goalDate: item.goalDate || item.targetDate || formatDate(new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate())),
    openingBalance: parseAmount(item.openingBalance ?? item.balance ?? currentBalance),
    currentBalance,
    notes: item.notes || item.comment || "",
    createdAt: item.createdAt || today(),
  };
}

function normalizeSavingTransaction(item) {
  const date = item.date || today();
  const status = getTransactionStatus(date, item.status);
  return {
    id: item.id || uid(),
    savingGoalId: item.savingGoalId || item.savingsId || "",
    type: item.type === "withdrawal" || item.direction === "withdrawal" ? "withdrawal" : "deposit",
    amount: parseAmount(item.amount),
    date,
    comment: item.comment || item.notes || "",
    status,
    appliedAt: appliedAtFor(status, date, item.appliedAt),
    createdAt: item.createdAt || today(),
  };
}

function normalizeInvestment(item) {
  return {
    id: item.id || uid(),
    name: item.name || "Investment",
    type: item.type || "ETF",
    currentBalance: parseAmount(item.currentBalance ?? 0),
    monthlyContribution: parseAmount(item.monthlyContribution),
    annualReturn: Number(item.annualReturn || 0),
    notes: item.notes || item.comment || "",
    createdAt: item.createdAt || today(),
  };
}

function normalizeInvestmentTransaction(item) {
  const isOpeningBalance = item.comment === "Opening balance" || item.notes === "Opening balance";
  const date = item.date || today();
  const status = getTransactionStatus(date, item.status);
  return {
    id: item.id || uid(),
    investmentId: item.investmentId || "",
    type: item.type === "withdrawal" ? "withdrawal" : "contribution",
    amount: parseAmount(item.amount),
    date,
    comment: item.comment || item.notes || "",
    affectsCash: isOpeningBalance ? false : item.affectsCash !== false,
    recurringId: item.recurringId || "",
    recurringDueDate: item.recurringDueDate || "",
    status,
    appliedAt: appliedAtFor(status, date, item.appliedAt),
    createdAt: item.createdAt || today(),
  };
}

function normalizeIncome(item) {
  const date = item.date || today();
  const status = getTransactionStatus(date, item.status);
  return {
    ...item,
    id: item.id || uid(),
    name: item.name || item.title || item.type || "Income",
    amount: parseAmount(item.amount),
    date,
    type: item.type || "Salary",
    notes: item.notes || item.comment || "",
    status,
    appliedAt: appliedAtFor(status, date, item.appliedAt),
    createdAt: item.createdAt || today(),
  };
}

function normalizeExpense(item) {
  const date = item.date || today();
  const status = getTransactionStatus(date, item.status);
  return {
    ...item,
    id: item.id || uid(),
    title: item.title || item.name || item.category || "Expense",
    amount: parseAmount(item.amount),
    date,
    category: item.category || "Groceries",
    paymentMethod: item.paymentMethod || "Card",
    notes: item.notes || item.comment || "",
    status,
    appliedAt: appliedAtFor(status, date, item.appliedAt),
    createdAt: item.createdAt || today(),
  };
}

function mergeById(...groups) {
  const map = new Map();
  groups.flat().forEach((item) => {
    if (item?.id) map.set(item.id, item);
  });
  return [...map.values()];
}

function pruneOldTransactions(data, monthsToKeep = 3) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsToKeep);
  const cutoffDate = formatDate(cutoff);
  const keepRecent = (item) => !item.date || item.date >= cutoffDate;

  return {
    ...data,
    incomes: data.incomes.filter(keepRecent),
    expenses: data.expenses.filter(keepRecent),
    savingTransactions: data.savingTransactions.filter(keepRecent),
    investmentTransactions: data.investmentTransactions.filter(keepRecent),
  };
}

function normalizeData(value) {
  const base = createInitialState();
  const raw = value && typeof value === "object" ? value : {};
  const settings = { ...base.settings, ...(raw.settings || {}) };

  settings.financialStartDay = clampStartDay(
    settings.financialStartDate ? parseDate(settings.financialStartDate).getDate() : settings.financialStartDay,
  );
  settings.financialStartDate = settings.financialStartDate || getCurrentFinancialStartDate(settings.financialStartDay);
  if (!["system", "light", "dark"].includes(settings.theme)) settings.theme = "system";
  if (!paletteOptions.includes(settings.palette)) settings.palette = "emerald";
  settings.paymentReminders = Boolean(settings.paymentReminders);
  settings.adjustFinancialWeekends = Boolean(settings.adjustFinancialWeekends);
  settings.showExpenseLegend = settings.showExpenseLegend !== false;
  settings.hideHeroIncome = Boolean(settings.hideHeroIncome);
  settings.hideHeroNetWorth = Boolean(settings.hideHeroNetWorth);
  settings.carryOverBalance = parseAmount(settings.carryOverBalance);
  settings.userName = String(settings.userName || "");

  const savingGoals = mergeById(
    Array.isArray(raw.savingGoals) ? raw.savingGoals.map(normalizeSavingGoal) : [],
    Array.isArray(raw.savings) ? raw.savings.map(normalizeSavingGoal) : [],
  );
  const savingTransactions = mergeById(
    Array.isArray(raw.savingTransactions) ? raw.savingTransactions.map(normalizeSavingTransaction) : [],
    Array.isArray(raw.savingsContributions) ? raw.savingsContributions.map(normalizeSavingTransaction) : [],
  );
  const investments = Array.isArray(raw.investments) ? raw.investments.map(normalizeInvestment) : [];
  const investmentTransactions = mergeById(
    Array.isArray(raw.investmentTransactions) ? raw.investmentTransactions.map(normalizeInvestmentTransaction) : [],
    Array.isArray(raw.contributions) ? raw.contributions.map(normalizeInvestmentTransaction) : [],
  );
  const categories = Array.isArray(raw.categories) && raw.categories.length ? normalizeCategories(raw.categories) : [...defaultCategories];
  const categoryColors = normalizeCategoryColors(categories, raw.categoryColors || {});
  const cycleSnapshots = Array.isArray(raw.cycleSnapshots) ? raw.cycleSnapshots.map(normalizeSnapshot) : [];

  return finalizeCycleState(pruneOldTransactions(materializeDueRecurring(applyPendingTransactions({
    ...base,
    ...raw,
    settings,
    incomes: Array.isArray(raw.incomes) ? raw.incomes.map(normalizeIncome) : [],
    expenses: Array.isArray(raw.expenses) ? raw.expenses.map(normalizeExpense) : [],
    recurring: Array.isArray(raw.recurring) ? raw.recurring.map(normalizeRecurring) : [],
    investments,
    contributions: Array.isArray(raw.contributions) ? raw.contributions : [],
    savings: Array.isArray(raw.savings) ? raw.savings.map(normalizeSavings) : [],
    savingsContributions: Array.isArray(raw.savingsContributions) ? raw.savingsContributions : [],
    savingGoals,
    savingTransactions,
    investmentTransactions,
    categories,
    categoryColors,
    incomeTypes: Array.isArray(raw.incomeTypes) && raw.incomeTypes.length ? uniqueList(raw.incomeTypes) : [...defaultIncomeTypes],
    cycleSnapshots,
  }))));
}

function cloneBudgetData(value) {
  return JSON.parse(JSON.stringify(value));
}

function getPersistentAppData(value) {
  const normalized = normalizeData(value);
  return CLOUD_SYNC_KEYS.reduce((next, key) => {
    if (Object.prototype.hasOwnProperty.call(normalized, key)) next[key] = cloneBudgetData(normalized[key]);
    return next;
  }, {});
}

function getCloudBackupRef(uidValue) {
  return doc(db, "users", uidValue, "appData", "main");
}

async function readCloudBackup(uidValue) {
  const snapshot = await getDoc(getCloudBackupRef(uidValue));
  if (!snapshot.exists()) return null;
  const cloudData = snapshot.data();
  return cloudData?.appData ? normalizeData(cloudData.appData) : null;
}

async function writeCloudBackup(uidValue, appData) {
  await setDoc(getCloudBackupRef(uidValue), {
    appData: getPersistentAppData(appData),
    updatedAt: serverTimestamp(),
    version: CLOUD_DATA_VERSION,
  });
}

function friendlyFirebaseAuthError(error) {
  const code = error?.code || "";
  if (code === "auth/unauthorized-domain") {
    return "Login failed: this domain is not authorized in Firebase. Add localhost and 127.0.0.1 in Firebase Authentication > Settings > Authorized domains.";
  }
  if (code === "auth/popup-blocked") return "Login failed: the Google popup was blocked. Please allow popups for this app and try again.";
  if (code === "auth/popup-closed-by-user") return "Login cancelled before Google sign-in finished.";
  if (code === "auth/operation-not-allowed") return "Login failed: Google sign-in is not enabled in Firebase Authentication.";
  if (code === "auth/network-request-failed") return "Login failed: please check your internet connection and try again.";
  return "Login failed. Please try again.";
}

function useBudgetStore() {
  const [data, setData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return normalizeData(saved ? JSON.parse(saved) : undefined);
    } catch {
      return createInitialState();
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const update = (fn) => {
    setData((prev) => normalizeData(fn(cloneBudgetData(prev)) || prev));
  };

  const replaceData = (next) => setData(normalizeData(next));

  return [data, update, replaceData];
}

function useFirebaseUser() {
  const [user, setUser] = useState(null);

  useEffect(() => onAuthStateChanged(auth, (nextUser) => setUser(nextUser)), []);

  return user;
}

function usePaymentReminders(data) {
  useEffect(() => {
    if (!data.settings.paymentReminders || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const notified = JSON.parse(localStorage.getItem(NOTIFIED_REMINDERS_KEY) || "{}");
    const now = parseDate(today());
    const upcoming = data.recurring
      .filter((item) => item.active)
      .map((item) => ({ ...item, next: nextDueDate(item.startDate, item.frequency, item.customDays) }))
      .filter((item) => {
        const days = Math.ceil((parseDate(item.next) - now) / 86400000);
        return days >= 0 && days <= 3;
      });

    upcoming.forEach((item) => {
      const key = `${item.id}:${item.next}`;
      if (notified[key]) return;
      new Notification("Upcoming payment", {
        body: `${item.title || item.type || item.category} is due ${displayDate(item.next)} (${money(item.amount, data.settings.currency)})`,
      });
      notified[key] = true;
    });
    localStorage.setItem(NOTIFIED_REMINDERS_KEY, JSON.stringify(notified));
  }, [data.recurring, data.settings.currency, data.settings.paymentReminders]);
}

function Shell({ data, update, tab, setTab, children }) {
  const tabs = [
    ["Dashboard", Wallet],
    ["Transactions", CreditCard],
    ["Savings", Landmark],
    ["Investments", TrendingUp],
    ["Settings", Settings],
  ];
  const [isDark, setIsDark] = useState(false);
  const swipeRef = useRef(null);

  usePaymentReminders(data);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const dark = data.settings.theme === "dark" || (data.settings.theme === "system" && media.matches);
      root.classList.toggle("dark", dark);
      root.dataset.palette = data.settings.palette || "emerald";
      root.style.colorScheme = dark ? "dark" : "light";
      setIsDark(dark);
    };

    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [data.settings.palette, data.settings.theme]);

  const toggleTheme = () => {
    update((draft) => {
      draft.settings.theme = isDark ? "light" : "dark";
      return draft;
    });
  };

  const switchTabBySwipe = (direction) => {
    const index = tabs.findIndex(([name]) => name === tab);
    const nextIndex = Math.min(tabs.length - 1, Math.max(0, index + direction));
    if (nextIndex !== index) setTab(tabs[nextIndex][0]);
  };

  const startSwipe = (event) => {
    if (event.target.closest("input, textarea, select, button, label")) return;
    const touch = event.touches[0];
    swipeRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const endSwipe = (event) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 72 || Math.abs(deltaX) < Math.abs(deltaY) * 1.3) return;
    switchTabBySwipe(deltaX < 0 ? 1 : -1);
  };

  return (
    <div
      className="min-h-screen overflow-x-hidden bg-[#f7f8fb] text-zinc-950 dark:bg-[#05050b] dark:text-zinc-50"
      style={getPaletteVars(data.settings.palette, isDark)}
      onTouchStart={startSwipe}
      onTouchEnd={endSwipe}
    >
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-white/10 bg-[#050512] px-3 py-5 text-white shadow-[20px_0_70px_rgba(0,0,0,0.35)] lg:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent-strong)] text-white">
            <Wallet size={17} />
          </div>
          <div>
            <p className="text-sm font-black tracking-tight">MyFlowState</p>
            <p className="text-[10px] font-semibold text-zinc-500">Budget clarity</p>
          </div>
        </div>
        <div className="space-y-1">
          {tabs.map(([name, Icon]) => (
            <button
              key={name}
              type="button"
              onClick={() => setTab(name)}
              className={cx(
                "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-xs font-bold transition",
                tab === name
                  ? "bg-[var(--accent-strong)] text-white shadow-[0_10px_28px_rgba(124,58,237,0.28)]"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon size={16} />
              {name}
            </button>
          ))}
        </div>
        <div className="mt-auto space-y-3">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-[11px] font-semibold text-zinc-400">
            <p className="mb-1 text-zinc-500">Current cycle</p>
            {displayRange(getFinancialRange(data.settings).start, getFinancialRange(data.settings).end)}
          </div>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-xs font-bold text-zinc-300"
            onClick={toggleTheme}
          >
            <span className="flex items-center gap-2">
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
              Dark mode
            </span>
            <span className={cx("h-5 w-9 rounded-full p-0.5 transition", isDark ? "bg-[var(--accent-strong)]" : "bg-zinc-700")}>
              <span className={cx("block h-4 w-4 rounded-full bg-white transition", isDark && "translate-x-4")} />
            </span>
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-[var(--border-color)] bg-[var(--header-background)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 border-b border-[var(--accent)]/10 bg-[var(--accent-soft)]/35 px-3 py-3 shadow-[0_18px_55px_rgba(15,23,42,0.08)] dark:bg-[var(--accent-strong)]/10 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-strong)] text-white shadow-[0_10px_28px_rgba(15,23,42,0.18)]">
              <Wallet size={17} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black tracking-tight sm:text-2xl">MyFlowState</h1>
              <p className="truncate text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                Keep your FlowState on a budget.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="grid h-11 w-11 place-items-center rounded-lg border border-[var(--border-color)] bg-white text-zinc-800 shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)] dark:bg-zinc-900 dark:text-zinc-100"
            onClick={toggleTheme}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl overflow-x-hidden px-3 py-5 pb-28 sm:px-6 lg:ml-56 lg:px-8 lg:py-7">{children}</main>

      <nav className="fixed bottom-3 left-1/2 z-30 w-[calc(100%-1.5rem)] max-w-3xl -translate-x-1/2 rounded-lg border border-zinc-200 bg-white/92 p-1.5 shadow-[0_20px_70px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/92 lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {tabs.map(([name, Icon]) => (
            <button
              key={name}
              type="button"
              aria-label={name}
              onClick={() => setTab(name)}
              className={cx(
                "rounded-md px-2 py-2.5 text-[11px] font-semibold transition sm:text-xs",
                tab === name
                  ? "bg-[var(--accent-strong)] text-white shadow-sm"
                  : "text-zinc-500 hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)] dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white",
              )}
            >
              <Icon className="mx-auto sm:mb-1" size={18} />
              <span className="hidden sm:inline">{name}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function Dashboard({ data, update, syncUser }) {
  const [selectedCycleId, setSelectedCycleId] = useState("current");
  const [aiOpen, setAiOpen] = useState(false);
  const range = useMemo(() => getFinancialRange(data.settings), [data.settings]);
  const currentTotals = useMemo(() => calculateCycleTotals(data, range), [data, range]);
  const selectedSnapshot = data.cycleSnapshots.find((item) => item.id === selectedCycleId);
  const isHistorical = Boolean(selectedSnapshot);
  const totals = isHistorical
    ? {
        income: selectedSnapshot.income,
        expenses: selectedSnapshot.expenses,
        savingsDeposited: selectedSnapshot.savings,
        investmentContributed: selectedSnapshot.investments,
        savingsInvestments: selectedSnapshot.savings + selectedSnapshot.investments,
        savingsInvestmentsExpenses: selectedSnapshot.savings + selectedSnapshot.investments + selectedSnapshot.expenses,
        moneyLeft: selectedSnapshot.moneyLeft,
        safeToSpend: selectedSnapshot.safeToSpend,
        netWorth: selectedSnapshot.netWorth,
        currentSaved: currentTotals.currentSaved,
        currentInvested: currentTotals.currentInvested,
        daysLeft: currentTotals.daysLeft,
        carryOver: selectedSnapshot.carryOver,
      }
    : currentTotals;
  const byCategory = useMemo(
    () =>
      isHistorical
        ? []
        :
      data.categories
        .map((category) => ({
          name: category,
          value: data.expenses
            .filter((expense) => isApplied(expense) && expense.category === category && inRange(expense.date, range.start, range.end))
            .reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
          color: data.categoryColors[category] || nextCategoryColor(Object.values(data.categoryColors || {})),
        }))
        .filter((item) => item.value > 0),
    [data.categories, data.categoryColors, data.expenses, isHistorical, range.end, range.start],
  );
  const expenseTotal = byCategory.reduce((sum, item) => sum + item.value, 0);
  const flowData = [
    { name: "Income", amount: totals.income, fill: "var(--graph-income)" },
    { name: "Expenses", amount: totals.expenses, fill: "var(--graph-expense)" },
    { name: "Money left", amount: Math.abs(totals.moneyLeft), fill: totals.moneyLeft >= 0 ? "var(--money-left)" : "#dc2626" },
  ];
  const expenseInsight =
    totals.income > 0 && totals.expenses / totals.income < 0.5
      ? "Good job, expenses are low."
      : totals.income > 0 && totals.expenses / totals.income > 0.85
        ? "Careful, expenses are high this month."
        : "";
  const savingsInsight = totals.savingsDeposited > 0 ? "Nice progress on savings." : "";
  const userName = data.settings.userName.trim();
  const incomeValue = data.settings.hideHeroIncome ? maskedMoney(data.settings.currency) : money(totals.income, data.settings.currency);
  const netWorthValue = data.settings.hideHeroNetWorth ? maskedMoney(data.settings.currency) : money(totals.netWorth, data.settings.currency);
  const privateBalanceValue = data.settings.hideHeroNetWorth ? maskedMoney(data.settings.currency) : null;
  const recentTransactions = useMemo(() => {
    const savingNames = Object.fromEntries(data.savingGoals.map((item) => [item.id, item.name]));
    const investmentNames = Object.fromEntries(data.investments.map((item) => [item.id, item.name]));
    return [
      ...data.incomes.filter(isApplied).map((item) => ({ id: item.id, group: "Income", title: item.name || item.type, subtitle: item.type, amount: item.amount, date: item.date, sign: 1 })),
      ...data.expenses.filter(isApplied).map((item) => ({ id: item.id, group: "Expense", title: item.title || item.category, subtitle: item.category, amount: item.amount, date: item.date, sign: -1 })),
      ...data.savingTransactions.filter(isApplied).map((item) => ({
        id: item.id,
        group: "Savings",
        title: item.type === "withdrawal" ? "Savings withdrawal" : "Savings deposit",
        subtitle: savingNames[item.savingGoalId] || "Saving goal",
        amount: item.amount,
        date: item.date,
        sign: item.type === "withdrawal" ? 1 : -1,
      })),
      ...data.investmentTransactions.filter((item) => isApplied(item) && item.affectsCash !== false).map((item) => ({
        id: item.id,
        group: "Investment",
        title: item.type === "withdrawal" ? "Investment withdrawal" : "Investment contribution",
        subtitle: investmentNames[item.investmentId] || "Investment",
        amount: item.amount,
        date: item.date,
        sign: item.type === "withdrawal" ? 1 : -1,
      })),
    ]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
  }, [data.expenses, data.incomes, data.investmentTransactions, data.investments, data.savingGoals, data.savingTransactions]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-black tracking-tight text-zinc-950 dark:text-white sm:text-xl">
            {greetingForNow()}{userName ? `, ${userName}` : ""}
          </h2>
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Here's your financial overview</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAiOpen((open) => !open)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-violet-200 bg-violet-50 text-violet-700 shadow-sm transition hover:border-violet-400 hover:bg-violet-100 dark:border-violet-900/70 dark:bg-violet-950/40 dark:text-violet-200"
            aria-label="Add with AI"
            title="Add with AI"
          >
            <Sparkles size={18} />
          </button>
          <select
            value={selectedCycleId}
            onChange={(event) => setSelectedCycleId(event.target.value)}
            aria-label="Select financial cycle"
            className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-xs font-bold text-zinc-900 outline-none transition focus:border-[var(--accent)] dark:border-zinc-800 dark:bg-[#0d0d18] dark:text-white sm:min-w-[260px]"
          >
            <option value="current">{displayRange(range.start, range.end)} (current)</option>
            {data.cycleSnapshots
              .slice()
              .sort((a, b) => b.end.localeCompare(a.end))
              .map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id}>
                  {displayRange(snapshot.start, snapshot.end)}
                </option>
              ))}
          </select>
        </div>
      </section>

      {aiOpen && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
          <AiAddPanel data={data} update={update} syncUser={syncUser} />
        </motion.div>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="flex min-h-[230px] flex-col justify-between rounded-lg border border-zinc-200 bg-white p-4 shadow-[0_18px_55px_rgba(15,23,42,0.08)] dark:border-[#202033] dark:bg-[#11111c] sm:p-5">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black text-zinc-600 dark:text-zinc-200">{isHistorical ? "Cycle snapshot" : "Money left"}</p>
                <p className="mt-1 text-sm font-bold text-zinc-500 dark:text-zinc-400">Income - expenses</p>
              </div>
              <span className="rounded-md bg-zinc-100 px-2 py-1 text-[10px] font-black text-zinc-500 dark:bg-[#25253a] dark:text-zinc-300">
                {totals.income ? `${Math.max(0, (totals.moneyLeft / totals.income) * 100).toFixed(0)}% left` : "0% left"}
              </span>
            </div>
            <p className="mt-3 text-3xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-4xl">{money(totals.moneyLeft, data.settings.currency)}</p>
            <p className="mt-2 max-w-md text-xs font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400">
              {isHistorical ? "Read-only dashboard values from this saved financial cycle." : "Includes carry-over, income, expenses, savings deposits, and investment contributions."}
            </p>
            <CompactIncomeExpenseBar hideIncome={data.settings.hideHeroIncome} income={totals.income} expenses={totals.expenses} currency={data.settings.currency} />
          </div>
          <div className="space-y-4 pt-5">
            {!isHistorical && <MonthProgress start={range.start} end={range.end} />}
          </div>
        </div>
        <NetWorthHero hideNetWorth={data.settings.hideHeroNetWorth} totals={totals} currency={data.settings.currency} />
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Wallet} label="Total income" value={incomeValue} hint="cycle" />
        <StatCard icon={CreditCard} label="Total expenses" value={money(totals.expenses, data.settings.currency)} hint="cycle" note={expenseInsight} />
        <StatCard icon={Landmark} label="Savings / Investments" value={privateBalanceValue || money(totals.savingsInvestments, data.settings.currency)} hint="cycle" note={savingsInsight} />
        <StatCard icon={BarChart3} label="Savings/Investments + expenses" value={privateBalanceValue || money(totals.savingsInvestmentsExpenses, data.settings.currency)} hint="cycle" />
        <StatCard icon={TrendingUp} label="Net worth" value={netWorthValue} hint="saved + invested + balance" />
        <StatCard icon={CalendarDays} label="Safe to spend per day" value={money(totals.safeToSpend, data.settings.currency)} hint={`${totals.daysLeft} days`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <ChartCard title="Income vs expenses" icon={BarChart3}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={flowData} margin={{ top: 18, right: 18, left: 18, bottom: 8 }}>
              <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 12, fill: "var(--chart-text)" }} />
              <YAxis width={72} tickLine={false} axisLine={false} tick={{ fill: "var(--chart-text)" }} tickFormatter={(value) => money(value, data.settings.currency)} />
              <Tooltip
                formatter={(value, _name, props) => (data.settings.hideHeroIncome && props?.payload?.name === "Income" ? maskedMoney(data.settings.currency) : money(value, data.settings.currency))}
                cursor={{ fill: "rgba(4,120,87,0.08)" }}
                contentStyle={chartTooltipStyle}
                labelStyle={chartTooltipLabelStyle}
                itemStyle={chartTooltipItemStyle}
              />
              <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                {flowData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Expense breakdown"
          icon={PieChart}
          action={
            <Toggle
              checked={data.settings.showExpenseLegend}
              label="Show key"
              onChange={(checked) =>
                update((draft) => {
                  draft.settings.showExpenseLegend = checked;
                  return draft;
                })
              }
            />
          }
        >
          {byCategory.length ? (
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <ResponsiveContainer width="100%" height={230}>
                <RPieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={54} outerRadius={86} paddingAngle={3}>
                    {byCategory.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                  <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" className="fill-zinc-950 text-base font-black dark:fill-zinc-50">
                    {money(expenseTotal, data.settings.currency)}
                  </text>
                  <text x="50%" y="56%" textAnchor="middle" dominantBaseline="middle" className="fill-zinc-500 text-xs font-bold dark:fill-zinc-400">
                    Total
                  </text>
                  <Tooltip formatter={(value) => money(value, data.settings.currency)} contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} itemStyle={chartTooltipItemStyle} />
                </RPieChart>
              </ResponsiveContainer>
              {data.settings.showExpenseLegend && (
                <div className="flex flex-wrap content-start gap-2 md:block md:space-y-2">
                  {byCategory.map((item) => (
                    <span key={item.name} className="inline-flex items-center gap-2 rounded-md bg-zinc-100 px-3 py-2 text-xs font-bold text-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.name} {money(item.value, data.settings.currency)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Empty text="Add expenses to see category breakdown." />
          )}
        </ChartCard>
      </section>

      <ChartCard title="Recent transactions" icon={CreditCard}>
        <div className="space-y-2">
          {recentTransactions.map((item) => (
            <div key={`${item.group}-${item.id}`} className="flex items-center justify-between gap-3 rounded-lg bg-zinc-50 p-3 dark:bg-[#0d0d18]">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] dark:bg-[#21152d]">
                  <CreditCard size={15} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-zinc-900 dark:text-white">{item.title}</p>
                  <p className="truncate text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    {item.group} - {item.subtitle}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{displayDate(item.date)}</p>
                <p className="text-sm font-black" style={{ color: item.sign >= 0 ? "var(--accent)" : "var(--expense)" }}>
                  {item.group === "Income" && data.settings.hideHeroIncome ? maskedMoney(data.settings.currency) : `${item.sign >= 0 ? "" : "-"}${money(item.amount, data.settings.currency)}`}
                </p>
              </div>
            </div>
          ))}
          {!recentTransactions.length && <Empty text="No transactions yet." />}
        </div>
      </ChartCard>

    </div>
  );
}

function MonthProgress({ start, end }) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  const currentDate = parseDate(today());
  const totalDays = Math.max(1, Math.ceil((endDate - startDate) / 86400000) + 1);
  const elapsed = Math.min(totalDays, Math.max(1, Math.ceil((currentDate - startDate) / 86400000) + 1));
  const percent = Math.min(100, Math.max(0, (elapsed / totalDays) * 100));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-[0.08em] text-zinc-700 dark:text-zinc-100">
        <span>Month progress</span>
        <span>{percent.toFixed(0)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-[#3f3f4a]">
        <span className="block h-full rounded-full bg-[var(--money-left)]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function CompactIncomeExpenseBar({ income, expenses, currency, hideIncome = false }) {
  const total = Math.max(1, Number(income || 0) + Number(expenses || 0));
  const incomePercent = Math.max(0, Math.min(100, (Number(income || 0) / total) * 100));
  const expensePercent = Math.max(0, Math.min(100, (Number(expenses || 0) / total) * 100));

  return (
    <div className="mt-4 rounded-lg bg-zinc-50 p-3 dark:bg-[#0d0d18]">
      <div className="mb-2 grid grid-cols-2 gap-3 text-xs">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-bold text-zinc-500 dark:text-zinc-400">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--graph-income)" }} />
            Income
          </p>
          <p className="mt-1 truncate font-black text-zinc-950 dark:text-white">{hideIncome ? maskedMoney(currency) : money(income, currency)}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="flex items-center justify-end gap-2 font-bold text-zinc-500 dark:text-zinc-400">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--graph-expense)" }} />
            Expenses
          </p>
          <p className="mt-1 truncate font-black text-zinc-950 dark:text-white">{money(expenses, currency)}</p>
        </div>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-[#303044]">
        <span className="h-full" style={{ width: `${incomePercent}%`, backgroundColor: "var(--graph-income)" }} />
        <span className="h-full" style={{ width: `${expensePercent}%`, backgroundColor: "var(--graph-expense)" }} />
      </div>
    </div>
  );
}

function NetWorthHero({ totals, currency, hideNetWorth = false }) {
  const netWorthValue = hideNetWorth ? maskedMoney(currency) : money(totals.netWorth, currency);
  const savedValue = hideNetWorth ? maskedMoney(currency) : money(totals.currentSaved, currency);
  const investedValue = hideNetWorth ? maskedMoney(currency) : money(totals.currentInvested, currency);
  const balanceValue = hideNetWorth ? maskedMoney(currency) : money(totals.moneyLeft, currency);

  return (
    <div className="flex min-h-[190px] flex-col justify-between rounded-lg border border-zinc-200 bg-white p-4 shadow-[0_18px_55px_rgba(15,23,42,0.08)] dark:border-[#202033] dark:bg-[#11111c] sm:p-5">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-zinc-600 dark:text-zinc-200">Net worth</p>
            <p className="mt-2 text-3xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-4xl">{netWorthValue}</p>
            <p className="mt-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Saved + invested + balance</p>
          </div>
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)] dark:bg-[#25253a] dark:text-zinc-100">
            <TrendingUp size={18} />
          </div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <div className="min-w-0 rounded-lg bg-zinc-50 p-2 dark:bg-[#0d0d18]">
          <p className="truncate text-[10px] font-black uppercase tracking-[0.06em] text-zinc-500 dark:text-zinc-400">Saved</p>
          <p className="mt-1 truncate text-sm font-black text-zinc-950 dark:text-white">{savedValue}</p>
        </div>
        <div className="min-w-0 rounded-lg bg-zinc-50 p-2 dark:bg-[#0d0d18]">
          <p className="truncate text-[10px] font-black uppercase tracking-[0.06em] text-zinc-500 dark:text-zinc-400">Invested</p>
          <p className="mt-1 truncate text-sm font-black text-zinc-950 dark:text-white">{investedValue}</p>
        </div>
        <div className="min-w-0 rounded-lg bg-zinc-50 p-2 dark:bg-[#0d0d18]">
          <p className="truncate text-[10px] font-black uppercase tracking-[0.06em] text-zinc-500 dark:text-zinc-400">Balance</p>
          <p className="mt-1 truncate text-sm font-black text-zinc-950 dark:text-white">{balanceValue}</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint, note }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-zinc-200 bg-white p-3 shadow-[0_12px_35px_rgba(24,24,27,0.07)] dark:border-[#202033] dark:bg-[#11111c] sm:p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-2 sm:mb-4 sm:gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] dark:bg-[#21152d] dark:text-[var(--accent)] sm:h-10 sm:w-10">
          <Icon size={17} />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400 sm:text-xs">{hint}</span>
      </div>
      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 sm:text-sm">{label}</p>
      <p className="mt-1 break-words text-lg font-black tracking-tight text-zinc-950 dark:text-white sm:text-2xl">{value}</p>
      {note && <p className="mt-3 text-xs font-bold text-[var(--accent-strong)] dark:text-zinc-300">{note}</p>}
    </motion.div>
  );
}

function ChartCard({ title, icon: Icon, children, action }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-[0_12px_35px_rgba(24,24,27,0.07)] dark:border-[#202033] dark:bg-[#11111c] sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="text-[var(--accent)] dark:text-white" size={18} />
          <h3 className="font-bold">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }) {
  return (
    <div className="flex min-h-[150px] items-center justify-center rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm font-medium text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
      {text}
    </div>
  );
}

function FormError({ text }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-200">
      {text}
    </div>
  );
}

function snapToForm(ref, setHighlight) {
  requestAnimationFrame(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlight?.(true);
    window.setTimeout(() => setHighlight?.(false), 1200);
  });
}

function normalizeAiType(parsed) {
  const raw = String(parsed?.transactionType || parsed?.type || parsed?.kind || "").toLowerCase();
  if (raw.includes("saving") && raw.includes("withdraw")) return "saving_withdrawal";
  if (raw.includes("saving")) return "saving_deposit";
  if (raw.includes("investment") && raw.includes("withdraw")) return "investment_withdrawal";
  if (raw.includes("investment")) return "investment_contribution";
  if (raw.includes("income")) return "income";
  if (raw.includes("expense")) return "expense";
  return raw;
}

function normalizeAiFrequency(parsed) {
  const raw = String(parsed?.frequency || "").toLowerCase();
  if (raw.includes("week")) return "Weekly";
  if (raw.includes("year") || raw.includes("annual")) return "Yearly";
  if (raw.includes("custom")) return "Custom";
  return "Monthly";
}

function aiWarnings(parsed) {
  return Array.isArray(parsed?.warnings) ? parsed.warnings.filter(Boolean) : [];
}

function aiConfidence(parsed) {
  return Number(parsed?.confidence || 0);
}

function aiUsageDocId() {
  return today();
}

function normalizeAiParseResponse(result) {
  const transactions = Array.isArray(result?.transactions) ? result.transactions : [result].filter(Boolean);
  return {
    transactions: transactions.slice(0, 5),
    overallConfidence: Number(result?.overallConfidence ?? transactions[0]?.confidence ?? 0),
    warnings: Array.isArray(result?.warnings) ? result.warnings.filter(Boolean) : [],
    usage: result?.usage || null,
  };
}

function aiReviewItem(parsed) {
  return {
    id: uid(),
    selected: true,
    parsed: {
      transactionType: normalizeAiType(parsed) || "expense",
      title: parsed?.title || "",
      amount: parsed?.amount || "",
      date: parsed?.date || today(),
      category: parsed?.category || "",
      accountName: parsed?.accountName || "",
      isRecurring: Boolean(parsed?.isRecurring),
      frequency: parsed?.frequency || "none",
      notes: parsed?.notes || "",
      confidence: Number(parsed?.confidence || 0),
      warnings: aiWarnings(parsed),
      lockedLedger: Boolean(parsed?.lockedLedger),
      ledgerKind: parsed?.ledgerKind || "cash",
    },
  };
}

function hasRequiredAiFields(parsed, data) {
  const transactionType = resolveAiTransactionType(parsed, data);
  if (!parsed?.amount || !parsed?.date || !parsed?.title) return false;
  if ((transactionType === "expense" || transactionType === "income") && !parsed?.category) return false;
  if (transactionType.startsWith("saving")) return Boolean(findAccountMatch(data.savingGoals, parsed.accountName || parsed.title || parsed.category));
  if (transactionType.startsWith("investment")) return Boolean(findAccountMatch(data.investments, parsed.accountName || parsed.title || parsed.category));
  return true;
}

function normalizeAccountText(value) {
  return String(value || "").trim().toLowerCase();
}

function findAccountMatch(items, accountName) {
  const normalized = normalizeAccountText(accountName);
  if (!normalized) return null;
  return items.find((item) => {
    const name = normalizeAccountText(item.name);
    return name && (name === normalized || normalized.includes(name) || name.includes(normalized));
  }) || null;
}

function accountIdByName(items, accountName) {
  return findAccountMatch(items, accountName)?.id || items[0]?.id || "";
}

function resolveAiTransactionType(parsed, data) {
  const transactionType = normalizeAiType(parsed) || "expense";
  if (transactionType.startsWith("saving") || transactionType.startsWith("investment")) return transactionType;

  const text = [parsed?.accountName, parsed?.title, parsed?.category, parsed?.notes].join(" ");
  const isWithdrawal = /\b(withdraw|withdrew|take out|transfer out|remove)\b/i.test(text);
  if (findAccountMatch(data.savingGoals, text)) return isWithdrawal ? "saving_withdrawal" : "saving_deposit";
  if (findAccountMatch(data.investments, text)) return isWithdrawal ? "investment_withdrawal" : "investment_contribution";
  return transactionType;
}

function resolveAiLedgerLock(parsed, data) {
  const text = [parsed?.accountName, parsed?.title, parsed?.category, parsed?.notes].join(" ");
  const transactionType = resolveAiTransactionType(parsed, data);
  const savingGoal = findAccountMatch(data.savingGoals, text);
  const investment = findAccountMatch(data.investments, text);

  if (investment && transactionType.startsWith("investment")) {
    return {
      locked: true,
      accountName: investment.name,
      transactionType,
      kind: "investment",
    };
  }

  if (savingGoal && transactionType.startsWith("saving")) {
    return {
      locked: true,
      accountName: savingGoal.name,
      transactionType,
      kind: "saving",
    };
  }

  return {
    locked: false,
    accountName: parsed?.accountName || parsed?.category || parsed?.title || "",
    transactionType,
    kind: transactionType.startsWith("investment") ? "investment" : transactionType.startsWith("saving") ? "saving" : "cash",
  };
}

function transactionSortKey(item) {
  return `${item.date || ""}T${String(item.createdAt || item.appliedAt || "00:00:00").slice(11, 19)}`;
}

function AiAddPanel({ data, update, syncUser }) {
  const [aiText, setAiText] = useState("");
  const [aiStatus, setAiStatus] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiReviewItems, setAiReviewItems] = useState([]);
  const [aiResponseWarnings, setAiResponseWarnings] = useState([]);
  const [aiUsage, setAiUsage] = useState({ count: 0, remaining: 30, limit: 30, bypass: false });
  const [aiAutoConfirm, setAiAutoConfirm] = useState(() => localStorage.getItem(AI_AUTO_CONFIRM_KEY) === "true");

  useEffect(() => {
    localStorage.setItem(AI_AUTO_CONFIRM_KEY, String(aiAutoConfirm));
  }, [aiAutoConfirm]);

  useEffect(() => {
    if (!syncUser?.uid) {
      setAiUsage({ count: 0, remaining: 30, limit: 30, bypass: false });
      return undefined;
    }

    return onSnapshot(doc(db, "users", syncUser.uid, "aiUsage", aiUsageDocId()), (snapshot) => {
      const count = Number(snapshot.data()?.count || 0);
      setAiUsage({
        count,
        remaining: Math.max(0, 30 - count),
        limit: 30,
        bypass: false,
      });
    });
  }, [syncUser?.uid]);

  const bumpUsage = (usage) => {
    if (usage) {
      setAiUsage(usage);
      return;
    }
    setAiUsage((current) => {
      if (current.bypass) return current;
      const count = Math.min(current.limit, Number(current.count || 0) + 1);
      return { ...current, count, remaining: Math.max(0, current.limit - count) };
    });
  };

  const makeReviewItem = (transaction) => {
    const lock = resolveAiLedgerLock(transaction, data);
    return aiReviewItem({
      ...transaction,
      transactionType: lock.transactionType,
      accountName: lock.accountName,
      lockedLedger: lock.locked,
      ledgerKind: lock.kind,
    });
  };

  const saveParsedResult = (parsed) => {
    const transactionType = resolveAiTransactionType(parsed, data);
    const amount = parseAmount(parsed.amount);
    const date = parsed.date || today();
    const status = getTransactionStatus(date);
    const createdAt = new Date().toISOString();
    update((draft) => {
      if (parsed.isRecurring && (transactionType === "income" || transactionType === "expense")) {
        const category = data.categories.includes(parsed.category) ? parsed.category : data.categories[0] || "Groceries";
        draft.recurring.push({
          id: uid(),
          kind: transactionType,
          title: parsed.title || (transactionType === "income" ? parsed.category || "Income" : category),
          amount,
          category,
          type: parsed.category || "Salary",
          startDate: date,
          frequency: normalizeAiFrequency(parsed),
          customDays: 30,
          notes: parsed.notes || "",
          active: true,
          createdAt,
        });
        return draft;
      }
      if (transactionType === "income") {
        draft.incomes.push({ id: uid(), name: parsed.title || parsed.category || "Income", amount, date, type: parsed.category || "Salary", notes: parsed.notes || "", status, appliedAt: appliedAtFor(status, date), createdAt });
      }
      if (transactionType === "expense") {
        const category = data.categories.includes(parsed.category) ? parsed.category : data.categories[0] || "Groceries";
        draft.expenses.push({ id: uid(), title: parsed.title || category, amount, date, category, paymentMethod: "Card", notes: parsed.notes || "", status, appliedAt: appliedAtFor(status, date), createdAt });
      }
      if (transactionType === "saving_deposit" || transactionType === "saving_withdrawal") {
        const accountText = [parsed.accountName, parsed.title, parsed.category, parsed.notes].join(" ");
        const accountName = parsed.accountName || parsed.title || "Saving goal";
        let goal = findAccountMatch(draft.savingGoals, accountText);
        if (!goal) {
          goal = {
            id: uid(),
            name: accountName,
            goalAmount: 0,
            goalDate: formatDate(new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate())),
            openingBalance: 0,
            currentBalance: 0,
            notes: "Created from AI",
            createdAt,
          };
          draft.savingGoals.push(goal);
        }
        const type = transactionType === "saving_withdrawal" ? "withdrawal" : "deposit";
        draft.savingTransactions.push({ id: uid(), savingGoalId: goal.id, type, amount, date, comment: parsed.notes || parsed.title || "", status, appliedAt: appliedAtFor(status, date), createdAt });
        if (goal && status === "applied") goal.currentBalance = Math.max(0, Number(goal.currentBalance || 0) + movementDelta(type, amount));
      }
      if (transactionType === "investment_contribution" || transactionType === "investment_withdrawal") {
        const accountText = [parsed.accountName, parsed.title, parsed.category, parsed.notes].join(" ");
        const accountName = parsed.accountName || parsed.title || "Investment";
        let investment = findAccountMatch(draft.investments, accountText);
        if (!investment) {
          investment = {
            id: uid(),
            name: accountName,
            type: parsed.category || "Other",
            currentBalance: 0,
            monthlyContribution: 0,
            annualReturn: 0,
            notes: "Created from AI",
            createdAt,
          };
          draft.investments.push(investment);
        }
        const type = transactionType === "investment_withdrawal" ? "withdrawal" : "contribution";
        draft.investmentTransactions.push({ id: uid(), investmentId: investment.id, type, amount, date, comment: parsed.notes || parsed.title || "", status, appliedAt: appliedAtFor(status, date), affectsCash: true, createdAt });
        if (investment && status === "applied") investment.currentBalance = Math.max(0, Number(investment.currentBalance || 0) + contributionDelta(type, amount));
      }
      return draft;
    });
  };

  const parseWithAi = async () => {
    if (!syncUser) {
      setAiStatus("Please sign in to use AI transaction parsing.");
      return;
    }
    const trimmed = aiText.trim();
    if (!trimmed) {
      setAiStatus("Type a transaction first.");
      return;
    }
    if (trimmed.length > AI_PROMPT_LIMIT) {
      setAiStatus(`Keep the AI prompt under ${AI_PROMPT_LIMIT} characters.`);
      return;
    }

    setAiBusy(true);
    setAiStatus("Adding with AI...");
    setAiReviewItems([]);
    setAiResponseWarnings([]);
    try {
      const response = normalizeAiParseResponse(await parseNaturalTransaction({
        text: trimmed,
        currency: data.settings.currency,
        categories: data.categories,
        savingGoals: data.savingGoals.map((item) => item.name),
        investments: data.investments.map((item) => item.name),
      }));
      const reviewItems = response.transactions.map(makeReviewItem);
      const safeItems = reviewItems.filter((item) =>
        aiConfidence(item.parsed) >= 0.85 &&
        !aiWarnings(item.parsed).length &&
        hasRequiredAiFields(item.parsed, data),
      );
      const needsReview = reviewItems.filter((item) => !safeItems.includes(item));

      bumpUsage(response.usage);
      setAiText("");
      setAiResponseWarnings(response.warnings);

      if (aiAutoConfirm && safeItems.length) {
        safeItems.forEach((item) => saveParsedResult(item.parsed));
      }

      setAiReviewItems(aiAutoConfirm ? needsReview : reviewItems);
      if (aiAutoConfirm) {
        setAiStatus(needsReview.length ? `${safeItems.length} transactions saved, ${needsReview.length} needs review.` : `${safeItems.length} transaction${safeItems.length === 1 ? "" : "s"} saved.`);
      } else {
        setAiStatus(reviewItems.length > 1 ? "Review the AI results before saving." : "Review this AI result before saving.");
      }
    } catch (error) {
      console.error(error);
      setAiStatus(error?.message || "AI parsing failed. Please reword it and try again.");
    } finally {
      setAiBusy(false);
    }
  };

  const updateAiReviewItem = (id, patch) => {
    setAiReviewItems((items) =>
      items.map((item) =>
        item.id === id ? { ...item, parsed: { ...item.parsed, ...patch } } : item,
      ),
    );
  };

  const confirmAiItems = (items) => {
    if (!items.length) {
      setAiStatus("Select at least one AI result to save.");
      return;
    }

    items.forEach((item) => saveParsedResult(item.parsed));
    setAiReviewItems((current) => current.filter((item) => !items.some((saved) => saved.id === item.id)));
    setAiStatus(`${items.length} transaction${items.length === 1 ? "" : "s"} saved.`);
  };

  const confirmCurrentAiItem = () => {
    const current = aiReviewItems[0];
    if (!current) return;
    saveParsedResult(current.parsed);
    setAiReviewItems((items) => items.slice(1));
    setAiStatus(aiReviewItems.length > 1 ? "Transaction saved. Review the next one." : "Transaction saved.");
  };

  const removeCurrentAiItem = () => {
    setAiReviewItems((items) => items.slice(1));
    setAiStatus(aiReviewItems.length > 1 ? "Skipped. Review the next one." : "Skipped.");
  };

  const currentReviewItem = aiReviewItems[0];

  return (
    <Panel title="Add with AI">
      <div className="grid gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-xs font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 sm:grid-cols-[1fr_auto] sm:items-center">
        <span>{syncUser ? `Signed in as ${syncUser.displayName || syncUser.email}` : "Please sign in to use AI transaction parsing."}</span>
        <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-[var(--accent-strong)] dark:bg-zinc-950">
          {aiUsage.bypass ? "Developer bypass" : `${aiUsage.count} used / ${aiUsage.remaining} left`}
        </span>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-zinc-500 dark:text-zinc-400">Describe transactions</span>
        <textarea
          value={aiText}
          maxLength={AI_PROMPT_LIMIT}
          onChange={(event) => setAiText(event.target.value)}
          rows={3}
          placeholder={"Example: Spent R450 on fuel yesterday and R200 on food today"}
          className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50/90 p-3 text-sm font-semibold text-zinc-950 shadow-inner outline-none transition placeholder:text-zinc-400 focus:border-[var(--accent)] focus:bg-white focus:ring-4 focus:ring-[var(--accent-soft)] dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-50 dark:focus:bg-zinc-950"
        />
        <span className={cx("mt-1.5 block text-right text-xs font-black", aiText.length >= AI_PROMPT_LIMIT ? "text-amber-600 dark:text-amber-300" : "text-zinc-500 dark:text-zinc-400")}>
          {aiText.length} / {AI_PROMPT_LIMIT}
        </span>
      </label>
      <label className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-950">
        <span>
          <span className="block text-sm font-black text-zinc-950 dark:text-white">Auto-confirm AI result</span>
          <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400">Only high-confidence results with no warnings save automatically.</span>
        </span>
        <button
          type="button"
          aria-pressed={aiAutoConfirm}
          className={cx("h-7 w-12 rounded-full p-1 transition", aiAutoConfirm ? "bg-[var(--accent-strong)]" : "bg-zinc-200 dark:bg-zinc-800")}
          onClick={() => {
            if (!aiAutoConfirm && !window.confirm("Auto-confirm will save high-confidence AI transactions without manual review. Continue?")) return;
            setAiAutoConfirm(!aiAutoConfirm);
          }}
        >
          <span className={cx("block h-5 w-5 rounded-full bg-white shadow-sm transition", aiAutoConfirm && "translate-x-5")} />
        </button>
      </label>
      <Button onClick={parseWithAi} disabled={aiBusy || !syncUser || !aiText.trim() || aiText.trim().length > AI_PROMPT_LIMIT}>
        <Sparkles size={16} /> {aiBusy ? "Adding..." : "Add with AI"}
      </Button>
      {aiStatus && <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">{aiStatus}</p>}
      {Boolean(aiResponseWarnings.length) && <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{aiResponseWarnings.join(" ")}</p>}
      {Boolean(currentReviewItem) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-lg bg-zinc-50 px-3 py-2 text-xs font-black text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
            <span>Review {1} of {aiReviewItems.length}</span>
            <span>{aiReviewItems.length > 1 ? `${aiReviewItems.length - 1} waiting` : "Last item"}</span>
          </div>
          {(() => {
            const item = currentReviewItem;
            const parsed = currentReviewItem.parsed;
            const confidence = aiConfidence(parsed);
            const warnings = aiWarnings(parsed);
            return (
              <div className={cx("rounded-lg border bg-white p-2.5 text-xs font-semibold dark:bg-zinc-950", confidence < 0.75 || warnings.length ? "border-amber-300 text-amber-800 dark:border-amber-500/50 dark:text-amber-200" : "border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300")}>
                <div className="mb-2.5 flex items-start justify-between gap-2">
                  <div className="min-w-0 text-sm font-black text-zinc-900 dark:text-white">
                    <span className="truncate">{parsed.title || "AI item"}</span>
                    <p className="mt-0.5 text-[10px] font-black uppercase text-zinc-400">{parsed.transactionType.replaceAll("_", " ")}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-md bg-[var(--accent-soft)] px-2 py-1 font-black text-[var(--accent-strong)]">
                      {Math.round(confidence * 100)}%
                    </span>
                    <TinyIconButton label="Skip AI result" onClick={removeCurrentAiItem}>
                      <Trash2 size={14} />
                    </TinyIconButton>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Select
                    label="Type"
                    value={parsed.transactionType}
                    options={parsed.lockedLedger ? [parsed.transactionType] : ["income", "expense", "saving_deposit", "saving_withdrawal", "investment_contribution", "investment_withdrawal"]}
                    onChange={(value) => updateAiReviewItem(item.id, { transactionType: value })}
                    disabled={parsed.lockedLedger}
                  />
                  <Input label="Title" value={parsed.title} onChange={(value) => updateAiReviewItem(item.id, { title: value })} />
                  <AmountInput label="Amount" value={String(parsed.amount)} onChange={(value) => updateAiReviewItem(item.id, { amount: value })} />
                  <DateInput label="Date" value={parsed.date} onChange={(value) => updateAiReviewItem(item.id, { date: value })} />
                  <Input
                    label={parsed.ledgerKind === "investment" ? "Investment account" : parsed.ledgerKind === "saving" ? "Saving goal" : "Category / account"}
                    value={parsed.accountName || parsed.category}
                    onChange={(value) => updateAiReviewItem(item.id, { category: value, accountName: value })}
                    disabled={parsed.lockedLedger}
                  />
                  <Select label="Frequency" value={parsed.frequency || "none"} options={["none", "weekly", "monthly", "yearly"]} onChange={(value) => updateAiReviewItem(item.id, { frequency: value, isRecurring: value !== "none" })} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded bg-zinc-100 px-2 py-1 font-black uppercase text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">{parsed.transactionType.replaceAll("_", " ")}</span>
                  <span className="rounded bg-zinc-100 px-2 py-1 font-black text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">{parsed.isRecurring ? "Recurring" : "Once-off"}</span>
                  {warnings.map((warning) => (
                    <span key={warning} className="rounded bg-amber-100 px-2 py-1 font-black text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">{warning}</span>
                  ))}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Button onClick={confirmCurrentAiItem}>
                    <CheckCircle2 size={16} /> Add This
                  </Button>
                  <Button variant="secondary" onClick={removeCurrentAiItem}>
                    Skip
                  </Button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </Panel>
  );
}

function Transactions({ data, update, syncUser, setTab, setAiDraft }) {
  const [kind, setKind] = useState("expense");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [aiText, setAiText] = useState("");
  const [aiStatus, setAiStatus] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiReviewItems, setAiReviewItems] = useState([]);
  const [aiResponseWarnings, setAiResponseWarnings] = useState([]);
  const [aiUsage, setAiUsage] = useState({ count: 0, remaining: 30, limit: 30, bypass: false });
  const [aiAutoConfirm, setAiAutoConfirm] = useState(() => localStorage.getItem(AI_AUTO_CONFIRM_KEY) === "true");
  const [aiReviewFields, setAiReviewFields] = useState([]);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [showAllRecurring, setShowAllRecurring] = useState(false);
  const [formError, setFormError] = useState("");
  const [recurringError, setRecurringError] = useState("");
  const [editingTransactionId, setEditingTransactionId] = useState("");
  const [highlightTransactionForm, setHighlightTransactionForm] = useState(false);
  const [highlightRecurringForm, setHighlightRecurringForm] = useState(false);
  const transactionFormRef = useRef(null);
  const recurringFormRef = useRef(null);
  const [form, setForm] = useState({
    title: "",
    amount: "",
    date: today(),
    category: data.categories[0] || "Groceries",
    type: "Salary",
    notes: "",
  });
  const [recurringForm, setRecurringForm] = useState({
    kind: "expense",
    title: "",
    amount: "",
    category: data.categories.includes("Subscriptions") ? "Subscriptions" : data.categories[0] || "Groceries",
    type: "Salary",
    startDate: today(),
    frequency: "Monthly",
    customDays: 30,
    notes: "",
  });
  const [editingRecurringId, setEditingRecurringId] = useState("");

  useEffect(() => {
    localStorage.setItem(AI_AUTO_CONFIRM_KEY, String(aiAutoConfirm));
  }, [aiAutoConfirm]);

  useEffect(() => {
    if (!syncUser?.uid) {
      setAiUsage({ count: 0, remaining: 30, limit: 30, bypass: false });
      return undefined;
    }

    return onSnapshot(doc(db, "users", syncUser.uid, "aiUsage", aiUsageDocId()), (snapshot) => {
      const count = Number(snapshot.data()?.count || 0);
      setAiUsage({
        count,
        remaining: Math.max(0, 30 - count),
        limit: 30,
        bypass: false,
      });
    });
  }, [syncUser?.uid]);

  const items = useMemo(
    () => {
      const savingNames = Object.fromEntries(data.savingGoals.map((item) => [item.id, item.name]));
      const investmentNames = Object.fromEntries(data.investments.map((item) => [item.id, item.name]));
      return [
        ...data.incomes.filter(isApplied).map((item) => ({ ...item, group: "Income", title: item.name || item.type, subtitle: item.recurringId ? `Recurring - ${item.type}` : item.type, sign: 1 })),
        ...data.expenses.filter(isApplied).map((item) => ({ ...item, group: "Expenses", title: item.title || item.category, subtitle: item.recurringId ? `Recurring - ${item.category}` : item.category, sign: -1 })),
        ...data.savingTransactions.filter(isApplied).map((item) => ({
          ...item,
          group: "Savings",
          title: item.type === "withdrawal" ? "Savings withdrawal" : "Savings deposit",
          subtitle: savingNames[item.savingGoalId] || "Saving goal",
          sign: item.type === "withdrawal" ? 1 : -1,
        })),
        ...data.investmentTransactions
          .filter((item) => isApplied(item) && item.affectsCash !== false)
          .map((item) => ({
            ...item,
            group: "Investments",
            title: item.type === "withdrawal" ? "Investment withdrawal" : "Investment contribution",
            subtitle: item.recurringId ? `Recurring - ${investmentNames[item.investmentId] || "Investment"}` : investmentNames[item.investmentId] || "Investment",
            sign: item.type === "withdrawal" ? 1 : -1,
          })),
      ]
        .filter((item) => filter === "All" || item.group === filter)
        .filter((item) => [item.title, item.name, item.notes, item.comment, item.category, item.type, item.subtitle].join(" ").toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => transactionSortKey(b).localeCompare(transactionSortKey(a)));
    },
    [data.expenses, data.incomes, data.investmentTransactions, data.investments, data.savingGoals, data.savingTransactions, filter, query],
  );
  const shownItems = showAllTransactions ? items : items.slice(0, SHOW_LIMIT);
  const upcomingItems = useMemo(
    () => {
      const savingNames = Object.fromEntries(data.savingGoals.map((item) => [item.id, item.name]));
      const investmentNames = Object.fromEntries(data.investments.map((item) => [item.id, item.name]));
      return [
        ...data.incomes.filter((item) => !isApplied(item)).map((item) => ({
          ...item,
          source: "pending",
          group: "Income",
          title: item.name || item.type,
          subtitle: item.type,
          dueDate: item.date,
          sign: 1,
        })),
        ...data.expenses.filter((item) => !isApplied(item)).map((item) => ({
          ...item,
          source: "pending",
          group: "Expenses",
          title: item.title || item.category,
          subtitle: item.category,
          dueDate: item.date,
          sign: -1,
        })),
        ...data.savingTransactions.filter((item) => !isApplied(item)).map((item) => ({
          ...item,
          source: "pending",
          group: "Savings",
          title: item.type === "withdrawal" ? "Savings withdrawal" : "Savings deposit",
          subtitle: savingNames[item.savingGoalId] || "Saving goal",
          dueDate: item.date,
          sign: item.type === "withdrawal" ? 1 : -1,
        })),
        ...data.investmentTransactions.filter((item) => !isApplied(item) && item.affectsCash !== false).map((item) => ({
          ...item,
          source: "pending",
          group: "Investments",
          title: item.type === "withdrawal" ? "Investment withdrawal" : "Investment contribution",
          subtitle: investmentNames[item.investmentId] || "Investment",
          dueDate: item.date,
          sign: item.type === "withdrawal" ? 1 : -1,
        })),
        ...data.recurring.map((item) => ({
          ...item,
          source: "recurring",
          group: item.kind === "income" ? "Income" : "Expenses",
          title: item.title || item.type || item.category || "Recurring item",
          subtitle: item.kind === "income" ? item.type : item.category,
          dueDate: nextDueDate(item.startDate, item.frequency, item.customDays),
          sign: item.kind === "income" ? 1 : -1,
        })),
      ].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    },
    [data.expenses, data.incomes, data.investmentTransactions, data.investments, data.recurring, data.savingGoals, data.savingTransactions],
  );
  const shownUpcoming = showAllRecurring ? upcomingItems : upcomingItems.slice(0, SHOW_LIMIT);

  const resetTransactionForm = () => {
    setEditingTransactionId("");
    setForm({ title: "", amount: "", date: today(), category: form.category, type: form.type, notes: "" });
    setFormError("");
  };

  const cancelTransactionEdit = () => {
    resetTransactionForm();
    setShowTransactionForm(false);
  };

  const resetRecurringForm = () => {
    setEditingRecurringId("");
    setRecurringForm({
      kind: recurringForm.kind,
      title: "",
      amount: "",
      category: recurringForm.category,
      type: recurringForm.type,
      startDate: today(),
      frequency: recurringForm.frequency,
      customDays: recurringForm.customDays,
      notes: "",
    });
    setRecurringError("");
  };

  const cancelRecurringEdit = () => {
    resetRecurringForm();
    setShowRecurringForm(false);
  };

  const applyParsedResult = (parsed) => {
    const transactionType = normalizeAiType(parsed);
    const amount = parsed.amount ? formatAmount(parsed.amount).replace(/\.00$/, "") : "";
    const frequency = normalizeAiFrequency(parsed);
    const category = data.categories.includes(parsed.category) ? parsed.category : data.categories[0] || "Groceries";
    const canUseRecurringForm = parsed.isRecurring && (transactionType === "income" || transactionType === "expense");

    if (canUseRecurringForm) {
      const recurringKind = transactionType === "income" ? "income" : "expense";
      setShowRecurringForm(true);
      setEditingRecurringId("");
      setRecurringForm({
        kind: recurringKind,
        title: parsed.title || "",
        amount,
        category,
        type: parsed.category || "Salary",
        startDate: parsed.date || today(),
        frequency,
        customDays: 30,
        notes: parsed.notes || "",
      });
      snapToForm(recurringFormRef, setHighlightRecurringForm);
      return;
    }

    if (transactionType === "income" || transactionType === "expense") {
      const nextKind = transactionType;
      setKind(nextKind);
      setShowTransactionForm(true);
      setEditingTransactionId("");
      setForm({
        title: parsed.title || "",
        amount,
        date: parsed.date || today(),
        category,
        type: parsed.category || "Salary",
        notes: parsed.notes || "",
      });
      snapToForm(transactionFormRef, setHighlightTransactionForm);
      return;
    }

    if (transactionType === "saving_deposit" || transactionType === "saving_withdrawal") {
      setAiDraft({
        target: "Savings",
        payload: {
          savingGoalId: accountIdByName(data.savingGoals, parsed.accountName || parsed.title),
          type: transactionType === "saving_withdrawal" ? "withdrawal" : "deposit",
          amount,
          date: parsed.date || today(),
          comment: parsed.notes || parsed.title || "",
        },
      });
      setTab("Savings");
      return;
    }

    if (transactionType === "investment_contribution" || transactionType === "investment_withdrawal") {
      setAiDraft({
        target: "Investments",
        payload: {
          investmentId: accountIdByName(data.investments, parsed.accountName || parsed.title),
          type: transactionType === "investment_withdrawal" ? "withdrawal" : "contribution",
          amount,
          date: parsed.date || today(),
          comment: parsed.notes || parsed.title || "",
        },
      });
      setTab("Investments");
    }
  };

  const missingRequiredFields = (parsed) => {
    const transactionType = normalizeAiType(parsed);
    const missing = [];
    if (!parsed?.amount) missing.push("amount");
    if (!parsed?.date) missing.push("date");
    if ((transactionType === "expense" || transactionType === "income") && !parsed?.category) missing.push("category");
    if (transactionType.startsWith("saving") && !accountIdByName(data.savingGoals, parsed?.accountName || parsed?.title)) missing.push("account");
    if (transactionType.startsWith("investment") && !accountIdByName(data.investments, parsed?.accountName || parsed?.title)) missing.push("account");
    return missing;
  };

  const saveParsedResult = (parsed) => {
    const transactionType = normalizeAiType(parsed);
    const amount = parseAmount(parsed.amount);
    const date = parsed.date || today();
    const status = getTransactionStatus(date);
    update((draft) => {
      if (parsed.isRecurring && (transactionType === "income" || transactionType === "expense")) {
        const category = data.categories.includes(parsed.category) ? parsed.category : data.categories[0] || "Groceries";
        draft.recurring.push({
          id: uid(),
          kind: transactionType,
          title: parsed.title || (transactionType === "income" ? parsed.category || "Income" : category),
          amount,
          category,
          type: parsed.category || "Salary",
          startDate: date,
          frequency: normalizeAiFrequency(parsed),
          customDays: 30,
          notes: parsed.notes || "",
          active: true,
        });
        return draft;
      }
      if (transactionType === "income") {
        draft.incomes.push({ id: uid(), name: parsed.title || parsed.category || "Income", amount, date, type: parsed.category || "Salary", notes: parsed.notes || "", status, appliedAt: appliedAtFor(status, date) });
      }
      if (transactionType === "expense") {
        const category = data.categories.includes(parsed.category) ? parsed.category : data.categories[0] || "Groceries";
        draft.expenses.push({ id: uid(), title: parsed.title || category, amount, date, category, paymentMethod: "Card", notes: parsed.notes || "", status, appliedAt: appliedAtFor(status, date) });
      }
      if (transactionType === "saving_deposit" || transactionType === "saving_withdrawal") {
        const savingGoalId = accountIdByName(draft.savingGoals, parsed.accountName || parsed.title);
        const goal = draft.savingGoals.find((item) => item.id === savingGoalId);
        const type = transactionType === "saving_withdrawal" ? "withdrawal" : "deposit";
        draft.savingTransactions.push({ id: uid(), savingGoalId, type, amount, date, comment: parsed.notes || parsed.title || "", status, appliedAt: appliedAtFor(status, date), createdAt: today() });
        if (goal && status === "applied") goal.currentBalance = Math.max(0, Number(goal.currentBalance || 0) + movementDelta(type, amount));
      }
      if (transactionType === "investment_contribution" || transactionType === "investment_withdrawal") {
        const investmentId = accountIdByName(draft.investments, parsed.accountName || parsed.title);
        const investment = draft.investments.find((item) => item.id === investmentId);
        const type = transactionType === "investment_withdrawal" ? "withdrawal" : "contribution";
        draft.investmentTransactions.push({ id: uid(), investmentId, type, amount, date, comment: parsed.notes || parsed.title || "", status, appliedAt: appliedAtFor(status, date), affectsCash: true, createdAt: today() });
        if (investment && status === "applied") investment.currentBalance = Math.max(0, Number(investment.currentBalance || 0) + contributionDelta(type, amount));
      }
      return draft;
    });
  };

  const parseWithAi = async () => {
    if (!syncUser) {
      setAiStatus("Please sign in to use AI transaction parsing.");
      return;
    }
    const trimmed = aiText.trim();
    if (!trimmed) {
      setAiStatus("Type a transaction first.");
      return;
    }
    if (trimmed.length > AI_PROMPT_LIMIT) {
      setAiStatus(`Keep the AI prompt under ${AI_PROMPT_LIMIT} characters.`);
      return;
    }

    setAiBusy(true);
    setAiStatus("Adding with AI...");
    setAiResult(null);
    setAiReviewItems([]);
    setAiResponseWarnings([]);
    setAiReviewFields([]);
    try {
      const response = normalizeAiParseResponse(await parseNaturalTransaction({
        text: trimmed,
        currency: data.settings.currency,
        categories: data.categories,
      }));
      const reviewItems = response.transactions.map(aiReviewItem);
      const safeItems = reviewItems.filter((item) =>
        aiConfidence(item.parsed) >= 0.85 &&
        !aiWarnings(item.parsed).length &&
        hasRequiredAiFields(item.parsed, data),
      );
      const needsReview = reviewItems.filter((item) => !safeItems.includes(item));

      if (response.usage) setAiUsage(response.usage);
      setAiResponseWarnings(response.warnings);
      setAiReviewItems(reviewItems);

      const firstParsed = reviewItems[0]?.parsed || null;
      const missing = firstParsed ? missingRequiredFields(firstParsed) : [];
      const warnings = firstParsed ? aiWarnings(firstParsed) : [];
      const confidence = firstParsed ? aiConfidence(firstParsed) : 0;
      setAiResult(firstParsed);
      setAiReviewFields(confidence < 0.75 ? missing.length ? missing : ["amount", "date", "category"] : missing);

      if (aiAutoConfirm) {
        if (safeItems.length) {
          safeItems.forEach((item) => saveParsedResult(item.parsed));
        }

        if (!needsReview.length) {
          setAiReviewItems([]);
          setAiResult(null);
          setAiStatus(`${safeItems.length} transaction${safeItems.length === 1 ? "" : "s"} saved.`);
          return;
        }

        setAiReviewItems(needsReview);
        setAiResult(needsReview.length === 1 ? needsReview[0].parsed : null);
        setAiStatus(`${safeItems.length} transaction${safeItems.length === 1 ? "" : "s"} saved, ${needsReview.length} needs review.`);
        if (needsReview.length === 1) applyParsedResult(needsReview[0].parsed);
      } else {
        setAiStatus(reviewItems.length > 1 ? "Review the AI results before saving." : confidence < 0.75 ? "Please review this transaction carefully." : "Parsed and filled the form. Review before saving.");
      }

      if (!aiAutoConfirm && reviewItems.length === 1) {
        applyParsedResult(firstParsed);
      }
    } catch (error) {
      console.error(error);
      setAiStatus(error?.message || "AI parsing failed. Please reword it and try again.");
    } finally {
      setAiBusy(false);
    }
  };

  const updateAiReviewItem = (id, patch) => {
    setAiReviewItems((items) =>
      items.map((item) =>
        item.id === id ? { ...item, parsed: { ...item.parsed, ...patch } } : item,
      ),
    );
  };

  const confirmAiItems = (items) => {
    if (!items.length) {
      setAiStatus("Select at least one AI result to save.");
      return;
    }

    items.forEach((item) => saveParsedResult(item.parsed));
    setAiReviewItems((current) => current.filter((item) => !items.some((saved) => saved.id === item.id)));
    setAiResult(null);
    setAiStatus(`${items.length} transaction${items.length === 1 ? "" : "s"} saved.`);
  };

  const recordRecurringNow = (item) =>
    update((draft) => {
      const dueDate = item.dueDate && item.dueDate <= today() ? item.dueDate : today();
      const exists = [...draft.incomes, ...draft.expenses, ...draft.investmentTransactions].some((entry) => entry.recurringId === item.id && entry.recurringDueDate === dueDate);
      if (!exists) addRecurringTransaction(draft, item, dueDate);
      const recurring = draft.recurring.find((entry) => entry.id === item.id);
      if (recurring) recurring.startDate = advanceRecurringDate(dueDate, recurring.frequency, recurring.customDays);
      return draft;
    });

  const add = () => {
    if (!form.amount) {
      setFormError("Amount is required.");
      return;
    }
    setFormError("");
    const status = getTransactionStatus(form.date);
    const createdAt = new Date().toISOString();
    update((draft) => {
      if (editingTransactionId) {
        if (kind === "income") {
          draft.incomes = draft.incomes.map((item) =>
            item.id === editingTransactionId
              ? { ...item, name: form.title.trim() || form.type, amount: parseAmount(form.amount), date: form.date, type: form.type, notes: form.notes, status, appliedAt: appliedAtFor(status, form.date) }
              : item,
          );
        } else {
          draft.expenses = draft.expenses.map((item) =>
            item.id === editingTransactionId
              ? { ...item, title: form.title.trim() || form.category, amount: parseAmount(form.amount), date: form.date, category: form.category, notes: form.notes, status, appliedAt: appliedAtFor(status, form.date) }
              : item,
          );
        }
        return draft;
      }
      if (kind === "income") {
        draft.incomes.push({
          id: uid(),
          name: form.title.trim() || form.type,
          amount: parseAmount(form.amount),
          date: form.date,
          type: form.type,
          notes: form.notes,
          status,
          appliedAt: appliedAtFor(status, form.date),
          createdAt,
        });
      } else {
        draft.expenses.push({
          id: uid(),
          title: form.title.trim() || form.category,
          amount: parseAmount(form.amount),
          date: form.date,
          category: form.category,
          paymentMethod: "Card",
          notes: form.notes,
          status,
          appliedAt: appliedAtFor(status, form.date),
          createdAt,
        });
      }
      return draft;
    });
    resetTransactionForm();
    setShowTransactionForm(false);
  };

  const editTransaction = (item) => {
    if (item.group !== "Income" && item.group !== "Expenses") return;
    if (editingTransactionId === item.id && showTransactionForm) {
      cancelTransactionEdit();
      return;
    }
    setEditingTransactionId(item.id);
    setKind(item.group === "Income" ? "income" : "expense");
    setShowTransactionForm(true);
    setForm({
      title: item.group === "Income" ? item.name || item.title || "" : item.title || "",
      amount: formatAmount(item.amount).replace(/\.00$/, ""),
      date: item.date || today(),
      category: item.category || data.categories[0] || "Groceries",
      type: item.type || "Salary",
      notes: item.notes || "",
    });
    snapToForm(transactionFormRef, setHighlightTransactionForm);
  };

  const remove = (item) =>
    update((draft) => {
      if (item.group === "Income") draft.incomes = draft.incomes.filter((entry) => entry.id !== item.id);
      if (item.group === "Expenses") draft.expenses = draft.expenses.filter((entry) => entry.id !== item.id);
      if (item.group === "Savings") {
        const transaction = draft.savingTransactions.find((entry) => entry.id === item.id);
        const goal = draft.savingGoals.find((entry) => entry.id === transaction?.savingGoalId);
        if (transaction && goal && isApplied(transaction)) {
          const delta = transaction.type === "withdrawal" ? Number(transaction.amount || 0) : -Number(transaction.amount || 0);
          goal.currentBalance = Math.max(0, Number(goal.currentBalance || 0) + delta);
        }
        draft.savingTransactions = draft.savingTransactions.filter((entry) => entry.id !== item.id);
      }
      if (item.group === "Investments") {
        const transaction = draft.investmentTransactions.find((entry) => entry.id === item.id);
        const investment = draft.investments.find((entry) => entry.id === transaction?.investmentId);
        if (transaction && investment && isApplied(transaction)) {
          const delta = transaction.type === "withdrawal" ? Number(transaction.amount || 0) : -Number(transaction.amount || 0);
          investment.currentBalance = Math.max(0, Number(investment.currentBalance || 0) + delta);
        }
        draft.investmentTransactions = draft.investmentTransactions.filter((entry) => entry.id !== item.id);
      }
      return draft;
    });

  const saveRecurring = () => {
    if (!recurringForm.amount) {
      setRecurringError("Amount is required.");
      return;
    }
    setRecurringError("");
    update((draft) => {
      const recurring = {
        ...recurringForm,
        title: recurringForm.title.trim() || (recurringForm.kind === "income" ? recurringForm.type : recurringForm.category),
        amount: parseAmount(recurringForm.amount),
        customDays: Number(recurringForm.customDays || 30),
      };
      if (editingRecurringId) {
        draft.recurring = draft.recurring.map((item) => (item.id === editingRecurringId ? { ...item, ...recurring, id: item.id, active: item.active !== false } : item));
      } else {
        draft.recurring.push({ id: uid(), ...recurring, active: true });
      }
      return draft;
    });
    resetRecurringForm();
    setShowRecurringForm(false);
  };

  const editRecurring = (item) => {
    if (editingRecurringId === item.id && showRecurringForm) {
      cancelRecurringEdit();
      return;
    }
    setEditingRecurringId(item.id);
    setShowRecurringForm(true);
    setRecurringForm({
      kind: item.kind || "expense",
      title: item.title || "",
      amount: formatAmount(item.amount).replace(/\.00$/, ""),
      category: item.category || data.categories[0] || "Groceries",
      type: item.type || "Salary",
      startDate: item.startDate || today(),
      frequency: item.frequency || "Monthly",
      customDays: item.customDays || 30,
      notes: item.notes || "",
    });
    snapToForm(recurringFormRef, setHighlightRecurringForm);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[390px_1fr]">
      <div className="space-y-5">
        {false && (
          <>
        <ActionButton
          icon={Sparkles}
          title={aiOpen ? "Close Add with AI" : "Add with AI"}
          description="Create up to 5 transactions"
          tone="purple"
          open={aiOpen}
          onClick={() => setAiOpen(!aiOpen)}
        />
        {aiOpen && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            <Panel title="Add with AI">
              <div className="grid gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 sm:grid-cols-[1fr_auto] sm:items-center">
                <span>{syncUser ? `Signed in as ${syncUser.displayName || syncUser.email}` : "Please sign in to use AI transaction parsing."}</span>
                <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-[var(--accent-strong)] dark:bg-zinc-950">
                  {aiUsage.bypass ? "Developer bypass" : `${aiUsage.count} used / ${aiUsage.remaining} left`}
                </span>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-zinc-500 dark:text-zinc-400">Describe transactions</span>
                <textarea
                  value={aiText}
                  maxLength={AI_PROMPT_LIMIT}
                  onChange={(event) => setAiText(event.target.value)}
                  rows={4}
                  placeholder={"Example: Spent R450 on fuel yesterday and R200 on food today"}
                  className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50/90 p-3 text-sm font-semibold text-zinc-950 shadow-inner outline-none transition placeholder:text-zinc-400 focus:border-[var(--accent)] focus:bg-white focus:ring-4 focus:ring-[var(--accent-soft)] dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-50 dark:focus:bg-zinc-950"
                />
                <span className={cx("mt-1.5 block text-right text-xs font-black", aiText.length >= AI_PROMPT_LIMIT ? "text-amber-600 dark:text-amber-300" : "text-zinc-500 dark:text-zinc-400")}>
                  {aiText.length} / {AI_PROMPT_LIMIT}
                </span>
              </label>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                <span>
                  <span className="block text-sm font-black text-zinc-950 dark:text-white">Auto-confirm AI result</span>
                  <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400">When off, AI will only fill the form for review.</span>
                </span>
                <button
                  type="button"
                  aria-pressed={aiAutoConfirm}
                  className={cx("h-7 w-12 rounded-full p-1 transition", aiAutoConfirm ? "bg-[var(--accent-strong)]" : "bg-zinc-200 dark:bg-zinc-800")}
                  onClick={() => {
                    if (!aiAutoConfirm && !window.confirm("Auto-confirm will save AI-parsed transactions without manual review when confidence is high. Continue?")) return;
                    setAiAutoConfirm(!aiAutoConfirm);
                  }}
                >
                  <span className={cx("block h-5 w-5 rounded-full bg-white shadow-sm transition", aiAutoConfirm && "translate-x-5")} />
                </button>
              </label>
              <Button onClick={parseWithAi} disabled={aiBusy || !syncUser || !aiText.trim() || aiText.trim().length > AI_PROMPT_LIMIT}>
                <Sparkles size={16} /> {aiBusy ? "Adding..." : "Add with AI"}
              </Button>
              {aiStatus && <p className={cx("text-sm font-semibold", aiConfidence(aiResult) < 0.75 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-300")}>{aiStatus}</p>}
              {Boolean(aiResponseWarnings.length) && <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{aiResponseWarnings.join(" ")}</p>}
              {aiResult && aiReviewItems.length <= 1 && (
                <div className={cx("rounded-lg border bg-white p-3 text-xs font-semibold dark:bg-zinc-950", aiConfidence(aiResult) < 0.75 ? "border-amber-300 text-amber-800 dark:border-amber-500/50 dark:text-amber-200" : "border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-zinc-900 dark:text-white">{aiResult.title || "Parsed transaction"}</p>
                      <p className="mt-1">{normalizeAiType(aiResult).replaceAll("_", " ")}</p>
                    </div>
                    <span className="rounded-md bg-[var(--accent-soft)] px-2 py-1 font-black text-[var(--accent-strong)]">
                      {Math.round(aiConfidence(aiResult) * 100)}%
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {[
                      ["Amount", aiResult.amount ? money(aiResult.amount, data.settings.currency) : "Missing"],
                      ["Date", aiResult.date ? displayDate(aiResult.date) : "Missing"],
                      ["Category", aiResult.category || "Unspecified"],
                      ["Account", aiResult.accountName || "Unspecified"],
                      ["Recurring", aiResult.isRecurring ? "Yes" : "No"],
                      ["Frequency", aiResult.frequency || "Not recurring"],
                    ].map(([label, value]) => (
                      <div key={label} className={cx("rounded-md bg-zinc-50 px-2 py-1.5 dark:bg-zinc-900", aiReviewFields.some((field) => label.toLowerCase().includes(field)) && "ring-2 ring-amber-300 dark:ring-amber-500")}>
                        <span className="block text-[10px] font-black uppercase tracking-[0.06em] text-zinc-400">{label}</span>
                        <span className="text-zinc-800 dark:text-zinc-100">{value}</span>
                      </div>
                    ))}
                  </div>
                  {aiConfidence(aiResult) < 0.75 && <p className="mt-3 font-black">Please review this transaction carefully.</p>}
                  {Boolean(aiWarnings(aiResult).length) && <p className="mt-2">{aiWarnings(aiResult).join(" ")}</p>}
                </div>
              )}
              {aiReviewItems.length > 1 && (
                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button onClick={() => confirmAiItems(aiReviewItems)}>
                      <CheckCircle2 size={16} /> Confirm All
                    </Button>
                    <Button variant="secondary" onClick={() => confirmAiItems(aiReviewItems.filter((item) => item.selected))}>
                      Confirm Selected
                    </Button>
                  </div>
                  {aiReviewItems.map((item, index) => {
                    const parsed = item.parsed;
                    const confidence = aiConfidence(parsed);
                    const warnings = aiWarnings(parsed);
                    return (
                      <div key={item.id} className={cx("rounded-lg border bg-white p-3 text-xs font-semibold dark:bg-zinc-950", confidence < 0.75 || warnings.length ? "border-amber-300 text-amber-800 dark:border-amber-500/50 dark:text-amber-200" : "border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300")}>
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <label className="flex min-w-0 items-center gap-2 text-sm font-black text-zinc-900 dark:text-white">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={(event) =>
                                setAiReviewItems((items) =>
                                  items.map((entry) => entry.id === item.id ? { ...entry, selected: event.target.checked } : entry),
                                )
                              }
                            />
                            <span className="truncate">AI item {index + 1}</span>
                          </label>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="rounded-md bg-[var(--accent-soft)] px-2 py-1 font-black text-[var(--accent-strong)]">
                              {Math.round(confidence * 100)}%
                            </span>
                            <TinyIconButton label="Remove AI result" onClick={() => setAiReviewItems((items) => items.filter((entry) => entry.id !== item.id))}>
                              <Trash2 size={14} />
                            </TinyIconButton>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Select label="Type" value={parsed.transactionType} options={["income", "expense", "saving_deposit", "saving_withdrawal", "investment_contribution", "investment_withdrawal"]} onChange={(value) => updateAiReviewItem(item.id, { transactionType: value })} />
                          <Input label="Title" value={parsed.title} onChange={(value) => updateAiReviewItem(item.id, { title: value })} />
                          <AmountInput label="Amount" value={String(parsed.amount)} onChange={(value) => updateAiReviewItem(item.id, { amount: value })} />
                          <DateInput label="Date" value={parsed.date} onChange={(value) => updateAiReviewItem(item.id, { date: value })} />
                          <Input label="Category / account" value={parsed.accountName || parsed.category} onChange={(value) => updateAiReviewItem(item.id, { category: value, accountName: value })} />
                          <Select label="Frequency" value={parsed.frequency || "none"} options={["none", "weekly", "monthly", "yearly"]} onChange={(value) => updateAiReviewItem(item.id, { frequency: value, isRecurring: value !== "none" })} />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded bg-zinc-100 px-2 py-1 font-black uppercase text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">{parsed.transactionType.replaceAll("_", " ")}</span>
                          <span className="rounded bg-zinc-100 px-2 py-1 font-black text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">{parsed.isRecurring ? "Recurring" : "Once-off"}</span>
                          {warnings.map((warning) => (
                            <span key={warning} className="rounded bg-amber-100 px-2 py-1 font-black text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">{warning}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </motion.div>
        )}
          </>
        )}

        <ActionButton
          icon={Plus}
          title={showTransactionForm ? "Close Transaction" : "Add Transaction"}
          description="Record a new transaction"
          open={showTransactionForm}
          onClick={() => (editingTransactionId && showTransactionForm ? cancelTransactionEdit() : setShowTransactionForm(!showTransactionForm))}
        />
        {showTransactionForm && (
          <div ref={transactionFormRef} className={cx("scroll-mt-24 rounded-lg transition", highlightTransactionForm && "ring-4 ring-[var(--accent)] ring-offset-2 ring-offset-white dark:ring-offset-zinc-950")}>
          <Panel title={editingTransactionId ? "Edit Transaction" : "Add Transaction"}>
            <Segment options={["expense", "income"]} value={kind} setValue={setKind} />
            <Input label="Details (optional)" value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
            <AmountInput label="Amount" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} />
            <DateInput label="Date" value={form.date} onChange={(value) => setForm({ ...form, date: value })} />
            {kind === "expense" ? (
              <Select label="Category" value={form.category} options={data.categories} onChange={(value) => setForm({ ...form, category: value })} />
            ) : (
              <Select label="Income type" value={form.type} options={data.incomeTypes} onChange={(value) => setForm({ ...form, type: value })} />
            )}
            <Input label="Comment" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} />
            {formError && <FormError text={formError} />}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button onClick={add}>
                <Plus size={16} /> {editingTransactionId ? "Update Transaction" : "Add Transaction"}
              </Button>
              {editingTransactionId && (
                <Button variant="secondary" onClick={cancelTransactionEdit}>
                  Cancel Edit
                </Button>
              )}
            </div>
          </Panel>
          </div>
        )}

        <ActionButton
          icon={CalendarDays}
          title={showRecurringForm ? "Close Recurring Transaction" : "Add Recurring Transaction"}
          description="Set up recurring payments"
          tone="purple"
          open={showRecurringForm}
          onClick={() => (editingRecurringId && showRecurringForm ? cancelRecurringEdit() : setShowRecurringForm(!showRecurringForm))}
        />
        {showRecurringForm && (
          <div ref={recurringFormRef} className={cx("scroll-mt-24 rounded-lg transition", highlightRecurringForm && "ring-4 ring-[var(--accent)] ring-offset-2 ring-offset-white dark:ring-offset-zinc-950")}>
          <Panel title={editingRecurringId ? "Edit Recurring Transaction" : "Add Recurring Transaction"}>
            <Segment
              options={["expense", "income"]}
              labels={{ expense: "Expense", income: "Income" }}
              value={recurringForm.kind}
              setValue={(value) => setRecurringForm({ ...recurringForm, kind: value })}
            />
            <Input label="Name (optional)" value={recurringForm.title} onChange={(value) => setRecurringForm({ ...recurringForm, title: value })} />
            <AmountInput label="Amount" value={recurringForm.amount} onChange={(value) => setRecurringForm({ ...recurringForm, amount: value })} />
            {recurringForm.kind === "expense" ? (
              <Select label="Category" value={recurringForm.category} options={data.categories} onChange={(value) => setRecurringForm({ ...recurringForm, category: value })} />
            ) : (
              <Select label="Income type" value={recurringForm.type} options={data.incomeTypes} onChange={(value) => setRecurringForm({ ...recurringForm, type: value })} />
            )}
            <DateInput label="Start date" value={recurringForm.startDate} onChange={(value) => setRecurringForm({ ...recurringForm, startDate: value })} />
              <Select label="Frequency" value={recurringForm.frequency} options={frequencyOptions} onChange={(value) => setRecurringForm({ ...recurringForm, frequency: value })} />
            {recurringForm.frequency === "Custom" && (
              <Input label="Custom days" type="number" min="1" value={recurringForm.customDays} onChange={(value) => setRecurringForm({ ...recurringForm, customDays: value })} />
            )}
            <Input label="Comment" value={recurringForm.notes} onChange={(value) => setRecurringForm({ ...recurringForm, notes: value })} />
            {recurringError && <FormError text={recurringError} />}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button onClick={saveRecurring}>
                <Plus size={16} /> {editingRecurringId ? "Update Recurring" : "Add Recurring"}
              </Button>
              {editingRecurringId && (
                <Button variant="secondary" onClick={cancelRecurringEdit}>
                  Cancel Edit
                </Button>
              )}
            </div>
          </Panel>
          </div>
        )}
      </div>

      <div className="space-y-5">
        <Panel title="All transactions">
          <Segment
            options={["All", "Income", "Expenses", "Savings", "Investments"]}
            labels={{ Expenses: "Exp.", Investments: "Inv." }}
            value={filter}
            setValue={setFilter}
          />
          <div className="relative">
            <Search className="absolute left-3 top-3 text-zinc-400" size={18} />
            <input
              className="w-full rounded-lg border border-zinc-200 bg-white p-3 pl-10 text-sm text-zinc-950 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
              placeholder="Search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="space-y-3">
            {shownItems.map((item) => (
              <Row
                key={`${item.group}-${item.id}`}
                left={
                  <>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {displayDate(item.date)} - {item.subtitle || item.category || item.type}
                    </p>
                    {(item.notes || item.comment) && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.notes || item.comment}</p>}
                  </>
                }
                right={
                  <div className="flex items-center gap-3">
                    <span style={{ color: item.sign >= 0 ? "var(--income)" : "var(--expense)" }}>
                      {item.sign >= 0 ? "+" : "-"}
                      {money(item.amount, data.settings.currency)}
                    </span>
                    {(item.group === "Income" || item.group === "Expenses") && (
                      <IconButton active={editingTransactionId === item.id} label={editingTransactionId === item.id ? "Cancel edit" : "Edit transaction"} onClick={() => editTransaction(item)}>
                        <Pencil size={16} />
                      </IconButton>
                    )}
                    <IconButton label="Delete transaction" onClick={() => remove(item)}>
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                }
              />
            ))}
            {!items.length && <Empty text="No transactions yet." />}
            {items.length > SHOW_LIMIT && (
              <ShowAllButton expanded={showAllTransactions} onClick={() => setShowAllTransactions(!showAllTransactions)} description="View all transactions and activity" />
            )}
          </div>
        </Panel>

        <Panel title="Upcoming Transactions">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {shownUpcoming.map((item) => (
              <CompactUpcomingRow
                key={item.id}
                item={item}
                currency={data.settings.currency}
                onRecordRecurring={recordRecurringNow}
                onToggleRecurring={() =>
                  update((draft) => {
                    const recurring = draft.recurring.find((entry) => entry.id === item.id);
                    if (recurring) recurring.active = !recurring.active;
                    return draft;
                  })
                }
                onEditRecurring={() => editRecurring(item)}
                recurringEditing={editingRecurringId === item.id}
                onDeleteRecurring={() =>
                  update((draft) => {
                    draft.recurring = draft.recurring.filter((entry) => entry.id !== item.id);
                    return draft;
                  })
                }
                onEditPending={() => editTransaction(item)}
                pendingEditing={editingTransactionId === item.id}
                onDeletePending={() => remove(item)}
              />
            ))}
          </div>
          {!upcomingItems.length && <Empty text="No upcoming transactions yet." />}
          {upcomingItems.length > SHOW_LIMIT && (
            <ShowAllButton expanded={showAllRecurring} onClick={() => setShowAllRecurring(!showAllRecurring)} description="View all upcoming transactions" />
          )}
        </Panel>
      </div>
    </div>
  );
}

function Recurring({ data, update }) {
  const [form, setForm] = useState({
    kind: "expense",
    title: "",
    amount: "",
    category: data.categories.includes("Subscriptions") ? "Subscriptions" : data.categories[0] || "Groceries",
    type: "Salary",
    startDate: today(),
    frequency: "Monthly",
    customDays: 30,
    notes: "",
  });
  const [editingId, setEditingId] = useState("");
  const [highlightForm, setHighlightForm] = useState(false);
  const formRef = useRef(null);

  const recurringItems = useMemo(
    () =>
      data.recurring
        .map((item) => ({ ...item, next: nextDueDate(item.startDate, item.frequency, item.customDays) }))
        .sort((a, b) => a.next.localeCompare(b.next)),
    [data.recurring],
  );

  const resetForm = () => {
    setForm({
      kind: form.kind,
      title: "",
      amount: "",
      category: form.category,
      type: form.type,
      startDate: form.startDate,
      frequency: form.frequency,
      customDays: form.customDays,
      notes: "",
    });
  };

  const save = () => {
    if (!form.amount) return;
    update((draft) => {
      const recurring = {
        ...form,
        title: form.title.trim() || (form.kind === "income" ? form.type : form.category),
        amount: parseAmount(form.amount),
        customDays: Number(form.customDays || 30),
      };

      if (editingId) {
        draft.recurring = draft.recurring.map((item) =>
          item.id === editingId
            ? {
                ...item,
                ...recurring,
                id: item.id,
                active: item.active !== false,
              }
            : item,
        );
      } else {
        draft.recurring.push({
          id: uid(),
          ...recurring,
          active: true,
        });
      }
      return draft;
    });
    setEditingId("");
    resetForm();
  };

  const edit = (item) => {
    if (editingId === item.id) {
      cancelEdit();
      return;
    }
    setEditingId(item.id);
    setForm({
      kind: item.kind || "expense",
      title: item.title || "",
      amount: formatAmount(item.amount).replace(/\.00$/, ""),
      category: item.category || data.categories[0] || "Groceries",
      type: item.type || "Salary",
      startDate: item.startDate || today(),
      frequency: item.frequency || "Monthly",
      customDays: item.customDays || 30,
      notes: item.notes || "",
    });
    snapToForm(formRef, setHighlightForm);
  };

  const cancelEdit = () => {
    setEditingId("");
    resetForm();
  };

  const recordNow = (item) =>
    update((draft) => {
      if (item.kind === "income") {
        draft.incomes.push({
          id: uid(),
          name: item.title || item.type,
          amount: parseAmount(item.amount),
          date: today(),
          type: item.type,
          notes: item.notes,
        });
      } else {
        draft.expenses.push({
          id: uid(),
          title: item.title || item.category,
          amount: parseAmount(item.amount),
          date: today(),
          category: item.category,
          paymentMethod: "Recurring",
          notes: item.notes,
        });
      }
      return draft;
    });

  return (
    <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      <div ref={formRef} className={cx("scroll-mt-24 rounded-lg transition", highlightForm && "ring-4 ring-[var(--accent)] ring-offset-2 ring-offset-white dark:ring-offset-zinc-950")}>
      <Panel title={editingId ? "Edit Recurring Transaction" : "Add Recurring Transaction"}>
        <Segment options={["expense", "income"]} value={form.kind} setValue={(value) => setForm({ ...form, kind: value })} />
        <Input label="Name (optional)" value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
        <AmountInput label="Amount" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} />
        {form.kind === "expense" ? (
          <Select label="Category" value={form.category} options={data.categories} onChange={(value) => setForm({ ...form, category: value })} />
        ) : (
          <Select label="Income type" value={form.type} options={data.incomeTypes} onChange={(value) => setForm({ ...form, type: value })} />
        )}
        <DateInput label="Start date" value={form.startDate} onChange={(value) => setForm({ ...form, startDate: value })} />
        <Select label="Frequency" value={form.frequency} options={frequencyOptions} onChange={(value) => setForm({ ...form, frequency: value })} />
        {form.frequency === "Custom" && (
          <Input label="Custom days" type="number" min="1" value={form.customDays} onChange={(value) => setForm({ ...form, customDays: value })} />
        )}
        <Input label="Notes" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} />
        <div className="grid gap-2 sm:grid-cols-2">
          <Button onClick={save}>
            <Plus size={16} /> {editingId ? "Update recurring" : "Add recurring"}
          </Button>
          {editingId && (
            <Button variant="secondary" onClick={cancelEdit}>
              Cancel Edit
            </Button>
          )}
        </div>
      </Panel>
      </div>

      <Panel title="Recurring payments and income">
        <div className="space-y-3">
          {recurringItems.map((item) => (
            <Row
              key={item.id}
              left={
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{item.title || item.type || item.category}</p>
                    {item.active === false && (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase text-amber-700 dark:bg-amber-950/50 dark:text-amber-200">
                        Paused
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {item.kind === "income" ? item.type : item.category} - {item.frequency} - Next {displayDate(item.next)}
                  </p>
                </>
              }
              right={
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span style={{ color: item.kind === "income" ? "var(--income)" : "var(--expense)" }}>
                    {item.kind === "income" ? "+" : "-"}
                    {money(item.amount, data.settings.currency)}
                  </span>
                  <button
                    type="button"
                    className={cx(
                      "rounded-md px-3 py-2 text-xs font-bold transition hover:opacity-85",
                      editingId === item.id
                        ? "bg-[var(--accent-strong)] text-white"
                        : "bg-[var(--accent-soft)] text-[var(--accent-strong)] dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
                    )}
                    onClick={() => edit(item)}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Pencil size={13} /> {editingId === item.id ? "Editing" : "Edit"}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-[var(--accent-soft)] px-3 py-2 text-xs font-bold text-[var(--accent-strong)] transition hover:opacity-85 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    onClick={() => recordNow(item)}
                  >
                    {item.kind === "income" ? "Received" : "Paid"}
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-[var(--accent-soft)] px-3 py-2 text-xs font-bold text-[var(--accent-strong)] transition hover:opacity-85 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    onClick={() =>
                      update((draft) => {
                        const recurring = draft.recurring.find((entry) => entry.id === item.id);
                        if (recurring) recurring.active = !recurring.active;
                        return draft;
                      })
                    }
                  >
                    {item.active ? "Pause" : "Resume"}
                  </button>
                  <IconButton
                    label="Delete recurring item"
                    onClick={() =>
                      update((draft) => {
                        draft.recurring = draft.recurring.filter((entry) => entry.id !== item.id);
                        return draft;
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              }
            />
          ))}
          {!recurringItems.length && <Empty text="No recurring payments or income yet." />}
        </div>
      </Panel>
    </div>
  );
}

function Savings({ data, update, aiDraft, clearAiDraft }) {
  const range = getFinancialRange(data.settings);
  const [showForm, setShowForm] = useState(false);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [showAllGoals, setShowAllGoals] = useState(false);
  const [goalError, setGoalError] = useState("");
  const [movementError, setMovementError] = useState("");
  const [editingGoalId, setEditingGoalId] = useState("");
  const [editingTransactionId, setEditingTransactionId] = useState("");
  const [highlightGoalForm, setHighlightGoalForm] = useState(false);
  const [highlightMovementForm, setHighlightMovementForm] = useState(false);
  const goalFormRef = useRef(null);
  const movementFormRef = useRef(null);
  const [expandedGoals, setExpandedGoals] = useState({});
  const [form, setForm] = useState({
    name: "",
    goalAmount: "",
    goalDate: formatDate(new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate())),
    openingBalance: "",
    currentBalance: "",
    notes: "",
  });
  const [movement, setMovement] = useState({
    savingGoalId: "",
    amount: "",
    date: today(),
    type: "deposit",
    comment: "",
  });

  const totalSavings = data.savingGoals.reduce((sum, item) => sum + Number(item.currentBalance || 0), 0);
  const savedThisMonth = data.savingTransactions
    .filter((item) => isApplied(item) && inRange(item.date, range.start, range.end))
    .reduce((sum, item) => sum + Number(item.amount || 0) * (item.type === "withdrawal" ? -1 : 1), 0);
  const selectedGoalId = movement.savingGoalId || data.savingGoals[0]?.id || "";
  const shownGoals = showAllGoals ? data.savingGoals : data.savingGoals.slice(0, SHOW_LIMIT);

  useEffect(() => {
    if (aiDraft?.target !== "Savings") return;
    const frame = requestAnimationFrame(() => {
      setShowMovementForm(true);
      setEditingTransactionId("");
      setMovement({
        savingGoalId: aiDraft.payload.savingGoalId || data.savingGoals[0]?.id || "",
        type: aiDraft.payload.type || "deposit",
        amount: aiDraft.payload.amount || "",
        date: aiDraft.payload.date || today(),
        comment: aiDraft.payload.comment || "",
      });
      snapToForm(movementFormRef, setHighlightMovementForm);
      clearAiDraft();
    });
    return () => cancelAnimationFrame(frame);
  }, [aiDraft, clearAiDraft, data.savingGoals]);

  const resetGoalForm = () => {
    setEditingGoalId("");
    setGoalError("");
    setForm({
      name: "",
      goalAmount: "",
      goalDate: form.goalDate,
      openingBalance: "",
      currentBalance: "",
      notes: "",
    });
  };

  const cancelGoalEdit = () => {
    resetGoalForm();
    setShowForm(false);
  };

  const resetMovementForm = () => {
    setEditingTransactionId("");
    setMovement({ savingGoalId: selectedGoalId, amount: "", date: today(), type: movement.type, comment: "" });
    setMovementError("");
  };

  const cancelMovementEdit = () => {
    resetMovementForm();
    setShowMovementForm(false);
  };

  const saveGoal = () => {
    if (!form.name.trim() || !form.goalAmount || !form.goalDate) {
      setGoalError("Goal name, goal amount, and goal date are required.");
      return;
    }
    setGoalError("");
    update((draft) => {
      const openingBalance = parseAmount(form.openingBalance);
      const goal = {
        name: form.name.trim() || "Saving goal",
        goalAmount: parseAmount(form.goalAmount),
        goalDate: form.goalDate,
        openingBalance,
        currentBalance: parseAmount(form.currentBalance || form.openingBalance),
        notes: form.notes,
      };
      if (editingGoalId) {
        draft.savingGoals = draft.savingGoals.map((item) => (item.id === editingGoalId ? { ...item, ...goal } : item));
      } else {
        draft.savingGoals.push({ id: uid(), ...goal, createdAt: today() });
      }
      return draft;
    });
    resetGoalForm();
    setShowForm(false);
  };

  const editGoal = (goal) => {
    if (editingGoalId === goal.id && showForm) {
      cancelGoalEdit();
      return;
    }
    setShowForm(true);
    setEditingGoalId(goal.id);
    setForm({
      name: goal.name,
      goalAmount: formatAmount(goal.goalAmount).replace(/\.00$/, ""),
      goalDate: goal.goalDate || today(),
      openingBalance: formatAmount(goal.openingBalance).replace(/\.00$/, ""),
      currentBalance: formatAmount(goal.currentBalance).replace(/\.00$/, ""),
      notes: goal.notes || "",
    });
    snapToForm(goalFormRef, setHighlightGoalForm);
  };

  const saveMovement = () => {
    if (!selectedGoalId || !movement.amount) {
      setMovementError("Choose a goal and enter an amount.");
      return;
    }
    setMovementError("");
    update((draft) => {
      const goal = draft.savingGoals.find((item) => item.id === selectedGoalId);
      if (!goal) return draft;
      const amount = parseAmount(movement.amount);
      const status = getTransactionStatus(movement.date);
      if (editingTransactionId) {
        const previous = draft.savingTransactions.find((item) => item.id === editingTransactionId);
        const previousGoal = draft.savingGoals.find((item) => item.id === previous?.savingGoalId);
        if (previous && previousGoal && isApplied(previous)) {
          const reverse = previous.type === "withdrawal" ? Number(previous.amount || 0) : -Number(previous.amount || 0);
          previousGoal.currentBalance = Math.max(0, Number(previousGoal.currentBalance || 0) + reverse);
        }
        draft.savingTransactions = draft.savingTransactions.map((item) =>
          item.id === editingTransactionId
            ? { ...item, savingGoalId: selectedGoalId, type: movement.type, amount, date: movement.date, comment: movement.comment, status, appliedAt: appliedAtFor(status, movement.date) }
            : item,
        );
      } else {
        draft.savingTransactions.push({
          id: uid(),
          savingGoalId: selectedGoalId,
          type: movement.type,
          amount,
          date: movement.date,
          comment: movement.comment,
          status,
          appliedAt: appliedAtFor(status, movement.date),
          createdAt: today(),
        });
      }
      if (status === "applied") goal.currentBalance = Math.max(0, Number(goal.currentBalance || 0) + movementDelta(movement.type, amount));
      return draft;
    });
    resetMovementForm();
    setShowMovementForm(false);
  };

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Landmark} label="Savings balance" value={money(totalSavings, data.settings.currency)} hint="all" />
        <StatCard icon={TrendingUp} label="Saved this month" value={money(savedThisMonth, data.settings.currency)} hint="cycle" />
      </section>

      <ActionButton
        icon={Landmark}
        title={showForm ? "Close Saving Goal" : "Add Saving Goal"}
        description="Create a new saving goal"
        tone="blue"
        open={showForm}
        onClick={() => (editingGoalId && showForm ? cancelGoalEdit() : setShowForm(!showForm))}
      />

      {showForm && (
        <div ref={goalFormRef} className={cx("scroll-mt-24 rounded-lg transition", highlightGoalForm && "ring-4 ring-[var(--accent)] ring-offset-2 ring-offset-white dark:ring-offset-zinc-950")}>
        <Panel title={editingGoalId ? "Edit Saving Goal" : "Add Saving Goal"}>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Goal name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
            <AmountInput label="Goal amount" value={form.goalAmount} onChange={(value) => setForm({ ...form, goalAmount: value })} />
            <DateInput label="Goal date" value={form.goalDate} onChange={(value) => setForm({ ...form, goalDate: value })} />
            <AmountInput label="Opening balance" value={form.openingBalance} onChange={(value) => setForm({ ...form, openingBalance: value })} />
            <AmountInput label="Current balance" value={form.currentBalance} onChange={(value) => setForm({ ...form, currentBalance: value })} />
            <Input label="Comment" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} />
          </div>
          {goalError && <FormError text={goalError} />}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button onClick={saveGoal}>
              <Plus size={16} /> {editingGoalId ? "Update Goal" : "Save Goal"}
            </Button>
            {editingGoalId && (
              <Button variant="secondary" onClick={cancelGoalEdit}>
                Cancel Edit
              </Button>
            )}
          </div>
        </Panel>
        </div>
      )}

      <ActionButton
        icon={Wallet}
        title={showMovementForm ? "Close Savings Movement" : "Add Savings Deposit or Withdrawal"}
        description="Add money or withdraw from your savings goal"
        tone="teal"
        open={showMovementForm}
        onClick={() => (editingTransactionId && showMovementForm ? cancelMovementEdit() : setShowMovementForm(!showMovementForm))}
      />

      {showMovementForm && (
        <div ref={movementFormRef} className={cx("scroll-mt-24 rounded-lg transition", highlightMovementForm && "ring-4 ring-[var(--accent)] ring-offset-2 ring-offset-white dark:ring-offset-zinc-950")}>
        <Panel title={editingTransactionId ? "Edit Saving Transaction" : "Add Savings Deposit or Withdrawal"}>
          {data.savingGoals.length ? (
            <div className="grid gap-3 md:grid-cols-5">
              <Select
                label="Goal"
                value={selectedGoalId}
                options={data.savingGoals.map((item) => item.id)}
                labels={Object.fromEntries(data.savingGoals.map((item) => [item.id, item.name]))}
                onChange={(value) => setMovement({ ...movement, savingGoalId: value })}
              />
              <Select
                label="Type"
                value={movement.type}
                options={["deposit", "withdrawal"]}
                labels={{ deposit: "Deposit", withdrawal: "Withdrawal" }}
                onChange={(value) => setMovement({ ...movement, type: value })}
              />
              <AmountInput label="Amount" value={movement.amount} onChange={(value) => setMovement({ ...movement, amount: value })} />
              <DateInput label="Date" value={movement.date} onChange={(value) => setMovement({ ...movement, date: value })} />
              <Input label="Comment" value={movement.comment} onChange={(value) => setMovement({ ...movement, comment: value })} />
              <div className="md:col-span-5">
                {movementError && <FormError text={movementError} />}
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button onClick={saveMovement}>
                    <Plus size={16} /> {editingTransactionId ? "Update Movement" : "Save Movement"}
                  </Button>
                  {editingTransactionId && (
                    <Button variant="secondary" onClick={cancelMovementEdit}>
                      Cancel Edit
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <Empty text="Create a saving goal first." />
          )}
        </Panel>
        </div>
      )}

      <Panel title="Saving Goals">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {shownGoals.map((goal) => {
            const accountProgress = goal.goalAmount ? Math.min(100, (Number(goal.currentBalance || 0) / Number(goal.goalAmount || 1)) * 100) : 0;
            const remaining = Math.max(0, Number(goal.goalAmount || 0) - Number(goal.currentBalance || 0));
            const suggestion = suggestedMonthlySaving(goal.goalAmount, goal.currentBalance, goal.goalDate);
            const history = data.savingTransactions.filter((item) => item.savingGoalId === goal.id).sort((a, b) => b.date.localeCompare(a.date));
            const shownHistory = expandedGoals[goal.id] ? history : history.slice(0, SHOW_LIMIT);
            return (
              <div key={goal.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">{goal.name}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Target {money(goal.goalAmount, data.settings.currency)} by {displayDate(goal.goalDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 font-bold">
                    <span>{money(goal.currentBalance, data.settings.currency)}</span>
                    <IconButton active={editingGoalId === goal.id} label={editingGoalId === goal.id ? "Cancel edit" : "Edit saving goal"} onClick={() => editGoal(goal)}>
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton
                      label="Delete saving goal"
                      onClick={() =>
                        update((draft) => {
                          draft.savingGoals = draft.savingGoals.filter((item) => item.id !== goal.id);
                          draft.savingTransactions = draft.savingTransactions.filter((item) => item.savingGoalId !== goal.id);
                          return draft;
                        })
                      }
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-2 flex justify-between text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    <span>{money(goal.currentBalance, data.settings.currency)} saved</span>
                    <span>{accountProgress.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                    <span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: `${accountProgress}%` }} />
                  </div>
                  <div className="mt-3 grid gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 sm:grid-cols-2">
                    <span>Remaining {money(remaining, data.settings.currency)}</span>
                    <span>{suggestion === null ? "Goal date passed" : `Suggested ${money(suggestion, data.settings.currency)}/month`}</span>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {shownHistory.map((entry, index) => (
                    <Row
                      key={entry.id}
                      className={!expandedGoals[goal.id] && index > 0 ? "hidden sm:flex" : ""}
                      compact
                      left={
                        <>
                          <p className="font-semibold capitalize">{entry.type}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{displayDate(entry.date)} {entry.comment ? `- ${entry.comment}` : ""}</p>
                        </>
                      }
                      right={
                        <div className="flex items-center gap-2">
                          <span style={{ color: entry.type === "deposit" ? "var(--income)" : "var(--expense)" }}>
                            {entry.type === "deposit" ? "+" : "-"}{money(entry.amount, data.settings.currency)}
                          </span>
                          <IconButton
                            active={editingTransactionId === entry.id}
                            label={editingTransactionId === entry.id ? "Cancel edit" : "Edit saving transaction"}
                            onClick={() => {
                              if (editingTransactionId === entry.id && showMovementForm) {
                                cancelMovementEdit();
                                return;
                              }
                              setEditingTransactionId(entry.id);
                              setShowMovementForm(true);
                              setMovement({ savingGoalId: entry.savingGoalId, type: entry.type, amount: formatAmount(entry.amount).replace(/\.00$/, ""), date: entry.date, comment: entry.comment || "" });
                              snapToForm(movementFormRef, setHighlightMovementForm);
                            }}
                          >
                            <Pencil size={16} />
                          </IconButton>
                          <IconButton
                            label="Delete saving transaction"
                            onClick={() =>
                              update((draft) => {
                                const target = draft.savingGoals.find((item) => item.id === entry.savingGoalId);
                                if (target && isApplied(entry)) {
                                  const delta = entry.type === "withdrawal" ? Number(entry.amount || 0) : -Number(entry.amount || 0);
                                  target.currentBalance = Math.max(0, Number(target.currentBalance || 0) + delta);
                                }
                                draft.savingTransactions = draft.savingTransactions.filter((item) => item.id !== entry.id);
                                return draft;
                              })
                            }
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        </div>
                      }
                    />
                  ))}
                  {history.length > 1 && (
                    <ShowAllButton
                      expanded={Boolean(expandedGoals[goal.id])}
                      onClick={() => setExpandedGoals({ ...expandedGoals, [goal.id]: !expandedGoals[goal.id] })}
                      description="View all saving goal activity"
                    />
                  )}
                </div>
              </div>
            );
          })}
          {!data.savingGoals.length && <Empty text="No saving goals yet." />}
        </div>
        {data.savingGoals.length > SHOW_LIMIT && (
          <ShowAllButton expanded={showAllGoals} onClick={() => setShowAllGoals(!showAllGoals)} description="View all saving goals" />
        )}
      </Panel>
    </div>
  );
}

function Investments({ data, update, aiDraft, clearAiDraft }) {
  const [showForm, setShowForm] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [investmentError, setInvestmentError] = useState("");
  const [transactionError, setTransactionError] = useState("");
  const [editingInvestmentId, setEditingInvestmentId] = useState("");
  const [editingTransactionId, setEditingTransactionId] = useState("");
  const [showAllInvestments, setShowAllInvestments] = useState(false);
  const [highlightInvestmentForm, setHighlightInvestmentForm] = useState(false);
  const [highlightTransactionForm, setHighlightTransactionForm] = useState(false);
  const investmentFormRef = useRef(null);
  const investmentTransactionFormRef = useRef(null);
  const [expandedInvestments, setExpandedInvestments] = useState({});
  const [form, setForm] = useState({
    name: "",
    type: "TFSA",
    currentBalance: "",
    monthlyContribution: "",
    annualReturn: "8",
    notes: "",
  });
  const [transaction, setTransaction] = useState({ investmentId: "", type: "contribution", amount: "", date: today(), comment: "" });

  useEffect(() => {
    if (aiDraft?.target !== "Investments") return;
    const frame = requestAnimationFrame(() => {
      setShowTransactionForm(true);
      setEditingTransactionId("");
      setTransaction({
        investmentId: aiDraft.payload.investmentId || data.investments[0]?.id || "",
        type: aiDraft.payload.type || "contribution",
        amount: aiDraft.payload.amount || "",
        date: aiDraft.payload.date || today(),
        comment: aiDraft.payload.comment || "",
      });
      snapToForm(investmentTransactionFormRef, setHighlightTransactionForm);
      clearAiDraft();
    });
    return () => cancelAnimationFrame(frame);
  }, [aiDraft, clearAiDraft, data.investments]);

  const resetInvestmentForm = () => {
    setEditingInvestmentId("");
    setInvestmentError("");
    setForm({ name: "", type: "TFSA", currentBalance: "", monthlyContribution: "", annualReturn: "8", notes: "" });
  };

  const cancelInvestmentEdit = () => {
    resetInvestmentForm();
    setShowForm(false);
  };

  const resetInvestmentTransactionForm = () => {
    setEditingTransactionId("");
    setTransaction({ investmentId: selectedInvestmentId, type: transaction.type, amount: "", date: today(), comment: "" });
    setTransactionError("");
  };

  const cancelInvestmentTransactionEdit = () => {
    resetInvestmentTransactionForm();
    setShowTransactionForm(false);
  };

  const saveInvestment = () => {
    if (!form.name.trim()) {
      setInvestmentError("Investment name is required.");
      return;
    }
    setInvestmentError("");
    update((draft) => {
      const investment = {
        name: form.name.trim(),
        type: form.type,
        currentBalance: parseAmount(form.currentBalance),
        monthlyContribution: parseAmount(form.monthlyContribution),
        annualReturn: Number(form.annualReturn || 0),
        notes: form.notes,
      };
      if (editingInvestmentId) {
        draft.investments = draft.investments.map((item) => (item.id === editingInvestmentId ? { ...item, ...investment } : item));
      } else {
        const id = uid();
        draft.investments.push({ id, ...investment, createdAt: today() });
      }
      return draft;
    });
    resetInvestmentForm();
    setShowForm(false);
  };

  const editInvestment = (investment) => {
    if (editingInvestmentId === investment.id && showForm) {
      cancelInvestmentEdit();
      return;
    }
    setShowForm(true);
    setEditingInvestmentId(investment.id);
    setForm({
      name: investment.name,
      type: investment.type || "TFSA",
      currentBalance: formatAmount(investment.currentBalance).replace(/\.00$/, ""),
      monthlyContribution: formatAmount(investment.monthlyContribution).replace(/\.00$/, ""),
      annualReturn: String(investment.annualReturn || 0),
      notes: investment.notes || "",
    });
    snapToForm(investmentFormRef, setHighlightInvestmentForm);
  };

  const saveTransaction = () => {
    if (!selectedInvestmentId || !transaction.amount) {
      setTransactionError("Choose an investment and enter an amount.");
      return false;
    }
    setTransactionError("");
    update((draft) => {
      const investmentId = transaction.investmentId || draft.investments[0]?.id;
      const investment = draft.investments.find((item) => item.id === investmentId);
      if (investment && transaction.amount) {
        const amount = parseAmount(transaction.amount);
        const status = getTransactionStatus(transaction.date);
        if (editingTransactionId) {
          const previous = draft.investmentTransactions.find((item) => item.id === editingTransactionId);
          const previousInvestment = draft.investments.find((item) => item.id === previous?.investmentId);
          if (previous && previousInvestment && isApplied(previous)) {
            const reverse = previous.type === "withdrawal" ? Number(previous.amount || 0) : -Number(previous.amount || 0);
            previousInvestment.currentBalance = Math.max(0, Number(previousInvestment.currentBalance || 0) + reverse);
          }
          draft.investmentTransactions = draft.investmentTransactions.map((item) =>
            item.id === editingTransactionId
              ? { ...item, investmentId, type: transaction.type, amount, date: transaction.date, comment: transaction.comment, status, appliedAt: appliedAtFor(status, transaction.date) }
              : item,
          );
        } else {
          draft.investmentTransactions.push({
            id: uid(),
            investmentId,
            type: transaction.type,
            amount,
            date: transaction.date,
            comment: transaction.comment,
            status,
            appliedAt: appliedAtFor(status, transaction.date),
            affectsCash: true,
            createdAt: today(),
          });
        }
        if (status === "applied") investment.currentBalance = Math.max(0, Number(investment.currentBalance || 0) + contributionDelta(transaction.type, amount));
      }
      return draft;
    });
    return true;
  };

  const totalValue = data.investments.reduce((sum, item) => sum + Number(item.currentBalance || 0), 0);
  const totalMonthly = data.investments.reduce((sum, item) => sum + Number(item.monthlyContribution || 0), 0);
  const growthData = [1, 5, 10, 20, 30].map((year) => ({
    year: `${year}y`,
    value: data.investments.reduce((sum, item) => sum + projection(item.currentBalance, item.monthlyContribution, item.annualReturn, year), 0),
  }));
  const selectedInvestmentId = transaction.investmentId || data.investments[0]?.id || "";
  const shownInvestments = showAllInvestments ? data.investments : data.investments.slice(0, 1);
  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={TrendingUp} label="Current value" value={money(totalValue, data.settings.currency)} hint="all" />
        <StatCard icon={Landmark} label="Monthly contributions" value={money(totalMonthly, data.settings.currency)} hint="recurring" />
        <StatCard icon={BarChart3} label="30y projection" value={money(growthData[growthData.length - 1]?.value || 0, data.settings.currency)} hint="estimate" />
      </section>

      <ActionButton
        icon={TrendingUp}
        title={showForm ? "Close Investment Account" : "Add Investment Account"}
        description="Create a new investment account"
        open={showForm}
        onClick={() => (editingInvestmentId && showForm ? cancelInvestmentEdit() : setShowForm(!showForm))}
      />

      <div className="grid gap-5 lg:grid-cols-[390px_1fr]">
        {showForm && (
        <div ref={investmentFormRef} className={cx("scroll-mt-24 rounded-lg transition", highlightInvestmentForm && "ring-4 ring-[var(--accent)] ring-offset-2 ring-offset-white dark:ring-offset-zinc-950")}>
        <Panel title={editingInvestmentId ? "Edit Investment" : "Add Investment"}>
          <Input label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          <Select label="Type" value={form.type} options={defaultInvestmentTypes} onChange={(value) => setForm({ ...form, type: value })} />
          <AmountInput label="Current balance" value={form.currentBalance} onChange={(value) => setForm({ ...form, currentBalance: value })} />
          <AmountInput label="Monthly contribution" value={form.monthlyContribution} onChange={(value) => setForm({ ...form, monthlyContribution: value })} />
          <Input label="Expected return %" type="number" value={form.annualReturn} onChange={(value) => setForm({ ...form, annualReturn: value })} />
          <Input label="Comment" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} />
          {investmentError && <FormError text={investmentError} />}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button onClick={saveInvestment}>
              <Plus size={16} /> {editingInvestmentId ? "Update Investment" : "Save Investment"}
            </Button>
            {editingInvestmentId && (
              <Button variant="secondary" onClick={cancelInvestmentEdit}>
                Cancel Edit
              </Button>
            )}
          </div>
        </Panel>
        </div>
        )}

        <ChartCard title="Investment projection" icon={TrendingUp}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={growthData} margin={{ top: 14, right: 20, left: 28, bottom: 12 }}>
              <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--chart-text)" }} />
              <YAxis width={88} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--chart-text)" }} tickFormatter={(value) => money(value, data.settings.currency)} />
              <Tooltip formatter={(value) => money(value, data.settings.currency)} contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} itemStyle={chartTooltipItemStyle} />
              <Line type="monotone" dataKey="value" stroke="var(--graph-income)" strokeWidth={3} dot={{ fill: "var(--graph-income)", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {data.investments.length > 0 && (
        <ActionButton
          icon={Landmark}
          title={showTransactionForm ? "Close Investment Transaction" : "Add Investment Contribution or Withdrawal"}
          description="Add money or withdraw from your investment account"
          tone="purple"
          open={showTransactionForm}
          onClick={() => (editingTransactionId && showTransactionForm ? cancelInvestmentTransactionEdit() : setShowTransactionForm(!showTransactionForm))}
        />
      )}

      {data.investments.length > 0 && showTransactionForm && (
        <div ref={investmentTransactionFormRef} className={cx("scroll-mt-24 rounded-lg transition", highlightTransactionForm && "ring-4 ring-[var(--accent)] ring-offset-2 ring-offset-white dark:ring-offset-zinc-950")}>
          <Panel title={editingTransactionId ? "Edit Investment Transaction" : "Add Investment Contribution or Withdrawal"}>
            <div className="grid gap-3 md:grid-cols-5">
            <Select
              label="Investment"
              value={selectedInvestmentId}
              options={data.investments.map((item) => item.id)}
              labels={Object.fromEntries(data.investments.map((item) => [item.id, item.name]))}
              onChange={(value) => setTransaction({ ...transaction, investmentId: value })}
            />
            <Select
              label="Type"
              value={transaction.type}
              options={["contribution", "withdrawal"]}
              labels={{ contribution: "Contribution", withdrawal: "Withdrawal" }}
              onChange={(value) => setTransaction({ ...transaction, type: value })}
            />
            <AmountInput label="Amount" value={transaction.amount} onChange={(value) => setTransaction({ ...transaction, amount: value })} />
            <DateInput label="Date" value={transaction.date} onChange={(value) => setTransaction({ ...transaction, date: value })} />
            <Input label="Comment" value={transaction.comment} onChange={(value) => setTransaction({ ...transaction, comment: value })} />
            {transactionError && <div className="md:col-span-5"><FormError text={transactionError} /></div>}
            <div className="md:col-span-5">
              <Button
                onClick={() => {
                  if (!saveTransaction()) return;
                  resetInvestmentTransactionForm();
                  setShowTransactionForm(false);
                }}
              >
                <Plus size={16} /> {editingTransactionId ? "Update Transaction" : "Save Transaction"}
              </Button>
              {editingTransactionId && (
                <div className="mt-2">
                  <Button variant="secondary" onClick={cancelInvestmentTransactionEdit}>
                    Cancel Edit
                  </Button>
                </div>
              )}
            </div>
          </div>
          </Panel>
        </div>
      )}

      <Panel title="Investment accounts">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {shownInvestments.map((investment) => {
            const history = data.investmentTransactions
              .filter((item) => item.investmentId === investment.id && item.affectsCash !== false)
              .sort((a, b) => b.date.localeCompare(a.date));
            const shownHistory = expandedInvestments[investment.id] ? history : history.slice(0, SHOW_LIMIT);
            const investmentGrowthData = [1, 5, 10, 20, 30].map((year) => ({
              year: `${year}y`,
              value: projection(investment.currentBalance, investment.monthlyContribution, investment.annualReturn, year),
            }));
            return (
              <div key={investment.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/70 sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">{investment.name}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {investment.type} - {investment.annualReturn}% expected return
                    </p>
                  </div>
                  <div className="flex items-center gap-2 font-bold">
                    <span>{money(investment.currentBalance, data.settings.currency)}</span>
                    <IconButton active={editingInvestmentId === investment.id} label={editingInvestmentId === investment.id ? "Cancel edit" : "Edit investment"} onClick={() => editInvestment(investment)}>
                      <Pencil size={16} />
                    </IconButton>
                  <IconButton
                    label="Delete investment"
                    onClick={() =>
                      update((draft) => {
                        draft.investments = draft.investments.filter((item) => item.id !== investment.id);
                        draft.investmentTransactions = draft.investmentTransactions.filter((item) => item.investmentId !== investment.id);
                        return draft;
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </IconButton>
                  </div>
                </div>
                <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950/60">
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={investmentGrowthData} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                      <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--chart-text)" }} />
                      <Tooltip formatter={(value) => money(value, data.settings.currency)} contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} itemStyle={chartTooltipItemStyle} />
                      <Line type="monotone" dataKey="value" stroke="var(--graph-income)" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 space-y-2">
                  {shownHistory.map((entry, index) => (
                    <Row
                      key={entry.id}
                      className={!expandedInvestments[investment.id] && index > 0 ? "hidden sm:flex" : ""}
                      compact
                      left={
                        <>
                          <p className="font-semibold capitalize">{entry.type}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{displayDate(entry.date)} {entry.comment ? `- ${entry.comment}` : ""}</p>
                        </>
                      }
                      right={
                        <div className="flex items-center gap-2">
                          <span style={{ color: entry.type === "contribution" ? "var(--income)" : "var(--expense)" }}>
                            {entry.type === "contribution" ? "+" : "-"}{money(entry.amount, data.settings.currency)}
                          </span>
                          <IconButton
                            active={editingTransactionId === entry.id}
                            label={editingTransactionId === entry.id ? "Cancel edit" : "Edit investment transaction"}
                            onClick={() => {
                              if (editingTransactionId === entry.id && showTransactionForm) {
                                cancelInvestmentTransactionEdit();
                                return;
                              }
                              setEditingTransactionId(entry.id);
                              setShowTransactionForm(true);
                              setTransaction({ investmentId: entry.investmentId, type: entry.type, amount: formatAmount(entry.amount).replace(/\.00$/, ""), date: entry.date, comment: entry.comment || "" });
                              snapToForm(investmentTransactionFormRef, setHighlightTransactionForm);
                            }}
                          >
                            <Pencil size={16} />
                          </IconButton>
                          <IconButton
                            label="Delete investment transaction"
                            onClick={() =>
                              update((draft) => {
                                const target = draft.investments.find((item) => item.id === entry.investmentId);
                                if (target && isApplied(entry)) {
                                  const delta = entry.type === "withdrawal" ? Number(entry.amount || 0) : -Number(entry.amount || 0);
                                  target.currentBalance = Math.max(0, Number(target.currentBalance || 0) + delta);
                                }
                                draft.investmentTransactions = draft.investmentTransactions.filter((item) => item.id !== entry.id);
                                return draft;
                              })
                            }
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        </div>
                      }
                    />
                  ))}
                  {history.length > 1 && (
                    <ShowAllButton
                      expanded={Boolean(expandedInvestments[investment.id])}
                      onClick={() => setExpandedInvestments({ ...expandedInvestments, [investment.id]: !expandedInvestments[investment.id] })}
                      description="View all investment activity"
                    />
                  )}
                </div>
              </div>
            );
          })}
          {!data.investments.length && <Empty text="No investments yet." />}
        </div>
        {data.investments.length > 1 && (
          <ShowAllButton expanded={showAllInvestments} onClick={() => setShowAllInvestments(!showAllInvestments)} description="View all investment accounts" />
        )}
      </Panel>
    </div>
  );
}

function SettingsScreen({ data, update, setData, syncUser }) {
  const [importError, setImportError] = useState("");
  const [syncStatus, setSyncStatus] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [showAllSettings, setShowAllSettings] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const currentDataRef = useRef(data);
  const range = getFinancialRange(data.settings);
  const shownCategories = showAllCategories ? data.categories : data.categories.slice(0, 4);

  useEffect(() => {
    currentDataRef.current = data;
  }, [data]);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `myflowstate-backup-${fileTimestamp()}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  };

  const copyAndShareJson = async () => {
    const fileName = `myflowstate-backup-${fileTimestamp()}.json`;
    const backupJson = JSON.stringify({ ...getPersistentAppData(data), exportedAt: new Date().toISOString() }, null, 2);
    const backupFile = new File([backupJson], fileName, { type: "application/json" });

    try {
      await navigator.clipboard.writeText(backupJson);
      setImportError("Backup JSON copied to clipboard.");
    } catch {
      setImportError("Could not copy backup JSON to clipboard.");
    }

    try {
      if (navigator.canShare?.({ files: [backupFile] })) {
        await navigator.share({
          title: "MyFlowState backup",
          text: "MyFlowState JSON backup",
          files: [backupFile],
        });
        setImportError("Backup JSON copied and shared.");
      } else if (navigator.share) {
        await navigator.share({
          title: "MyFlowState backup",
          text: backupJson,
        });
        setImportError("Backup JSON copied and shared.");
      }
    } catch (error) {
      if (error?.name !== "AbortError") setImportError("Backup JSON copied, but sharing failed.");
    }
  };

  const exportCsv = () => {
    const savingsNames = Object.fromEntries(data.savingGoals.map((item) => [item.id, item.name]));
    const investmentNames = Object.fromEntries(data.investments.map((item) => [item.id, item.name]));
    const rows = [
      ["kind", "title", "amount", "date", "category/type", "notes"],
      ...data.incomes.map((item) => ["income", item.name, item.amount, displayDate(item.date), item.type, item.notes]),
      ...data.expenses.map((item) => ["expense", item.title, item.amount, displayDate(item.date), item.category, item.notes]),
      ...data.savingTransactions.map((item) => [
        item.type === "withdrawal" ? "savings withdrawal" : "savings deposit",
        savingsNames[item.savingGoalId] || "Saving goal",
        item.amount,
        displayDate(item.date),
        "Savings",
        item.comment,
      ]),
      ...data.investmentTransactions.map((item) => [
        item.type === "withdrawal" ? "investment withdrawal" : "investment contribution",
        investmentNames[item.investmentId] || "Investment",
        item.amount,
        displayDate(item.date),
        "Investments",
        item.comment,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = "myflowstate-transactions.csv";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  };

  const importJson = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setData(JSON.parse(reader.result));
        setImportError("");
      } catch {
        setImportError("That backup file could not be imported.");
      }
    };
    reader.readAsText(file);
  };

  const updateFinancialStart = (value) => {
    const selectedDate = parseDate(value || range.start);
    update((draft) => {
      draft.settings.financialStartDate = formatDate(selectedDate);
      draft.settings.financialStartDay = selectedDate.getDate();
      const nextRange = getFinancialRange(draft.settings);
      draft.settings.activeCycleStart = nextRange.start;
      draft.settings.activeCycleEnd = nextRange.end;
      return draft;
    });
  };

  const addCategory = () => {
    const nextCategory = categoryName.trim();
    if (!nextCategory) return;
    update((draft) => {
      draft.categories = uniqueList([...draft.categories, nextCategory]);
      draft.categoryColors = normalizeCategoryColors(draft.categories, {
        ...(draft.categoryColors || {}),
        [nextCategory]: draft.categoryColors?.[nextCategory] || nextCategoryColor(Object.values(draft.categoryColors || {})),
      });
      return draft;
    });
    setCategoryName("");
  };

  const removeCategory = (category) => {
    if (defaultCategories.includes(category)) return;
    update((draft) => {
      draft.categories = draft.categories.filter((item) => item !== category);
      delete draft.categoryColors?.[category];
      return draft;
    });
  };

  const signInWithGoogle = async () => {
    setSyncBusy(true);
    setSyncStatus("Signing in...");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const backup = await readCloudBackup(result.user.uid);
      if (backup) {
        if (confirm("Cloud backup found. Load it?")) {
          setData(backup);
          setSyncStatus("Load successful.");
        } else {
          setSyncStatus("Signed in. Cloud backup was left unchanged.");
        }
      } else if (confirm("No cloud backup found. Save current local data to cloud?")) {
        await writeCloudBackup(result.user.uid, currentDataRef.current);
        setSyncStatus("Save successful.");
      } else {
        setSyncStatus("Signed in. No cloud backup found.");
      }
    } catch (error) {
      console.error(error);
      setSyncStatus(friendlyFirebaseAuthError(error));
    } finally {
      setSyncBusy(false);
    }
  };

  const saveToCloud = async () => {
    if (!syncUser) return;
    if (!confirm("Save current local data to cloud? This will overwrite your cloud backup.")) {
      setSyncStatus("Cloud save cancelled.");
      return;
    }
    setSyncBusy(true);
    setSyncStatus("Saving to cloud...");
    try {
      await writeCloudBackup(syncUser.uid, currentDataRef.current);
      setSyncStatus("Save successful.");
    } catch (error) {
      console.error(error);
      setSyncStatus("Save failed. Please check your connection and try again.");
    } finally {
      setSyncBusy(false);
    }
  };

  const loadFromCloud = async () => {
    if (!syncUser) return;
    if (!confirm("Load cloud backup? This will replace the local data on this device.")) {
      setSyncStatus("Cloud load cancelled.");
      return;
    }
    setSyncBusy(true);
    setSyncStatus("Loading from cloud...");
    try {
      const backup = await readCloudBackup(syncUser.uid);
      if (!backup) {
        setSyncStatus("No cloud backup found.");
        return;
      }
      setData(backup);
      setSyncStatus("Load successful.");
    } catch (error) {
      console.error(error);
      setSyncStatus("Load failed. Please check your connection and try again.");
    } finally {
      setSyncBusy(false);
    }
  };

  const logout = async () => {
    setSyncBusy(true);
    setSyncStatus("Signing out...");
    try {
      await signOut(auth);
      setSyncStatus("Logged out.");
    } catch (error) {
      console.error(error);
      setSyncStatus("Logout failed. Please try again.");
    } finally {
      setSyncBusy(false);
    }
  };

  return (
    <div className="grid min-w-0 gap-4 sm:gap-5 lg:grid-cols-2">
      <Panel title="Preferences">
        <Input
          label="Your name"
          value={data.settings.userName || ""}
          onChange={(value) =>
            update((draft) => {
              draft.settings.userName = value;
              return draft;
            })
          }
        />
        <Select
          label="Visual theme"
          value={data.settings.palette}
          options={paletteOptions}
          labels={Object.fromEntries(paletteOptions.map((key) => [key, getPalette(key).label]))}
          onChange={(value) =>
            update((draft) => {
              draft.settings.palette = value;
              return draft;
            })
          }
        />
        <Input
          label="Currency symbol"
          value={data.settings.currency}
          onChange={(value) =>
            update((draft) => {
              draft.settings.currency = value;
              return draft;
            })
          }
        />
        <FinancialStartInput
          label="Financial month starts on"
          value={data.settings.financialStartDate || range.start}
          onChange={updateFinancialStart}
        />
        {showAllSettings && (
          <>
            <Toggle
              checked={data.settings.adjustFinancialWeekends}
              label="Move weekend cycle starts to the previous working day"
              onChange={(checked) =>
                update((draft) => {
                  draft.settings.adjustFinancialWeekends = checked;
                  return draft;
                })
              }
            />
            <Toggle
              checked={data.settings.hideHeroIncome}
              label="Hide income amount on dashboard"
              onChange={(checked) =>
                update((draft) => {
                  draft.settings.hideHeroIncome = checked;
                  return draft;
                })
              }
            />
            <Toggle
              checked={data.settings.hideHeroNetWorth}
              label="Hide net worth and balance values on dashboard"
              onChange={(checked) =>
                update((draft) => {
                  draft.settings.hideHeroNetWorth = checked;
                  return draft;
                })
              }
            />
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              Current range: {displayRange(range.start, range.end)}
            </div>
          </>
        )}
        <ShowAllButton expanded={showAllSettings} onClick={() => setShowAllSettings(!showAllSettings)} description="View all settings options" />
      </Panel>

      <Panel title="Categories">
        <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Input label="New category" value={categoryName} onChange={setCategoryName} />
          <div className="sm:pt-6">
            <Button onClick={addCategory}>
              <Plus size={16} /> Save Category
            </Button>
          </div>
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
          {shownCategories.map((category) => (
            <span
              key={category}
              className="inline-flex min-w-0 items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            >
              <Tags className="shrink-0" size={14} />
              <span className="min-w-0 truncate">{category}</span>
              {!defaultCategories.includes(category) && (
                <button
                  type="button"
                  aria-label={`Remove ${category}`}
                  className="text-zinc-400 transition hover:text-rose-600"
                  onClick={() => removeCategory(category)}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </span>
          ))}
        </div>
        {data.categories.length > 4 && (
          <ShowAllButton expanded={showAllCategories} onClick={() => setShowAllCategories(!showAllCategories)} description="View all saved categories" />
        )}
      </Panel>

      <Panel title="Cloud Sync">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          {syncUser ? `Signed in as ${syncUser.displayName || syncUser.email}` : "Sign in to save and load your budget across devices."}
        </div>
        {!syncUser ? (
          <Button onClick={signInWithGoogle} disabled={syncBusy}>
            Sign in with Google
          </Button>
        ) : (
          <div className="grid min-w-0 gap-3 sm:grid-cols-3">
            <Button onClick={saveToCloud} disabled={syncBusy}>
              <Upload size={16} /> Save to Cloud
            </Button>
            <Button onClick={loadFromCloud} disabled={syncBusy} variant="secondary">
              <Download size={16} /> Load from Cloud
            </Button>
            <Button onClick={logout} disabled={syncBusy} variant="secondary">
              Logout
            </Button>
          </div>
        )}
        {syncStatus && <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">{syncStatus}</p>}
      </Panel>

      <Panel title="Backup and data">
        <Button onClick={exportJson} variant="secondary">
          <Download size={16} /> Export JSON backup
        </Button>
        <Button onClick={copyAndShareJson} variant="secondary">
          <Upload size={16} /> Copy and share JSON backup
        </Button>
        <Button onClick={exportCsv} variant="secondary">
          <Download size={16} /> Export CSV transactions
        </Button>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-900 transition hover:border-[var(--accent)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
          <Upload size={16} /> Import JSON
          <input
            type="file"
            accept="application/json"
            hidden
            onChange={(event) => event.target.files?.[0] && importJson(event.target.files[0])}
          />
        </label>
        {importError && <p className="text-sm font-semibold text-rose-600 dark:text-rose-300">{importError}</p>}
        <button
          type="button"
          className="w-full rounded-lg bg-rose-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700"
          onClick={() => confirm("Reset all MyFlowState data?") && setData(createInitialState())}
        >
          Reset all data
        </button>
      </Panel>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <section className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4 shadow-[0_12px_35px_rgba(24,24,27,0.07)] dark:border-[#202033] dark:bg-[#11111c] sm:p-5">
      <h2 className="mb-4 break-words text-lg font-black tracking-tight">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Input({ label, value, onChange, type = "text", min, disabled = false }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-zinc-500 dark:text-zinc-400">{label}</span>
      <input
        type={type}
        min={min}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cx(
          "w-full rounded-lg border border-zinc-200 bg-zinc-50/90 p-3 text-sm font-semibold text-zinc-950 shadow-inner outline-none transition placeholder:text-zinc-400 focus:border-[var(--accent)] focus:bg-white focus:ring-4 focus:ring-[var(--accent-soft)] dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-50 dark:focus:bg-zinc-950",
          disabled && "cursor-not-allowed opacity-70",
        )}
      />
    </label>
  );
}

function AmountInput({ label, value, onChange }) {
  const commit = () => {
    if (String(value).trim() === "") return;
    const parsed = parseAmount(value);
    const formatted = formatAmount(parsed).replace(/\.00$/, "");
    onChange(formatted);
  };

  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-zinc-500 dark:text-zinc-400">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onBlur={commit}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-zinc-200 bg-zinc-50/90 p-3 text-sm font-semibold text-zinc-950 shadow-inner outline-none transition placeholder:text-zinc-400 focus:border-[var(--accent)] focus:bg-white focus:ring-4 focus:ring-[var(--accent-soft)] dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-50 dark:focus:bg-zinc-950"
      />
    </label>
  );
}

function DateInput({ label, value, onChange }) {
  const pickerRef = useRef(null);
  const [draftState, setDraftState] = useState({ source: value, draft: displayDate(value) });
  const draft = draftState.source === value ? draftState.draft : displayDate(value);

  const setDate = (nextValue) => {
    onChange(nextValue);
    setDraftState({ source: nextValue, draft: displayDate(nextValue) });
  };

  const commit = (nextValue) => {
    const parsed = parseDisplayDate(nextValue);
    if (!parsed) {
      setDraftState({ source: value, draft: displayDate(value) });
      return;
    }
    setDate(parsed);
  };

  const openPicker = () => {
    if (pickerRef.current?.showPicker) pickerRef.current.showPicker();
    else pickerRef.current?.click();
  };

  return (
    <div className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-zinc-500 dark:text-zinc-400">{label}</span>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          placeholder="dd/mm/yyyy"
          value={draft}
          onBlur={() => commit(draft)}
          onChange={(event) => {
            const nextValue = event.target.value;
            setDraftState({ source: value, draft: nextValue });
            const parsed = parseDisplayDate(nextValue);
            if (parsed) onChange(parsed);
          }}
          className="w-full rounded-lg border border-zinc-200 bg-zinc-50/90 p-3 pr-12 text-sm font-semibold text-zinc-950 shadow-inner outline-none transition placeholder:text-zinc-400 focus:border-[var(--accent)] focus:bg-white focus:ring-4 focus:ring-[var(--accent-soft)] dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-50 dark:focus:bg-zinc-950"
        />
        <button
          type="button"
          aria-label={`Choose ${label.toLowerCase()}`}
          onClick={openPicker}
          className="absolute right-1.5 top-1.5 grid h-9 w-9 place-items-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-[var(--accent-strong)] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <CalendarDays size={17} />
        </button>
        <input
          ref={pickerRef}
          tabIndex={-1}
          aria-hidden="true"
          type="date"
          value={value}
          onChange={(event) => {
            if (event.target.value) setDate(event.target.value);
          }}
          className="pointer-events-none absolute right-1.5 top-1.5 h-9 w-9 opacity-0"
        />
      </div>
    </div>
  );
}

function FinancialStartInput({ label, value, onChange }) {
  const pickerRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const [draftState, setDraftState] = useState({ source: value, draft: ordinalDay(parseDate(value).getDate()) });
  const displayValue = focused ? displayDate(value) : ordinalDay(parseDate(value).getDate());
  const draft = draftState.source === value ? draftState.draft : displayValue;

  const setDate = (nextValue) => {
    onChange(nextValue);
    setDraftState({ source: nextValue, draft: focused ? displayDate(nextValue) : ordinalDay(parseDate(nextValue).getDate()) });
  };

  const commit = (nextValue) => {
    const trimmed = String(nextValue || "").trim();
    const fullDate = parseDisplayDate(trimmed);
    const dayOnly = trimmed.match(/^(\d{1,2})(?:st|nd|rd|th)?$/i);

    if (fullDate) {
      setDate(fullDate);
      return;
    }

    if (dayOnly) {
      const current = parseDate(value);
      const next = dateFromDay(current.getFullYear(), current.getMonth(), Number(dayOnly[1]));
      setDate(formatDate(next));
      return;
    }

    setDraftState({ source: value, draft: focused ? displayDate(value) : ordinalDay(parseDate(value).getDate()) });
  };

  const openPicker = () => {
    if (pickerRef.current?.showPicker) pickerRef.current.showPicker();
    else pickerRef.current?.click();
  };

  return (
    <div className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-zinc-500 dark:text-zinc-400">{label}</span>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          placeholder="25th or dd/mm/yyyy"
          value={draft}
          onFocus={() => {
            setFocused(true);
            setDraftState({ source: value, draft: displayDate(value) });
          }}
          onBlur={() => {
            commit(draft);
            setFocused(false);
            setDraftState({ source: value, draft: ordinalDay(parseDate(value).getDate()) });
          }}
          onChange={(event) => {
            const nextValue = event.target.value;
            setDraftState({ source: value, draft: nextValue });
            const parsed = parseDisplayDate(nextValue);
            if (parsed) onChange(parsed);
          }}
          className="w-full rounded-lg border border-zinc-200 bg-zinc-50/90 p-3 pr-12 text-sm font-black text-zinc-950 shadow-inner outline-none transition placeholder:text-zinc-400 focus:border-[var(--accent)] focus:bg-white focus:ring-4 focus:ring-[var(--accent-soft)] dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-50 dark:focus:bg-zinc-950"
        />
        <button
          type="button"
          aria-label="Choose financial month start date"
          onClick={openPicker}
          className="absolute right-1.5 top-1.5 grid h-9 w-9 place-items-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-[var(--accent-strong)] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <CalendarDays size={17} />
        </button>
        <input
          ref={pickerRef}
          tabIndex={-1}
          aria-hidden="true"
          type="date"
          value={value}
          onChange={(event) => {
            if (event.target.value) setDate(event.target.value);
          }}
          className="pointer-events-none absolute right-1.5 top-1.5 h-9 w-9 opacity-0"
        />
      </div>
      <p className="mt-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
        Uses the {ordinalDay(parseDate(value).getDate())} of each financial month. You can still type a full date or pick one from the calendar.
      </p>
    </div>
  );
}

function Select({ label, value, options, labels = {}, onChange, disabled = false }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-zinc-500 dark:text-zinc-400">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cx(
          "w-full rounded-lg border border-zinc-200 bg-zinc-50/90 p-3 text-sm font-semibold text-zinc-950 shadow-inner outline-none transition focus:border-[var(--accent)] focus:bg-white focus:ring-4 focus:ring-[var(--accent-soft)] dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-50 dark:focus:bg-zinc-950",
          disabled && "cursor-not-allowed opacity-70",
        )}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {labels[option] || option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Button({ children, onClick, variant = "primary", disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold shadow-sm transition",
        variant === "primary"
          ? "bg-[var(--accent-strong)] text-white hover:opacity-90"
          : "border border-zinc-200 bg-white text-zinc-900 hover:border-[var(--accent)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100",
        disabled && "cursor-not-allowed opacity-60 hover:opacity-60",
      )}
    >
      {children}
    </button>
  );
}

const actionButtonTones = {
  green: {
    shell: "border-emerald-700/35 bg-emerald-950/10 hover:border-emerald-500/70 dark:border-emerald-500/25 dark:bg-emerald-950/20",
    icon: "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
    arrow: "text-emerald-600 dark:text-emerald-300",
  },
  purple: {
    shell: "border-violet-700/35 bg-violet-950/10 hover:border-violet-500/70 dark:border-violet-500/25 dark:bg-violet-950/20",
    icon: "border-violet-500/40 bg-violet-500/15 text-violet-600 dark:text-violet-300",
    arrow: "text-violet-600 dark:text-violet-300",
  },
  blue: {
    shell: "border-sky-700/35 bg-sky-950/10 hover:border-sky-500/70 dark:border-sky-500/25 dark:bg-sky-950/20",
    icon: "border-sky-500/40 bg-sky-500/15 text-sky-600 dark:text-sky-300",
    arrow: "text-sky-600 dark:text-sky-300",
  },
  teal: {
    shell: "border-cyan-700/35 bg-cyan-950/10 hover:border-cyan-500/70 dark:border-cyan-500/25 dark:bg-cyan-950/20",
    icon: "border-cyan-500/40 bg-cyan-500/15 text-cyan-600 dark:text-cyan-300",
    arrow: "text-cyan-600 dark:text-cyan-300",
  },
  grey: {
    shell: "border-zinc-300 bg-zinc-100/70 hover:border-zinc-400 dark:border-zinc-700/70 dark:bg-zinc-900/50 dark:hover:border-zinc-500",
    icon: "border-zinc-400/40 bg-zinc-500/15 text-zinc-600 dark:text-zinc-200",
    arrow: "text-zinc-500 dark:text-zinc-300",
  },
};

function ActionButton({ icon: Icon, title, description, tone = "green", onClick, open = false }) {
  const palette = actionButtonTones[tone] || actionButtonTones.green;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "group flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg sm:px-4",
        palette.shell,
      )}
    >
      <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-full border sm:h-12 sm:w-12", palette.icon)}>
        <Icon size={21} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-zinc-950 dark:text-white sm:text-base">{title}</span>
        <span className="mt-0.5 block truncate text-xs font-semibold text-zinc-500 dark:text-zinc-400">{description}</span>
      </span>
      <ChevronRight className={cx("shrink-0 transition group-hover:translate-x-0.5", open && "rotate-90", palette.arrow)} size={23} />
    </button>
  );
}

function ShowAllButton({ expanded, onClick, description = "View all accounts, transactions, goals and activity" }) {
  return (
    <ActionButton
      icon={Grid2X2}
      title={expanded ? "Show Less" : "Show All"}
      description={description}
      tone="grey"
      open={expanded}
      onClick={onClick}
    />
  );
}

function Toggle({ checked, label, onChange }) {
  return (
    <label className="inline-flex w-full min-w-0 items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-black text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 sm:w-auto">
      <span className="min-w-0 leading-snug">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative h-7 w-12 shrink-0 rounded-full border transition",
          checked ? "border-[var(--accent-strong)] bg-[var(--accent-strong)]" : "border-zinc-300 bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800",
        )}
      >
        <span
          className={cx(
            "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition",
            checked ? "left-6" : "left-1",
          )}
        />
      </button>
    </label>
  );
}

function IconButton({ children, label, onClick, active = false }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      title={label}
      className={cx(
        "grid h-9 w-9 shrink-0 place-items-center rounded-md transition",
        active
          ? "bg-[var(--accent-strong)] text-white shadow-sm"
          : "text-zinc-500 hover:bg-zinc-100 hover:text-rose-600 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-rose-300",
      )}
    >
      {children}
    </button>
  );
}

function Segment({ options, value, setValue, labels = {} }) {
  return (
    <div className="grid overflow-hidden rounded-lg bg-[var(--accent-soft)] p-1 dark:bg-zinc-900" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setValue(option)}
          className={cx(
            "min-w-0 truncate rounded-md px-0.5 py-2 text-[8px] font-bold capitalize transition min-[360px]:text-[9px] sm:px-3 sm:text-xs",
            value === option
              ? "bg-[var(--accent-strong)] text-white shadow-sm"
              : "text-[var(--accent-strong)] opacity-75 hover:opacity-100 dark:text-zinc-300",
          )}
        >
          {labels[option] || option}
        </button>
      ))}
    </div>
  );
}

function Row({ left, right, className, compact = false }) {
  return (
    <div
      className={cx(
        "flex flex-col rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/70 sm:flex-row sm:items-center sm:justify-between",
        compact ? "gap-2 p-3" : "gap-3 p-3 sm:p-4",
        className,
      )}
    >
      <div className="min-w-0">{left}</div>
      <div className="font-bold sm:text-right">{right}</div>
    </div>
  );
}

function CompactUpcomingRow({ item, currency, onRecordRecurring, onToggleRecurring, onEditRecurring, recurringEditing = false, onDeleteRecurring, onEditPending, pendingEditing = false, onDeletePending }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/70">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-zinc-900 dark:text-white">{item.title || item.type || item.category}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className="rounded bg-[var(--accent-soft)] px-2 py-0.5 text-[9px] font-black uppercase text-[var(--accent-strong)] dark:bg-zinc-800 dark:text-zinc-200">
              {item.group}
            </span>
            {item.source === "recurring" && (
              <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 text-[9px] font-black uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <CalendarDays size={10} /> Recurring
              </span>
            )}
            {item.source === "recurring" && item.active === false && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase text-amber-700 dark:bg-amber-950/50 dark:text-amber-200">
                Paused
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
            {item.subtitle} {item.frequency ? `- ${item.frequency}` : ""} - Due {displayDate(item.dueDate)}
          </p>
          {(item.notes || item.comment) && <p className="mt-1 truncate text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{item.notes || item.comment}</p>}
        </div>
        <span className="shrink-0 pt-1 text-sm font-black" style={{ color: item.sign >= 0 ? "var(--income)" : "var(--expense)" }}>
          {item.sign >= 0 ? "+" : "-"}{money(item.amount, currency)}
        </span>
      </div>
      <div className="mt-2 flex justify-end gap-1.5">
        {item.source === "recurring" ? (
          <>
            <TinyIconButton label={item.kind === "income" ? "Received" : "Paid"} onClick={item.active === false ? undefined : onRecordRecurring}>
              <CheckCircle2 size={14} />
            </TinyIconButton>
            <TinyIconButton label={item.active ? "Pause" : "Resume"} onClick={onToggleRecurring}>
              <PauseCircle size={14} />
            </TinyIconButton>
            <TinyIconButton active={recurringEditing} label={recurringEditing ? "Cancel edit" : "Edit recurring item"} onClick={onEditRecurring}>
              <Pencil size={14} />
            </TinyIconButton>
            <TinyIconButton label="Delete recurring item" onClick={onDeleteRecurring}>
              <Trash2 size={14} />
            </TinyIconButton>
          </>
        ) : (
          <>
            {(item.group === "Income" || item.group === "Expenses") && (
              <TinyIconButton active={pendingEditing} label={pendingEditing ? "Cancel edit" : "Edit pending transaction"} onClick={onEditPending}>
                <Pencil size={14} />
              </TinyIconButton>
            )}
            <TinyIconButton label="Delete pending transaction" onClick={onDeletePending}>
              <Trash2 size={14} />
            </TinyIconButton>
          </>
        )}
      </div>
    </div>
  );
}

function TinyIconButton({ children, label, onClick, active = false }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx(
        "grid h-7 w-7 place-items-center rounded-md border transition",
        active
          ? "border-[var(--accent-strong)] bg-[var(--accent-strong)] text-white"
          : "border-zinc-200 bg-white text-zinc-500 hover:border-[var(--accent)] hover:text-[var(--accent)] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300",
      )}
    >
      {children}
    </button>
  );
}

export default function BudgetFlowApp() {
  const [data, update, setData] = useBudgetStore();
  const syncUser = useFirebaseUser();
  const [tab, setTab] = useState("Dashboard");
  const [aiDraft, setAiDraft] = useState(null);

  useEffect(() => {
    if (import.meta.env.DEV) runDevAssertions();
  }, []);

  return (
    <Shell data={data} update={update} tab={tab} setTab={setTab}>
      {tab === "Dashboard" && <Dashboard data={data} update={update} syncUser={syncUser} />}
      {tab === "Transactions" && <Transactions data={data} update={update} syncUser={syncUser} setTab={setTab} setAiDraft={setAiDraft} />}
      {tab === "Recurring" && <Recurring data={data} update={update} />}
      {tab === "Savings" && <Savings data={data} update={update} aiDraft={aiDraft} clearAiDraft={() => setAiDraft(null)} />}
      {tab === "Investments" && <Investments data={data} update={update} aiDraft={aiDraft} clearAiDraft={() => setAiDraft(null)} />}
      {tab === "Settings" && <SettingsScreen data={data} update={update} setData={setData} syncUser={syncUser} />}
    </Shell>
  );
}
