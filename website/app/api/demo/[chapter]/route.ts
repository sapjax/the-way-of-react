import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";

const CODE_ROOT = path.join(process.cwd(), "..", "code");

export async function GET(_request: NextRequest, { params }: { params: Promise<{ chapter: string }> }) {
  const { chapter } = await params;
  if (!/^ch\d{2}$/.test(chapter)) {
    return new Response("Not found", { status: 404 });
  }

  const filePath = path.join(CODE_ROOT, `${chapter}.html`);
  if (!fs.existsSync(filePath)) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(fs.readFileSync(filePath, "utf8"), {
    headers: {
      "content-type": "text/html; charset=utf-8"
    }
  });
}
