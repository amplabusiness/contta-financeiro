import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CNPJData {
  razao_social?: string;
  nome_fantasia?: string;
  email?: string;
  telefone?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  porte?: string;
  natureza_juridica?: string;
  capital_social?: number;
  situacao?: string;
  data_abertura?: string;
  atividade_principal?: any;
  atividades_secundarias?: any;
  qsa?: any;
}

interface CNPJInputProps {
  value: string;
  onChange: (value: string) => void;
  onDataFetched?: (data: CNPJData) => void;
  autoFetch?: boolean;
  label?: string;
  required?: boolean;
  className?: string;
}

export const CNPJInput = ({ 
  value, 
  onChange, 
  onDataFetched,
  autoFetch = true,
  label = "CNPJ",
  required = false,
  className = ""
}: CNPJInputProps) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const formatCNPJ = (val: string) => {
    const numbers = val.replace(/\D/g, "");
    if (numbers.length <= 14) {
      return numbers
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return val;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCNPJ(e.target.value);
    onChange(formatted);
    setStatus("idle");

    // Auto-fetch when 14 digits are entered
    const numbers = formatted.replace(/\D/g, "");
    if (autoFetch && numbers.length === 14 && !loading) {
      fetchCNPJData(numbers);
    }
  };

  const fetchCNPJData = async (cnpj: string) => {
    setLoading(true);
    setStatus("idle");

    try {
      const { data, error } = await supabase.functions.invoke("enrich-client-data", {
        body: { cnpj }
      });

      if (error) throw error;

      if (data && data.success) {
        setStatus("success");
        toast.success("Dados do CNPJ carregados com sucesso!", {
          description: `${data.data.razao_social || data.data.nome_fantasia}`
        });

        // Call callback with fetched data
        if (onDataFetched) {
          onDataFetched(data.data);
        }
      } else {
        throw new Error(data?.message || "Erro ao buscar dados do CNPJ");
      }
    } catch (error) {
      console.error("Error fetching CNPJ data:", error);
      setStatus("error");
      toast.error("Erro ao buscar dados do CNPJ", {
        description: error instanceof Error ? error.message : "Verifique o número e tente novamente"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = () => {
    if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    if (status === "success") return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === "error") return <AlertCircle className="h-4 w-4 text-destructive" />;
    return null;
  };

  return (
    <div className={className}>
      <Label htmlFor="cnpj">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className="relative">
        <Input
          id="cnpj"
          type="text"
          value={value}
          onChange={handleChange}
          placeholder="00.000.000/0000-00"
          maxLength={18}
          required={required}
          disabled={loading}
          className="pr-10"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {getStatusIcon()}
        </div>
      </div>
      {autoFetch && (
        <p className="text-xs text-muted-foreground mt-1">
          Dados serão carregados automaticamente ao digitar o CNPJ completo
        </p>
      )}
    </div>
  );
};
