import { act, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it } from "vitest";

import { resetEncounterLog, appendEncounterLogEntry } from "@store/encounterLogSlice";
import { store } from "@store/store";
import { LogPanel } from "@ui/panels/LogPanel";

type LogGeometry = {
  clientHeight: number;
  scrollHeight: () => number;
};

function appendLogEntry(index: number) {
  store.dispatch(
    appendEncounterLogEntry({
      actionId: `log-action-${index}`,
      actionType: "actor.move",
      category: "actor",
      id: `log-entry-${index}`,
      kind: "commit",
      message: `Actor moved ${index}.`,
      timestamp: index
    })
  );
}

/** Makes JSDOM expose scroll measurements that change as list entries are rendered. */
function configureLogGeometry(list: HTMLElement, geometry: LogGeometry) {
  let scrollTop = 0;
  const scrollTopWrites: number[] = [];

  Object.defineProperties(list, {
    clientHeight: {
      configurable: true,
      get: () => geometry.clientHeight
    },
    scrollHeight: {
      configurable: true,
      get: geometry.scrollHeight
    },
    scrollTop: {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
        scrollTopWrites.push(value);
      }
    }
  });

  return { scrollTopWrites };
}

describe("LogPanel sticky scrolling", () => {
  beforeEach(() => {
    store.dispatch(resetEncounterLog());
  });

  it("follows a new entry when the previous list did not overflow", () => {
    render(
      <Provider store={store}>
        <LogPanel />
      </Provider>
    );

    act(() => {
      appendLogEntry(1);
    });

    const list = screen.getByLabelText("Encounter log");
    const { scrollTopWrites } = configureLogGeometry(list, {
      clientHeight: 100,
      scrollHeight: () => (list.children.length === 1 ? 50 : 200)
    });

    act(() => {
      appendLogEntry(2);
    });

    expect(scrollTopWrites).toEqual([200]);
  });

  it("follows a new entry when an overflowing list was at its bottom", () => {
    render(
      <Provider store={store}>
        <LogPanel />
      </Provider>
    );

    act(() => {
      appendLogEntry(1);
      appendLogEntry(2);
    });

    const list = screen.getByLabelText("Encounter log");
    const { scrollTopWrites } = configureLogGeometry(list, {
      clientHeight: 100,
      scrollHeight: () => (list.children.length === 2 ? 300 : 400)
    });

    list.scrollTop = 200;
    fireEvent.scroll(list);
    scrollTopWrites.length = 0;

    act(() => {
      appendLogEntry(3);
    });

    expect(scrollTopWrites).toEqual([400]);
  });

  it("does not follow a new entry when an overflowing list was scrolled away from the bottom", () => {
    render(
      <Provider store={store}>
        <LogPanel />
      </Provider>
    );

    act(() => {
      appendLogEntry(1);
      appendLogEntry(2);
    });

    const list = screen.getByLabelText("Encounter log");
    const { scrollTopWrites } = configureLogGeometry(list, {
      clientHeight: 100,
      scrollHeight: () => (list.children.length === 2 ? 300 : 400)
    });

    list.scrollTop = 40;
    fireEvent.scroll(list);
    scrollTopWrites.length = 0;

    act(() => {
      appendLogEntry(3);
    });

    expect(scrollTopWrites).toEqual([]);
  });
});
