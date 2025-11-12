export const expensesData = {
  november: {
    faturamento: 118282.72,
    repasse: 2071.76,
    juros: 221.76,
    totalRecebido: 113693.81,
    aReceber: 4588.91,
    totalSaidas: 171831.61,
    sergio: {
      total: 77890.99,
      items: [
        { name: "Água", value: 326.78 },
        { name: "Personal", value: 800.00 },
        { name: "Condomínio Galeria", value: 1140.88 },
        { name: "Condomínio Lago", value: 2357.33 },
        { name: "Condomínio Mundi", value: 3610.46 },
        { name: "Energia", value: 699.02 },
        { name: "Gás", value: 45.82 },
        { name: "Internet", value: 106.58 },
        { name: "IPTU", value: 585.34 },
        { name: "Obras Lago", value: 44668.03 },
        { name: "Plano de Saúde", value: 4344.32 },
        { name: "Tharson Diego", value: 19206.43 },
      ],
    },
    ampla: {
      total: 93940.62,
      contasFixas: 28480.87,
      impostos: 12445.56,
      contasVariaveis: 2266.27,
      servicosTerceiros: 32495.72,
      folhaPagamento: 17531.73,
      materialConsumo: 720.47,
    },
    resultado: 19753.19,
  },
  december: {
    faturamento: 118582.72,
    repasse: 2071.76,
    juros: 403.34,
    totalRecebido: 111649.76,
    aReceber: 6932.96,
    totalSaidas: 167835.62,
    sergio: {
      total: 35750.81,
      items: [
        { name: "Água", value: 264.86 },
        { name: "Personal", value: 800.00 },
        { name: "Condomínio Galeria", value: 1068.00 },
        { name: "Condomínio Lago", value: 3488.62 },
        { name: "Condomínio Mundi", value: 3372.33 },
        { name: "Energia", value: 672.50 },
        { name: "Gás", value: 32.13 },
        { name: "Internet", value: 103.65 },
        { name: "IPTU", value: 585.34 },
        { name: "Obras Lago", value: 11153.90 },
        { name: "Plano de Saúde", value: 4434.32 },
        { name: "Tharson Diego", value: 9775.16 },
      ],
    },
    ampla: {
      total: 132084.81,
      contasFixas: 58266.67,
      impostos: 13453.38,
      contasVariaveis: 4949.11,
      servicosTerceiros: 32888.55,
      folhaPagamento: 20677.13,
      materialConsumo: 1849.97,
    },
    resultado: -20435.05,
  },
  honorarios287: {
    november: {
      faturamento: 113578.45,
      recebido: 113578.45,
      empresas: [
        { name: "Action", faturamento: 2440658.67, honorario: 70046.90 },
        { name: "Ipê Comércio", faturamento: 483324.21, honorario: 13871.40 },
        { name: "Mata Pragras", faturamento: 1033454.45, honorario: 29660.14 },
      ],
    },
    december: {
      faturamento: 129235.83,
      recebido: 82582.22,
      aReceber: 46653.61,
      empresas: [
        { name: "Action", faturamento: 2604939.97, honorario: 74761.78 },
        { name: "Ipê Comércio", faturamento: 272489.46, honorario: 7820.45 },
        { name: "Mata Pragras", faturamento: 1625561.17, honorario: 46653.61 },
      ],
    },
  },
};

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export const formatPercentage = (value: number) => {
  return `${value.toFixed(2)}%`;
};
