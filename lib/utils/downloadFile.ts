export async function downloadBackendFile(options: {
  url: string;
  filename: string;
  onError?: (error: unknown) => void;
}) {
  const { url, filename, onError } = options;
  try {
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) {
      throw new Error(`Download failed with status ${res.status}`);
    }

    const blob = await res.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objectUrl);
  } catch (err) {
    console.error("downloadBackendFile error", err);
    if (onError) onError(err);
  }
}
