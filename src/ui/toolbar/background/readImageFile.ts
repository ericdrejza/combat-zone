import type { EncounterBackgroundImage } from "../../../core/encounter/types";

export function readImageFile(file: File): Promise<EncounterBackgroundImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Selected file could not be read as an image."));
        return;
      }

      resolve({
        dataUrl: reader.result,
        mediaType: file.type || "application/octet-stream",
        name: file.name
      });
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("Selected file could not be read."));
    });
    reader.readAsDataURL(file);
  });
}
