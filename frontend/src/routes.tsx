import { Navigate, Route, Routes } from "react-router";
import App from "./App";
import { Home } from "./pages/Home";
import { Comprimi } from "./pages/Comprimi";
import { Unisci } from "./pages/Unisci";
import { Dividi } from "./pages/Dividi";
import { Ruota } from "./pages/Ruota";
import { Estrai } from "./pages/Estrai";
import { Proteggi } from "./pages/Proteggi";
import { Sblocca } from "./pages/Sblocca";
import { Editor } from "./pages/Editor";
import { Privacy } from "./pages/Privacy";

/** Route tree: App shell (persistent header) wrapping the home + tool pages. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<App />}>
        <Route index element={<Home />} />
        <Route path="comprimi" element={<Comprimi />} />
        <Route path="unisci" element={<Unisci />} />
        <Route path="dividi" element={<Dividi />} />
        <Route path="ruota" element={<Ruota />} />
        <Route path="estrai" element={<Estrai />} />
        <Route path="proteggi" element={<Proteggi />} />
        <Route path="sblocca" element={<Sblocca />} />
        <Route path="editor" element={<Editor />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
