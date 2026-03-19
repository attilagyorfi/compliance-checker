import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import AnalysisPage from "./pages/AnalysisPage";
import ReportsPage from "./pages/ReportsPage";
import ResultPage from "./pages/ResultPage";
import RegulationLibraryPage from "./pages/RegulationLibraryPage";
import PlatformConnectionsPage from "./pages/PlatformConnectionsPage";
import StandardsSearchPage from "./pages/StandardsSearchPage";
import SearchHistoryPage from "./pages/SearchHistoryPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/analysis" component={AnalysisPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/result/:id" component={ResultPage} />
      <Route path="/regulations" component={RegulationLibraryPage} />
      <Route path="/platforms" component={PlatformConnectionsPage} />
      <Route path="/search" component={StandardsSearchPage} />
      <Route path="/search-history" component={SearchHistoryPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
