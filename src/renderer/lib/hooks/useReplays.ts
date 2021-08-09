import { ipc_loadReplayFolder } from "@replays/ipc";
import { FileLoadResult, FolderResult } from "@replays/types";
import { produce } from "immer";
import path from "path";
import { useState } from "react";

import { findChild, generateSubFolderTree, isSubDirectory } from "../folderTree";
import { useMousetrap } from "./useMousetrap";
import { useReplayBrowserList } from "./useReplayBrowserList";
import { useReplayStore } from "./useReplayStore";

export const useReplays = (replayPaths: Array<{ folderPath: string; loadSubDirs?: boolean }>) => {
  const currentFolder = useReplayStore((store) => store.currentFolder);
  const loading = useReplayStore((store) => store.loading);
  const replayFolders = useReplayStore((store) => store.replayFolders);
  const setReplayFolders = useReplayStore((store) => store.setReplayFolders);
  const setScrollRowItem = useReplayStore((store) => store.setScrollRowItem);
  const setFiles = useReplayStore((store) => store.setFiles);
  const setFileErrorCount = useReplayStore((store) => store.setFileErrorCount);
  const setProgress = useReplayStore((store) => store.setProgress);
  const setLoading = useReplayStore((store) => store.setLoading);

  const init = () => {
    const newReplayFolders: FolderResult[] = replayPaths.map(({ folderPath }) => generateFolderResult(folderPath));
    setReplayFolders(newReplayFolders);
  };

  const loadDirectoryList = async (childFolder: string) => {
    const parentFolderIndex = replayPaths.findIndex(
      ({ folderPath }) => folderPath === childFolder || isSubDirectory(folderPath, childFolder),
    );
    if (parentFolderIndex === -1) {
      return;
    }

    const { loadSubDirs } = replayPaths[parentFolderIndex];
    const currentTree = replayFolders[parentFolderIndex];
    const newReplayFolder = await produce(currentTree, async (draft: FolderResult) => {
      const pathToLoad = childFolder;
      const child = findChild(draft, pathToLoad) ?? draft;
      child.collapsed = !loadSubDirs;
      const childPaths = path.relative(child.fullPath, pathToLoad);
      const childrenToExpand = childPaths ? childPaths.split(path.sep) : [];
      if (loadSubDirs && child && child.subdirectories.length === 0) {
        child.subdirectories = await generateSubFolderTree(child.fullPath, childrenToExpand);
      }
    });
    const newReplayFolders = produce(replayFolders, (draft) => {
      draft[parentFolderIndex] = newReplayFolder;
    });
    setReplayFolders(newReplayFolders);
  };

  const loadFolder = async (childPath: string, forceReload?: boolean) => {
    if (loading) {
      console.warn("A folder is already loading! Please wait for it to finish first.");
      return;
    }

    const folderToLoad = childPath ?? currentFolder;
    if (currentFolder === folderToLoad && !forceReload) {
      console.warn(`${currentFolder} is already loaded. Set forceReload to true to reload anyway.`);
      return;
    }

    setLoading(true);
    setProgress(null);
    try {
      const result = await handleReplayFolderLoading(folderToLoad);
      setFiles(result.files);
      setScrollRowItem(0);
      setFileErrorCount(result.fileErrorCount);
    } catch (err) {
      setProgress(null);
    } finally {
      setLoading(false);
    }
  };

  return { init, loadFolder, loadDirectoryList };
};

const handleReplayFolderLoading = async (folderPath: string): Promise<FileLoadResult> => {
  const loadFolderResult = await ipc_loadReplayFolder.renderer!.trigger({ folderPath });
  if (!loadFolderResult.result) {
    console.error(`Error loading folder: ${folderPath}`, loadFolderResult.errors);
    throw new Error(`Error loading folder: ${folderPath}`);
  }
  return loadFolderResult.result;
};

export const useReplaySelection = () => {
  const { files } = useReplayBrowserList();
  const selectedFiles = useReplayStore((store) => store.checkedFiles);
  const setSelectedFiles = useReplayStore((store) => store.setCheckedFiles);

  const [lastClickIndex, setLastClickIndex] = useState<number | null>(null);
  const [shiftHeld, setShiftHeld] = useState(false);
  useMousetrap("shift", () => setShiftHeld(true));
  useMousetrap("shift", () => setShiftHeld(false), "keyup");

  const toggleFiles = (fileNames: string[], mode: "toggle" | "select" | "deselect" = "toggle") => {
    const newSelection = Array.from(selectedFiles);

    fileNames.forEach((fileName) => {
      const alreadySelectedIndex = newSelection.findIndex((f) => f === fileName);
      switch (mode) {
        case "toggle": {
          if (alreadySelectedIndex !== -1) {
            newSelection.splice(alreadySelectedIndex, 1);
          } else {
            newSelection.push(fileName);
          }
          break;
        }
        case "select": {
          if (alreadySelectedIndex === -1) {
            newSelection.push(fileName);
          }
          break;
        }
        case "deselect": {
          if (alreadySelectedIndex !== -1) {
            newSelection.splice(alreadySelectedIndex, 1);
          }
          break;
        }
      }
    });

    setSelectedFiles(newSelection);
  };

  const onFileClick = (index: number) => {
    const isCurrentSelected = selectedFiles.includes(files[index].fullPath);
    if (lastClickIndex !== null && shiftHeld) {
      // Shift is held
      // Find all the files between the last clicked file and the current one
      const startIndex = Math.min(index, lastClickIndex);
      const endIndex = Math.max(index, lastClickIndex);

      const filesToToggle: string[] = [];
      for (let i = startIndex; i <= endIndex; i++) {
        filesToToggle.push(files[i].fullPath);
      }

      if (lastClickIndex > index) {
        filesToToggle.reverse();
      }

      if (isCurrentSelected) {
        toggleFiles(filesToToggle, "deselect");
      } else {
        toggleFiles(filesToToggle, "select");
      }
    } else {
      toggleFiles([files[index].fullPath]);
    }

    // Update the click index when we're done
    setLastClickIndex(index);
  };

  const clearSelection = () => {
    setSelectedFiles([]);
  };

  const selectAll = () => {
    setSelectedFiles(files.map((f) => f.fullPath));
  };

  return {
    onFileClick,
    clearSelection,
    selectAll,
  };
};

const generateFolderResult = (folder: string, collapsed = true): FolderResult => {
  return {
    name: path.basename(folder),
    fullPath: folder,
    subdirectories: [],
    collapsed,
  };
};
