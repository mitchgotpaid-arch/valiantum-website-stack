export type ProviderChannel = "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "X";

export interface PublishingCapabilities {
  text: boolean;
  images: boolean;
  video: boolean;
  scheduling: boolean;
  unpublishedTests: boolean;
}

export interface ProviderPublicationResult {
  externalPostId: string;
}

export interface PublishingProvider<Request> {
  readonly channel: ProviderChannel;
  getCapabilities(): PublishingCapabilities;
  publish(request: Request): Promise<ProviderPublicationResult>;
}
