import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, AlertCircle, Clock, CheckCheck, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatCurrency(value: string | number) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
}

function StatusBadge({ status }: { status: string }) {
  if (status === "paid") {
    return (
      <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 font-medium">
        <CheckCircle2 className="w-3 h-3" />
        Paga
      </Badge>
    );
  }
  if (status === "overdue") {
    return (
      <Badge variant="destructive" className="gap-1 font-medium animate-pulse">
        <AlertCircle className="w-3 h-3" />
        Em Atraso
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 font-medium">
      <Clock className="w-3 h-3" />
      Pendente
    </Badge>
  );
}

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const clientId = parseInt(params.id ?? "0");
  const [confirmPayId, setConfirmPayId] = useState<number | null>(null);
  const [confirmUnpayId, setConfirmUnpayId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.clients.getById.useQuery({ id: clientId });

  const markPaidMutation = trpc.installments.markPaid.useMutation({
    onSuccess: () => {
      toast.success("Parcela marcada como paga!");
      utils.clients.getById.invalidate({ id: clientId });
      utils.clients.list.invalidate();
      utils.installments.carne.invalidate();
      setConfirmPayId(null);
    },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  const markUnpaidMutation = trpc.installments.markUnpaid.useMutation({
    onSuccess: () => {
      toast.success("Pagamento desfeito.");
      utils.clients.getById.invalidate({ id: clientId });
      utils.clients.list.invalidate();
      utils.installments.carne.invalidate();
      setConfirmUnpayId(null);
    },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 rounded-xl" />
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Cliente não encontrado.</p>
        <Button variant="link" onClick={() => navigate("/")}>Voltar</Button>
      </div>
    );
  }

  const installments = data.installments ?? [];
  const paid = installments.filter(i => i.status === "paid").length;
  const overdue = installments.filter(i => i.status === "overdue").length;
  const pending = installments.filter(i => i.status === "pending").length;
  const progress = installments.length > 0 ? (paid / installments.length) * 100 : 0;

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-full">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            {data.name}
          </h1>
          <p className="text-sm text-muted-foreground">Detalhes do carnê de pagamento</p>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="border border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total dos Honorários</p>
            <p className="text-lg font-bold text-primary" style={{ fontFamily: "'Playfair Display', serif" }}>
              {formatCurrency(data.totalFees)}
            </p>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Valor da Parcela</p>
            <p className="text-lg font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
              {formatCurrency(data.installmentValue)}
            </p>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Pagas</p>
            <p className="text-lg font-bold text-emerald-600" style={{ fontFamily: "'Playfair Display', serif" }}>
              {paid} / {installments.length}
            </p>
          </CardContent>
        </Card>
        <Card className={`border ${overdue > 0 ? "border-destructive/40 bg-destructive/5" : "border-border"}`}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Em Atraso</p>
            <p className={`text-lg font-bold ${overdue > 0 ? "text-destructive" : "text-muted-foreground"}`} style={{ fontFamily: "'Playfair Display', serif" }}>
              {overdue}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de progresso */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span>Progresso do pagamento</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Tabela de parcelas */}
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base" style={{ fontFamily: "'Playfair Display', serif" }}>
            Parcelas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Parcela</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vencimento</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pagamento</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ação</th>
                </tr>
              </thead>
              <tbody>
                {installments.map((inst, idx) => (
                  <tr
                    key={inst.id}
                    className={`border-b border-border/60 transition-colors ${
                      inst.status === "overdue" ? "bg-destructive/5 hover:bg-destructive/10" :
                      inst.status === "paid" ? "hover:bg-muted/30" :
                      "hover:bg-muted/20"
                    } ${idx === installments.length - 1 ? "border-b-0" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium">
                      {inst.number}ª parcela
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(inst.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                    </td>
                    <td className="px-4 py-3">
                      {inst.paidAt ? (
                        <span className="text-emerald-600 font-medium">
                          {format(new Date(inst.paidAt), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={inst.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {inst.status !== "paid" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 h-7 text-xs border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
                          onClick={() => setConfirmPayId(inst.id)}
                        >
                          <CheckCheck className="w-3 h-3" />
                          Marcar Paga
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 h-7 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setConfirmUnpayId(inst.id)}
                        >
                          <RotateCcw className="w-3 h-3" />
                          Desfazer
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {data.notes && (
        <div className="mt-4 p-4 bg-muted/40 rounded-lg border border-border/60">
          <p className="text-xs font-medium text-muted-foreground mb-1">Observações</p>
          <p className="text-sm text-foreground">{data.notes}</p>
        </div>
      )}

      {/* Modal confirmar pagamento */}
      <Dialog open={confirmPayId !== null} onOpenChange={() => setConfirmPayId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Playfair Display', serif" }}>Confirmar Pagamento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja marcar esta parcela como <strong>paga</strong>? A data de pagamento será registrada automaticamente como hoje.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPayId(null)}>Cancelar</Button>
            <Button
              disabled={markPaidMutation.isPending}
              onClick={() => confirmPayId !== null && markPaidMutation.mutate({ id: confirmPayId })}
            >
              {markPaidMutation.isPending ? "Registrando..." : "Confirmar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal desfazer pagamento */}
      <Dialog open={confirmUnpayId !== null} onOpenChange={() => setConfirmUnpayId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Playfair Display', serif" }}>Desfazer Pagamento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja desfazer o registro de pagamento desta parcela? Ela voltará ao status anterior.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmUnpayId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={markUnpaidMutation.isPending}
              onClick={() => confirmUnpayId !== null && markUnpaidMutation.mutate({ id: confirmUnpayId })}
            >
              {markUnpaidMutation.isPending ? "Desfazendo..." : "Desfazer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
