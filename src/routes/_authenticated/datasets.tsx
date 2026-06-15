import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Upload, FileText, Eye, Download, Trash2, X, Loader2 } from "lucide-react";

import { PageHeader, Panel, EmptyState, StatusPill } from "@/components/eng-ui";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/datasets")({
  component: DatasetsPage,
  head: () => ({ meta: [{ title: "Datasets — EngineAI" }] }),
});

type ParsedFile = {
  name: string;
  fileType: "csv" | "xlsx" | "xls";
  columns: string[];
  rows: Record<string, unknown>[];
  duplicates: number;
};

const ALLOWED = ["csv", "xlsx", "xls"] as const;

function fileExt(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

async function parseFile(file: File): Promise<ParsedFile> {
  const ext = fileExt(file.name);
  if (!ALLOWED.includes(ext as (typeof ALLOWED)[number])) {
    throw new Error("Invalid file format. Please upload CSV or Excel (.csv, .xlsx, .xls).");
  }
  if (file.size === 0) throw new Error("File is empty.");

  const buf = await file.arrayBuffer();
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "array" });
  } catch {
    throw new Error("File appears to be corrupted or unreadable.");
  }
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("No sheets found in the file.");
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (!rows.length) throw new Error("No data rows found in the file.");

  const columns = Object.keys(rows[0]);
  if (!columns.length) throw new Error("No columns detected — check the header row.");

  // dedupe
  const seen = new Set<string>();
  const unique: Record<string, unknown>[] = [];
  let duplicates = 0;
  for (const r of rows) {
    const k = JSON.stringify(r);
    if (seen.has(k)) {
      duplicates++;
      continue;
    }
    seen.add(k);
    unique.push(r);
  }

  return {
    name: file.name,
    fileType: ext as ParsedFile["fileType"],
    columns,
    rows: unique,
    duplicates,
  };
}

function DatasetsPage() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const { data: datasets = [], isLoading } = useQuery({
    queryKey: ["datasets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("datasets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const importMutation = useMutation({
    mutationFn: async (p: ParsedFile) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not authenticated");

      // graceful duplicate handling: same name + same record count + same user
      const { data: existing } = await supabase
        .from("datasets")
        .select("id")
        .eq("name", p.name)
        .eq("record_count", p.rows.length)
        .maybeSingle();
      if (existing) {
        throw new Error(`A dataset named "${p.name}" with the same record count already exists.`);
      }

      const { data, error } = await supabase
        .from("datasets")
        .insert({
          user_id: auth.user.id,
          name: p.name,
          source: "upload",
          file_type: p.fileType,
          record_count: p.rows.length,
          columns: p.columns,
          preview: p.rows.slice(0, 200) as never,
          status: "ready",
          storage_path: p.name,
        })
        .select("id")
        .single();
      if (error) throw error;
      return { id: data.id, count: p.rows.length };
    },
    onSuccess: ({ id, count }) => {
      toast.success(`Dataset imported successfully. Records Imported: ${count}, Dataset ID: ${id.slice(0, 8)}`);
      setParsed(null);
      setProgress(0);
      qc.invalidateQueries({ queryKey: ["datasets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("datasets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dataset deleted");
      qc.invalidateQueries({ queryKey: ["datasets"] });
      setConfirmDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleFile = useCallback(async (file: File) => {
    setParsing(true);
    setProgress(10);
    const tick = setInterval(() => {
      setProgress((p) => (p < 85 ? p + 8 : p));
    }, 80);
    try {
      const result = await parseFile(file);
      clearInterval(tick);
      setProgress(100);
      setParsed(result);
      if (result.duplicates > 0) {
        toast.info(`${result.duplicates} duplicate row${result.duplicates > 1 ? "s" : ""} removed`);
      }
      toast.success(`Loaded ${result.rows.length.toLocaleString()} rows`);
    } catch (e) {
      clearInterval(tick);
      setProgress(0);
      toast.error((e as Error).message);
    } finally {
      setParsing(false);
      setTimeout(() => setProgress(0), 600);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const viewed = useMemo(
    () => datasets.find((d) => d.id === viewing),
    [datasets, viewing]
  );

  const downloadDataset = (d: typeof datasets[number]) => {
    const rows = (d.preview as Record<string, unknown>[]) ?? [];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    const ext = d.file_type === "csv" ? "csv" : "xlsx";
    XLSX.writeFile(wb, `${d.name.replace(/\.[^.]+$/, "")}.${ext}`);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <PageHeader
        eyebrow="Dataset Manager"
        title="Research Datasets"
        description="Upload and validate CSV/XLSX engine test data."
        actions={
          <Button
            className="bg-brand text-brand-foreground hover:bg-brand/90"
            onClick={() => inputRef.current?.click()}
            disabled={parsing}
          >
            <Upload className="size-4 mr-1.5" /> Upload Dataset
          </Button>
        }
      />

      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      {/* Dropzone */}
      <Panel className="!p-0 overflow-hidden">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !parsing && inputRef.current?.click()}
          className={`cursor-pointer p-10 text-center transition-colors ${
            dragOver ? "bg-brand/5 ring-1 ring-brand/40" : ""
          }`}
        >
          <Upload className="size-8 mx-auto text-muted-foreground" />
          <p className="mt-3 font-medium">Drop file here or click to upload</p>
          <p className="text-xs text-muted-foreground mt-1">CSV, XLSX, or XLS — up to 20MB</p>
          {(parsing || progress > 0) && (
            <div className="max-w-md mx-auto mt-4">
              <Progress value={progress} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground mt-1.5 num">
                {parsing ? "Uploading..." : "Done"} {progress}%
              </p>
            </div>
          )}
        </div>
      </Panel>

      {/* Preview */}
      {parsed && (
        <Panel>
          <div className="flex items-start justify-between mb-4 gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-brand" />
                <h2 className="font-semibold truncate">{parsed.name}</h2>
              </div>
              <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                <span>
                  <span className="num text-foreground">{parsed.rows.length.toLocaleString()}</span> rows
                </span>
                <span>
                  <span className="num text-foreground">{parsed.columns.length}</span> columns
                </span>
                <span className="uppercase">{parsed.fileType}</span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setParsed(null)} disabled={importMutation.isPending}>
                <X className="size-3.5 mr-1" /> Cancel
              </Button>
              <Button
                size="sm"
                className="bg-brand text-brand-foreground hover:bg-brand/90"
                disabled={importMutation.isPending}
                onClick={() => importMutation.mutate(parsed)}
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="size-3.5 mr-1 animate-spin" /> Importing...
                  </>
                ) : (
                  "Import Dataset"
                )}
              </Button>
            </div>
          </div>
          <div className="border border-border rounded-md overflow-auto max-h-80">
            <Table>
              <TableHeader>
                <TableRow>
                  {parsed.columns.map((c) => (
                    <TableHead key={c} className="whitespace-nowrap">
                      {c}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsed.rows.slice(0, 20).map((r, i) => (
                  <TableRow key={i}>
                    {parsed.columns.map((c) => (
                      <TableCell key={c} className="num whitespace-nowrap">
                        {String(r[c] ?? "")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {parsed.rows.length > 20 && (
            <p className="text-[11px] text-muted-foreground mt-2">
              Showing first 20 of {parsed.rows.length.toLocaleString()} rows.
            </p>
          )}
        </Panel>
      )}

      {/* Datasets table */}
      <Panel>
        <h2 className="text-sm font-semibold mb-4">Imported Datasets</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : datasets.length === 0 ? (
          <EmptyState title="No datasets yet" hint="Upload your first CSV or XLSX above." />
        ) : (
          <>
            {/* Desktop / tablet table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dataset Name</TableHead>
                    <TableHead>File Type</TableHead>
                    <TableHead className="text-right">Record Count</TableHead>
                    <TableHead>Upload Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datasets.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="uppercase text-xs">{d.file_type ?? "—"}</TableCell>
                      <TableCell className="text-right num">{d.record_count.toLocaleString()}</TableCell>
                      <TableCell className="num text-xs">
                        {new Date(d.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <StatusPill status={d.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setViewing(d.id)}>
                            <Eye className="size-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => downloadDataset(d)}>
                            <Download className="size-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDelete({ id: d.id, name: d.name })}
                          >
                            <Trash2 className="size-3.5 text-danger" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {datasets.map((d) => (
                <div key={d.id} className="panel p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{d.name}</p>
                      <p className="text-[11px] text-muted-foreground num mt-0.5">
                        {new Date(d.created_at).toLocaleDateString()} · {d.record_count.toLocaleString()} records · <span className="uppercase">{d.file_type ?? "—"}</span>
                      </p>
                    </div>
                    <StatusPill status={d.status} />
                  </div>
                  <div className="flex gap-1 pt-1 border-t border-border/40">
                    <Button size="sm" variant="ghost" className="flex-1" onClick={() => setViewing(d.id)}>
                      <Eye className="size-3.5 mr-1" /> View
                    </Button>
                    <Button size="sm" variant="ghost" className="flex-1" onClick={() => downloadDataset(d)}>
                      <Download className="size-3.5 mr-1" /> Download
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDelete({ id: d.id, name: d.name })}
                    >
                      <Trash2 className="size-3.5 text-danger" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Panel>

      {/* View Dialog */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{viewed?.name}</DialogTitle>
            <DialogDescription>
              {viewed?.record_count.toLocaleString()} records · {viewed?.columns.length} columns ·
              showing preview (first {Math.min(200, viewed?.record_count ?? 0)})
            </DialogDescription>
          </DialogHeader>
          <div className="border border-border rounded-md overflow-auto flex-1">
            {viewed && (
              <Table>
                <TableHeader>
                  <TableRow>
                    {viewed.columns.map((c) => (
                      <TableHead key={c} className="whitespace-nowrap">
                        {c}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((viewed.preview as Record<string, unknown>[]) ?? []).map((r, i) => (
                    <TableRow key={i}>
                      {viewed.columns.map((c) => (
                        <TableCell key={c} className="num whitespace-nowrap">
                          {String(r[c] ?? "")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete dataset?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{confirmDelete?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
              className="bg-danger text-danger-foreground hover:bg-danger/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
