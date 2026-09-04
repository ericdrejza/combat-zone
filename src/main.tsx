import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";

import { App } from "@ui/App";
import { store } from "@store/store";
import { PersistenceProvider } from "@ui/persistence/PersistenceProvider";
import { IndexedDbLocalSyncRepository, IndexedDbWorkspaceRepository } from "@core/persistence";
import { CloudSyncProvider } from "@ui/cloud_sync";
import "./styles.css";

const workspaceRepository = new IndexedDbWorkspaceRepository();
const localSyncRepository = new IndexedDbLocalSyncRepository();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <PersistenceProvider repository={workspaceRepository} localSync={localSyncRepository}>
        <CloudSyncProvider localSync={localSyncRepository} workspaceRepository={workspaceRepository}>
          <App />
        </CloudSyncProvider>
      </PersistenceProvider>
    </Provider>
  </React.StrictMode>
);
