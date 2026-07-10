import { ensureBotInitialized } from "@/lib/bot";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureBotInitialized();
    return Response.json({ adapter: "wecom", status: "initialized" });
  } catch (error) {
    return Response.json({
      adapter: "wecom",
      status: "error",
      message: error instanceof Error ? error.message : "Unknown initialization error",
    }, { status: 503 });
  }
}
