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
import { Plus, Users, AlertCircle, CheckCircle2, Clock, Trash2, ChevronRight, Pencil, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatCurrency(value: string | number) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
}

function toDateInputValue(ts: number) {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

type ClientData = {
  id: number;
  name: string;
  totalFees: string;
  installmentCount: number;
  installmentValue: string;
  startDate: number;
  notes?: string | null;
};

type FormState = {
  name: string;
  totalFees: string;
  installmentCount: string;
  installmentValue: string;
  startDate: string;
  notes: string;
};

const emptyForm: FormState = {
  name: "", totalFees: "", installmentCount: "", installmentValue: "", startDate: "", notes: "",
};

export default function ClientsPage() {
  const [, navigate] = useLocation();

  // Modais
  const [createOpen, setCreateOpen] = useState(false);
  const [editClient, setEditClient] = useState<ClientData | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);

  // Formulário compartilhado (criação e edição)
  const [form, setForm] = useState<FormState>(emptyForm);

  const utils = trpc.useUtils();
  const { data: clients, isLoading } = trpc.clients.list.useQuery();

  const createMutation = trpc.clients.create.useMutation({
    onSuccess: () => {
      toast.success("Cliente cadastrado com sucesso!");
      utils.clients.list.invalidate();
      setCreateOpen(false);
      setForm(emptyForm);
    },
    onError: (err) => toast.error("Erro ao cadastrar: " + err.message),
  });

  const updateMutation = trpc.clients.update.useMutation({
    onSuccess: () => {
      toast.success("Carnê atualizado com sucesso!");
      utils.clients.list.invalidate();
      utils.clients.getById.invalidate();
      utils.installments.carne.invalidate();
      setEditClient(null);
      setConfirmRegen(false);
    },
    onError: (err) => toast.error("Erro ao atualizar: " + err.message),
  });

  const deleteMutation = trpc.clients.delete.useMutation({
    onSuccess: () => {
      toast.success("Cliente removido.");
      utils.clients.list.invalidate();
      setDeleteId(null);
    },
    onError: (err) => toast.error("Erro ao remover: " + err.message),
  });

  function handleCreate(e: React.FormEvent) {
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

  function openEdit(client: ClientData) {
    setForm({
      name: client.name,
      totalFees: parseFloat(client.totalFees).toFixed(2),
      installmentCount: String(client.installmentCount),
      installmentValue: parseFloat(client.installmentValue).toFixed(2),
      startDate: toDateInputValue(client.startDate),
      notes: client.notes ?? "",
    });
    setEditClient(client);
    setConfirmRegen(false);
  }

  function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editClient) return;
    if (!form.name || !form.totalFees || !form.installmentCount || !form.installmentValue || !form.startDate) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    const newCount = parseInt(form.installmentCount);
    const newValue = parseFloat(form.installmentValue);
    const newStartDate = new Date(form.startDate + "T12:00:00").getTime();

    // Detectar se houve mudança em campos que afetam as parcelas
    const parcelasAlteradas =
      newCount !== editClient.installmentCount ||
      newValue !== parseFloat(editClient.installmentValue) ||
      newStartDate !== editClient.startDate;

    if (parcelasAlteradas && !confirmRegen) {
      setConfirmRegen(true);
      return;
    }

    updateMutation.mutate({
      id: editClient.id,
      name: form.name.trim(),
      totalFees: parseFloat(form.totalFees),
      installmentCount: newCount,
      installmentValue: newValue,
      startDate: newStartDate,
      notes: form.notes || null,
      regenerateInstallments: parcelasAlteradas,
    });
  }

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
        <Button onClick={() => { setForm(emptyForm); setCreateOpen(true); }} className="gap-2 shadow-sm">
          <Plus className="w-4 h-4" />
          Novo Cliente
        </Button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
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
              onEdit={() => openEdit(client)}
              onDelete={() => setDeleteId(client.id)}
            />
          ))}
        </div>
      )}

      {/* ── Modal Novo Cliente ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Playfair Display', serif" }}>Novo Cliente</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <ClientFormFields form={form} setForm={setForm} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setCreateOpen(false); setForm(emptyForm); }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Cadastrando..." : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal Editar Cliente ── */}
      <Dialog open={!!editClient} onOpenChange={(v) => { if (!v) { setEditClient(null); setConfirmRegen(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Playfair Display', serif" }}>
              Editar Carnê
            </DialogTitle>
          </DialogHeader>

          {confirmRegen ? (
            /* Tela de confirmação de regeneração */
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <div className="flex items-start gap-2">
                  <RefreshCw className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold mb-1">Atenção: as parcelas serão recriadas</p>
                    <p>Você alterou o número de parcelas, o valor ou a data de início. Isso irá <strong>apagar todas as parcelas existentes</strong> (incluindo registros de pagamento) e gerar um novo carnê com os novos dados.</p>
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setConfirmRegen(false)}>
                  Voltar e Revisar
                </Button>
                <Button
                  variant="destructive"
                  disabled={updateMutation.isPending}
                  onClick={() => {
                    if (!editClient) return;
                    const newCount = parseInt(form.installmentCount);
                    const newValue = parseFloat(form.installmentValue);
                    const newStartDate = new Date(form.startDate + "T12:00:00").getTime();
                    updateMutation.mutate({
                      id: editClient.id,
                      name: form.name.trim(),
                      totalFees: parseFloat(form.totalFees),
                      installmentCount: newCount,
                      installmentValue: newValue,
                      startDate: newStartDate,
                      notes: form.notes || null,
                      regenerateInstallments: true,
                    });
                  }}
                >
                  {updateMutation.isPending ? "Salvando..." : "Confirmar e Recriar Parcelas"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleEdit} className="space-y-4">
              <ClientFormFields form={form} setForm={setForm} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setEditClient(null); setConfirmRegen(false); }}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Modal Confirmar Exclusão ── */}
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

/* ── Campos do formulário (reutilizados em criar e editar) ── */
function ClientFormFields({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  return (
    <>
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
    </>
  );
}

/* ── Card de cliente ── */
function ClientCard({
  client,
  onOpen,
  onEdit,
  onDelete,
}: {
  client: ClientData;
  onOpen: () => void;
  onEdit: () => void;
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
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              title="Editar carnê"
              onClick={onEdit}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              title="Remover cliente"
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
