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
import SearchHistoryPage from "./pages/SearchHistoryPage";
import KnowledgeBasePage from "./pages/KnowledgeBasePage";
import DashboardPage from "./pages/DashboardPage";
import PlatformConnectionsPage from "./pages/PlatformConnectionsPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import AuditPage from "./pages/AuditPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/projects" component={ProjectsPage} />
      <Route path="/projects/:id" component={ProjectDetailPage} />
      <Route path="/search" component={StandardsSearchPage} />
      <Route path="/knowledge-base" component={KnowledgeBasePage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/result/:id" component={ResultPage} />
      <Route path="/regulations" component={RegulationLibraryPage} />
      <Route path="/search-history" component={SearchHistoryPage} />
      <Route path="/platforms" component={PlatformConnectionsPage} />
      <Route path="/audit" component={AuditPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
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
