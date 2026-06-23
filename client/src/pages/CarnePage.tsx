import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, Clock, Search, BookOpen, FileDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generateClientPDF } from "@/lib/generatePDF";

function formatCurrency(value: string | number) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
}

function StatusBadge({ status }: { status: string }) {
  if (status === "paid") {
    return (
      <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 text-xs font-medium whitespace-nowrap">
        <CheckCircle2 className="w-3 h-3" />
        Paga
      </Badge>
    );
  }
  if (status === "overdue") {
    return (
      <Badge variant="destructive" className="gap-1 text-xs font-medium whitespace-nowrap">
        <AlertCircle className="w-3 h-3" />
        Em Atraso
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 text-xs font-medium whitespace-nowrap">
      <Clock className="w-3 h-3" />
      Pendente
    </Badge>
  );
}

export default function CarnePage() {
  const [search, setSearch] = useState("");
  const [exportingId, setExportingId] = useState<number | null>(null);
  const { data: rows, isLoading } = trpc.installments.carne.useQuery();
  const { data: clients } = trpc.clients.list.useQuery();

  // Agrupar por cliente
  const grouped = useMemo(() => {
    if (!rows) return [];
    const map = new Map<number, {
      clientId: number;
      clientName: string;
      installments: typeof rows;
    }>();
    for (const row of rows) {
      if (!map.has(row.clientId)) {
        map.set(row.clientId, { clientId: row.clientId, clientName: row.clientName, installments: [] });
      }
      map.get(row.clientId)!.installments.push(row);
    }
    return Array.from(map.values());
  }, [rows]);

  const filtered = useMemo(() => {
    if (!search.trim()) return grouped;
    const q = search.toLowerCase();
    return grouped.filter(g => g.clientName.toLowerCase().includes(q));
  }, [grouped, search]);

  // Estatísticas gerais
  const stats = useMemo(() => {
    if (!rows) return { total: 0, paid: 0, overdue: 0, pending: 0 };
    return {
      total: rows.length,
      paid: rows.filter(r => r.status === "paid").length,
      overdue: rows.filter(r => r.status === "overdue").length,
      pending: rows.filter(r => r.status === "pending").length,
    };
  }, [rows]);

  function handleExportPDF(group: typeof grouped[0]) {
    setExportingId(group.clientId);
    try {
      // Buscar dados completos do cliente
      const clientData = clients?.find(c => c.id === group.clientId);
      generateClientPDF({
        clientName: group.clientName,
        totalFees: clientData?.totalFees ?? "0",
        installmentCount: clientData?.installmentCount ?? group.installments.length,
        installmentValue: clientData?.installmentValue ?? group.installments[0]?.installmentValue ?? "0",
        startDate: clientData?.startDate ?? group.installments[0]?.dueDate ?? Date.now(),
        installments: group.installments.map(i => ({
          installmentNumber: i.installmentNumber,
          installmentValue: i.installmentValue,
          dueDate: i.dueDate,
          paidAt: i.paidAt,
          status: i.status,
        })),
      });
      toast.success(`PDF do carnê de ${group.clientName} gerado com sucesso!`);
    } catch (err) {
      toast.error("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setExportingId(null);
    }
  }

  function handleExportAllPDF() {
    if (!filtered.length) return;
    try {
      for (const group of filtered) {
        const clientData = clients?.find(c => c.id === group.clientId);
        generateClientPDF({
          clientName: group.clientName,
          totalFees: clientData?.totalFees ?? "0",
          installmentCount: clientData?.installmentCount ?? group.installments.length,
          installmentValue: clientData?.installmentValue ?? group.installments[0]?.installmentValue ?? "0",
          startDate: clientData?.startDate ?? group.installments[0]?.dueDate ?? Date.now(),
          installments: group.installments.map(i => ({
            installmentNumber: i.installmentNumber,
            installmentValue: i.installmentValue,
            dueDate: i.dueDate,
            paidAt: i.paidAt,
            status: i.status,
          })),
        });
      }
      toast.success(`${filtered.length} PDF(s) gerado(s) com sucesso!`);
    } catch {
      toast.error("Erro ao gerar PDFs.");
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Carnê Consolidado
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Visão completa de todos os clientes e parcelas</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {!isLoading && filtered.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
              onClick={handleExportAllPDF}
            >
              <FileDown className="w-4 h-4" />
              Exportar Todos
            </Button>
          )}
        </div>
      </div>

      {/* Estatísticas */}
      {!isLoading && rows && rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="border border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Total de Parcelas</p>
              <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="border border-emerald-200 bg-emerald-50/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Pagas</p>
              <p className="text-2xl font-bold text-emerald-600" style={{ fontFamily: "'Playfair Display', serif" }}>{stats.paid}</p>
            </CardContent>
          </Card>
          <Card className={`border ${stats.overdue > 0 ? "border-destructive/40 bg-destructive/5" : "border-border"}`}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Em Atraso</p>
              <p className={`text-2xl font-bold ${stats.overdue > 0 ? "text-destructive" : "text-muted-foreground"}`} style={{ fontFamily: "'Playfair Display', serif" }}>{stats.overdue}</p>
            </CardContent>
          </Card>
          <Card className="border border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Pendentes</p>
              <p className="text-2xl font-bold text-muted-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>{stats.pending}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Conteúdo */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : !rows || rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Nenhuma parcela registrada</h3>
          <p className="text-muted-foreground text-sm max-w-xs">
            Cadastre clientes na aba "Clientes" para visualizar o carnê consolidado aqui.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum cliente encontrado para "{search}".
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((group) => {
            const paidCount = group.installments.filter(i => i.status === "paid").length;
            const overdueCount = group.installments.filter(i => i.status === "overdue").length;
            const isExporting = exportingId === group.clientId;
            return (
              <Card key={group.clientId} className="border border-border overflow-hidden">
                <CardHeader className="pb-0 pt-4 px-4 bg-muted/30 border-b border-border/60">
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <CardTitle className="text-base font-semibold" style={{ fontFamily: "'Playfair Display', serif" }}>
                        {group.clientName}
                      </CardTitle>
                      <div className="flex gap-2">
                        {overdueCount > 0 && (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {overdueCount} em atraso
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {paidCount}/{group.installments.length} pagas
                        </Badge>
                      </div>
                    </div>
                    {/* Botão Exportar PDF */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 h-8 text-xs border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground transition-all"
                      disabled={isExporting}
                      onClick={() => handleExportPDF(group)}
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      {isExporting ? "Gerando..." : "Exportar PDF"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/60 bg-muted/20">
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Parcela</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Valor</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Vencimento</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Pagamento</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.installments.map((inst, idx) => (
                          <tr
                            key={inst.installmentId}
                            className={`border-b border-border/40 transition-colors ${
                              inst.status === "overdue" ? "bg-destructive/5" :
                              inst.status === "paid" ? "bg-emerald-50/30" : ""
                            } ${idx === group.installments.length - 1 ? "border-b-0" : ""}`}
                          >
                            <td className="px-4 py-2.5 font-medium text-foreground">
                              {inst.installmentNumber}ª
                            </td>
                            <td className="px-4 py-2.5 text-foreground">
                              {formatCurrency(inst.installmentValue)}
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground">
                              {format(new Date(inst.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                            </td>
                            <td className="px-4 py-2.5">
                              {inst.paidAt ? (
                                <span className="text-emerald-600 font-medium">
                                  {format(new Date(inst.paidAt), "dd/MM/yyyy", { locale: ptBR })}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <StatusBadge status={inst.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
