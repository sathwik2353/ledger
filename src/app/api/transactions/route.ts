
import { NextRequest, NextResponse } from "next/server";
import { authServer } from "@/lib/auth/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TransactionType = "income" | "expense";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Supports both common Neon Auth session response shapes:
 * { user } and { data: { user } }.
 */
async function currentUserId(): Promise<string | null> {
  try {
    const result: unknown = await authServer.getSession();

    if (!result || typeof result !== "object") {
      return null;
    }

    const response = result as Record<string, unknown>;

    let user: unknown = response.user;

    if (!user && response.data && typeof response.data === "object") {
      user = (response.data as Record<string, unknown>).user;
    }

    if (!user || typeof user !== "object") {
      return null;
    }

    const id = (user as Record<string, unknown>).id;

    return typeof id === "string" && id.length > 0 ? id : null;
  } catch (error) {
    console.error(
      "Neon Auth session lookup failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return null;
  }
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export async function GET() {
  const userId = await currentUserId();

  if (!userId) {
    return jsonError("Please sign in before accessing transactions.", 401);
  }

  try {
    const transactions = await sql`
      SELECT *
      FROM transactions
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error(
      "Failed to load transactions:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return jsonError("Failed to load transactions.", 500);
  }
}

export async function POST(request: NextRequest) {
  const userId = await currentUserId();

  if (!userId) {
    return jsonError("Please sign in before creating a transaction.", 401);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON request body.", 400);
  }

  if (!isRecord(body)) {
    return jsonError("Invalid transaction data.", 400);
  }

  const amount =
    typeof body.amount === "number" || typeof body.amount === "string"
      ? Number(body.amount)
      : NaN;

  // Accept the dashboard's field names and the API's previous field names.
  const titleValue = body.title ?? body.description;
  const dateValue = body.transaction_date ?? body.date;

  const description =
    typeof titleValue === "string" ? titleValue.trim() : "";

  const category =
    typeof body.category === "string" ? body.category.trim() : "";

  const type = body.type;
  const date = typeof dateValue === "string" ? dateValue : "";

  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonError("Enter a valid amount greater than zero.", 400);
  }

  if (!description || description.length > 200) {
    return jsonError("The transaction title must be 1–200 characters.", 400);
  }

  if (type !== "income" && type !== "expense") {
    return jsonError("Transaction type must be income or expense.", 400);
  }

  if (!category || category.length > 100) {
    return jsonError("The category must be 1–100 characters.", 400);
  }

  if (!validDate(date)) {
    return jsonError("Enter a valid transaction date.", 400);
  }

  try {
    const rows = await sql`
  INSERT INTO transactions (
    user_id,
    title,
    amount,
    description,
    type,
    category,
    date
  )
  VALUES (
    ${userId},
    ${description},
    ${amount},
    ${description},
    ${String(type)},
    ${category},
    ${date}
  )
  RETURNING *
`;

    return NextResponse.json(
      { transaction: rows[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Failed to create transaction:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return jsonError("Failed to save transaction.", 500);
  }
}
