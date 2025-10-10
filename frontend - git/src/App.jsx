import { Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth-callback" element={<AuthCallback />} />
    </Routes>
  );
};

export default App;
