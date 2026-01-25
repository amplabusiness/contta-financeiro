
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CashFlowService, CashFlowProjection, CashFlowEvent } from "@/services/CashFlowService";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, DollarSign, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/data/expensesData";
import { Button } from "@/components/ui/button";

export const CashFlowWidget = () => {
    const [projection, setProjection] = useState<CashFlowProjection | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await CashFlowService.getProjection(30); // 30 days projection
            setProjection(data);
        } catch (error) {
            console.error("[CashFlowWidget] Failed to load cash flow", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div>Carregando Fluxo...</div>;

    if (!projection) return null;

    const projectedBalance = projection.dailyBalances[projection.dailyBalances.length - 1]?.balance || 0;
    const balanceColor = projectedBalance >= 0 ? "text-green-600" : "text-red-600";

    // Group events next 5
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day

    const upcomingEvents = projection.events.filter(e => {
        const eventDate = new Date(e.date);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate >= today;
    }).slice(0, 5);

    return (
        <Card className="col-span-full md:col-span-1 shadow-md hover:shadow-lg transition-all duration-200 border-l-4 border-l-indigo-500">
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div className="flex-1">
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-indigo-500" />
                            Projeção (30 dias)
                        </CardTitle>
                        <CardDescription className="mt-1">
                            Saldo Atual: {formatCurrency(projection.currentBalance)}
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={loadData}
                            disabled={loading}
                            className="h-8 w-8"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                        <Badge variant="outline" className={`${balanceColor} border-current font-mono text-lg`}>
                            {formatCurrency(projectedBalance)}
                        </Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="h-[200px] overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Dia</TableHead>
                                    <TableHead>Descrição</TableHead>
                                    <TableHead className="text-right">Valor</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {upcomingEvents.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground">Sem lançamentos previstos</TableCell>
                                    </TableRow>
                                )}
                                {upcomingEvents.map((evt, idx) => (
                                    <TableRow key={idx} className="text-sm">
                                        <TableCell>{new Date(evt.date).toLocaleDateString('pt-BR')}</TableCell>
                                        <TableCell className="max-w-[150px] truncate" title={evt.description}>
                                            <div className="flex items-center gap-2">
                                                {evt.amount < 0 ? (
                                                    <TrendingDown className="h-3 w-3 text-red-500" />
                                                ) : (
                                                    <TrendingUp className="h-3 w-3 text-green-500" />
                                                )}
                                                {evt.description}
                                            </div>
                                        </TableCell>
                                        <TableCell className={`text-right font-medium ${evt.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {formatCurrency(evt.amount)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
