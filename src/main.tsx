import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";

import { App } from "@ui/App";
import { store } from "@store/store";
import { PersistenceProvider } from "@ui/persistence/PersistenceProvider";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <PersistenceProvider>
        <App />
      </PersistenceProvider>
    </Provider>
  </React.StrictMode>
);
