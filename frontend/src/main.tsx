import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { RoomLayout } from "@/components/RoomLayout";
import { AuthScreen } from "@/components/screens/AuthScreen";
import { CreateRoomScreen } from "@/components/screens/CreateRoomScreen";
import { GameScreen } from "@/components/screens/GameScreen";
import { LobbyScreen } from "@/components/screens/LobbyScreen";
import { ResultScreen } from "@/components/screens/ResultScreen";
import { RoomBrowserScreen } from "@/components/screens/RoomBrowserScreen";
import { StartScreen } from "@/components/screens/StartScreen";
import "./index.css";

const router = createBrowserRouter([
  { path: "/", element: <StartScreen /> },
  { path: "/login", element: <AuthScreen /> },
  {
    path: "/rooms",
    element: (
      <RequireAuth>
        <RoomBrowserScreen />
      </RequireAuth>
    ),
  },
  {
    path: "/create",
    element: (
      <RequireAuth>
        <CreateRoomScreen />
      </RequireAuth>
    ),
  },
  {
    path: "/room/:code",
    element: (
      <RequireAuth>
        <RoomLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <LobbyScreen /> },
      { path: "play", element: <GameScreen /> },
      { path: "result", element: <ResultScreen /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
