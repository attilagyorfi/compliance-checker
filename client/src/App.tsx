import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ProjectProvider } from "./contexts/ProjectContext";
import Home from "./pages/Home";
import ReportsPage from "./pages/ReportsPage";
import ResultPage from "./pages/ResultPage";
import RegulationLibraryPage from "./pages/RegulationLibraryPage";
import StandardsSearchPage from "./pages/StandardsSearchPage";
import DashboardPage from "./pages/DashboardPage";
import PlatformConnectionsPage from "./pages/PlatformConnectionsPage";
import SettingsPage from "./pages/SettingsPage";
import AdminPage from "./pages/AdminPage";
import LoginPage from "./pages/LoginPage";

// V11.15: a Projektek, Tudástár, Audit és Előzmények route-ok megszűntek.
// (Az Előzmények az Admin oldalon érhető el szekcióként.)
function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/search" component={StandardsSearchPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/result/:id" component={ResultPage} />
      <Route path="/regulations" component={RegulationLibraryPage} />
      <Route path="/platforms" component={PlatformConnectionsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <ProjectProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ProjectProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
