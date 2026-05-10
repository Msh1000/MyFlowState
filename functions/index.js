const Groq = require("groq-sdk");
const admin = require("firebase-admin");
const {setGlobalOptions} = require("firebase-functions");
const {HttpsError, onCall} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

admin.initializeApp();
setGlobalOptions({maxInstances: 10});

const GROQ_MODEL = "llama-3.1-8b-instant";
const DAILY_AI_LIMIT = 30;
const AI_COOLDOWN_MS = 2000;
const MAX_PARSED_ACTIONS = 5;
const ACTION_TYPES = new Set([
  "income",
  "expense",
  "saving_goal",
  "saving_deposit",
  "saving_withdrawal",
  "investment_account",
  "investment_contribution",
  "investment_withdrawal",
]);
const FREQUENCIES = new Set(["none", "weekly", "monthly", "yearly"]);
const firestore = admin.firestore();
const fieldValue = admin.firestore.FieldValue;
const timestamp = admin.firestore.Timestamp;

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
  const warnings = asWarnings(raw?.warnings);
  const amount = Number(raw?.amount);
  const rawType = asString(raw?.actionType || raw?.transactionType);
  const actionType = ACTION_TYPES.has(rawType) ? rawType : "expense";
  const needsAmount = !["saving_goal", "investment_account"].includes(actionType) ||
    Number.isFinite(amount) && amount > 0;

  if (needsAmount && (!Number.isFinite(amount) || amount <= 0)) {
    warnings.push("Amount was missing or unclear.");
  }

  const frequency = FREQUENCIES.has(raw?.frequency) ? raw.frequency : "none";
  const category = asString(raw?.category) ||
    (actionType === "income" ? "Salary" : request.categories[0] || "Other");
  const actionName = asString(raw?.name || raw?.title, "Untitled action").slice(0, 120);
  const goalName = actionType === "saving_goal" ?
    actionName :
    asString(raw?.goalName || raw?.accountName).slice(0, 120);
  const investmentName = actionType === "investment_account" ?
    actionName :
    asString(raw?.investmentName || raw?.accountName).slice(0, 120);
  const accountName = actionType === "saving_goal" ?
    actionName :
    actionType === "investment_account" ?
      actionName :
      asString(raw?.accountName).slice(0, 120);
  const normalizedDate = normalizeDate(raw?.date, request.today);
  const normalizedGoalDate = normalizeDate(raw?.goalDate, request.today);
  const actionDate = actionType === "saving_goal" &&
    Number.isFinite(amount) &&
    amount > 0 &&
    normalizedDate === normalizedGoalDate &&
    normalizedGoalDate !== request.today ?
    request.today :
    normalizedDate;

  return {
    actionType,
    transactionType: actionType,
    title: actionName,
    name: actionName,
    amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
    date: actionDate,
    category: category.slice(0, 80),
    type: asString(raw?.type || raw?.category).slice(0, 80),
    accountName,
    goalName,
    investmentName,
    goalAmount: Number(raw?.goalAmount) > 0 ? Number(raw.goalAmount) : 0,
    goalDate: normalizedGoalDate,
    isRecurring: Boolean(raw?.isRecurring),
    frequency,
    notes: asString(raw?.notes).slice(0, 500),
    confidence: normalizeConfidence(raw?.confidence, warnings),
    warnings,
  };
}

function parseAndValidateJson(text, request) {
  const raw = extractJson(text);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Parsed response was not an object.");
  }

  const rawActions = Array.isArray(raw.actions) ?
    raw.actions :
    Array.isArray(raw.transactions) ? raw.transactions :
    [raw];
  if (!rawActions.length) {
    throw new Error("Parsed response did not include actions.");
  }

  const limitedActions = rawActions
    .slice(0, MAX_PARSED_ACTIONS)
    .map((item) => validateParseResult(item, request));
  const warnings = asWarnings(raw.warnings);

  if (rawActions.length > MAX_PARSED_ACTIONS) {
    warnings.push("Only the first 5 AI forms were created.");
  }

  const averageConfidence = limitedActions.reduce(
    (sum, item) => sum + item.confidence,
    0,
  ) / limitedActions.length;

  return {
    actions: limitedActions,
    transactions: limitedActions,
    overallConfidence: Number.isFinite(Number(raw.overallConfidence)) ?
      normalizeConfidence(raw.overallConfidence, warnings) :
      averageConfidence,
    warnings,
  };
}

function validateRequest(data) {
  const text = asString(data?.text);
  if (!text) {
    throw new HttpsError("invalid-argument", "Please enter a transaction to parse.");
  }
  if (text.length > 150) {
    throw new HttpsError(
      "invalid-argument",
      "That transaction is too long. Please shorten it and try again.",
    );
  }

  const today = normalizeDate(data?.today, new Date().toISOString().slice(0, 10));
  const categories = Array.isArray(data?.categories) ?
    data.categories.map((item) => asString(item)).filter(Boolean).slice(0, 40) :
    [];
  const savingGoals = Array.isArray(data?.savingGoals) ?
    data.savingGoals.map((item) => asString(item)).filter(Boolean).slice(0, 40) :
    [];
  const investments = Array.isArray(data?.investments) ?
    data.investments.map((item) => asString(item)).filter(Boolean).slice(0, 40) :
    [];

  return {
    text,
    today,
    currency: asString(data?.currency, "R").slice(0, 8),
    categories,
    savingGoals,
    investments,
  };
}

function buildPrompt(request) {
  return `You parse personal finance notes into strict JSON only.

Rules:
- Return exactly one JSON object and no markdown.
- Support one action or multiple actions in the same prompt.
- Create a separate action for each distinct amount/action/form.
- Do not combine separate purchases, deposits, income payments, or bills into
  one action.
- Return at most ${MAX_PARSED_ACTIONS} actions.
- If the prompt contains more than ${MAX_PARSED_ACTIONS} actions, parse only the first
  ${MAX_PARSED_ACTIONS} and add this warning exactly:
  "Only the first 5 AI forms were created."
- If date is missing, use today: ${request.today}.
- For saving_goal actions, date means the deposit date. goalDate means the
  target date. Keep them separate.
- If a saving_goal prompt includes a target date but no deposit date, set date
  to today (${request.today}) and set goalDate to the inferred target date.
- Do not copy goalDate into date unless the prompt explicitly says the deposit
  happens on that same date.
- Currency symbol is ${request.currency}.
- Known expense categories: ${request.categories.join(", ") || "none"}.
- Known saving goals: ${request.savingGoals.join(", ") || "none"}.
- Known investments: ${request.investments.join(", ") || "none"}.
- Savings and investment contributions are not expenses.
- Use saving_goal to create a new saving goal. If the prompt also adds money
  to that new goal, include that amount on the same saving_goal action.
- If the user says "new goal", "create a goal", or "called X", do not match it
  to any existing saving goal. Set name, title, accountName, and goalName to
  the explicit new goal name X.
- Use investment_account to create a new investment account. If the prompt
  also adds money to it, include that amount on the same investment_account
  action.
- Money added to an existing saving goal must be saving_deposit.
- Money added to an existing investment must be investment_contribution.
- Put the matched saving goal or investment name in accountName.
- If amount is missing or unclear, set amount to 0, confidence below 0.5,
  and add a warning.
- Use ISO date format YYYY-MM-DD.
- actionType must be one of:
  income, expense, saving_goal, saving_deposit, saving_withdrawal,
  investment_account, investment_contribution, investment_withdrawal.
- frequency must be one of: none, weekly, monthly, yearly.

Examples:
- "Spent R450 on fuel yesterday and R200 on food today" returns two expense
  transactions.
- "Salary R22000 today, Netflix R199 monthly, fuel R500 yesterday" returns
  three transactions.
- "Add R2000 to TFSA and R1000 to emergency fund" returns two actions based
  on the account names.
- "Create a new goal called car with a goal amount of 10000 which I want to
  reach by December and add 5000 to it" returns one saving_goal action with
  name Car, goalAmount 10000, a reasonable December goalDate, amount 5000,
  and date ${request.today} unless the deposit date is stated separately.

JSON shape:
{
  "actions": [
    {
      "actionType": "expense",
      "title": "Fuel",
      "name": "Fuel",
      "amount": 450,
      "date": "${request.today}",
      "category": "Transport",
      "type": "Transport",
      "accountName": "",
      "goalName": "",
      "investmentName": "",
      "goalAmount": 0,
      "goalDate": "${request.today}",
      "isRecurring": false,
      "frequency": "none",
      "notes": "",
      "confidence": 0.92,
      "warnings": []
    }
  ],
  "overallConfidence": 0.92,
  "warnings": []
}

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

Return only a valid JSON object in the requested shape now. Do not include
markdown, comments, explanations, arrays outside the object, or extra text.`;
}

function buildMessages(request, retryContext) {
  return [
    {
      role: "system",
      content: "Parse personal finance text into strict JSON with an actions array. " +
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

function usageDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function listFromEnv(name) {
  return asString(process.env[name])
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function hasDeveloperBypass(request) {
  if (asString(process.env.AI_USAGE_BYPASS, "").toLowerCase() === "true") {
    return true;
  }

  const uid = asString(request.auth?.uid).toLowerCase();
  const email = asString(request.auth?.token?.email).toLowerCase();
  return listFromEnv("AI_USAGE_BYPASS_UIDS").includes(uid) ||
    listFromEnv("AI_USAGE_BYPASS_EMAILS").includes(email);
}

function usagePayload(data, lastRequestAt, bypass = false) {
  const formsCreated = Number(data?.formsCreated || data?.count || 0);
  const promptsSent = Number(data?.promptsSent || 0);
  return {
    count: formsCreated,
    promptsSent,
    formsCreated,
    aiFormsCreatedToday: formsCreated,
    aiPromptsSentToday: promptsSent,
    totalAiUsageToday: formsCreated,
    limit: DAILY_AI_LIMIT,
    remaining: Math.max(0, DAILY_AI_LIMIT - formsCreated),
    lastRequestAt: lastRequestAt?.toDate?.().toISOString?.() || null,
    date: usageDateKey(),
    bypass,
  };
}

async function checkAiUsage(request) {
  const uid = request.auth.uid;
  const dateKey = usageDateKey();
  const bypass = hasDeveloperBypass(request);

  if (bypass) {
    return usagePayload({}, null, true);
  }

  const ref = firestore.doc(`users/${uid}/aiUsage/${dateKey}`);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.exists ? snapshot.data() : {};
    const formsCreated = Number(data.formsCreated || data.count || 0);
    const lastRequestAt = data.lastRequestAt;
    const lastMillis = lastRequestAt?.toMillis?.() || 0;
    const nowMillis = Date.now();

    if (formsCreated >= DAILY_AI_LIMIT) {
      throw new HttpsError("resource-exhausted", "Daily AI limit reached.");
    }

    if (lastMillis && nowMillis - lastMillis < AI_COOLDOWN_MS) {
      throw new HttpsError(
        "failed-precondition",
        "Please wait a moment before trying again.",
      );
    }

    return usagePayload(data, lastRequestAt);
  });
}

async function recordAiUsage(request, formsCreated) {
  const uid = request.auth.uid;
  const dateKey = usageDateKey();
  const bypass = hasDeveloperBypass(request);

  if (bypass) {
    return usagePayload({}, null, true);
  }

  const acceptedForms = Math.max(1, Number(formsCreated || 1));
  const ref = firestore.doc(`users/${uid}/aiUsage/${dateKey}`);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.exists ? snapshot.data() : {};
    const currentForms = Number(data.formsCreated || data.count || 0);

    if (currentForms + acceptedForms > DAILY_AI_LIMIT) {
      throw new HttpsError("resource-exhausted", "Daily AI limit reached.");
    }

    const now = timestamp.now();
    transaction.set(ref, {
      count: fieldValue.increment(acceptedForms),
      promptsSent: fieldValue.increment(1),
      formsCreated: fieldValue.increment(acceptedForms),
      totalAiUsageToday: fieldValue.increment(acceptedForms),
      lastRequestAt: now,
      updatedAt: now,
    }, {merge: true});

    return usagePayload({
      promptsSent: Number(data.promptsSent || 0) + 1,
      formsCreated: currentForms + acceptedForms,
    }, now);
  });
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
  await checkAiUsage(request);

  try {
    const parsed = await parseWithGroq(parsedRequest);
    const usage = await recordAiUsage(request, parsed.actions?.length || 1);
    return {
      ...parsed,
      usage,
    };
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
