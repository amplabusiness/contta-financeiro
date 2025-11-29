# Instrução para VSCode/Claude

## Tarefa: Fazer Merge do Branch para Main

### Branch a ser mergeado:
```
claude/analyze-claude-config-01DwBx8AxYbXpiRF9R4aamLo
```

### Destino:
```
main
```

### O que está no branch:
1. **AINetwork.tsx** - Página de visualização de rede neural com 21 agentes de IA
2. **BusinessManager.tsx** - Gestor Empresarial IA com treinamento MBA
3. **AIAccountantWidget.tsx** - Widget do Contador IA no dashboard
4. **Documentação .claude** atualizada com ecossistema completo de IA

### Comandos para executar:

```bash
# 1. Buscar branch main atualizado
git fetch origin main

# 2. Checkout para main
git checkout main

# 3. Fazer merge do branch feature
git merge claude/analyze-claude-config-01DwBx8AxYbXpiRF9R4aamLo --no-edit

# 4. Resolver conflitos se houver (usar versão do branch feature)
# Se houver conflitos:
git checkout --theirs <arquivo_conflitante>
git add <arquivo_conflitante>

# 5. Push para main
git push origin main
```

### Se o push para main falhar com 403:
O branch main está protegido. Opções:
1. Criar PR via GitHub interface
2. Desabilitar proteção temporariamente em Settings > Branches
3. Usar `gh pr create` e `gh pr merge`

### Novas funcionalidades incluídas:
- `/ai-network` - Rede Neural de IA (visualização)
- `/business-manager` - Gestor Empresarial IA
- Menu "Rede Neural IA" em Ferramentas
- 21 Edge Functions de IA documentadas

### Prioridade: ALTA
O usuário quer ver essas mudanças em produção.
