import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState } from "react";
import { CheckCircle2, AlertCircle, Clock, BadgeCheck, Undo2, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatCurrency(value: string | number) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
}

type ClientAlpha = {
  id: number;
  name: string;
  totalFees: string;
  installmentCount: number;
  installmentValue: string;
  startDate: number;
  notes: string | null;
  settledAt: number | null;
  paidCount: number;
  totalInstallments: number;
};

function StatusSummary({ client }: { client: ClientAlpha }) {
  if (client.settledAt) {
    return (
      <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 font-semibold text-xs">
        <BadgeCheck className="w-3.5 h-3.5" />
        Adimplido em {format(new Date(client.settledAt), "dd/MM/yyyy", { locale: ptBR })}
      </Badge>
    );
  }
  const remaining = client.totalInstallments - client.paidCount;
  if (remaining === 0 && client.totalInstallments > 0) {
    return (
      <Badge className="gap-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-50 border border-emerald-200 font-medium text-xs">
        <CheckCircle2 className="w-3 h-3" />
        Todas pagas
      </Badge>
    );
  }
  return null;
}

export default function ClientsListPage() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.clients.listAlpha.useQuery();

  const [confirmSettleId, setConfirmSettleId] = useState<number | null>(null);
  const [confirmUnsettleId, setConfirmUnsettleId] = useState<number | null>(null);

  const markSettledMutation = trpc.clients.markSettled.useMutation({
    onSuccess: () => {
      toast.success("Contrato marcado como adimplido!");
      utils.clients.listAlpha.invalidate();
      utils.clients.list.invalidate();
      setConfirmSettleId(null);
    },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  const markUnsettledMutation = trpc.clients.markUnsettled.useMutation({
    onSuccess: () => {
      toast.success("Adimplemento desfeito.");
      utils.clients.listAlpha.invalidate();
      utils.clients.list.invalidate();
      setConfirmUnsettleId(null);
    },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  const clients = data ?? [];
  const settled = clients.filter(c => c.settledAt).length;
  const active = clients.length - settled;

  // Agrupar por letra inicial
  const grouped: Record<string, ClientAlpha[]> = {};
  for (const c of clients) {
    const letter = c.name.trim()[0]?.toUpperCase() ?? "#";
    if (!grouped[letter]) grouped[letter] = [];
    grouped[letter].push(c);
  }
  const letters = Object.keys(grouped).sort();

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in-up">
      {/* Cabeçalho */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
          Lista de Clientes
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Clientes em ordem alfabética com situação do contrato</p>
      </div>

      {/* Resumo */}
      {!isLoading && clients.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Total de Clientes</p>
            <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
              {clients.length}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Contratos Ativos</p>
            <p className="text-2xl font-bold text-primary" style={{ fontFamily: "'Playfair Display', serif" }}>
              {active}
            </p>
          </div>
          <div className="bg-card border border-emerald-200 bg-emerald-50/50 rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Adimplidos</p>
            <p className="text-2xl font-bold text-emerald-600" style={{ fontFamily: "'Playfair Display', serif" }}>
              {settled}
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && clients.length === 0 && (
        <div className="text-center py-16">
          <TrendingUp className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum cliente cadastrado</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Adicione clientes na aba "Clientes"</p>
        </div>
      )}

      {/* Lista agrupada por letra */}
      {!isLoading && letters.map((letter) => (
        <div key={letter} className="mb-6">
          {/* Separador de letra */}
          <div className="flex items-center gap-3 mb-2">
            <span
              className="text-xs font-bold text-primary/70 w-6 text-center"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {letter}
            </span>
            <div className="flex-1 h-px bg-border/60" />
          </div>

          {/* Linhas de clientes */}
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border/60">
            {grouped[letter].map((client) => {
              const progress = client.totalInstallments > 0
                ? Math.round((client.paidCount / client.totalInstallments) * 100)
                : 0;
              const isSettled = !!client.settledAt;

              return (
                <div
                  key={client.id}
                  className={`flex items-center gap-4 px-5 py-4 transition-colors ${
                    isSettled ? "bg-emerald-50/40 hover:bg-emerald-50/70" : "hover:bg-muted/30"
                  }`}
                >
                  {/* Indicador de adimplido */}
                  <div className="flex-shrink-0">
                    {isSettled ? (
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                        <BadgeCheck className="w-4 h-4 text-emerald-600" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary" style={{ fontFamily: "'Playfair Display', serif" }}>
                          {client.name.trim()[0]?.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Nome e status */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`font-semibold text-sm truncate ${isSettled ? "text-emerald-800" : "text-foreground"}`}
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        {client.name}
                      </span>
                      <StatusSummary client={client} />
                    </div>
                    {/* Barra de progresso compacta */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[120px]">
                        <div
                          className={`h-full rounded-full transition-all ${isSettled ? "bg-emerald-500" : "bg-primary"}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {client.paidCount}/{client.totalInstallments} parcelas pagas
                      </span>
                    </div>
                  </div>

                  {/* Valor do contrato */}
                  <div className="text-right flex-shrink-0 hidden sm:block">
                    <p className="text-xs text-muted-foreground">Contrato</p>
                    <p className="font-bold text-sm text-primary" style={{ fontFamily: "'Playfair Display', serif" }}>
                      {formatCurrency(client.totalFees)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {client.installmentCount}x de {formatCurrency(client.installmentValue)}
                    </p>
                  </div>

                  {/* Ação de adimplemento */}
                  <div className="flex-shrink-0 ml-2">
                    {!isSettled ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-8 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all"
                        onClick={() => setConfirmSettleId(client.id)}
                      >
                        <BadgeCheck className="w-3.5 h-3.5" />
                        Adimplir
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setConfirmUnsettleId(client.id)}
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        Desfazer
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Modal confirmar adimplemento */}
      <Dialog open={confirmSettleId !== null} onOpenChange={() => setConfirmSettleId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Playfair Display', serif" }}>
              Confirmar Adimplemento
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja marcar este contrato como <strong>adimplido</strong>? A data de adimplemento será registrada automaticamente como hoje.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSettleId(null)}>Cancelar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={markSettledMutation.isPending}
              onClick={() => confirmSettleId !== null && markSettledMutation.mutate({ id: confirmSettleId })}
            >
              {markSettledMutation.isPending ? "Registrando..." : "Confirmar Adimplemento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal desfazer adimplemento */}
      <Dialog open={confirmUnsettleId !== null} onOpenChange={() => setConfirmUnsettleId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Playfair Display', serif" }}>
              Desfazer Adimplemento
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja desfazer o registro de adimplemento deste contrato? Ele voltará ao status ativo.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmUnsettleId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={markUnsettledMutation.isPending}
              onClick={() => confirmUnsettleId !== null && markUnsettledMutation.mutate({ id: confirmUnsettleId })}
            >
              {markUnsettledMutation.isPending ? "Desfazendo..." : "Desfazer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
