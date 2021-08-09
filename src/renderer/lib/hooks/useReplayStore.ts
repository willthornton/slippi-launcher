import { FileResult, FolderResult, Progress } from "@replays/types";
import { produce } from "immer";
import create from "zustand";
import { combine } from "zustand/middleware";

import { findChild, isSubDirectory } from "../folderTree";

export const useReplayStore = create(
  combine(
    {
      files: [] as FileResult[],
      currentFolder: null as string | null,
      replayFolders: [] as FolderResult[],
      loading: false,
      progress: null as Progress | null,
      checkedFiles: [] as string[],
      selectedFile: {
        index: null as number | null,
        total: null as number | null,
        fileResult: null as FileResult | null,
      },
      scrollRowItem: 0,
      fileErrorCount: 0,
    },
    (set) => ({
      setFiles: (files: FileResult[]) => set({ files }),
      removeFile: (filePath: string) => {
        set((state) =>
          produce(state, (draft) => {
            const index = draft.files.findIndex((f) => f.fullPath === filePath);
            // Modify the array in place
            draft.files.splice(index, 1);
          }),
        );
      },
      setCurrentFolder: (currentFolder: string | null) => set({ currentFolder }),
      setReplayFolders: (replayFolders: FolderResult[]) => set({ replayFolders }),
      setLoading: (loading: boolean) => set({ loading }),
      setFileErrorCount: (fileErrorCount: number) => set({ fileErrorCount }),
      setCheckedFiles: (checkedFiles: string[]) => set({ checkedFiles }),
      toggleFolder: (childFolder: string) => {
        console.log(`toggling folder: ${childFolder}`);
        set((state) => {
          const parentFolderIndex = state.replayFolders.findIndex(
            ({ fullPath }) => fullPath === childFolder || isSubDirectory(fullPath, childFolder),
          );
          if (parentFolderIndex === -1) {
            console.warn(`${childFolder} is not a valid child path`);
            return state;
          }

          const newState = produce(state, (draft) => {
            const currentTree = draft.replayFolders[parentFolderIndex];
            if (currentTree) {
              const child = findChild(currentTree, childFolder);
              if (child) {
                child.collapsed = !child.collapsed;
              }
            }
          });
          return newState;
        });
      },
      setSelectedFile: (file: FileResult | null, index: number | null = null, total: number | null = null) => {
        set({
          selectedFile: { fileResult: file, index, total },
        });
      },
      setProgress: (progress: Progress | null) => set({ progress }),
      setScrollRowItem: (scrollRowItem: number) => set({ scrollRowItem }),
    }),
  ),
);
