import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

import LoginPage from "./pages/Login";
import SignupPage from "./pages/Signup";
import ForgotPasswordPage from "./pages/ForgotPassword";
import ResetPasswordPage from "./pages/ResetPassword";
import DashboardPage from "./pages/Dashboard";
import ContactsPage from "./pages/Contacts";
import ContactDetailPage from "./pages/ContactDetail";
import CompaniesPage from "./pages/Companies";
import CompanyDetailPage from "./pages/CompanyDetail";
import ListsPage from "./pages/Lists";
import ListDetailPage from "./pages/ListDetail";
import ImportsPage from "./pages/Imports";
import ImportWizardPage from "./pages/ImportWizard";
import ImportJobDetailPage from "./pages/ImportJobDetail";
import SavedViewsPage from "./pages/SavedViews";
import DataHealthPage from "./pages/DataHealth";
import SettingsPage from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route path="/" element={<ProtectedLayout><DashboardPage /></ProtectedLayout>} />
            <Route path="/contacts" element={<ProtectedLayout><ContactsPage /></ProtectedLayout>} />
            <Route path="/contacts/:id" element={<ProtectedLayout><ContactDetailPage /></ProtectedLayout>} />
            <Route path="/companies" element={<ProtectedLayout><CompaniesPage /></ProtectedLayout>} />
            <Route path="/companies/:id" element={<ProtectedLayout><CompanyDetailPage /></ProtectedLayout>} />
            <Route path="/lists" element={<ProtectedLayout><ListsPage /></ProtectedLayout>} />
            <Route path="/lists/:id" element={<ProtectedLayout><ListDetailPage /></ProtectedLayout>} />
            <Route path="/imports" element={<ProtectedLayout><ImportsPage /></ProtectedLayout>} />
            <Route path="/saved-views" element={<ProtectedLayout><SavedViewsPage /></ProtectedLayout>} />
            <Route path="/data-health" element={<ProtectedLayout><DataHealthPage /></ProtectedLayout>} />
            <Route path="/settings" element={<ProtectedLayout><SettingsPage /></ProtectedLayout>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
