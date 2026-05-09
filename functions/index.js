const Groq = require("groq-sdk");
const {setGlobalOptions} = require("firebase-functions");
const {HttpsError, onCall} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

setGlobalOptions({maxInstances: 10});

const GROQ_MODEL = "llama-3.1-8b-instant";
const TRANSACTION_TYPES = new Set([
  "income",
  "expense",
  "saving_deposit",
  "saving_withdrawal",
  "investment_contribution",
  "investment_withdrawal",
]);
const FREQUENCIES = new Set(["none", "weekly", "monthly", "yearly"]);

function asString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function asWarnings(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean).slice(0, 5);
}

function normalizeDate(value, today) {
  const date = asString(value, today);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
}

function normalizeConfidence(value, warnings) {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) return warnings.length ? 0.45 : 0.7;
  return Math.max(0, Math.min(1, confidence));
}

function extractJson(text) {
  const cleaned = asString(text)
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return JSON.");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

function validateParseResult(raw, request) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Parsed response was not an object.");
  }

  const warnings = asWarnings(raw.warnings);
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    warnings.push("Amount was missing or unclear.");
  }

  const transactionType = TRANSACTION_TYPES.has(raw.transactionType) ?
    raw.transactionType :
    "expense";
  const frequency = FREQUENCIES.has(raw.frequency) ? raw.frequency : "none";
  const category = asString(raw.category) ||
    (transactionType === "income" ? "Salary" : request.categories[0] || "Other");

  return {
    transactionType,
    title: asString(raw.title, "Untitled transaction").slice(0, 120),
    amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
    date: normalizeDate(raw.date, request.today),
    category: category.slice(0, 80),
    accountName: asString(raw.accountName).slice(0, 120),
    isRecurring: Boolean(raw.isRecurring),
    frequency,
    notes: asString(raw.notes).slice(0, 500),
    confidence: normalizeConfidence(raw.confidence, warnings),
    warnings,
  };
}

function parseAndValidateJson(text, request) {
  return validateParseResult(extractJson(text), request);
}

function validateRequest(data) {
  const text = asString(data?.text);
  if (!text) {
    throw new HttpsError("invalid-argument", "Please enter a transaction to parse.");
  }
  if (text.length > 1000) {
    throw new HttpsError(
      "invalid-argument",
      "That transaction is too long. Please shorten it and try again.",
    );
  }

  const today = normalizeDate(data?.today, new Date().toISOString().slice(0, 10));
  const categories = Array.isArray(data?.categories) ?
    data.categories.map((item) => asString(item)).filter(Boolean).slice(0, 40) :
    [];

  return {
    text,
    today,
    currency: asString(data?.currency, "R").slice(0, 8),
    categories,
  };
}

function buildPrompt(request) {
  return `You parse one personal finance note into strict JSON only.

Rules:
- Return exactly one JSON object and no markdown.
- If date is missing, use today: ${request.today}.
- Currency symbol is ${request.currency}.
- Known expense categories: ${request.categories.join(", ") || "none"}.
- Savings and investment contributions are not expenses.
- If amount is missing or unclear, set amount to 0, confidence below 0.5,
  and add a warning.
- Use ISO date format YYYY-MM-DD.
- transactionType must be one of:
  income, expense, saving_deposit, saving_withdrawal,
  investment_contribution, investment_withdrawal.
- frequency must be one of: none, weekly, monthly, yearly.

JSON keys:
transactionType, title, amount, date, category, accountName, isRecurring,
frequency, notes, confidence, warnings.

Text to parse:
${request.text}`;
}

function buildStrictRetryPrompt(request, invalidOutput, errorMessage) {
  return `${buildPrompt(request)}

The previous AI output was invalid and could not be parsed.
Validation error:
${errorMessage}

Invalid output:
${asString(invalidOutput).slice(0, 1500)}

Return only a valid JSON object now. Do not include markdown, comments,
explanations, arrays, or extra text.`;
}

function buildMessages(request, retryContext) {
  return [
    {
      role: "system",
      content: "Parse personal finance text into one strict JSON object. " +
        "Return no markdown.",
    },
    {
      role: "user",
      content: retryContext ?
        buildStrictRetryPrompt(request, retryContext.output, retryContext.error) :
        buildPrompt(request),
    },
  ];
}

function groqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new HttpsError(
      "failed-precondition",
      "Groq AI parsing is not configured yet. Add GROQ_API_KEY and redeploy functions.",
    );
  }
  return new Groq({apiKey});
}

async function generateGroqJson(parsedRequest, retryContext) {
  const completion = await groqClient().chat.completions.create({
    model: GROQ_MODEL,
    messages: buildMessages(parsedRequest, retryContext),
    temperature: retryContext ? 0 : 0.1,
    response_format: {
      type: "json_object",
    },
    stream: false,
  });

  return completion.choices?.[0]?.message?.content || "";
}

async function parseWithGroq(parsedRequest) {
  const firstOutput = await generateGroqJson(parsedRequest);
  try {
    return parseAndValidateJson(firstOutput, parsedRequest);
  } catch (error) {
    logger.warn("Groq parse output invalid; retrying once", {
      error: error?.message,
    });
    const secondOutput = await generateGroqJson(parsedRequest, {
      output: firstOutput,
      error: error?.message || "Invalid JSON output.",
    });
    return parseAndValidateJson(secondOutput, parsedRequest);
  }
}

exports.parseTransaction = onCall({
  invoker: "public",
  timeoutSeconds: 30,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Please sign in before using AI transaction parsing.",
    );
  }

  const parsedRequest = validateRequest(request.data);

  try {
    return await parseWithGroq(parsedRequest);
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("parseTransaction failed", error);
    const reason = asString(error?.message) ||
      asString(error?.status) ||
      "Groq request failed.";
    throw new HttpsError(
      "internal",
      "AI could not understand that transaction. Please reword it and try again.",
      {reason},
    );
  }
});
