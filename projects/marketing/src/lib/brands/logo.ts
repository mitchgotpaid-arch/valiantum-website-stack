export const BRAND_LOGO_MAX_BYTES = 5 * 1024 * 1024;
export const BRAND_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type BrandLogoType = typeof BRAND_LOGO_TYPES[number];

function hasPrefix(bytes: Uint8Array, prefix: number[]) {
  return prefix.every((value, index) => bytes[index] === value);
}

function hasAscii(bytes: Uint8Array, offset: number, value: string) {
  return [...value].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
}

export function validateBrandLogoMetadata(mimeType: string, size: number): string | null {
  if (!BRAND_LOGO_TYPES.includes(mimeType as BrandLogoType)) return "Choose a PNG, JPEG, or WebP image.";
  if (size < 1) return "Choose a logo image to upload.";
  if (size > BRAND_LOGO_MAX_BYTES) return "Logo files must be 5 MB or smaller.";
  return null;
}

export function validateBrandLogo(mimeType: string, size: number, bytes: Uint8Array): string | null {
  const metadataError = validateBrandLogoMetadata(mimeType, size);
  if (metadataError) return metadataError;

  const signatureMatches = mimeType === "image/png"
    ? hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    : mimeType === "image/jpeg"
      ? hasPrefix(bytes, [0xff, 0xd8, 0xff])
      : hasAscii(bytes, 0, "RIFF") && hasAscii(bytes, 8, "WEBP");

  return signatureMatches ? null : "The file contents do not match the selected image type.";
}
