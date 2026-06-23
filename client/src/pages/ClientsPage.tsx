import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Users, AlertCircle, CheckCircle2, Clock, Trash2, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatCurrency(value: string | number) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
}

function ClientStatusSummary({ installments }: { installments: Array<{ status: string }> }) {
  const paid = installments.filter(i => i.status === "paid").length;
  const overdue = installments.filter(i => i.status === "overdue").length;
  const pending = installments.filter(i => i.status === "pending").length;
  return (
    <div className="flex gap-2 flex-wrap mt-2">
      {overdue > 0 && (
        <Badge variant="destructive" className="gap-1 text-xs font-medium">
          <AlertCircle className="w-3 h-3" />
          {overdue} em atraso
        </Badge>
      )}
      {paid > 0 && (
        <Badge className="gap-1 text-xs font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
          <CheckCircle2 className="w-3 h-3" />
          {paid} paga{paid > 1 ? "s" : ""}
        </Badge>
      )}
      {pending > 0 && (
        <Badge variant="secondary" className="gap-1 text-xs font-medium">
          <Clock className="w-3 h-3" />
          {pending} pendente{pending > 1 ? "s" : ""}
        </Badge>
      )}
    </div>
  );
}

export default function ClientsPage() {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    totalFees: "",
    installmentCount: "",
    installmentValue: "",
    startDate: "",
    notes: "",
  });

  const utils = trpc.useUtils();
  const { data: clients, isLoading } = trpc.clients.list.useQuery();

  const createMutation = trpc.clients.create.useMutation({
    onSuccess: () => {
      toast.success("Cliente cadastrado com sucesso!");
      utils.clients.list.invalidate();
      setOpen(false);
      resetForm();
    },
    onError: (err) => toast.error("Erro ao cadastrar: " + err.message),
  });

  const deleteMutation = trpc.clients.delete.useMutation({
    onSuccess: () => {
      toast.success("Cliente removido.");
      utils.clients.list.invalidate();
      setDeleteId(null);
    },
    onError: (err) => toast.error("Erro ao remover: " + err.message),
  });

  function resetForm() {
    setForm({ name: "", totalFees: "", installmentCount: "", installmentValue: "", startDate: "", notes: "" });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.totalFees || !form.installmentCount || !form.installmentValue || !form.startDate) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    const startDateMs = new Date(form.startDate + "T12:00:00").getTime();
    createMutation.mutate({
      name: form.name.trim(),
      totalFees: parseFloat(form.totalFees),
      installmentCount: parseInt(form.installmentCount),
      installmentValue: parseFloat(form.installmentValue),
      startDate: startDateMs,
      notes: form.notes || undefined,
    });
  }

  // Buscar parcelas para cada cliente para exibir resumo
  // Usamos uma query separada para cada cliente via ClientCard
  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Clientes
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Gerencie os honorários e carnês de pagamento</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2 shadow-sm">
          <Plus className="w-4 h-4" />
          Novo Cliente
        </Button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : !clients || clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Nenhum cliente cadastrado</h3>
          <p className="text-muted-foreground text-sm max-w-xs">
            Clique em "Novo Cliente" para começar a gerenciar os carnês de pagamento.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onOpen={() => navigate(`/clientes/${client.id}`)}
              onDelete={() => setDeleteId(client.id)}
            />
          ))}
        </div>
      )}

      {/* Modal Novo Cliente */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Playfair Display', serif" }}>
              Novo Cliente
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome do Cliente *</Label>
              <Input
                id="name"
                placeholder="Ex: João da Silva"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="totalFees">Valor Total (R$) *</Label>
                <Input
                  id="totalFees"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={form.totalFees}
                  onChange={e => setForm(f => ({ ...f, totalFees: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="installmentCount">Nº de Parcelas *</Label>
                <Input
                  id="installmentCount"
                  type="number"
                  min="1"
                  max="120"
                  placeholder="Ex: 12"
                  value={form.installmentCount}
                  onChange={e => setForm(f => ({ ...f, installmentCount: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="installmentValue">Valor da Parcela (R$) *</Label>
                <Input
                  id="installmentValue"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={form.installmentValue}
                  onChange={e => setForm(f => ({ ...f, installmentValue: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="startDate">1ª Data de Vencimento *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Informações adicionais..."
                rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Cadastrando..." : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Exclusão */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover Cliente</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja remover este cliente? Todas as parcelas serão excluídas permanentemente.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })}
            >
              {deleteMutation.isPending ? "Removendo..." : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClientCard({
  client,
  onOpen,
  onDelete,
}: {
  client: { id: number; name: string; totalFees: string; installmentCount: number; installmentValue: string; startDate: number };
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { data } = trpc.clients.getById.useQuery({ id: client.id });
  const installments = data?.installments ?? [];
  const overdueCount = installments.filter(i => i.status === "overdue").length;

  return (
    <Card
      className="group relative cursor-pointer hover:shadow-md transition-all duration-200 border border-border hover:border-primary/30 overflow-hidden"
      onClick={onOpen}
    >
      {overdueCount > 0 && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-destructive" />
      )}
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold leading-tight line-clamp-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            {client.name}
          </CardTitle>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <p className="text-2xl font-bold text-primary" style={{ fontFamily: "'Playfair Display', serif" }}>
            {formatCurrency(client.totalFees)}
          </p>
          <p className="text-xs text-muted-foreground">
            {client.installmentCount}x de {formatCurrency(client.installmentValue)}
          </p>
        </div>
        <ClientStatusSummary installments={installments} />
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60">
          <span className="text-xs text-muted-foreground">
            Início: {format(new Date(client.startDate), "dd/MM/yyyy", { locale: ptBR })}
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </CardContent>
    </Card>
  );
}
