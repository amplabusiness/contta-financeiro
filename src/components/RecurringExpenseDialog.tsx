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

interface RecurringExpenseDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (updateAll: boolean) => void;
  mode: "edit" | "delete";
}

export const RecurringExpenseDialog = ({
  open,
  onClose,
  onConfirm,
  mode,
}: RecurringExpenseDialogProps) => {
  const isEdit = mode === "edit";

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isEdit ? "Editar Despesa Recorrente" : "Excluir Despesa Recorrente"}
          </AlertDialogTitle>
        </AlertDialogHeader>
        <div className="space-y-3 px-6">
          <AlertDialogDescription>
            {isEdit
              ? "Esta é uma despesa recorrente. Como você deseja atualizar?"
              : "Esta é uma despesa recorrente. Como você deseja excluir?"}
          </AlertDialogDescription>
          <div className="space-y-2">
            <button
              onClick={() => {
                onConfirm(false);
                onClose();
              }}
              className="w-full text-left p-3 border rounded-md hover:bg-accent transition-colors"
            >
              <div className="font-medium">
                {isEdit ? "Atualizar somente esta" : "Apagar somente esta"}
              </div>
              <div className="text-xs text-muted-foreground">
                {isEdit
                  ? "Apenas esta despesa será atualizada"
                  : "Apenas esta despesa será removida"}
              </div>
            </button>
            <button
              onClick={() => {
                onConfirm(true);
                onClose();
              }}
              className="w-full text-left p-3 border rounded-md hover:bg-accent transition-colors"
            >
              <div className="font-medium">
                {isEdit
                  ? "Atualizar esta e as demais"
                  : "Apagar esta e as demais recorrências futuras"}
              </div>
              <div className="text-xs text-muted-foreground">
                {isEdit
                  ? "Esta despesa e todas as futuras serão atualizadas"
                  : "Esta despesa e todas as futuras serão removidas"}
              </div>
            </button>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
