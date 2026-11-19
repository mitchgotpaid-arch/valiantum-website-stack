import { describe, expect, it, vi } from "vitest";
import type { MetaEnvironment } from "./config";
import { MetaFacebookProvider, MetaPublishingError } from "./meta-provider";

const environment: MetaEnvironment = {
  META_APP_ID: "app-id",
  META_APP_SECRET: "a-secret-long-enough-for-tests",
  META_GRAPH_API_VERSION: "v26.0",
  META_LOGIN_CONFIG_ID: "2551830225244050",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};

describe("MetaFacebookProvider", () => {
  it("creates only an unpublished Page post", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id: "page_post_123" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const provider = new MetaFacebookProvider("page/123", "secret-page-token", environment, request);

    await expect(provider.publish({ message: "  Test post  " })).resolves.toEqual({ externalPostId: "page_post_123" });
    expect(request).toHaveBeenCalledOnce();
    const [url, options] = request.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v26.0/page%2F123/feed");
    expect(options?.method).toBe("POST");
    expect(options?.headers).toMatchObject({ authorization: "Bearer secret-page-token" });
    expect((options?.body as URLSearchParams).toString()).toBe("message=Test+post&published=false");
  });

  it("fails closed when Meta rejects the request", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: { message: "denied" } }), { status: 403 }));
    const provider = new MetaFacebookProvider("page-id", "secret-page-token", environment, request);

    await expect(provider.publish({ message: "Test" })).rejects.toMatchObject<Partial<MetaPublishingError>>({ code: "PROVIDER_REJECTED" });
  });

  it("rejects empty content without calling Meta", async () => {
    const request = vi.fn<typeof fetch>();
    const provider = new MetaFacebookProvider("page-id", "secret-page-token", environment, request);

    await expect(provider.publish({ message: "   " })).rejects.toMatchObject<Partial<MetaPublishingError>>({ code: "INVALID_REQUEST" });
    expect(request).not.toHaveBeenCalled();
  });
});
