import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Download, AlertCircle } from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DownloadDialogProps {
  data: any[];
  onExport?: (format: string) => Promise<Blob>;
  filename?: string;
  maxRows?: number;
}

// Regenerated server-side via `onExport` (re-run with FORMAT <x>), unlike
// csv/json/clipboard which format the already-fetched `data` prop locally.
export const NATIVE_TEXT_FORMATS = [
  "CSV",
  "CSVWithNames",
  "CSVWithNamesAndTypes",
  "TabSeparated",
  "TabSeparatedWithNames",
  "JSON",
  "JSONStrings",
  "JSONColumns",
  "JSONColumnsWithMetadata",
  "JSONCompact",
  "JSONEachRow",
  "PrettyJSONEachRow",
  "SQLInsert",
  "Markdown",
  "Values",
  "Prometheus",
] as const;

export const NATIVE_BINARY_FORMATS = ["Native", "Avro", "Parquet", "BSONEachRow"] as const;

export const NATIVE_FORMATS = [...NATIVE_TEXT_FORMATS, ...NATIVE_BINARY_FORMATS] as const;

export type NativeExportFormat = (typeof NATIVE_FORMATS)[number];
type ExportFormat = "csv" | "json" | "clipboard" | NativeExportFormat;

const isNativeFormat = (format: ExportFormat): format is NativeExportFormat =>
  (NATIVE_FORMATS as readonly string[]).includes(format);

export const NATIVE_FORMAT_EXTENSIONS: Record<NativeExportFormat, string> = {
  CSV: "csv",
  CSVWithNames: "csv",
  CSVWithNamesAndTypes: "csv",
  TabSeparated: "tsv",
  TabSeparatedWithNames: "tsv",
  JSON: "json",
  JSONStrings: "json",
  JSONColumns: "json",
  JSONColumnsWithMetadata: "json",
  JSONCompact: "json",
  JSONEachRow: "ndjson",
  PrettyJSONEachRow: "json",
  SQLInsert: "sql",
  Markdown: "md",
  Values: "txt",
  Prometheus: "prom",
  Native: "native",
  Avro: "avro",
  Parquet: "parquet",
  BSONEachRow: "bson",
};

export const NATIVE_FORMAT_CONTENT_TYPES: Record<NativeExportFormat, string> = {
  CSV: "text/csv",
  CSVWithNames: "text/csv",
  CSVWithNamesAndTypes: "text/csv",
  TabSeparated: "text/tab-separated-values",
  TabSeparatedWithNames: "text/tab-separated-values",
  JSON: "application/json",
  JSONStrings: "application/json",
  JSONColumns: "application/json",
  JSONColumnsWithMetadata: "application/json",
  JSONCompact: "application/json",
  JSONEachRow: "application/x-ndjson",
  PrettyJSONEachRow: "text/plain",
  SQLInsert: "text/plain",
  Markdown: "text/markdown",
  Values: "text/plain",
  Prometheus: "text/plain",
  Native: "application/octet-stream",
  Avro: "application/octet-stream",
  Parquet: "application/octet-stream",
  BSONEachRow: "application/octet-stream",
};

const CHUNK_SIZE = 10000; // Number of rows to process at once

/**
 * Prepares a value for CSV export by properly handling objects and complex types.
 * Objects are serialized to JSON strings which PapaParse will then properly escape.
 */
const prepareCsvValue = (value: unknown): string | number | boolean | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "object") {
    // Convert objects/arrays to JSON strings
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return String(value);
};

/**
 * Prepares an entire row for CSV export by processing each value.
 */
const prepareRowForCsv = (row: Record<string, unknown>): Record<string, string | number | boolean | null> => {
  const prepared: Record<string, string | number | boolean | null> = {};
  for (const key of Object.keys(row)) {
    prepared[key] = prepareCsvValue(row[key]);
  }
  return prepared;
};

const DownloadDialog: React.FC<DownloadDialogProps> = ({
  data,
  onExport,
  maxRows = 1000000,
}) => {
  const [downloadOption, setDownloadOption] = useState<ExportFormat>("csv");
  const [estimatedSize, setEstimatedSize] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [open, setOpen] = useState(false);

  const estimateSize = useCallback(async () => {
    if (isNativeFormat(downloadOption)) {
      setEstimatedSize("");
      return;
    }

    if (data.length === 0) {
      setEstimatedSize("0 B");
      return;
    }

    const sampleSize = Math.min(100, data.length);
    const sample = data.slice(0, sampleSize);
    let size: number;

    switch (downloadOption) {
      case "csv": {
        const preparedSample = sample.map(prepareRowForCsv);
        const csvOptions: Papa.UnparseConfig = {
          quotes: true,
          quoteChar: '"',
          escapeChar: '"',
        };
        size =
          new Blob([Papa.unparse(preparedSample, csvOptions)]).size *
          (data.length / sampleSize);
        break;
      }
      case "json":
        size =
          new Blob([JSON.stringify(sample)]).size * (data.length / sampleSize);
        break;
      case "clipboard":
        size =
          new Blob([JSON.stringify(sample)]).size * (data.length / sampleSize);
        break;
      default:
        size = 0;
    }

    setEstimatedSize(formatBytes(size));
  }, [data, downloadOption]);

  useEffect(() => {
    estimateSize();
  }, [estimateSize]);

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const processInChunks = async (
    data: any[],
    format: ExportFormat,
    chunkSize: number
  ): Promise<Blob> => {
    const chunks = Math.ceil(data.length / chunkSize);
    let result = "";

    for (let i = 0; i < chunks; i++) {
      const chunk = data.slice(i * chunkSize, (i + 1) * chunkSize);

      switch (format) {
        case "csv": {
          // Preprocess data to handle objects and complex types
          const preparedChunk = chunk.map(prepareRowForCsv);
          // Use PapaParse with proper escaping configuration
          const csvOptions: Papa.UnparseConfig = {
            header: i === 0,
            quotes: true, // Always quote fields to ensure proper escaping
            quoteChar: '"',
            escapeChar: '"', // Double-quote escaping as per RFC 4180
            newline: "\r\n", // Standard CSV line ending
          };
          result += Papa.unparse(preparedChunk, csvOptions);
          if (i < chunks - 1) {
            result += "\r\n"; // Add newline between chunks
          }
          break;
        }
        case "json":
        case "clipboard":
          result +=
            (i === 0 ? "[" : "") +
            chunk.map((item) => JSON.stringify(item)).join(",") +
            (i === chunks - 1 ? "]" : "");
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      setProgress(((i + 1) / chunks) * 100);
      // Allow UI to update
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    return new Blob([result], { type: getContentType(format) });
  };

  const getContentType = (format: ExportFormat): string => {
    switch (format) {
      case "csv":
        return "text/csv";
      case "json":
        return "application/json";
      default:
        return "text/plain";
    }
  };

  type AlertVariant =
    | "destructive"
    | "warning"
    | "info"
    | "default"
    | "success"
    | "neutral";

  type SizeWarning = {
    message: string;
    severity: AlertVariant;
  } | null;

  const getSizeWarning = useCallback((): SizeWarning => {
    if (!estimatedSize) return null;

    const [size, unit] = estimatedSize.split(" ");
    const sizeNum = parseFloat(size);

    // Convert everything to MB for comparison
    let sizeInMB = sizeNum;
    switch (unit) {
      case "GB":
        sizeInMB = sizeNum * 1024;
        break;
      case "KB":
        sizeInMB = sizeNum / 1024;
        break;
      case "B":
        sizeInMB = sizeNum / (1024 * 1024);
        break;
      case "MB":
        sizeInMB = sizeNum;
        break;
    }

    if (sizeInMB >= 100) {
      return {
        message:
          "Warning: The export size is over 100MB. This might take a while and could impact browser performance.",
        severity: "destructive",
      };
    } else if (sizeInMB >= 50) {
      return {
        message:
          "Warning: The export size is over 50MB. This might take a while.",
        severity: "warning",
      };
    } else if (sizeInMB >= 20) {
      return {
        message: "The export size is over 20MB.",
        severity: "default",
      };
    }
    return null;
  }, [estimatedSize]);

  const handleDownload = async () => {
    try {
      setIsProcessing(true);
      setProgress(0);

      const usingNativeFormat = isNativeFormat(downloadOption);

      if (!usingNativeFormat && data.length > maxRows) {
        toast.error(`Cannot export more than ${maxRows.toLocaleString()} rows`);
        return;
      }

      let blob: Blob;

      if (usingNativeFormat) {
        if (!onExport) {
          toast.error("Native format export isn't available here.");
          return;
        }
        blob = await onExport(downloadOption);
      } else {
        blob = await processInChunks(data, downloadOption, CHUNK_SIZE);
      }

      const now = new Date().toISOString().split(".")[0].replace(/[:]/g, "-");
      const exportFilename = `ch_ui_export_${now}`;

      if (downloadOption === "clipboard") {
        const text = await blob.text();
        await navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard!", { duration: 2000 });
      } else {
        const extension = isNativeFormat(downloadOption)
          ? NATIVE_FORMAT_EXTENSIONS[downloadOption]
          : downloadOption;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${exportFilename}.${extension}`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("Download started!", { duration: 2000 });
      }

      setOpen(false);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data. Please try again.", {
        duration: 2000,
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="link" className="h-4 w-4 p-0 ml-2">
          <Download />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Data</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {getSizeWarning() && (
            <Alert variant={getSizeWarning()?.severity || "neutral"}>
              <AlertDescription>{getSizeWarning()?.message}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Quick Export</Label>
            <RadioGroup
              value={downloadOption}
              onValueChange={(value) => setDownloadOption(value as ExportFormat)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv">CSV</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="json" id="json" />
                <Label htmlFor="json">JSON</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="clipboard" id="clipboard" />
                <Label htmlFor="clipboard">Copy to Clipboard</Label>
              </div>
            </RadioGroup>
          </div>

          {onExport && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Native ClickHouse Format
                </Label>
                <Select
                  value={isNativeFormat(downloadOption) ? downloadOption : ""}
                  onValueChange={(value) => setDownloadOption(value as ExportFormat)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a native format…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {NATIVE_TEXT_FORMATS.map((format) => (
                        <SelectItem key={format} value={format}>
                          {format}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Binary</SelectLabel>
                      {NATIVE_BINARY_FORMATS.map((format) => (
                        <SelectItem key={format} value={format}>
                          {format}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Re-runs the query on the server with this FORMAT and streams the result.
                </p>
              </div>
            </>
          )}

          <div className="text-sm text-gray-500">
            {isNativeFormat(downloadOption)
              ? "Size depends on the server-side result — not estimated locally."
              : `Estimated size: ${estimatedSize}`}
            {!isNativeFormat(downloadOption) && data.length > maxRows && (
              <div className="flex items-center mt-2 text-amber-500">
                <AlertCircle className="h-4 w-4 mr-2" />
                Warning: Large dataset ({data.length.toLocaleString()} rows)
              </div>
            )}
          </div>

          {isProcessing && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-gray-500 text-center">
                Processing... {Math.round(progress)}%
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={handleDownload}
              disabled={isProcessing}
            >
              {isProcessing ? "Processing..." : "Export"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DownloadDialog;
