import "server-only";
import { z } from "zod";
import {
  claimFacebookUnpublishedTest,
  completeFacebookUnpublishedTest,
  PublishingDataError,
} from "@/data/publishing";
import { getMetaEnvironment } from "./config";
import { decryptProviderCredential } from "./credential-crypto";
import { MetaFacebookProvider, MetaPublishingError } from "./meta-provider";

const metaCredentialSchema = z.object({
  systemAccessToken: z.string().min(1),
  pageAccessToken: z.string().min(1),
  facebookPageId: z.string().min(1),
  instagramAccountId: z.string().nullable(),
});

export type UnpublishedTestResult =
  | { outcome: "SUCCEEDED"; externalPostId: string }
  | { outcome: "ALREADY_SUCCEEDED" }
  | { outcome: "PROCESSING" }
  | { outcome: "RETRY_LIMIT" };

export class PublicationExecutionError extends Error {
  constructor(public readonly code: "CREDENTIAL_INVALID" | "PROVIDER_REJECTED" | "COMPLETION_FAILED") {
    super(code);
    this.name = "PublicationExecutionError";
  }
}

export async function executeFacebookUnpublishedTest(contentId: string): Promise<UnpublishedTestResult> {
  const claim = await claimFacebookUnpublishedTest(contentId);
  if (!claim.shouldExecute) {
    if (claim.attemptStatus === "SUCCEEDED") return { outcome: "ALREADY_SUCCEEDED" };
    if (claim.attemptStatus === "PROCESSING") return { outcome: "PROCESSING" };
    return { outcome: "RETRY_LIMIT" };
  }

  const environment = getMetaEnvironment();
  let credential: z.infer<typeof metaCredentialSchema>;
  try {
    const context = `brand:${claim.brandId}:provider:META`;
    const decrypted = decryptProviderCredential<unknown>(claim.encryptedCredential, environment.META_APP_SECRET, context);
    credential = metaCredentialSchema.parse(decrypted);
    if (credential.facebookPageId !== claim.pageId) throw new Error("Credential Page mismatch.");
  } catch {
    await failAttempt(claim.attemptId, "CREDENTIAL_INVALID");
    throw new PublicationExecutionError("CREDENTIAL_INVALID");
  }

  try {
    const provider = new MetaFacebookProvider(claim.pageId, credential.pageAccessToken, environment);
    const result = await provider.publish({ message: claim.contentBody });
    await completeFacebookUnpublishedTest({
      attemptId: claim.attemptId,
      succeeded: true,
      externalPostId: result.externalPostId,
    });
    return { outcome: "SUCCEEDED", externalPostId: result.externalPostId };
  } catch (error) {
    if (error instanceof PublishingDataError) throw new PublicationExecutionError("COMPLETION_FAILED");
    const errorCode = error instanceof MetaPublishingError ? error.code : "PROVIDER_REJECTED";
    await failAttempt(claim.attemptId, errorCode);
    throw new PublicationExecutionError("PROVIDER_REJECTED");
  }
}

async function failAttempt(attemptId: string, errorCode: string): Promise<void> {
  try {
    await completeFacebookUnpublishedTest({ attemptId, succeeded: false, errorCode });
  } catch (error) {
    if (error instanceof PublishingDataError) throw new PublicationExecutionError("COMPLETION_FAILED");
    throw error;
  }
}
