import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { AuthScreen } from "@/components/screens/AuthScreen";
import { GameScreen } from "@/components/screens/GameScreen";
import { LobbyScreen } from "@/components/screens/LobbyScreen";
import { ResultScreen } from "@/components/screens/ResultScreen";
import { StartScreen } from "@/components/screens/StartScreen";
import "./index.css";

const router = createBrowserRouter([
  { path: "/login", element: <AuthScreen /> },
  {
    path: "/",
    element: (
      <RequireAuth>
        <StartScreen />
      </RequireAuth>
    ),
  },
  {
    path: "/room/:code",
    element: (
      <RequireAuth>
        <LobbyScreen />
      </RequireAuth>
    ),
  },
  {
    path: "/room/:code/play",
    element: (
      <RequireAuth>
        <GameScreen />
      </RequireAuth>
    ),
  },
  {
    path: "/room/:code/result",
    element: (
      <RequireAuth>
        <ResultScreen />
      </RequireAuth>
    ),
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
