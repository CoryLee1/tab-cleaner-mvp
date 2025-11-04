import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DetailedCard } from "./screens/DetailedCard";

createRoot(document.getElementById("app")).render(
  <StrictMode>
    <DetailedCard />
  </StrictMode>,
);
