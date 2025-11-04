import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DesktopPetMain } from "./screens/DesktopPetMain";

createRoot(document.getElementById("app")).render(
  <StrictMode>
    <DesktopPetMain />
  </StrictMode>,
);
