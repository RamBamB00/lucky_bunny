import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { CheckCircle2, Download, FileUp, Loader2, RefreshCw } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { downloadBookCsvTemplate, readCsvFile } from "@/lib/book-csv";

const MAX_FILE_BYTES = 9 * 1024 * 1024;

export default function ImportBooksDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const imp = trpc.adminCatalog.importBooks.useMutation({
    onSuccess: (r) => {
      utils.adminCatalog.invalidate();
      utils.catalog.invalidate();
      if (r.created + r.updated > 0 && r.errors.length === 0) toast.success("Импорт завершён");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (/\.xlsx?$/i.test(file.name)) {
      toast.error("Excel-файлы (.xlsx) пока не поддерживаются. В Excel: «Сохранить как» → «CSV UTF-8».");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error("Файл слишком большой (максимум 9 МБ)");
      return;
    }
    setFileName(file.name);
    try {
      const csv = await readCsvFile(file);
      imp.mutate({ csv });
    } catch {
      toast.error("Не удалось прочитать файл");
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void handleFile(e.dataTransfer.files?.[0]);
  };

  const reset = () => {
    imp.reset();
    setFileName(null);
  };

  const close = () => {
    if (imp.isPending) return;
    reset();
    onClose();
  };

  const r = imp.data;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto bg-card">
        <DialogTitle className="font-display text-xl">Импорт книг из CSV</DialogTitle>
        <DialogDescription className="text-sm">
          Загрузите файл — книги сразу попадут в каталог. Книги с уже существующим ISBN обновятся, остальные
          добавятся. Недостающие категории создаются автоматически.
        </DialogDescription>

        {!r && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`mt-2 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
              dragging ? "border-primary bg-secondary" : "border-border"
            }`}
          >
            {imp.isPending ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm font-semibold">Импортируем «{fileName}»…</p>
                <p className="text-xs text-muted-foreground">Не закрывайте окно, это может занять до минуты.</p>
              </>
            ) : (
              <>
                <FileUp className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-semibold">Перетащите CSV-файл сюда</p>
                <Button type="button" className="rounded-full" onClick={() => fileRef.current?.click()}>
                  Выбрать файл
                </Button>
                <p className="text-xs text-muted-foreground">
                  CSV (UTF-8 или Windows-1251), разделитель «;», «,» или табуляция. До 5000 строк.
                </p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }}
            />
          </div>
        )}

        {r && (
          <div className="mt-2 space-y-4">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" /> Файл «{fileName}» обработан, строк с данными: {r.total}
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Добавлено" value={r.created} />
              <Stat label="Обновлено" value={r.updated} />
              <Stat label="С ошибками" value={r.errors.length} danger={r.errors.length > 0} />
            </div>

            {r.skipped > 0 && (
              <p className="text-xs text-muted-foreground">Пропущено строк без изменений: {r.skipped}.</p>
            )}
            {r.categoriesCreated.length > 0 && (
              <p className="text-sm">
                <span className="font-semibold">Создано категорий ({r.categoriesCreated.length}):</span>{" "}
                {r.categoriesCreated.join(", ")}
              </p>
            )}
            {r.ignoredColumns.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Столбцы не распознаны и пропущены: {r.ignoredColumns.join(", ")}.
              </p>
            )}

            {r.errors.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-semibold">Строки с ошибками (они не загружены):</p>
                <div className="max-h-56 overflow-y-auto rounded-xl border border-border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted text-left">
                      <tr><th className="w-20 p-2">Строка</th><th className="p-2">Проблема</th></tr>
                    </thead>
                    <tbody>
                      {r.errors.map((e, i) => (
                        <tr key={i} className="border-t border-border/60">
                          <td className="p-2 font-semibold">{e.row}</td>
                          <td className="p-2 text-destructive">{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Номера строк — как в Excel (первая строка — заголовок). Исправьте файл и загрузите снова: уже
                  добавленные книги не задублируются.
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="rounded-full" onClick={reset}>
                <RefreshCw className="mr-1 h-4 w-4" /> Загрузить ещё файл
              </Button>
              <Button type="button" className="rounded-full" onClick={close}>Готово</Button>
            </div>
          </div>
        )}

        {!imp.isPending && !r && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              Обязательные поля: <b>title</b> (название) и <b>priceRetail</b> (розничная цена).
            </p>
            <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={downloadBookCsvTemplate}>
              <Download className="mr-1 h-4 w-4" /> Скачать шаблон CSV
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-2xl bg-muted p-3">
      <p className={`text-2xl font-bold ${danger ? "text-destructive" : ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
