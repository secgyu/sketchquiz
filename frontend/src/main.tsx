import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";

import { GameScreen } from "@/components/screens/GameScreen";
import { LobbyScreen } from "@/components/screens/LobbyScreen";
import { ResultScreen } from "@/components/screens/ResultScreen";
import { StartScreen } from "@/components/screens/StartScreen";
import "./index.css";

const router = createBrowserRouter([
  { path: "/", element: <StartScreen /> },
  { path: "/room/:code", element: <LobbyScreen /> },
  { path: "/room/:code/play", element: <GameScreen /> },
  { path: "/room/:code/result", element: <ResultScreen /> },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
