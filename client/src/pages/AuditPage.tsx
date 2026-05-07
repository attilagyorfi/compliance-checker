/**
 * Audit log nézet — V11.3 (c)
 *
 * Listázza az audit_logs táblát szűrőkkel, paginálással és összefoglaló
 * statisztikákkal. Protected — csak authentikált user éri el.
 */

import { useState } from "react";
import {
  Shield, Filter, Calendar, ChevronLeft, ChevronRight, Loader2,
  ChevronDown, ChevronUp, Inbox, User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import Header from "@/components/Header";
import { trpc } from "@/lib/trpc";
import { formatDateTime } from "@/lib/format";

const EVENT_TYPE_OPTIONS = [
  { value: "all", label: "Minden esemény" },
  { value: "user_login", label: "Bejelentkezés" },
  { value: "user_logout", label: "Kijelentkezés" },
  { value: "document_upload", label: "Dokumentum-feltöltés" },
  { value: "document_delete", label: "Dokumentum-törlés" },
  { value: "document_view", label: "Dokumentum-megtekintés" },
  { value: "analysis_start", label: "Elemzés indítása" },
  { value: "analysis_complete", label: "Elemzés kész" },
  { value: "analysis_error", label: "Elemzés hiba" },
  { value: "analysis_retry", label: "Elemzés újrapróbálás" },
  { value: "report_generate", label: "Riport generálás" },
  { value: "report_download", label: "Riport letöltés" },
  { value: "regulation_source_add", label: "Jogszabály-hozzáadás" },
  { value: "regulation_source_update", label: "Jogszabály-frissítés" },
  { value: "regulation_source_delete", label: "Jogszabály-törlés" },
  { value: "regulation_source_sync", label: "Jogszabály-sync" },
  { value: "credential_save", label: "Credential mentés" },
  { value: "credential_delete", label: "Credential törlés" },
  { value: "credential_test", label: "Credential teszt" },
  { value: "search_query", label: "Keresés" },
  { value: "knowledge_base_upload", label: "Tudástár feltöltés" },
  { value: "knowledge_base_delete", label: "Tudástár törlés" },
  { value: "project_create", label: "Projekt-létrehozás" },
  { value: "project_update", label: "Projekt-frissítés" },
  { value: "project_archive", label: "Projekt-archiválás" },
  { value: "project_export", label: "Projekt-export" },
  { value: "project_member_add", label: "Tag-hozzáadás" },
  { value: "project_member_remove", label: "Tag-eltávolítás" },
  { value: "project_member_change_role", label: "Tag-szerepkör" },
  { value: "finding_status_change", label: "Finding-státusz" },
  { value: "workflow_status_change", label: "Workflow-státusz" },
] as const;

const SINCE_OPTIONS = [
  { value: "all", label: "Mind" },
  { value: "1", label: "Utolsó 24 óra" },
  { value: "7", label: "Utolsó 7 nap" },
  { value: "30", label: "Utolsó 30 nap" },
  { value: "90", label: "Utolsó 90 nap" },
];

const PAGE_SIZE = 50;

function eventTypeLabel(eventType: string): string {
  return EVENT_TYPE_OPTIONS.find((o) => o.value === eventType)?.label ?? eventType;
}

function eventTypeBadgeColor(eventType: string): { color: string; bg: string } {
  if (eventType.includes("error")) return { color: "#dc2626", bg: "#fef2f2" };
  if (eventType.includes("delete") || eventType.includes("archive") || eventType.includes("remove")) {
    return { color: "#92400e", bg: "#fef3c7" };
  }
  if (eventType.includes("complete")) return { color: "#059669", bg: "#f0fdf4" };
  if (eventType.includes("login") || eventType.includes("create") || eventType.includes("add")) {
    return { color: "#1d4ed8", bg: "#eff6ff" };
  }
  return { color: "#6b7280", bg: "#f3f4f6" };
}

interface AuditRow {
  id: number;
  userId: number | null;
  userEmail: string | null;
  eventType: string;
  resourceType: string | null;
  resourceId: string | null;
  description: string | null;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: Date | string;
}

function EventRow({ event }: { event: AuditRow }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = eventTypeBadgeColor(event.eventType);
  const hasMetadata = event.metadata != null && (
    typeof event.metadata !== "object" || Object.keys(event.metadata as object).length > 0
  );

  return (
    <div className="rounded-lg border bg-white" style={{ borderColor: "#e5e7eb" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-3 flex items-start gap-3 hover:bg-gray-50 transition-colors"
      >
        <Badge
          className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium border-0 mt-0.5"
          style={{ backgroundColor: cfg.bg, color: cfg.color }}
        >
          {eventTypeLabel(event.eventType)}
        </Badge>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 truncate">{event.description ?? "—"}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {event.resourceType && (
              <span className="text-xs text-gray-400">
                {event.resourceType}
                {event.resourceId ? ` #${event.resourceId}` : ""}
              </span>
            )}
            {event.userEmail && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <UserIcon size={9} />
                {event.userEmail}
              </span>
            )}
            <span className="text-xs text-gray-400 flex items-center gap-1 ml-auto">
              <Calendar size={9} />
              {formatDateTime(event.createdAt)}
            </span>
          </div>
        </div>
        {hasMetadata && (
          <span className="flex-shrink-0 text-gray-400 mt-0.5">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        )}
      </button>
      {expanded && hasMetadata && (
        <div className="border-t px-3 py-2 bg-gray-50" style={{ borderColor: "#f3f4f6" }}>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap break-all overflow-x-auto">
            {JSON.stringify(event.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

type EventTypeValue = typeof EVENT_TYPE_OPTIONS[number]["value"];
type EventTypeBackend = Exclude<EventTypeValue, "all">;

export default function AuditPage() {
  const [eventType, setEventType] = useState<EventTypeValue>("all");
  const [resourceType, setResourceType] = useState<string>("all");
  const [sinceDays, setSinceDays] = useState<string>("30");
  const [offset, setOffset] = useState(0);

  const eventTypeFilter: EventTypeBackend | undefined =
    eventType === "all" ? undefined : eventType;
  const resourceTypeFilter = resourceType === "all" ? undefined : resourceType;
  const sinceDaysFilter = sinceDays === "all" ? undefined : Number(sinceDays);

  const listQuery = trpc.audit.list.useQuery({
    limit: PAGE_SIZE,
    offset,
    eventType: eventTypeFilter,
    resourceType: resourceTypeFilter,
    sinceDays: sinceDaysFilter,
  });

  const summaryQuery = trpc.audit.summary.useQuery({ sinceDays: sinceDaysFilter ?? 30 });
  const resourceTypesQuery = trpc.audit.resourceTypes.useQuery();

  const items = (listQuery.data?.items ?? []) as AuditRow[];
  const total = listQuery.data?.total ?? 0;
  const summary = summaryQuery.data ?? [];
  const resourceTypes = resourceTypesQuery.data ?? [];
  const totalRecentEvents = summary.reduce((sum, s) => sum + s.count, 0);

  const handleResetFilters = () => {
    setEventType("all");
    setResourceType("all");
    setSinceDays("30");
    setOffset(0);
  };

  const onFilterChange = () => setOffset(0);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <div className="border-b" style={{ borderColor: "#e5e7eb", backgroundColor: "#F8FAFC" }}>
        <div className="container py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#7CA9D3" }}>
              <Shield size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "#161718" }}>Audit napló</h1>
          </div>
          <p className="text-gray-500 text-sm ml-11">
            Az alkalmazás minden írási műveletének naplója. {totalRecentEvents.toLocaleString("hu-HU")} esemény az utolsó {sinceDaysFilter ?? "30"} napban.
          </p>
        </div>
      </div>

      <main className="flex-1 container py-8 space-y-6">
        {/* Summary widget */}
        {summary.length > 0 && (
          <div className="rounded-xl border bg-white p-4" style={{ borderColor: "#e5e7eb" }}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Esemény-megoszlás (utolsó {sinceDaysFilter ?? "30"} nap)
            </p>
            <div className="flex flex-wrap gap-2">
              {summary.slice(0, 12).map((s) => {
                const cfg = eventTypeBadgeColor(s.eventType);
                return (
                  <button
                    key={s.eventType}
                    onClick={() => { setEventType(s.eventType as EventTypeValue); onFilterChange(); }}
                    className="text-xs px-2 py-1 rounded-full font-medium border-0 hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: cfg.bg, color: cfg.color }}
                  >
                    {eventTypeLabel(s.eventType)} <span className="ml-1 opacity-70">×{s.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mr-1">
            <Filter size={12} />
            Szűrés:
          </div>
          <Select value={eventType} onValueChange={(v) => { setEventType(v as EventTypeValue); onFilterChange(); }}>
            <SelectTrigger className="h-9 text-xs w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EVENT_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={resourceType} onValueChange={(v) => { setResourceType(v); onFilterChange(); }}>
            <SelectTrigger className="h-9 text-xs w-44"><SelectValue placeholder="Erőforrás" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Minden erőforrás</SelectItem>
              {resourceTypes.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sinceDays} onValueChange={(v) => { setSinceDays(v); onFilterChange(); }}>
            <SelectTrigger className="h-9 text-xs w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SINCE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {(eventType !== "all" || resourceType !== "all" || sinceDays !== "30") && (
            <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={handleResetFilters}>
              Szűrők alaphelyzetbe
            </Button>
          )}
          <span className="ml-auto text-xs text-gray-500">
            {total.toLocaleString("hu-HU")} esemény
          </span>
        </div>

        {/* Events list */}
        {listQuery.isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Betöltés…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border bg-white p-12 flex flex-col items-center gap-3" style={{ borderColor: "#e5e7eb" }}>
            <Inbox size={26} className="text-gray-300" />
            <p className="font-medium text-gray-700">Nincs találat</p>
            <p className="text-sm text-gray-500 text-center max-w-md">
              A jelenlegi szűrőkkel egy esemény sem található. Próbáld ki a "Szűrők alaphelyzetbe" gombbal.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0 || listQuery.isLoading}
            >
              <ChevronLeft size={14} /> Előző
            </Button>
            <span className="text-xs text-gray-500">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} / {total.toLocaleString("hu-HU")}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total || listQuery.isLoading}
            >
              Következő <ChevronRight size={14} />
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
