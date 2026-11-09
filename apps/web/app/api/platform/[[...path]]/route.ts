import { notImplemented } from "@/server/http/respond";

function platform501() {
  return notImplemented("platform");
}

export const GET = platform501;
export const POST = platform501;
export const PUT = platform501;
export const PATCH = platform501;
export const DELETE = platform501;
