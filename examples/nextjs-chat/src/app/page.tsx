import { ensureBotInitialized } from "@/lib/bot";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let status = "not initialized";
  let detail = "";
  try {
    await ensureBotInitialized();
    status = "initialized";
    detail = "The resident WebSocket client is running in this Node.js process.";
  } catch (error) {
    status = "failed";
    detail = error instanceof Error ? error.message : "Unknown initialization error";
  }

  return (
    <main>
      <h1>Chat SDK WeCom Example</h1>
      <p>Use this app to test single-chat messages and group messages that mention the WeCom intelligent robot.</p>
      <p><strong>Adapter status:</strong> {status}</p>
      <p>{detail}</p>
      <h2>Test checklist</h2>
      <ol>
        <li>Invite the intelligent robot to a test group.</li>
        <li>Send a group message that mentions the robot.</li>
        <li>Confirm the Chat SDK handler replies in WeCom.</li>
        <li>Open <code>/api/status</code> to inspect process status.</li>
      </ol>
    </main>
  );
}
