import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Package,
  ShoppingCart,
  AlertTriangle,
  Plus,
  Minus,
  ClipboardList,
  Truck,
  BarChart3,
  Loader2,
  Search,
  CheckCircle2,
  XCircle,
  TrendingDown,
  FileText,
  DollarSign,
  Pencil,
  Trash2,
  MoreHorizontal,
  Power,
  PowerOff,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  minimum_stock: number;
  maximum_stock: number;
  last_purchase_price: number | null;
  preferred_supplier: string | null;
  is_active: boolean;
}

interface PurchaseList {
  id: string;
  created_by: string;
  status: string;
  total_estimated: number | null;
  total_actual: number | null;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
}

interface Supplier {
  id: string;
  name: string;
  category: string;
  phone: string | null;
  notes: string | null;
}

const Inventory = () => {
  // Estados de carregamento
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Estados de dados principais
  const [products, setProducts] = useState<Product[]>([]);
  const [purchaseLists, setPurchaseLists] = useState<PurchaseList[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [consumptionQty, setConsumptionQty] = useState(1);
  const [showInactive, setShowInactive] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [productForm, setProductForm] = useState({
    name: "",
    category: "limpeza",
    unit: "un",
    current_stock: 0,
    minimum_stock: 5,
    maximum_stock: 20,
    last_purchase_price: 0,
    preferred_supplier: "",
  });
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    category: "limpeza",
    phone: "",
    notes: "",
  });

  // Estados de diálogos
  const [consumptionDialog, setConsumptionDialog] = useState(false);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showDeleteProductDialog, setShowDeleteProductDialog] = useState(false);
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const [showDeleteSupplierDialog, setShowDeleteSupplierDialog] = useState(false);

  const categories = [
    { value: "all", label: "Todas" },
    { value: "limpeza", label: "Limpeza" },
    { value: "higiene", label: "Higiene" },
    { value: "alimentacao", label: "Alimentacao" },
    { value: "escritorio", label: "Escritorio" },
  ];

  // =====================================================
  // FUNÇÕES DE CARREGAMENTO DE DADOS
  // =====================================================

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load products
      let productsQuery = supabase
        .from("office_products")
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (!showInactive) {
        productsQuery = productsQuery.eq("is_active", true);
      }

      const { data: productsData, error: productsError } = await productsQuery;

      if (productsError) throw productsError;
      setProducts(productsData || []);

      // Load purchase lists
      const { data: listsData, error: listsError } = await supabase
        .from("purchase_lists")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (listsError) throw listsError;
      setPurchaseLists(listsData || []);

      // Load suppliers
      const { data: suppliersData, error: suppliersError } = await supabase
        .from("suppliers")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (suppliersError) throw suppliersError;
      setSuppliers(suppliersData || []);

    } catch (error: any) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados", { description: error.message });
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  // =====================================================
  // EFFECTS - Inicialização e sincronização
  // =====================================================

  useEffect(() => {
    loadData();
  }, [loadData]);

  // =====================================================
  // HANDLERS DE AÇÕES
  // =====================================================

  const handleConsumption = async () => {
    if (!selectedProduct || consumptionQty <= 0) return;

    setSubmitting(true);
    try {
      // Register consumption
      const { error: consumptionError } = await supabase
        .from("product_consumption")
        .insert({
          product_id: selectedProduct.id,
          quantity: consumptionQty,
          consumed_by: "Lilian",
          notes: "Consumo registrado via sistema",
        });

      if (consumptionError) throw consumptionError;

      // Update stock
      const { error: updateError } = await supabase
        .from("office_products")
        .update({
          current_stock: selectedProduct.current_stock - consumptionQty,
        })
        .eq("id", selectedProduct.id);

      if (updateError) throw updateError;

      toast.success("Consumo registrado!", {
        description: `${consumptionQty} ${selectedProduct.unit} de ${selectedProduct.name}`,
      });

      setConsumptionDialog(false);
      setSelectedProduct(null);
      setConsumptionQty(1);
      loadData();

    } catch (error: any) {
      console.error("Error registering consumption:", error);
      toast.error("Erro ao registrar consumo", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const generateShoppingList = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("generate_shopping_list", {
        p_created_by: "Lilian",
      });

      if (error) throw error;

      toast.success("Lista de compras gerada!", {
        description: "Produtos com estoque baixo foram adicionados.",
      });

      loadData();

    } catch (error: any) {
      console.error("Error generating list:", error);
      toast.error("Erro ao gerar lista", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  // ========== CRUD PRODUCTS ==========
  const resetProductForm = () => {
    setProductForm({
      name: "",
      category: "limpeza",
      unit: "un",
      current_stock: 0,
      minimum_stock: 5,
      maximum_stock: 20,
      last_purchase_price: 0,
      preferred_supplier: "",
    });
    setEditingProduct(null);
  };

  const openCreateProduct = () => {
    resetProductForm();
    setShowProductDialog(true);
  };

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      category: product.category,
      unit: product.unit,
      current_stock: product.current_stock,
      minimum_stock: product.minimum_stock,
      maximum_stock: product.maximum_stock,
      last_purchase_price: product.last_purchase_price || 0,
      preferred_supplier: product.preferred_supplier || "",
    });
    setShowProductDialog(true);
  };

  const handleSaveProduct = async () => {
    if (!productForm.name.trim()) {
      toast.error("Nome do produto é obrigatório");
      return;
    }

    setSubmitting(true);
    try {
      if (editingProduct) {
        const { error } = await supabase
          .from("office_products")
          .update({
            name: productForm.name,
            category: productForm.category,
            unit: productForm.unit,
            current_stock: productForm.current_stock,
            minimum_stock: productForm.minimum_stock,
            maximum_stock: productForm.maximum_stock,
            last_purchase_price: productForm.last_purchase_price || null,
            preferred_supplier: productForm.preferred_supplier || null,
          })
          .eq("id", editingProduct.id);

        if (error) throw error;
        toast.success("Produto atualizado!");
      } else {
        const { error } = await supabase
          .from("office_products")
          .insert({
            name: productForm.name,
            category: productForm.category,
            unit: productForm.unit,
            current_stock: productForm.current_stock,
            minimum_stock: productForm.minimum_stock,
            maximum_stock: productForm.maximum_stock,
            last_purchase_price: productForm.last_purchase_price || null,
            preferred_supplier: productForm.preferred_supplier || null,
            is_active: true,
          });

        if (error) throw error;
        toast.success("Produto criado!");
      }

      setShowProductDialog(false);
      resetProductForm();
      loadData();
    } catch (error: any) {
      console.error("Error saving product:", error);
      toast.error("Erro ao salvar produto", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = (product: Product) => {
    setProductToDelete(product);
    setShowDeleteProductDialog(true);
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("office_products")
        .update({ is_active: false })
        .eq("id", productToDelete.id);

      if (error) throw error;

      toast.success("Produto desativado!");
      setShowDeleteProductDialog(false);
      setProductToDelete(null);
      loadData();
    } catch (error: any) {
      console.error("Error deleting product:", error);
      toast.error("Erro ao desativar produto", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleProductStatus = async (product: Product) => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("office_products")
        .update({ is_active: !product.is_active })
        .eq("id", product.id);

      if (error) throw error;

      toast.success(product.is_active ? "Produto desativado!" : "Produto reativado!");
      loadData();
    } catch (error: any) {
      console.error("Error toggling product:", error);
      toast.error("Erro ao alterar status", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  // ========== CRUD SUPPLIERS ==========
  const resetSupplierForm = () => {
    setSupplierForm({
      name: "",
      category: "limpeza",
      phone: "",
      notes: "",
    });
    setEditingSupplier(null);
  };

  const openCreateSupplier = () => {
    resetSupplierForm();
    setShowSupplierDialog(true);
  };

  const openEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setSupplierForm({
      name: supplier.name,
      category: supplier.category,
      phone: supplier.phone || "",
      notes: supplier.notes || "",
    });
    setShowSupplierDialog(true);
  };

  const handleSaveSupplier = async () => {
    if (!supplierForm.name.trim()) {
      toast.error("Nome do fornecedor é obrigatório");
      return;
    }

    setSubmitting(true);
    try {
      if (editingSupplier) {
        const { error } = await supabase
          .from("suppliers")
          .update({
            name: supplierForm.name,
            category: supplierForm.category,
            phone: supplierForm.phone || null,
            notes: supplierForm.notes || null,
          })
          .eq("id", editingSupplier.id);

        if (error) throw error;
        toast.success("Fornecedor atualizado!");
      } else {
        const { error } = await supabase
          .from("suppliers")
          .insert({
            name: supplierForm.name,
            category: supplierForm.category,
            phone: supplierForm.phone || null,
            notes: supplierForm.notes || null,
            is_active: true,
          });

        if (error) throw error;
        toast.success("Fornecedor criado!");
      }

      setShowSupplierDialog(false);
      resetSupplierForm();
      loadData();
    } catch (error: any) {
      console.error("Error saving supplier:", error);
      toast.error("Erro ao salvar fornecedor", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSupplier = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setShowDeleteSupplierDialog(true);
  };

  const confirmDeleteSupplier = async () => {
    if (!supplierToDelete) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("suppliers")
        .update({ is_active: false })
        .eq("id", supplierToDelete.id);

      if (error) throw error;

      toast.success("Fornecedor desativado!");
      setShowDeleteSupplierDialog(false);
      setSupplierToDelete(null);
      loadData();
    } catch (error: any) {
      console.error("Error deleting supplier:", error);
      toast.error("Erro ao desativar fornecedor", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  // =====================================================
  // FUNÇÕES AUXILIARES
  // =====================================================

  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const lowStockProducts = products.filter(p => p.current_stock <= p.minimum_stock);
  const criticalProducts = products.filter(p => p.current_stock === 0);

  const getStockStatus = (product: Product) => {
    if (product.current_stock === 0) {
      return { label: "Esgotado", color: "bg-red-500", textColor: "text-red-700" };
    }
    if (product.current_stock <= product.minimum_stock) {
      return { label: "Baixo", color: "bg-yellow-500", textColor: "text-yellow-700" };
    }
    if (product.current_stock >= product.maximum_stock) {
      return { label: "Alto", color: "bg-blue-500", textColor: "text-blue-700" };
    }
    return { label: "Normal", color: "bg-green-500", textColor: "text-green-700" };
  };

  const getStockPercentage = (product: Product) => {
    if (product.maximum_stock === 0) return 0;
    return Math.min((product.current_stock / product.maximum_stock) * 100, 100);
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getCategoryLabel = (category: string) => {
    const cat = categories.find(c => c.value === category);
    return cat ? cat.label : category;
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
              Estoque e Compras
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Controle de produtos e lista de compras do escritorio
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={generateShoppingList} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ClipboardList className="h-4 w-4 mr-2" />
              )}
              Gerar Lista de Compras
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{products.length}</div>
                  <div className="text-xs text-muted-foreground">Produtos</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={lowStockProducts.length > 0 ? "border-yellow-300 bg-yellow-50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <TrendingDown className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{lowStockProducts.length}</div>
                  <div className="text-xs text-muted-foreground">Estoque Baixo</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={criticalProducts.length > 0 ? "border-red-300 bg-red-50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{criticalProducts.length}</div>
                  <div className="text-xs text-muted-foreground">Esgotados</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Truck className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{suppliers.length}</div>
                  <div className="text-xs text-muted-foreground">Fornecedores</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Low Stock Alert */}
        {lowStockProducts.length > 0 && (
          <Card className="border-yellow-300 bg-yellow-50">
            <CardHeader className="py-3">
              <CardTitle className="text-lg flex items-center gap-2 text-yellow-800">
                <AlertTriangle className="h-5 w-5" />
                Produtos com Estoque Baixo
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {lowStockProducts.map(product => (
                  <Badge
                    key={product.id}
                    variant={product.current_stock === 0 ? "destructive" : "secondary"}
                    className="gap-1"
                  >
                    {product.name}: {product.current_stock} {product.unit}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="products" className="space-y-4">
          <TabsList>
            <TabsTrigger value="products">Produtos</TabsTrigger>
            <TabsTrigger value="lists">Listas de Compras</TabsTrigger>
            <TabsTrigger value="suppliers">Fornecedores</TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Produtos do Escritorio</CardTitle>
                    <CardDescription>
                      Clique em um produto para registrar consumo
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar produto..."
                        className="pl-9 w-[200px]"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant={showInactive ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setShowInactive(!showInactive)}
                    >
                      {showInactive ? "Ver Ativos" : "Ver Inativos"}
                    </Button>
                    <Button onClick={openCreateProduct}>
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Produto
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Estoque</TableHead>
                        <TableHead className="w-[200px]">Nivel</TableHead>
                        <TableHead>Ultimo Preco</TableHead>
                        <TableHead>Acoes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((product) => {
                        const status = getStockStatus(product);
                        const percentage = getStockPercentage(product);

                        return (
                          <TableRow
                            key={product.id}
                            className={cn(
                              "cursor-pointer hover:bg-muted/50",
                              product.current_stock === 0 && "bg-red-50",
                              product.current_stock <= product.minimum_stock && product.current_stock > 0 && "bg-yellow-50"
                            )}
                          >
                            <TableCell>
                              <div className="font-medium">{product.name}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{getCategoryLabel(product.category)}</Badge>
                            </TableCell>
                            <TableCell>
                              <span className={cn("font-medium", status.textColor)}>
                                {product.current_stock} {product.unit}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <Progress
                                  value={percentage}
                                  className={cn(
                                    "h-2",
                                    percentage <= 25 ? "[&>div]:bg-red-500" :
                                    percentage <= 50 ? "[&>div]:bg-yellow-500" :
                                    "[&>div]:bg-green-500"
                                  )}
                                />
                                <div className="text-xs text-muted-foreground">
                                  Min: {product.minimum_stock} | Max: {product.maximum_stock}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{formatCurrency(product.last_purchase_price)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedProduct(product);
                                    setConsumptionDialog(true);
                                  }}
                                  disabled={!product.is_active}
                                >
                                  <Minus className="h-4 w-4 mr-1" />
                                  Baixar
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openEditProduct(product)}>
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => toggleProductStatus(product)}>
                                      {product.is_active ? (
                                        <>
                                          <PowerOff className="h-4 w-4 mr-2" />
                                          Desativar
                                        </>
                                      ) : (
                                        <>
                                          <Power className="h-4 w-4 mr-2" />
                                          Reativar
                                        </>
                                      )}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-red-600"
                                      onClick={() => handleDeleteProduct(product)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Excluir
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Purchase Lists Tab */}
          <TabsContent value="lists" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Listas de Compras</CardTitle>
                <CardDescription>
                  Historico de listas geradas para cotacao
                </CardDescription>
              </CardHeader>
              <CardContent>
                {purchaseLists.length === 0 ? (
                  <div className="text-center py-12">
                    <ClipboardList className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhuma lista</h3>
                    <p className="text-muted-foreground mb-4">
                      Gere uma lista de compras baseada no estoque baixo
                    </p>
                    <Button onClick={generateShoppingList}>
                      <ClipboardList className="h-4 w-4 mr-2" />
                      Gerar Lista
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Criado por</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Estimado</TableHead>
                        <TableHead>Real</TableHead>
                        <TableHead>Aprovado por</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseLists.map((list) => (
                        <TableRow key={list.id}>
                          <TableCell>
                            {new Date(list.created_at).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>{list.created_by}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                list.status === "completed" ? "default" :
                                list.status === "approved" ? "default" :
                                list.status === "pending" ? "secondary" :
                                "outline"
                              }
                            >
                              {list.status === "pending" ? "Pendente" :
                               list.status === "approved" ? "Aprovada" :
                               list.status === "completed" ? "Concluida" :
                               list.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(list.total_estimated)}</TableCell>
                          <TableCell>{formatCurrency(list.total_actual)}</TableCell>
                          <TableCell>{list.approved_by || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Suppliers Tab */}
          <TabsContent value="suppliers" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Fornecedores</CardTitle>
                    <CardDescription>
                      Lista de fornecedores para cotacao
                    </CardDescription>
                  </div>
                  <Button onClick={openCreateSupplier}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Fornecedor
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {suppliers.map((supplier) => (
                    <Card key={supplier.id} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium">{supplier.name}</div>
                            <Badge variant="outline" className="mt-1">
                              {getCategoryLabel(supplier.category)}
                            </Badge>
                            {supplier.phone && (
                              <div className="text-sm text-muted-foreground mt-2">
                                Tel: {supplier.phone}
                              </div>
                            )}
                            {supplier.notes && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {supplier.notes}
                              </div>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditSupplier(supplier)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleDeleteSupplier(supplier)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Consumption Dialog */}
        <Dialog open={consumptionDialog} onOpenChange={setConsumptionDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Consumo</DialogTitle>
              <DialogDescription>
                {selectedProduct && (
                  <>
                    Produto: <strong>{selectedProduct.name}</strong>
                    <br />
                    Estoque atual: {selectedProduct.current_stock} {selectedProduct.unit}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Quantidade consumida</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setConsumptionQty(Math.max(1, consumptionQty - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    value={consumptionQty}
                    onChange={(e) => setConsumptionQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 text-center"
                    min={1}
                    max={selectedProduct?.current_stock || 999}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setConsumptionQty(Math.min(selectedProduct?.current_stock || 999, consumptionQty + 1))}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <span className="text-muted-foreground">
                    {selectedProduct?.unit}
                  </span>
                </div>
              </div>

              {selectedProduct && consumptionQty > selectedProduct.current_stock && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  Quantidade maior que o estoque disponivel!
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setConsumptionDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleConsumption}
                disabled={submitting || !selectedProduct || consumptionQty > (selectedProduct?.current_stock || 0)}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirmar Baixa
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Product Create/Edit Dialog */}
        <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? "Editar Produto" : "Novo Produto"}
              </DialogTitle>
              <DialogDescription>
                {editingProduct ? "Atualize as informacoes do produto" : "Cadastre um novo produto no estoque"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="product-name">Nome do Produto *</Label>
                <Input
                  id="product-name"
                  value={productForm.name}
                  onChange={(e) => setProductForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Detergente Ype"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="product-category">Categoria</Label>
                  <Select
                    value={productForm.category}
                    onValueChange={(value) => setProductForm(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.filter(c => c.value !== "all").map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product-unit">Unidade</Label>
                  <Select
                    value={productForm.unit}
                    onValueChange={(value) => setProductForm(prev => ({ ...prev, unit: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="un">Unidade</SelectItem>
                      <SelectItem value="pct">Pacote</SelectItem>
                      <SelectItem value="cx">Caixa</SelectItem>
                      <SelectItem value="kg">Quilograma</SelectItem>
                      <SelectItem value="l">Litro</SelectItem>
                      <SelectItem value="resma">Resma</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="product-stock">Estoque Atual</Label>
                  <Input
                    id="product-stock"
                    type="number"
                    min={0}
                    value={productForm.current_stock}
                    onChange={(e) => setProductForm(prev => ({ ...prev, current_stock: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-min">Estoque Min.</Label>
                  <Input
                    id="product-min"
                    type="number"
                    min={0}
                    value={productForm.minimum_stock}
                    onChange={(e) => setProductForm(prev => ({ ...prev, minimum_stock: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-max">Estoque Max.</Label>
                  <Input
                    id="product-max"
                    type="number"
                    min={0}
                    value={productForm.maximum_stock}
                    onChange={(e) => setProductForm(prev => ({ ...prev, maximum_stock: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-price">Ultimo Preco de Compra (R$)</Label>
                <Input
                  id="product-price"
                  type="number"
                  min={0}
                  step={0.01}
                  value={productForm.last_purchase_price}
                  onChange={(e) => setProductForm(prev => ({ ...prev, last_purchase_price: parseFloat(e.target.value) || 0 }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-supplier">Fornecedor Preferencial</Label>
                <Select
                  value={productForm.preferred_supplier}
                  onValueChange={(value) => setProductForm(prev => ({ ...prev, preferred_supplier: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {suppliers.map(sup => (
                      <SelectItem key={sup.id} value={sup.name}>
                        {sup.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowProductDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveProduct} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {editingProduct ? "Salvar" : "Criar Produto"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Supplier Create/Edit Dialog */}
        <Dialog open={showSupplierDialog} onOpenChange={setShowSupplierDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}
              </DialogTitle>
              <DialogDescription>
                {editingSupplier ? "Atualize as informacoes do fornecedor" : "Cadastre um novo fornecedor"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="supplier-name">Nome do Fornecedor *</Label>
                <Input
                  id="supplier-name"
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Atacadao"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier-category">Categoria Principal</Label>
                <Select
                  value={supplierForm.category}
                  onValueChange={(value) => setSupplierForm(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c.value !== "all").map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier-phone">Telefone</Label>
                <Input
                  id="supplier-phone"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(62) 99999-9999"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier-notes">Observacoes</Label>
                <Input
                  id="supplier-notes"
                  value={supplierForm.notes}
                  onChange={(e) => setSupplierForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Ex: Melhor preco em limpeza"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSupplierDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveSupplier} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {editingSupplier ? "Salvar" : "Criar Fornecedor"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Product AlertDialog */}
        <AlertDialog open={showDeleteProductDialog} onOpenChange={setShowDeleteProductDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desativar Produto</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja desativar o produto "{productToDelete?.name}"?
                O produto nao sera excluido permanentemente e pode ser reativado depois.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteProduct}
                className="bg-red-600 hover:bg-red-700"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Desativar"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Supplier AlertDialog */}
        <AlertDialog open={showDeleteSupplierDialog} onOpenChange={setShowDeleteSupplierDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desativar Fornecedor</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja desativar o fornecedor "{supplierToDelete?.name}"?
                O fornecedor nao sera excluido permanentemente e pode ser reativado depois.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteSupplier}
                className="bg-red-600 hover:bg-red-700"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Desativar"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default Inventory;
