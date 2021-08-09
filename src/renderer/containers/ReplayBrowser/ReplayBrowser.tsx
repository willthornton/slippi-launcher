/** @jsx jsx */
import { css, jsx } from "@emotion/react";
import styled from "@emotion/styled";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import List from "@material-ui/core/List";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";
import FolderIcon from "@material-ui/icons/Folder";
import SearchIcon from "@material-ui/icons/Search";
import { colors } from "common/colors";
import { shell } from "electron";
import React from "react";
import { useToasts } from "react-toast-notifications";

import { DualPane } from "@/components/DualPane";
import { BasicFooter } from "@/components/Footer";
import { LabelledText } from "@/components/LabelledText";
import { LoadingScreen } from "@/components/LoadingScreen";
import { IconMessage } from "@/components/Message";
import { usePlayFiles } from "@/lib/hooks/usePlayFiles";
import { useReplayBrowserList, useReplayBrowserNavigation } from "@/lib/hooks/useReplayBrowserList";
import { useReplayFilter } from "@/lib/hooks/useReplayFilter";
import { useReplays, useReplaySelection } from "@/lib/hooks/useReplays";
import { useReplayStore } from "@/lib/hooks/useReplayStore";

import { FileList } from "./FileList";
import { FileSelectionToolbar } from "./FileSelectionToolbar";
import { FilterToolbar } from "./FilterToolbar";
import { FolderTreeNode } from "./FolderTreeNode";

export const ReplayBrowser: React.FC<{
  replayPaths: string[];
}> = ({ replayPaths }) => {
  const searchInputRef = React.createRef<HTMLInputElement>();
  const currentFolder = useReplayStore((store) => store.currentFolder);
  const setCurrentFolder = useReplayStore((store) => store.setCurrentFolder);
  const replayFolders = useReplayStore((store) => store.replayFolders);
  const loading = useReplayStore((store) => store.loading);
  const scrollRowItem = useReplayStore((store) => store.scrollRowItem);
  const setScrollRowItem = useReplayStore((store) => store.setScrollRowItem);
  const removeFile = useReplayStore((store) => store.removeFile);
  const setSelectedFile = useReplayStore((store) => store.setSelectedFile);
  const playFiles = usePlayFiles();
  const selectedFiles = useReplayStore((store) => store.checkedFiles);
  const fileSelection = useReplaySelection();
  const { init, loadDirectoryList, loadFolder } = useReplays(replayPaths);
  const fileErrorCount = useReplayStore((store) => store.fileErrorCount);
  const { addToast } = useToasts();

  const resetFilter = useReplayFilter((store) => store.resetFilter);
  const { files: filteredFiles, hiddenFileCount } = useReplayBrowserList();
  const { goToReplayStatsPage } = useReplayBrowserNavigation();

  const onFolderClick = (folderPath: string, forceReload?: boolean) => {
    setCurrentFolder(folderPath);
    void Promise.all([loadDirectoryList(folderPath), loadFolder(folderPath, forceReload)]).catch(console.warn);
  };

  React.useEffect(() => {
    console.log("use effect");
    init();
    if (replayPaths.length > 0) {
      onFolderClick(replayPaths[0]);
    }
  }, []);

  const setSelectedItem = (index: number | null) => {
    if (index === null) {
      setSelectedFile(null);
    } else {
      const file = filteredFiles[index];
      setSelectedFile(file, index, filteredFiles.length);
      goToReplayStatsPage(file.fullPath);
    }
  };

  const playSelectedFile = (index: number) => {
    const filePath = filteredFiles[index].fullPath;
    playFiles([{ path: filePath }]);
  };

  const deleteFiles = (filePaths: string[]) => {
    let errCount = 0;
    filePaths.forEach((filePath) => {
      const success = shell.moveItemToTrash(filePath);
      if (success) {
        // Remove the file from the store
        removeFile(filePath);
      } else {
        errCount += 1;
      }
    });

    let message = `${filePaths.length - errCount} file(s) deleted successfully.`;
    if (errCount > 0) {
      message += ` ${errCount} file(s) couldn't be deleted.`;
    }
    addToast(message, { appearance: "success", autoDismiss: true });
  };

  return (
    <Outer>
      <div
        style={{
          display: "flex",
          flex: "1",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <DualPane
          id="replay-browser"
          resizable={true}
          minWidth={0}
          maxWidth={300}
          leftStyle={{ backgroundColor: "rgba(0,0,0, 0.3)" }}
          leftSide={
            <List dense={true} style={{ flex: 1, padding: 0 }}>
              <div style={{ position: "relative", minHeight: "100%" }}>
                {replayFolders.map((folder) => (
                  <FolderTreeNode key={folder.fullPath} {...folder} onClick={onFolderClick} />
                ))}
                {loading && (
                  <div
                    style={{
                      position: "absolute",
                      height: "100%",
                      width: "100%",
                      top: 0,
                      backgroundColor: "rgba(0, 0, 0, 0.5)",
                    }}
                  />
                )}
              </div>
            </List>
          }
          rightSide={
            <div
              css={css`
                display: flex;
                flex-direction: column;
                flex: 1;
              `}
            >
              <FilterToolbar
                disabled={loading}
                ref={searchInputRef}
                onRefreshClick={() => {
                  if (currentFolder) {
                    onFolderClick(currentFolder, true);
                  }
                }}
              />
              {loading || !currentFolder ? (
                <LoadingBox />
              ) : filteredFiles.length === 0 ? (
                <EmptyFolder
                  hiddenFileCount={hiddenFileCount}
                  onClearFilter={() => {
                    if (searchInputRef.current) {
                      searchInputRef.current.value = "";
                    }
                    resetFilter();
                  }}
                />
              ) : (
                <FileList
                  folderPath={currentFolder}
                  onDelete={(filePath) => deleteFiles([filePath])}
                  onFileClick={fileSelection.onFileClick}
                  selectedFiles={selectedFiles}
                  onSelect={(index: number) => setSelectedItem(index)}
                  onPlay={(index: number) => playSelectedFile(index)}
                  files={filteredFiles}
                  scrollRowItem={scrollRowItem}
                  setScrollRowItem={setScrollRowItem}
                />
              )}
              <FileSelectionToolbar
                totalSelected={selectedFiles.length}
                onSelectAll={fileSelection.selectAll}
                onPlay={() => playFiles(selectedFiles.map((path) => ({ path })))}
                onClear={fileSelection.clearSelection}
                onDelete={() => {
                  deleteFiles(selectedFiles);
                  fileSelection.clearSelection();
                }}
              />
            </div>
          }
        />
      </div>

      <Footer>
        <div
          css={css`
            display: flex;
            align-items: center;
          `}
        >
          <div>
            <Tooltip title="Reveal location">
              <IconButton onClick={() => currentFolder && shell.openItem(currentFolder)} size="small">
                <FolderIcon
                  css={css`
                    color: ${colors.purpleLight};
                  `}
                />
              </IconButton>
            </Tooltip>
          </div>
          <LabelledText
            label="Current folder"
            css={css`
              margin-left: 10px;
            `}
          >
            {currentFolder}
          </LabelledText>
        </div>
        <div style={{ textAlign: "right" }}>
          {filteredFiles.length} files found. {hiddenFileCount} files filtered.{" "}
          {fileErrorCount > 0 ? `${fileErrorCount} files had errors.` : ""}
        </div>
      </Footer>
    </Outer>
  );
};

const LoadingBox: React.FC = () => {
  const progress = useReplayStore((store) => store.progress);
  let message = "Loading...";
  if (progress !== null) {
    message += ` ${Math.floor((progress.current / progress.total) * 100)}%`;
  }
  return <LoadingScreen message={message} />;
};

const EmptyFolder: React.FC<{
  hiddenFileCount: number;
  onClearFilter: () => void;
}> = ({ hiddenFileCount, onClearFilter }) => {
  return (
    <IconMessage Icon={SearchIcon} label="No SLP files found">
      {hiddenFileCount > 0 && (
        <div style={{ textAlign: "center" }}>
          <Typography style={{ marginTop: 20, opacity: 0.6 }}>{hiddenFileCount} files hidden</Typography>
          <Button
            css={css`
              text-transform: lowercase;
              font-size: 12px;
            `}
            color="primary"
            onClick={onClearFilter}
            size="small"
          >
            clear filter
          </Button>
        </div>
      )}
    </IconMessage>
  );
};

const Outer = styled.div`
  display: flex;
  flex-flow: column;
  flex: 1;
  position: relative;
  min-width: 0;
`;

const Footer = styled(BasicFooter)`
  justify-content: space-between;
`;
