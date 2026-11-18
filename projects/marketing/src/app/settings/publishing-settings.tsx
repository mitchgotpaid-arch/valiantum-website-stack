import type { PublishingDestination } from "@/data/publishing";

export function PublishingSettings({ destinations, metaConfigured, metaOutcome }: { destinations: PublishingDestination[]; metaConfigured: boolean; metaOutcome?: string }) {
  const facebook = destinations.find((destination) => destination.channel === "FACEBOOK");
  const instagram = destinations.find((destination) => destination.channel === "INSTAGRAM");
  const tiktok = destinations.find((destination) => destination.channel === "TIKTOK");
  const x = destinations.find((destination) => destination.channel === "X");
  const metaConnected = facebook?.connectionStatus === "CONNECTED" || instagram?.connectionStatus === "CONNECTED";
  const brandId = destinations[0]?.brandId;
  const notice = metaNotice(metaOutcome);

  return <div className="publishing-settings">
    <div className="publishing-summary">
      <div><span className="eyebrow">Lowest-cost configuration</span><strong>Meta automatic · TikTok approval path · X manual</strong><p>Facebook and Instagram share one secure Meta connection. TikTok will use its official Content Posting API after developer approval. X stays a free manual handoff.</p></div>
      <span className="badge warning">Publishing stays off</span>
    </div>

    <div className="channel-list">
      <article className="channel-card">
        <div className="channel-icon meta-icon">M</div>
        <div className="channel-copy"><div className="channel-title"><strong>Facebook + Instagram</strong><span className={`status ${metaConnected ? "status-connected" : "status-setup_required"}`}>{metaConnected ? "Connected" : "Setup required"}</span></div><p>Automatic publishing through Meta’s official APIs. One Meta app can connect a Facebook Page and its Instagram professional account.</p><div className="channel-details"><span>Facebook: {destinationLabel(facebook)}</span><span>Instagram: {destinationLabel(instagram)}</span></div></div>
        {metaConfigured && brandId ? <a className="button" href={`/marketing/api/meta/connect?brandId=${encodeURIComponent(brandId)}`}>{metaConnected ? "Reconnect Meta" : "Connect Meta"}</a> : <button className="button" disabled type="button">Add Meta credentials first</button>}
      </article>

      <article className="channel-card">
        <div className="channel-icon tiktok-icon">T</div>
        <div className="channel-copy"><div className="channel-title"><strong>TikTok</strong><span className={`status ${tiktok?.connectionStatus === "CONNECTED" ? "status-connected" : "status-setup_required"}`}>{tiktok?.connectionStatus === "CONNECTED" ? "Connected" : "Developer setup required"}</span></div><p>Phase one will upload a draft for final review in TikTok. Direct Post follows after TikTok approves the app and publishing scope.</p><div className="channel-details"><span>Planned mode: creator confirmation</span><span>{tiktok ? destinationLabel(tiktok) : "Database setup pending"}</span></div></div>
        <a className="button secondary" href="https://developers.tiktok.com/" rel="noreferrer" target="_blank">TikTok developer portal</a>
      </article>

      <article className="channel-card">
        <div className="channel-icon x-icon">X</div>
        <div className="channel-copy"><div className="channel-title"><strong>X</strong><span className="status status-ready">Manual handoff</span></div><p>Valiantum will generate the final copy and assets, then open X for your final review and manual post. No X API subscription or usage charge.</p><div className="channel-details"><span>{x?.connectionStatus === "READY" ? "Ready—no account connection needed" : "Preparing manual handoff"}</span></div></div>
      </article>
    </div>

    {notice ? <div className={`setup-callout ${notice.tone}`} role={notice.tone === "success" ? "status" : "alert"}><strong>{notice.title}</strong><p>{notice.message}</p></div> : null}
    {!metaConfigured ? <div className="setup-callout"><strong>Next dependency: Meta developer app</strong><p>Add the server-only Meta App ID, App Secret, Graph API version, and Login Configuration ID to the environment. Never paste Page tokens into a normal settings field.</p></div> : <div className="setup-callout"><strong>Secure Meta connection is ready</strong><p>Connect one Facebook Page and its linked Instagram professional account. Credentials are encrypted before storage. Connecting an account does not enable automatic publishing.</p></div>}
  </div>;
}

function metaNotice(outcome: string | undefined): { title: string; message: string; tone: "success" | "error" } | null {
  if (!outcome) return null;
  if (outcome === "connected") return { title: "Meta connected", message: "The Facebook Page and linked Instagram account are ready for provider testing. Automatic publishing remains off.", tone: "success" };
  if (outcome === "instagram_missing") return { title: "Facebook connected; Instagram needs attention", message: "Meta did not return a linked Instagram professional account. Verify the Instagram account is professional and linked to the selected Page.", tone: "error" };
  if (outcome === "multiple_pages") return { title: "Select one Facebook Page", message: "The authorization returned multiple Pages. Reconnect and select only the Page belonging to this Brand.", tone: "error" };
  if (outcome === "cancelled") return { title: "Meta connection cancelled", message: "No credentials were stored and nothing changed.", tone: "error" };
  if (outcome === "not_permitted") return { title: "Connection not permitted", message: "Only a Brand owner or administrator can connect publishing accounts.", tone: "error" };
  return { title: "Meta connection failed", message: "No credentials were stored. Check the Meta configuration and try the connection again.", tone: "error" };
}

function destinationLabel(destination: PublishingDestination | undefined): string {
  if (!destination) return "Not configured";
  if (destination.connectionStatus === "CONNECTED") return destination.externalAccountName ?? "Connected";
  if (destination.connectionStatus === "ACTION_REQUIRED") return "Reconnect required";
  return "Not connected";
}
