import { supabase } from "./supabase";

const BUCKET = "shop-photos";

/**
 * Upload a single image file to Supabase Storage under a folder
 * (e.g. `order-items/{orderItemId}`), returning its public-signed URL.
 * The bucket is private, so we store the storage `path` and generate a
 * signed URL for display — call getSignedUrl() again if a link expires.
 */
export async function uploadPhoto(folder, file) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const url = await getSignedUrl(path);
  return { path, url };
}

/** Generate a time-limited signed URL for a private object. */
export async function getSignedUrl(path, expiresInSeconds = 60 * 60 * 24) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

/** Delete a photo by its storage path (admin-only per storage policy). */
export async function deletePhoto(path) {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

/** Convenience: upload several files at once, returning [{path,url,caption}]. */
export async function uploadPhotos(folder, filesWithCaptions) {
  const results = [];
  for (const { file, caption } of filesWithCaptions) {
    const { path, url } = await uploadPhoto(folder, file);
    results.push({ path, url, caption });
  }
  return results;
}
