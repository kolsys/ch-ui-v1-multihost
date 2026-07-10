"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import useAppStore from "@/store";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  ClockIcon,
  Download,
  FileText,
  RefreshCcw,
  Search,
  X,
  Copy,
  CheckCircle,
  Eye,
  DatabaseIcon,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const escapeSqlLiteral = (value: string) => value.replace(/'/g, "''");

interface LogEntry {
  id: string;
  timestamp: string;
  type: string;
  component: string;
  message: string;
  details: string;
}

interface KnownLogTableConfig {
  table: string;
  label: string;
  description: string;
  timestampColumn: string;
  // Column name, or a quoted SQL literal like "'ERROR'" for tables with no level column.
  levelColumn: string;
  componentColumn: string;
  messageColumn: string;
  detailColumns: string[];
  typeOptions: string[];
  baseWhere?: string;
}

// Curated views for well-known ClickHouse system log tables — their column sets
// differ too much from each other to share a single generic mapping.
const KNOWN_LOG_TABLES: Record<string, KnownLogTableConfig> = {
  text_log: {
    table: "text_log",
    label: "Text Log",
    description: "General server logs from system.text_log",
    timestampColumn: "event_time_microseconds",
    levelColumn: "level",
    componentColumn: "logger_name",
    messageColumn: "message",
    detailColumns: ["source_file", "source_line", "query_id"],
    typeOptions: ["Fatal", "Error", "Warning", "Information", "Debug", "Trace"],
  },
  query_log: {
    table: "query_log",
    label: "Query Log",
    description: "Executed queries from system.query_log",
    timestampColumn: "event_time_microseconds",
    levelColumn: "type",
    componentColumn: "user",
    messageColumn: "query",
    detailColumns: ["exception", "query_duration_ms", "memory_usage", "read_rows", "query_id"],
    typeOptions: ["QueryStart", "QueryFinish", "ExceptionBeforeStart", "ExceptionWhileProcessing"],
  },
  errors: {
    table: "errors",
    label: "Errors",
    description: "Cumulative error counters from system.errors",
    timestampColumn: "last_error_time",
    levelColumn: "'ERROR'",
    componentColumn: "name",
    messageColumn: "last_error_message",
    detailColumns: ["code", "value", "remote"],
    typeOptions: [],
    baseWhere: "value > 0",
  },
};

interface ColumnMeta {
  name: string;
  type: string;
}

interface DiscoveredTable {
  name: string;
  columns: ColumnMeta[];
}

// Best-effort pick of a DateTime-like column to order/filter a table we know nothing about.
const detectTimestampColumn = (columns: ColumnMeta[]): string | null => {
  const dateTimeColumns = columns.filter((c) => c.type.startsWith("DateTime"));
  if (dateTimeColumns.length === 0) return null;
  const preferredNames = ["event_time_microseconds", "event_time", "event_date"];
  for (const name of preferredNames) {
    const match = dateTimeColumns.find((c) => c.name === name);
    if (match) return match.name;
  }
  return dateTimeColumns[0].name;
};

// e.g. "part_log" -> "Part Log"
const humanizeTableName = (name: string): string =>
  name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

interface LogTableProps {
  logs: LogEntry[];
  isLoading: boolean;
  onLogClick: (log: LogEntry) => void;
}

const LogTable: React.FC<LogTableProps> = ({ logs, isLoading, onLogClick }) => {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-4 border border-muted rounded-md">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded-md animate-pulse" />
        ))}
      </div>
    );
  }
  if (logs.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-2">No logs found</h3>
        <p className="text-muted-foreground">
          Try adjusting your search filters
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden">
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            <TableHead className="w-[180px]">Timestamp</TableHead>
            <TableHead className="w-[100px]">Type</TableHead>
            <TableHead className="w-[150px]">Component</TableHead>
            <TableHead>Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow
              key={log.id}
              className="group cursor-pointer hover:bg-muted/50"
              onClick={() => onLogClick(log)}
            >
              <TableCell className="font-mono text-xs">
                <div className="flex items-center">
                  <ClockIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                  {formatTimestamp(log.timestamp)}
                </div>
              </TableCell>
              <TableCell>
                <LogTypeBadge type={log.type} />
              </TableCell>
              <TableCell className="text-xs truncate max-w-56">{log.component}</TableCell>
              <TableCell className="flex items-center space-x-2 truncate justify-between">
                <div className="font-mono text-sm truncate max-w-[700px]">
                  {log.message}
                </div>
                <div className="text-xs text-muted-foreground flex items-center shrink-0 opacity-0 group-hover:opacity-100">
                  <Eye className="h-4 w-4" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

interface GenericRowsTableProps {
  columns: string[];
  rows: Record<string, any>[];
  isLoading: boolean;
  onRowClick: (row: Record<string, any>) => void;
}

// Fallback viewer for any discovered system.*_log table with no curated mapping.
const GenericRowsTable: React.FC<GenericRowsTableProps> = ({
  columns,
  rows,
  isLoading,
  onRowClick,
}) => {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-4 border border-muted rounded-md">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded-md animate-pulse" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-2">No rows found</h3>
        <p className="text-muted-foreground">
          Try adjusting your search filters
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col} className="whitespace-nowrap">
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow
              key={i}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onRowClick(row)}
            >
              {columns.map((col) => (
                <TableCell key={col} className="font-mono text-xs truncate max-w-[400px]">
                  {formatCellValue(row[col])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

const formatCellValue = (value: any): string => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const LogTypeBadge: React.FC<{ type: string }> = ({ type }) => {
  const upper = type.toUpperCase();
  let variant: "destructive" | "warning" | "secondary" | "outline" | "default" = "secondary";
  if (/(ERROR|FATAL|EXCEPTION)/.test(upper)) variant = "destructive";
  else if (/WARN/.test(upper)) variant = "warning";
  else if (/(DEBUG|TRACE)/.test(upper)) variant = "outline";

  return (
    <Badge variant={variant as any} className="">{type}</Badge>
  );
};

const LogDetailView: React.FC<{ log: LogEntry | null }> = ({ log }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!log) return null;

  const logDetails = {
    "Log ID": log.id,
    Timestamp: formatTimestamp(log.timestamp),
    Type: log.type,
    Component: log.component,
    Message: log.message,
    Details: log.details,
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <LogTypeBadge type={log.type} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => copyToClipboard(JSON.stringify(log, null, 2))}
        >
          {copied ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              Copy JSON
            </>
          )}
        </Button>
      </div>
      <div className="space-y-4">
        {Object.entries(logDetails).map(([key, value]) => (
          <div key={key} className="space-y-1">
            <Label className="text-xs text-muted-foreground">{key}</Label>
            <div
              className={`p-2 rounded-md bg-muted ${
                key === "Message" || key === "Details"
                  ? "font-mono text-sm whitespace-pre-wrap break-words"
                  : "font-mono text-sm"
              }`}
            >
              {value || "-"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const GenericRowDetailView: React.FC<{ row: Record<string, any> | null }> = ({ row }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!row) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => copyToClipboard(JSON.stringify(row, null, 2))}
        >
          {copied ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              Copy JSON
            </>
          )}
        </Button>
      </div>
      <div className="space-y-4">
        {Object.entries(row).map(([key, value]) => (
          <div key={key} className="space-y-1">
            <Label className="text-xs text-muted-foreground">{key}</Label>
            <div className="p-2 rounded-md bg-muted font-mono text-sm whitespace-pre-wrap break-words">
              {formatCellValue(value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Helper function to format timestamps
const formatTimestamp = (timestamp: string) => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
      hour12: false,
    });
  } catch (e) {
    return timestamp;
  }
};

const LogsPage: React.FC = () => {
  const { runQuery, clickHouseClient, isServerAvailable } = useAppStore();

  // Table discovery
  const [availableTables, setAvailableTables] = useState<DiscoveredTable[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(true);
  const [selectedTable, setSelectedTable] = useState<string>("");

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [genericRows, setGenericRows] = useState<Record<string, any>[]>([]);
  const [genericColumns, setGenericColumns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [selectedRow, setSelectedRow] = useState<Record<string, any> | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollAreaHeight, setScrollAreaHeight] = useState("500px");
  const [autoRefresh, setAutoRefresh] = useState<number | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [logType, setLogType] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<string>("1h");

  const timeRangeOptions = [
    { value: "1h", label: "Last hour", hours: 1 },
    { value: "6h", label: "Last 6 hours", hours: 6 },
    { value: "12h", label: "Last 12 hours", hours: 12 },
    { value: "24h", label: "Last 24 hours", hours: 24 },
    { value: "3d", label: "Last 3 days", hours: 72 },
    { value: "7d", label: "Last 7 days", hours: 168 },
    { value: "14d", label: "Last 14 days", hours: 336 },
  ];

  const refreshOptions = [
    { value: null, label: "Manual" },
    { value: 5000, label: "5 seconds" },
    { value: 15000, label: "15 seconds" },
    { value: 30000, label: "30 seconds" },
    { value: 60000, label: "1 minute" },
  ];

  const knownConfig = KNOWN_LOG_TABLES[selectedTable];
  const discoveredTable = availableTables.find((t) => t.name === selectedTable);
  const genericTimestampColumn = discoveredTable && !knownConfig
    ? detectTimestampColumn(discoveredTable.columns)
    : null;
  const hasTimeFilter = !!knownConfig || !!genericTimestampColumn;

  // Discover available system.*_log tables (plus system.errors) on connect.
  useEffect(() => {
    const discover = async () => {
      if (!isServerAvailable || !clickHouseClient) return;
      setIsDiscovering(true);
      try {
        const result = await runQuery(`
          SELECT table, name, type
          FROM system.columns
          WHERE database = 'system'
            AND table IN (
              SELECT name FROM system.tables
              WHERE database = 'system' AND (endsWith(name, '_log') OR name = 'errors')
            )
          ORDER BY table, position
        `);

        const grouped = new Map<string, ColumnMeta[]>();
        for (const row of result.data || []) {
          const list = grouped.get(row.table) || [];
          list.push({ name: row.name, type: row.type });
          grouped.set(row.table, list);
        }

        const tables: DiscoveredTable[] = Array.from(grouped.entries()).map(
          ([name, columns]) => ({ name, columns })
        );
        setAvailableTables(tables);

        setSelectedTable((current) => {
          if (current && tables.some((t) => t.name === current)) return current;
          const preferredOrder = ["text_log", "query_log", "errors"];
          const preferred = preferredOrder.find((name) =>
            tables.some((t) => t.name === name)
          );
          return preferred || tables[0]?.name || "";
        });
      } catch (err: any) {
        setError(err.message || "Failed to discover log tables");
      } finally {
        setIsDiscovering(false);
      }
    };
    discover();
  }, [isServerAvailable, clickHouseClient]);

  // Reset filters that don't make sense across table switches.
  useEffect(() => {
    setLogType("all");
  }, [selectedTable]);

  const getTimeRangeDates = (): { fromDate: string; toDate: string } => {
    const now = new Date();
    const hoursToSubtract =
      timeRangeOptions.find((option) => option.value === timeRange)?.hours || 1;
    const fromDate = new Date(now);
    fromDate.setHours(fromDate.getHours() - hoursToSubtract);
    return { fromDate: fromDate.toISOString(), toDate: now.toISOString() };
  };

  useEffect(() => {
    const calculateHeight = () => {
      if (scrollContainerRef.current) {
        const rect = scrollContainerRef.current.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const availableHeight = windowHeight - rect.top - 150;
        setScrollAreaHeight(`${Math.max(300, availableHeight)}px`);
      }
    };
    calculateHeight();
    window.addEventListener("resize", calculateHeight);
    return () => window.removeEventListener("resize", calculateHeight);
  }, []);

  const handleLogClick = (log: LogEntry) => {
    setSelectedLog(log);
    setSelectedRow(null);
    setSheetOpen(true);
  };

  const handleRowClick = (row: Record<string, any>) => {
    setSelectedRow(row);
    setSelectedLog(null);
    setSheetOpen(true);
  };

  const buildKnownTableQuery = (cfg: KnownLogTableConfig): string => {
    const detailsExpr = cfg.detailColumns
      .map((col) => `'${col}=', toString(${col})`)
      .join(", ', ', ");

    let query = `
      SELECT
        generateUUIDv4() as id,
        ${cfg.timestampColumn} as timestamp,
        toString(${cfg.levelColumn}) as type,
        toString(${cfg.componentColumn}) as component,
        toString(${cfg.messageColumn}) as message,
        concat(${detailsExpr}) as details
      FROM system.${cfg.table}
      WHERE 1=1
    `;

    if (cfg.baseWhere) {
      query += `\n AND (${cfg.baseWhere})`;
    }

    if (logType !== "all" && cfg.typeOptions.length > 0) {
      query += `\n AND ${cfg.levelColumn} = '${escapeSqlLiteral(logType)}'`;
    }

    if (searchTerm) {
      const esc = escapeSqlLiteral(searchTerm);
      query += `\n AND (toString(${cfg.messageColumn}) ILIKE '%${esc}%' OR toString(${cfg.componentColumn}) ILIKE '%${esc}%')`;
    }

    const { fromDate, toDate } = getTimeRangeDates();
    query += `\n AND ${cfg.timestampColumn} >= parseDateTimeBestEffort('${fromDate}')`;
    query += `\n AND ${cfg.timestampColumn} <= parseDateTimeBestEffort('${toDate}')`;

    query += `\n ORDER BY ${cfg.timestampColumn} DESC LIMIT 1000`;

    return query;
  };

  const buildGenericTableQuery = (table: DiscoveredTable): string => {
    const tsCol = detectTimestampColumn(table.columns);
    const conditions: string[] = [];

    if (tsCol) {
      const { fromDate, toDate } = getTimeRangeDates();
      conditions.push(`${tsCol} >= parseDateTimeBestEffort('${fromDate}')`);
      conditions.push(`${tsCol} <= parseDateTimeBestEffort('${toDate}')`);
    }

    if (searchTerm) {
      const stringColumns = table.columns
        .filter((c) => c.type.includes("String"))
        .map((c) => c.name);
      if (stringColumns.length > 0) {
        const esc = escapeSqlLiteral(searchTerm);
        conditions.push(
          "(" +
            stringColumns.map((c) => `toString(${c}) ILIKE '%${esc}%'`).join(" OR ") +
            ")"
        );
      }
    }

    let query = `SELECT * FROM system.${table.name}`;
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }
    if (tsCol) {
      query += ` ORDER BY ${tsCol} DESC`;
    }
    query += ` LIMIT 1000`;

    return query;
  };

  const fetchLogs = async () => {
    if (!isServerAvailable || !clickHouseClient) {
      setError("Not connected to ClickHouse. Please connect first.");
      setIsLoading(false);
      return;
    }
    if (!selectedTable) return;

    setIsLoading(true);
    setError(null);

    try {
      if (knownConfig) {
        const result = await runQuery(buildKnownTableQuery(knownConfig));
        setLogs((result.data || []) as LogEntry[]);
        setGenericRows([]);
        setGenericColumns([]);
      } else if (discoveredTable) {
        const result = await runQuery(buildGenericTableQuery(discoveredTable));
        setGenericRows(result.data || []);
        setGenericColumns((result.meta || []).map((c: any) => c.name));
        setLogs([]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch logs");
      setLogs([]);
      setGenericRows([]);
      setGenericColumns([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const intervalId = setInterval(() => {
      fetchLogs();
    }, autoRefresh);
    return () => clearInterval(intervalId);
  }, [autoRefresh, timeRange, logType, searchTerm, selectedTable]);

  useEffect(() => {
    if (isServerAvailable && selectedTable) {
      fetchLogs();
    }
  }, [isServerAvailable, selectedTable, logType, searchTerm, timeRange]);

  const downloadLogs = () => {
    const data = knownConfig ? logs : genericRows;
    if (data.length === 0) return;

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    const now = new Date().toISOString().split(".")[0].replace(/[:.]/g, "-");
    a.download = `clickhouse-${selectedTable || "logs"}-${now}.json`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const rowCount = knownConfig ? logs.length : genericRows.length;

  return (
    <div className="container mx-auto py-6 h-screen flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Logs</h1>
          <p className="text-muted-foreground">
            Browse ClickHouse system log tables
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Select
            value={autoRefresh?.toString() || "null"}
            onValueChange={(value) => setAutoRefresh(value === "null" ? null : Number(value))}
          >
            <SelectTrigger className="w-36">
              <ClockIcon className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Auto-refresh" />
            </SelectTrigger>
            <SelectContent>
              {refreshOptions.map((option) => (
                <SelectItem key={option.value?.toString() || "null"} value={option.value?.toString() || "null"}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={isLoading}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadLogs}
            disabled={isLoading || rowCount === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="flex-shrink-0 mb-4">
        <CardHeader className="pb-3">
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Choose a log table, then filter by time range, type, and search terms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="log-source">Log Source</Label>
              <Select value={selectedTable} onValueChange={setSelectedTable}>
                <SelectTrigger id="log-source">
                  <DatabaseIcon className="mr-2 h-4 w-4" />
                  <SelectValue placeholder={isDiscovering ? "Discovering…" : "Select table"} />
                </SelectTrigger>
                <SelectContent>
                  {availableTables.map((t) => (
                    <SelectItem key={t.name} value={t.name}>
                      {KNOWN_LOG_TABLES[t.name]?.label || humanizeTableName(t.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 col-span-1 md:col-span-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search message or component..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-8 w-8 opacity-70 hover:opacity-100"
                    onClick={() => setSearchTerm("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {knownConfig && knownConfig.typeOptions.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="log-type">Log Type</Label>
                <Select value={logType} onValueChange={setLogType}>
                  <SelectTrigger id="log-type">
                    <SelectValue placeholder="Select log type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {knownConfig.typeOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {hasTimeFilter && (
              <div className="space-y-2">
                <Label htmlFor="time-range">Time Range</Label>
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger id="time-range">
                    <SelectValue placeholder="Select time range" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeRangeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex-1 flex flex-col min-h-0" ref={scrollContainerRef}>
        <Card className="flex-1 flex flex-col">
          <CardHeader className="pb-3 flex-shrink-0">
            <CardTitle>
              {knownConfig?.label ||
                (selectedTable ? humanizeTableName(selectedTable) : "Logs")}
            </CardTitle>
            <CardDescription>
              {knownConfig?.description ||
                (selectedTable
                  ? `Raw rows from system.${selectedTable}`
                  : isDiscovering
                  ? "Discovering available log tables…"
                  : "No system.*_log tables found on this server")}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full" style={{ height: scrollAreaHeight }}>
              {knownConfig ? (
                <LogTable logs={logs} isLoading={isLoading} onLogClick={handleLogClick} />
              ) : (
                <GenericRowsTable
                  columns={genericColumns}
                  rows={genericRows}
                  isLoading={isLoading}
                  onRowClick={handleRowClick}
                />
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedLog ? "Log Details" : "Row Details"}</SheetTitle>
            <SheetDescription>
              Detailed information about the selected {selectedLog ? "log" : "row"}
            </SheetDescription>
          </SheetHeader>
          <div className="py-6">
            {selectedLog ? (
              <LogDetailView log={selectedLog} />
            ) : (
              <GenericRowDetailView row={selectedRow} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default LogsPage;
