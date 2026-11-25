import { supabase } from "./data";
import { preparePhoto } from "./image";

/**
 * "Report a problem". Saved in the Kitchen Compass database (app "junior") and
 * emailed to the owner by the notify-problem-report function. Pictures are
 * re-saved through preparePhoto first, so they carry no location data.
 */
export async function sendProblemReport(message: string, picture: File | null): Promise<{ saved: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { saved: false, error: "You need to be signed in." };
  const id = crypto.randomUUID();
  let photoPath: string | null = null;
  if (picture) {
    let blob: Blob;
    try { blob = (await preparePhoto(picture)).blob; }
    catch { return { saved: false, error: "Couldn't read that picture. Try a screenshot or a JPEG." }; }
    photoPath = `${user.id}/${id}.jpg`;
    const { error } = await supabase.storage.from("problem-reports").upload(photoPath, blob, { contentType: "image/jpeg" });
    if (error) return { saved: false, error: "The picture couldn't be uploaded." };
  }
  const { error } = await supabase.from("problem_reports").insert({
    id, user_id: user.id, app: "junior", message: message.trim(), photo_path: photoPath,
    page: window.location.pathname, app_version: "web", user_agent: navigator.userAgent,
  });
  if (error) return { saved: false, error: error.message.includes("a lot of reports") ? error.message : "The report couldn't be saved. Please try again." };
  await supabase.functions.invoke("notify-problem-report", { body: { reportId: id } }).catch(() => undefined);
  return { saved: true };
}
