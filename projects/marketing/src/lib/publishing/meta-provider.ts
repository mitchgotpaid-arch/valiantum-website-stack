import { z } from "zod";
import type { MetaEnvironment } from "./config";
import type { ProviderPublicationResult, PublishingCapabilities, PublishingProvider } from "./provider";

const unpublishedPostResponseSchema = z.object({ id: z.string().min(1) });

export interface FacebookUnpublishedTestRequest {
  message: string;
}

export class MetaPublishingError extends Error {
  constructor(public readonly code: "INVALID_REQUEST" | "PROVIDER_REJECTED" | "INVALID_RESPONSE") {
    super(code);
    this.name = "MetaPublishingError";
  }
}

export class MetaFacebookProvider implements PublishingProvider<FacebookUnpublishedTestRequest> {
  readonly channel = "FACEBOOK" as const;

  constructor(
    private readonly pageId: string,
    private readonly pageAccessToken: string,
    private readonly environment: MetaEnvironment,
    private readonly request: typeof fetch = fetch,
  ) {}

  getCapabilities(): PublishingCapabilities {
    return {
      text: true,
      images: true,
      video: true,
      scheduling: true,
      unpublishedTests: true,
    };
  }

  async publish(input: FacebookUnpublishedTestRequest): Promise<ProviderPublicationResult> {
    const message = input.message.trim();
    if (!message || message.length > 50_000) throw new MetaPublishingError("INVALID_REQUEST");

    const response = await this.request(
      `https://graph.facebook.com/${this.environment.META_GRAPH_API_VERSION}/${encodeURIComponent(this.pageId)}/feed`,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          authorization: `Bearer ${this.pageAccessToken}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ message, published: "false" }),
      },
    );

    if (!response.ok) throw new MetaPublishingError("PROVIDER_REJECTED");
    const parsed = unpublishedPostResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new MetaPublishingError("INVALID_RESPONSE");
    return { externalPostId: parsed.data.id };
  }
}
