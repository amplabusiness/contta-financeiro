import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Crown } from "lucide-react";

interface FinancialGroupBadgeProps {
  clientId: string;
}

interface GroupInfo {
  groupId: string;
  groupName: string;
  groupNumber: number;
  mainPayerName: string;
  isMainPayer: boolean;
  groupColor?: string;
}

// Paleta de cores para os 21 grupos financeiros
const GROUP_COLORS = [
  "#3B82F6", // azul
  "#10B981", // verde
  "#F59E0B", // âmbar
  "#EF4444", // vermelho
  "#8B5CF6", // violeta
  "#EC4899", // rosa
  "#14B8A6", // teal
  "#F97316", // laranja
  "#6366F1", // indigo
  "#84CC16", // lima
  "#06B6D4", // cyan
  "#F43F5E", // rose
  "#A855F7", // purple
  "#22C55E", // green-500
  "#FBBF24", // yellow-400
  "#FB923C", // orange-400
  "#4ADE80", // green-400
  "#38BDF8", // sky-400
  "#C084FC", // purple-400
  "#FB7185", // rose-400
  "#2DD4BF", // teal-400
];

export function FinancialGroupBadge({ clientId }: FinancialGroupBadgeProps) {
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGroupInfo();
  }, [clientId]);

  const loadGroupInfo = async () => {
    try {
      // Buscar se o cliente pertence a algum grupo financeiro
      const { data: memberData, error: memberError } = await supabase
        .from('economic_group_members')
        .select(`
          economic_group_id,
          economic_groups!inner (
            id,
            name,
            main_payer_client_id,
            group_color,
            clients!economic_groups_main_payer_client_id_fkey (
              name
            )
          )
        `)
        .eq('client_id', clientId)
        .single();

      if (memberError || !memberData) {
        setGroupInfo(null);
        return;
      }

      const group = memberData.economic_groups as any;
      const groupNumber = parseInt(group.name.replace(/\D/g, '')) || 1;
      
      setGroupInfo({
        groupId: group.id,
        groupName: group.name,
        groupNumber: groupNumber,
        mainPayerName: group.clients?.name || 'Desconhecido',
        isMainPayer: group.main_payer_client_id === clientId,
        groupColor: group.group_color
      });
    } catch (error) {
      console.error('Error loading financial group:', error);
      setGroupInfo(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !groupInfo) {
    return null;
  }

  const color = groupInfo.groupColor || GROUP_COLORS[(groupInfo.groupNumber - 1) % GROUP_COLORS.length];
  const borderWidth = groupInfo.isMainPayer ? '4px' : '3px';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1">
            <div
              className="h-8 rounded"
              style={{
                width: borderWidth,
                backgroundColor: color,
              }}
            />
            {groupInfo.isMainPayer && (
              <Crown className="h-4 w-4" style={{ color }} />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-semibold">{groupInfo.groupName}</p>
            <p className="text-sm">Pagadora: {groupInfo.mainPayerName}</p>
            {groupInfo.isMainPayer && (
              <p className="text-xs text-muted-foreground">Esta é a empresa pagadora</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
