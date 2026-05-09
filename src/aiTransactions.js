import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

const parseTransaction = httpsCallable(functions, "parseTransaction");

function friendlyCallableError(error) {
  const code = error?.code || "";
  const details = error?.details || {};
  const message = String(error?.message || "");

  if (details.reason) return details.reason;
  if (code === "functions/unauthenticated") return "Please sign in to use AI transaction parsing.";
  if (code === "functions/failed-precondition") return "AI parsing is not configured yet. Please redeploy the function with GROQ_API_KEY set.";
  if (code === "functions/invalid-argument") return message || "Please enter a transaction to parse.";
  if (code === "functions/internal" || message === "internal") {
    return "AI parsing failed inside the Firebase function. Check the function logs for the AI provider error, then try again.";
  }

  return message || "AI parsing failed. Please reword it and try again.";
}

export async function parseNaturalTransaction({ text, currency, categories }) {
  try {
    const result = await parseTransaction({
      text,
      today: new Date().toISOString().slice(0, 10),
      currency,
      categories,
    });

    return result.data;
  } catch (error) {
    const nextError = new Error(friendlyCallableError(error));
    nextError.code = error?.code;
    nextError.details = error?.details;
    throw nextError;
  }
}
