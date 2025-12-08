import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface RecurringExpenseFormProps {
  formData: {
    is_recurring: boolean;
    recurrence_frequency: string;
    recurrence_start_date: string;
    recurrence_end_date: string;
    recurrence_count: number | undefined;
    recurrence_specific_days: number[];
    recurrence_day: number;
  };
  onFormChange: (updates: any) => void;
  isPaused?: boolean;
}

export const RecurringExpenseForm = ({ formData, onFormChange }: RecurringExpenseFormProps) => {
  if (!formData.is_recurring) return null;

  return (
    <div className="space-y-4 ml-6 border-l-2 border-blue-300 pl-4">
      {/* Frequência */}
      <div className="space-y-2">
        <Label htmlFor="recurrence_frequency">Frequência da Recorrência *</Label>
        <Select
          value={formData.recurrence_frequency}
          onValueChange={(value) => onFormChange({ recurrence_frequency: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Semanal (a cada 7 dias)</SelectItem>
            <SelectItem value="biweekly">Quinzenal (a cada 15 dias)</SelectItem>
            <SelectItem value="monthly">Mensal</SelectItem>
            <SelectItem value="annual">Anual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Data de Início */}
      <div className="space-y-2">
        <Label htmlFor="recurrence_start_date">Data de Início da Recorrência *</Label>
        <Input
          id="recurrence_start_date"
          type="date"
          value={formData.recurrence_start_date}
          onChange={(e) => onFormChange({ recurrence_start_date: e.target.value })}
          required
        />
      </div>

      {/* Dia do Mês para Recorrência Mensal */}
      {formData.recurrence_frequency === "monthly" && (
        <div className="space-y-2">
          <Label htmlFor="recurrence_monthly_day">Dia do mês (1-31)</Label>
          <Input
            id="recurrence_monthly_day"
            type="number"
            min="1"
            max="31"
            value={formData.recurrence_specific_days && formData.recurrence_specific_days.length > 0
              ? formData.recurrence_specific_days[0]
              : ""
            }
            onChange={(e) => {
              const day = parseInt(e.target.value);
              if (day >= 1 && day <= 31) {
                onFormChange({
                  recurrence_specific_days: [day],
                });
              }
            }}
            placeholder="Ex: 15"
          />
          <p className="text-xs text-muted-foreground">
            A despesa será gerada no dia {formData.recurrence_specific_days && formData.recurrence_specific_days.length > 0 ? formData.recurrence_specific_days[0] : "???"} de cada mês
          </p>
        </div>
      )}

      {/* Opções de Término */}
      <div className="space-y-3 pt-2 border-t">
        <p className="text-sm font-medium">Quando terminar esta recorrência?</p>

        <label className="flex items-center space-x-2 cursor-pointer text-sm">
          <input
            type="radio"
            name="recurrence_end_type"
            checked={!formData.recurrence_count && !formData.recurrence_end_date}
            onChange={() => {
              onFormChange({
                recurrence_count: undefined,
                recurrence_end_date: "",
              });
            }}
          />
          <span>Indefinidamente</span>
        </label>

        <div className="space-y-2">
          <label className="flex items-center space-x-2 cursor-pointer text-sm">
            <input
              type="radio"
              name="recurrence_end_type"
              checked={!!formData.recurrence_count}
              onChange={() => {
                onFormChange({
                  recurrence_count: 1,
                  recurrence_end_date: "",
                });
              }}
            />
            <span>Após um número de ocorrências:</span>
          </label>
          {formData.recurrence_count !== undefined && (
            <Input
              type="number"
              min="1"
              value={formData.recurrence_count}
              onChange={(e) => onFormChange({ recurrence_count: parseInt(e.target.value) || 1 })}
              placeholder="Número de ocorrências"
              className="ml-6 max-w-32"
            />
          )}
        </div>

        <div className="space-y-2">
          <label className="flex items-center space-x-2 cursor-pointer text-sm">
            <input
              type="radio"
              name="recurrence_end_type"
              checked={!!formData.recurrence_end_date}
              onChange={() => {
                onFormChange({
                  recurrence_count: undefined,
                  recurrence_end_date: formData.recurrence_end_date || new Date().toISOString().split("T")[0],
                });
              }}
            />
            <span>Na data:</span>
          </label>
          {formData.recurrence_end_date && (
            <Input
              type="date"
              value={formData.recurrence_end_date}
              onChange={(e) => onFormChange({ recurrence_end_date: e.target.value })}
              className="ml-6 max-w-32"
            />
          )}
        </div>
      </div>

      <div className="pt-2 border-t text-xs text-blue-600 bg-blue-50 p-2 rounded">
        <strong>💡 Dica:</strong> As despesas recorrentes serão geradas automaticamente nas datas especificadas
      </div>
    </div>
  );
};
