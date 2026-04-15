import { Navigate } from "react-router-dom";

// Signup is disabled — private platform. Redirect to login.
export default function SignupPage() {
  return <Navigate to="/login" replace />;
}
