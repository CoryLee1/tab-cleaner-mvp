import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Information } from "./screens/Information";

createRoot(document.getElementById("app")).render(
  <StrictMode>
    <Information />
  </StrictMode>,
);
