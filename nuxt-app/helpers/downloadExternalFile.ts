/**
 * A helper function for downloading external files. Since the <a> element
 * with the "download" attribute only allows URL with the same origin, this
 * function bypasses this limitation.
 *
 * @param url The URL of the file.
 * @param fileName The name of the file.
 */
export async function downloadExternalFile(url: string, fileName: string) {
  // Download file
  const file = await fetch(url);

  // Create blob URL
  const blob = await file.blob();
  const objectUrl = URL.createObjectURL(blob);

  // Create <a> element
  const downloadLink = document.createElement('a');
  downloadLink.href = objectUrl;
  downloadLink.download = fileName;

  // Trigger download
  downloadLink.click();
}
