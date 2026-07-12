export type DroppedImageFile = {
  file: File;
  relativePath?: string;
};

type FileSystemFileEntryLike = {
  file: (success: (file: File) => void, error?: (error: unknown) => void) => void;
  fullPath?: string;
  isFile: true;
  isDirectory: false;
  name: string;
};

type FileSystemDirectoryEntryLike = {
  createReader: () => {
    readEntries: (
      success: (entries: FileSystemEntryLike[]) => void,
      error?: (error: unknown) => void
    ) => void;
  };
  fullPath?: string;
  isFile: false;
  isDirectory: true;
  name: string;
};

type FileSystemEntryLike =
  | FileSystemFileEntryLike
  | FileSystemDirectoryEntryLike;

type DataTransferItemWithEntry = {
  webkitGetAsEntry?: () => FileSystemEntryLike | null;
};

export function getFileRelativePath(file: File) {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath;
}

function readEntryFile(entry: FileSystemFileEntryLike): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

function readDirectoryEntries(
  entry: FileSystemDirectoryEntryLike
): Promise<FileSystemEntryLike[]> {
  const reader = entry.createReader();
  const entries: FileSystemEntryLike[] = [];

  return new Promise((resolve, reject) => {
    function readBatch() {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(entries);
          return;
        }

        entries.push(...batch);
        readBatch();
      }, reject);
    }

    readBatch();
  });
}

async function collectEntryFiles(
  entry: FileSystemEntryLike,
  rootPath = ""
): Promise<DroppedImageFile[]> {
  const relativePath = rootPath ? `${rootPath}/${entry.name}` : entry.name;

  if (entry.isFile) {
    const file = await readEntryFile(entry);

    return [{
      file,
      relativePath: entry.fullPath?.replace(/^\/+/, "") || relativePath
    }];
  }

  const entries = await readDirectoryEntries(entry);
  const nestedFiles = await Promise.all(
    entries.map((child) => collectEntryFiles(child, relativePath))
  );

  return nestedFiles.flat();
}

export async function getDroppedImageFiles(
  dataTransfer: DataTransfer
): Promise<DroppedImageFile[]> {
  const itemEntries: FileSystemEntryLike[] = [];

  for (const item of Array.from(dataTransfer.items ?? [])) {
    const entry = (item as unknown as DataTransferItemWithEntry)
      .webkitGetAsEntry?.();

    if (entry) {
      itemEntries.push(entry);
    }
  }

  if (itemEntries.length > 0) {
    const entryFiles = await Promise.all(
      itemEntries.map((entry) => collectEntryFiles(entry))
    );

    return entryFiles.flat();
  }

  return Array.from(dataTransfer.files ?? []).map((file) => ({
    file,
    relativePath: getFileRelativePath(file)
  }));
}
