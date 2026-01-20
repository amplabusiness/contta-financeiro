/**
 * TenantLogo - Componente para exibir o logo do tenant atual
 *
 * Carrega o logo do tenant do Supabase Storage ou exibe um placeholder.
 * O logo é armazenado em: tenant-assets/{tenant_id}/logo.png
 *
 * EXEMPLO DE USO:
 *
 * ```tsx
 * <TenantLogo size="sm" />
 * <TenantLogo size="md" className="rounded-full" />
 * <TenantLogo size="lg" fallbackText="MC" />
 * ```
 */

import { useState, useEffect } from "react";
import { useTenantConfig } from "@/hooks/useTenantConfig";
import { supabase } from "@/integrations/supabase/client";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TenantLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  fallbackText?: string;
  showFallbackIcon?: boolean;
}

const sizeClasses = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-sm",
  md: "w-10 h-10 text-base",
  lg: "w-16 h-16 text-lg",
  xl: "w-24 h-24 text-xl",
};

const iconSizes = {
  xs: "w-3 h-3",
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-8 h-8",
  xl: "w-12 h-12",
};

export function TenantLogo({
  size = "md",
  className,
  fallbackText,
  showFallbackIcon = true,
}: TenantLogoProps) {
  const { tenant, officeData, loading } = useTenantConfig();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    async function loadLogo() {
      if (!tenant?.id) return;

      // Primeiro, verificar se há logo_url salvo no officeData
      if (officeData?.logo_url) {
        setLogoUrl(officeData.logo_url);
        return;
      }

      // Tentar carregar do storage
      try {
        const { data } = await supabase.storage
          .from("tenant-assets")
          .createSignedUrl(`${tenant.id}/logo.png`, 3600); // 1 hora

        if (data?.signedUrl) {
          setLogoUrl(data.signedUrl);
        }
      } catch (err) {
        // Logo não existe no storage, usar fallback
        console.debug("[TenantLogo] Logo não encontrado no storage");
      }
    }

    loadLogo();
  }, [tenant?.id, officeData?.logo_url]);

  // Gerar iniciais para fallback
  const getInitials = () => {
    if (fallbackText) return fallbackText;

    const name = officeData?.nome_fantasia || officeData?.razao_social || tenant?.name || "";
    if (!name) return "";

    const words = name.split(" ").filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Loading state
  if (loading) {
    return (
      <div
        className={cn(
          "animate-pulse bg-muted rounded-md flex items-center justify-center",
          sizeClasses[size],
          className
        )}
      />
    );
  }

  // Se tem logo e não deu erro
  if (logoUrl && !imageError) {
    return (
      <img
        src={logoUrl}
        alt={officeData?.nome_fantasia || tenant?.name || "Logo"}
        className={cn(
          "object-contain rounded-md",
          sizeClasses[size],
          className
        )}
        onError={() => setImageError(true)}
      />
    );
  }

  // Fallback: iniciais ou ícone
  const initials = getInitials();

  return (
    <div
      className={cn(
        "bg-primary/10 text-primary rounded-md flex items-center justify-center font-semibold",
        sizeClasses[size],
        className
      )}
    >
      {initials ? (
        <span>{initials}</span>
      ) : showFallbackIcon ? (
        <Building2 className={iconSizes[size]} />
      ) : null}
    </div>
  );
}

export default TenantLogo;
