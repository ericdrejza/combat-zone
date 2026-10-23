import { render, screen, within } from "@testing-library/react";
import { KeybindProvider } from "@ui/keybinds";
import { KeybindSettings } from "@ui/settings/KeybindSettings";

it("groups related customizable shortcuts and alphabetizes their titles", () => {
  render(<KeybindProvider><KeybindSettings /></KeybindProvider>);
  const customizable = screen.getByRole("group", { name: "Customizable shortcuts" });
  const groups = within(customizable).getAllByRole("group");
  expect(groups.map(group => within(group).getByRole("heading").textContent))
    .toEqual(["Audio", "Entities", "History", "Panels", "Tools", "Viewport"]);
  const panels = within(customizable).getByRole("group", { name: "Panels" });
  expect(within(panels).getAllByRole("button", { name: /^Change / }).map(button => button.getAttribute("aria-label")))
    .toEqual(["Change Expand/collapse sidebars keybind", "Change Open Library keybind", "Change Toggle Initiative popout keybind"]);
  for (const group of groups) {
    const titles = within(group).getAllByRole("button", { name: /^Change / }).map(button => button.getAttribute("aria-label")!.replace(/^Change /, "").replace(/ keybind$/, ""));
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
  }
  expect(within(screen.getByRole("group", { name: "Viewport panning" })).getByRole("button", { name: "WASD" })).toBeInTheDocument();
});

it("groups fixed shortcuts while retaining the wheel-zoom toggle", () => {
  render(<KeybindProvider><KeybindSettings /></KeybindProvider>);
  const fixed = screen.getByRole("group", { name: "Fixed shortcuts" });
  const groups = within(fixed).getAllByRole("group");
  expect(groups.map(group => within(group).getByRole("heading").textContent))
    .toEqual(["Ruler", "Selection and editing", "Viewport", "Workspace"]);
  expect(within(within(fixed).getByRole("group", { name: "Ruler" })).getByLabelText("Choose ruler shape while Ruler is active keybind")).toHaveTextContent("1–5");
  expect(within(within(fixed).getByRole("group", { name: "Viewport" })).getByRole("switch", { name: "Zoom in/out" })).toBeInTheDocument();
});

it("lists separate ruler actions and shows Shift+Wheel in both relevant groups", () => {
  render(<KeybindProvider><KeybindSettings /></KeybindProvider>);
  const fixed = screen.getByRole("group", { name: "Fixed shortcuts" });
  const ruler = within(within(fixed).getByRole("group", { name: "Ruler" }));
  const viewport = within(within(fixed).getByRole("group", { name: "Viewport" }));
  expect(ruler.getByLabelText("Toggle actor movement distance while Ruler is active keybind")).toHaveTextContent(/^9$/);
  expect(ruler.getByLabelText("Clear rulers while Ruler is active keybind")).toHaveTextContent(/^0$/);
  expect(ruler.getByLabelText("Adjust cone angle in Ruler cone mode keybind")).toHaveTextContent("Shift + Wheel");
  expect(viewport.getByLabelText("Scroll canvas horizontally keybind")).toHaveTextContent("Shift + Wheel");
  expect(viewport.queryByLabelText("Adjust cone angle in Ruler cone mode keybind")).not.toBeInTheDocument();
});
