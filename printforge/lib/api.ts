import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "./auth";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function created<T>(data: T) {
  return NextResponse.json({ data }, { status: 201 });
}

export function fail(message: string, status = 400, extra?: unknown) {
  return NextResponse.json({ error: message, details: extra }, { status });
}

// Translate thrown errors into consistent JSON responses.
export function handleError(err: unknown) {
  if (err instanceof AuthError) return fail(err.message, err.status);
  if (err instanceof ZodError) {
    return fail("Validation failed", 422, err.flatten());
  }
  console.error(err);
  return fail("Internal server error", 500);
}
