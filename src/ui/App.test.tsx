import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";

import { store } from "../store/store";
import { App } from "./App";

describe("App", () => {
  it("renders the boilerplate workspace", () => {
    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    expect(screen.getByRole("banner", { name: "Combat Zone toolbar" })).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "Encounter canvas" })).toBeInTheDocument();
  });
});
