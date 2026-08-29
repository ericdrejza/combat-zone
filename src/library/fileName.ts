/** Returns a browser-safe basename without its final file extension. */
export function getFileNameWithoutExtension(fileName: string): string {
  const baseName = fileName.split(/[\\/]/).at(-1) ?? fileName;
  const extensionIndex = baseName.lastIndexOf(".");

  return extensionIndex > 0 ? baseName.slice(0, extensionIndex) : baseName;
}
