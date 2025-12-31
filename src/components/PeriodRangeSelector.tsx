import { usePeriod } from "@/contexts/PeriodContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarRange } from "lucide-react";
import { useMemo } from "react";

interface PeriodRangeSelectorProps {
  className?: string;
  showLabel?: boolean;
}

// Gerar lista de meses
const generateMonthOptions = () => {
  const months: { value: string; label: string; month: number; year: number }[] = [];
  const monthNames = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ];
  const startDate = new Date(2024, 0, 1); // Janeiro 2024
  const endDate = new Date(); // Hoje

  let current = startDate;
  while (current <= endDate) {
    const month = current.getMonth() + 1;
    const year = current.getFullYear();
    const value = `${month}-${year}`;
    const label = `${monthNames[month - 1]}/${year}`;
    months.push({ value, label, month, year });
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }

  return months.reverse(); // Mais recente primeiro
};

export function PeriodRangeSelector({ className = "", showLabel = true }: PeriodRangeSelectorProps) {
  const {
    rangeStartYear,
    rangeStartMonth,
    rangeEndYear,
    rangeEndMonth,
    setRangeStart,
    setRangeEnd,
    getFormattedRange,
  } = usePeriod();

  const monthOptions = useMemo(() => generateMonthOptions(), []);

  const handleStartChange = (value: string) => {
    const [month, year] = value.split("-").map(Number);
    setRangeStart(year, month);

    // Se a data inicial for maior que a final, ajustar a final
    const startValue = year * 12 + month;
    const endValue = rangeEndYear * 12 + rangeEndMonth;
    if (startValue > endValue) {
      setRangeEnd(year, month);
    }
  };

  const handleEndChange = (value: string) => {
    const [month, year] = value.split("-").map(Number);
    setRangeEnd(year, month);

    // Se a data final for menor que a inicial, ajustar a inicial
    const startValue = rangeStartYear * 12 + rangeStartMonth;
    const endValue = year * 12 + month;
    if (endValue < startValue) {
      setRangeStart(year, month);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <CalendarRange className="w-4 h-4 text-muted-foreground" />

      {showLabel && (
        <span className="text-sm text-muted-foreground">Período:</span>
      )}

      <Select
        value={`${rangeStartMonth}-${rangeStartYear}`}
        onValueChange={handleStartChange}
      >
        <SelectTrigger className="w-[110px]">
          <SelectValue placeholder="Início" />
        </SelectTrigger>
        <SelectContent>
          {monthOptions.map((option) => (
            <SelectItem key={`start-${option.value}`} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-sm text-muted-foreground">até</span>

      <Select
        value={`${rangeEndMonth}-${rangeEndYear}`}
        onValueChange={handleEndChange}
      >
        <SelectTrigger className="w-[110px]">
          <SelectValue placeholder="Fim" />
        </SelectTrigger>
        <SelectContent>
          {monthOptions.map((option) => (
            <SelectItem key={`end-${option.value}`} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
