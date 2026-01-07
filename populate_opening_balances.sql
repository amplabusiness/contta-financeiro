-- Script gerado para popular client_opening_balance
-- Baseado em _raw_opening_balances.txt
BEGIN;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '12/2025', 
            1412.0, 
            '2026-01-09', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'CENTRO MEDICO MILHOMEM LTDA%'
        OR name ILIKE '%CENTRO MEDICO MILHOMEM LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '12/2025', 
            1518.0, 
            '2026-01-04', 
            'paid', 
            1518.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'PET SHOP E CAOPANHIA LTDA%'
        OR name ILIKE '%PET SHOP E CAOPANHIA LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '12/2025', 
            2182.01, 
            '2026-01-04', 
            'paid', 
            2182.01, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'FAZENDA DA TOCA PARTICIPACOES LTDA%'
        OR name ILIKE '%FAZENDA DA TOCA PARTICIPACOES LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '12/2025', 
            2897.9, 
            '2026-01-04', 
            'paid', 
            2897.9, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'MARO - INVESTIMENTOS E PARTICIPACOES S/A%'
        OR name ILIKE '%MARO - INVESTIMENTOS E PARTICIPACOES S/A%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '12/2024', 
            713.38, 
            '2025-01-09', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'RESTAURANTE IUVACI LTDA ME%'
        OR name ILIKE '%RESTAURANTE IUVACI LTDA ME%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '12/2024', 
            713.38, 
            '2025-01-09', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'RESTAURANTE IUVACI LTDA ME%'
        OR name ILIKE '%RESTAURANTE IUVACI LTDA ME%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '12/2024', 
            1051.4, 
            '2025-01-09', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'TIMES NEGOCIOS IMOBILIARIOS LTDA ME%'
        OR name ILIKE '%TIMES NEGOCIOS IMOBILIARIOS LTDA ME%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '12/2024', 
            1051.46, 
            '2025-01-04', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'TIMES NEGOCIOS IMOBILIARIOS LTDA ME%'
        OR name ILIKE '%TIMES NEGOCIOS IMOBILIARIOS LTDA ME%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '12/2024', 
            2118.07, 
            '2025-01-09', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'VERDI E ECD EMPREENDIMENTOS IMOBILIARIOS SPE LTDA%'
        OR name ILIKE '%VERDI E ECD EMPREENDIMENTOS IMOBILIARIOS SPE LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '12/2024', 
            2118.07, 
            '2025-01-09', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'VERDI E ECD EMPREENDIMENTOS IMOBILIARIOS SPE LTDA%'
        OR name ILIKE '%VERDI E ECD EMPREENDIMENTOS IMOBILIARIOS SPE LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '12/2024', 
            1412.0, 
            '2024-12-04', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'CENTRO MEDICO MILHOMEM LTDA%'
        OR name ILIKE '%CENTRO MEDICO MILHOMEM LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '12/2024', 
            932.05, 
            '2025-01-04', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'PM ADMINISTRACAO E SERVICOS LTDA%'
        OR name ILIKE '%PM ADMINISTRACAO E SERVICOS LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '12/2024', 
            932.05, 
            '2025-01-04', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'PM ADMINISTRACAO E SERVICOS LTDA%'
        OR name ILIKE '%PM ADMINISTRACAO E SERVICOS LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '12/2024', 
            647.5, 
            '2025-01-09', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'KORSICA COMERCIO ATACADISTA DE PNEUS LTDA ME%'
        OR name ILIKE '%KORSICA COMERCIO ATACADISTA DE PNEUS LTDA ME%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '12/2024', 
            706.0, 
            '2025-01-09', 
            'paid', 
            706.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'MINERACAO SERRANO LTDA%'
        OR name ILIKE '%MINERACAO SERRANO LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '12/2024', 
            275.98, 
            '2024-12-19', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'JULLYANA MENDONCA RODRIGUES SILVA%'
        OR name ILIKE '%JULLYANA MENDONCA RODRIGUES SILVA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '12/2024', 
            275.98, 
            '2024-12-19', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'JULLYANA MENDONCA RODRIGUES SILVA%'
        OR name ILIKE '%JULLYANA MENDONCA RODRIGUES SILVA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '12/2024', 
            1604.67, 
            '2024-12-19', 
            'paid', 
            1604.67, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'UNICAIXAS DESPACHANTE LTDA%'
        OR name ILIKE '%UNICAIXAS DESPACHANTE LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '12/2024', 
            706.0, 
            '2025-01-09', 
            'paid', 
            706.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'MINERACAO SERRANO LTDA%'
        OR name ILIKE '%MINERACAO SERRANO LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            549.21, 
            '2025-12-04', 
            'paid', 
            549.21, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'PORTO FINO MAQUINAS LTDA%'
        OR name ILIKE '%PORTO FINO MAQUINAS LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            383.35, 
            '2025-12-14', 
            'paid', 
            383.35, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'LEM ESCOLA DE IDIOMAS LTDA%'
        OR name ILIKE '%LEM ESCOLA DE IDIOMAS LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            586.79, 
            '2025-12-09', 
            'paid', 
            586.79, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'MV LG CLINICA VETERINARIA PET FERA LTDA%'
        OR name ILIKE '%MV LG CLINICA VETERINARIA PET FERA LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            1022.58, 
            '2025-12-04', 
            'paid', 
            1022.58, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'PM ADMINISTRACAO E SERVICOS LTDA%'
        OR name ILIKE '%PM ADMINISTRACAO E SERVICOS LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            997.08, 
            '2025-12-09', 
            'paid', 
            997.08, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'HOLDINGS BCS GUIMARAES LTDA%'
        OR name ILIKE '%HOLDINGS BCS GUIMARAES LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            997.08, 
            '2025-12-09', 
            'paid', 
            997.08, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'DR BERNARDO GUIMARAES LTDA%'
        OR name ILIKE '%DR BERNARDO GUIMARAES LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            1549.27, 
            '2025-12-04', 
            'paid', 
            1549.27, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'CENTRO MEDICO MILHOMEM LTDA%'
        OR name ILIKE '%CENTRO MEDICO MILHOMEM LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            997.08, 
            '2025-12-09', 
            'paid', 
            997.08, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'BCS MINAS SERVICOS MEDICOS LTDA%'
        OR name ILIKE '%BCS MINAS SERVICOS MEDICOS LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            997.08, 
            '2025-12-09', 
            'paid', 
            997.08, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'BCS GOIAS SERVICOS MEDICOS LTDA%'
        OR name ILIKE '%BCS GOIAS SERVICOS MEDICOS LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            774.55, 
            '2025-12-04', 
            'paid', 
            774.55, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'RAMAYOLE CASA DOS SALGADOS EIRELI - ME%'
        OR name ILIKE '%RAMAYOLE CASA DOS SALGADOS EIRELI - ME%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            616.06, 
            '2025-12-04', 
            'paid', 
            616.06, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'LIVRE VISTORIA VEICULAR LTDA - ME%'
        OR name ILIKE '%LIVRE VISTORIA VEICULAR LTDA - ME%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            548.46, 
            '2025-12-04', 
            'paid', 
            548.46, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'AGROPECUARIA SCA LTDA%'
        OR name ILIKE '%AGROPECUARIA SCA LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            548.46, 
            '2025-12-04', 
            'paid', 
            548.46, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'AGROPECUARIA ADM LTDA%'
        OR name ILIKE '%AGROPECUARIA ADM LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            275.98, 
            '2025-12-14', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'JULLYANA MENDONCA RODRIGUES SILVA%'
        OR name ILIKE '%JULLYANA MENDONCA RODRIGUES SILVA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            3036.0, 
            '2025-12-09', 
            'paid', 
            3036.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'MARIAH PARTICIPACOES LTDA%'
        OR name ILIKE '%MARIAH PARTICIPACOES LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            759.0, 
            '2025-12-09', 
            'paid', 
            759.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'SHARKSAPACE GASTRO PARK LTDA%'
        OR name ILIKE '%SHARKSAPACE GASTRO PARK LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            2182.01, 
            '2025-12-04', 
            'paid', 
            2182.01, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'FAZENDA DA TOCA PARTICIPACOES LTDA%'
        OR name ILIKE '%FAZENDA DA TOCA PARTICIPACOES LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            330.0, 
            '2025-12-09', 
            'paid', 
            330.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'LOPES CONSULTORIA LTDA%'
        OR name ILIKE '%LOPES CONSULTORIA LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            1518.0, 
            '2025-12-04', 
            'paid', 
            1518.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'ALLIANCE EMPREENDIMENTOS LTDA%'
        OR name ILIKE '%ALLIANCE EMPREENDIMENTOS LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            485.77, 
            '2025-12-04', 
            'paid', 
            485.77, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'DIAS FERNANDES ELETRODOMESTICOS LTDA%'
        OR name ILIKE '%DIAS FERNANDES ELETRODOMESTICOS LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            1138.48, 
            '2025-12-04', 
            'paid', 
            1138.48, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'LAJES MORADA LTDA%'
        OR name ILIKE '%LAJES MORADA LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            322.5, 
            '2025-12-04', 
            'paid', 
            322.5, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'NUNES MOTA AGROPECUARIA LTDA%'
        OR name ILIKE '%NUNES MOTA AGROPECUARIA LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            759.0, 
            '2025-12-04', 
            'paid', 
            759.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'AMAGU FESTAS LTDA%'
        OR name ILIKE '%AMAGU FESTAS LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            603.73, 
            '2025-12-04', 
            'paid', 
            603.73, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'CDC PLAYGROUND E BRINQUEDOS LTDA%'
        OR name ILIKE '%CDC PLAYGROUND E BRINQUEDOS LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            322.5, 
            '2025-12-04', 
            'paid', 
            322.5, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'ELETROSOL SOLUCOES EM ENERGIA LTDA%'
        OR name ILIKE '%ELETROSOL SOLUCOES EM ENERGIA LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            172.5, 
            '2025-12-04', 
            'paid', 
            172.5, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'MARCUS ABDULMASSIH DEL PAPA%'
        OR name ILIKE '%MARCUS ABDULMASSIH DEL PAPA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            766.88, 
            '2025-12-04', 
            'paid', 
            766.88, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'WESLEY MARTINS DE MOURA ME%'
        OR name ILIKE '%WESLEY MARTINS DE MOURA ME%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            759.0, 
            '2025-12-09', 
            'paid', 
            759.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'CANAL PET DISTRIBUIDORA LTDA%'
        OR name ILIKE '%CANAL PET DISTRIBUIDORA LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            963.1, 
            '2025-12-09', 
            'paid', 
            963.1, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'EXPRESS RIOVERDENSE LTDA%'
        OR name ILIKE '%EXPRESS RIOVERDENSE LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            860.0, 
            '2025-12-09', 
            'paid', 
            860.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'MARIO CESAR PEREIRA DA SILVA%'
        OR name ILIKE '%MARIO CESAR PEREIRA DA SILVA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            759.0, 
            '2025-12-19', 
            'paid', 
            759.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'SHARKSAPACE GASTRO PARK LTDA%'
        OR name ILIKE '%SHARKSAPACE GASTRO PARK LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            4346.3, 
            '2025-12-19', 
            'paid', 
            4346.3, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'JPL AGROPECUARIA LTDA%'
        OR name ILIKE '%JPL AGROPECUARIA LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            1500.0, 
            '2025-12-20', 
            'paid', 
            1500.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'ANAPOLIS SERVICOS DE VISTORIAS LTDA%'
        OR name ILIKE '%ANAPOLIS SERVICOS DE VISTORIAS LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            759.0, 
            '2025-12-19', 
            'paid', 
            759.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'ARANTES NEGOCIOS LTDA%'
        OR name ILIKE '%ARANTES NEGOCIOS LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            603.73, 
            '2025-12-19', 
            'paid', 
            603.73, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'CDC PLAYGROUND E BRINQUEDOS LTDA%'
        OR name ILIKE '%CDC PLAYGROUND E BRINQUEDOS LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            322.5, 
            '2025-12-19', 
            'paid', 
            322.5, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'ELETROSOL SOLUCOES EM ENERGIA LTDA%'
        OR name ILIKE '%ELETROSOL SOLUCOES EM ENERGIA LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            1138.48, 
            '2025-12-19', 
            'paid', 
            1138.48, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'LAJES MORADA LTDA%'
        OR name ILIKE '%LAJES MORADA LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            860.0, 
            '2025-12-19', 
            'paid', 
            860.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'MARIO CESAR PEREIRA DA SILVA%'
        OR name ILIKE '%MARIO CESAR PEREIRA DA SILVA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            574.96, 
            '2025-12-19', 
            'paid', 
            574.96, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'MV LG CLINICA VETERINARIA PET FERA LTDA%'
        OR name ILIKE '%MV LG CLINICA VETERINARIA PET FERA LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            724.88, 
            '2025-12-21', 
            'paid', 
            724.88, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'SOLUTTI TECNOLOGIA LTDA%'
        OR name ILIKE '%SOLUTTI TECNOLOGIA LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            322.5, 
            '2025-12-04', 
            'paid', 
            322.5, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'ELETROSOL ENERGIA SOLAR LTDA%'
        OR name ILIKE '%ELETROSOL ENERGIA SOLAR LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            100.0, 
            '2025-12-04', 
            'paid', 
            100.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'TAISSA TORMIN MUNDIM%'
        OR name ILIKE '%TAISSA TORMIN MUNDIM%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            250.0, 
            '2025-12-09', 
            'paid', 
            250.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'LEMS HOLDINGS LTDA%'
        OR name ILIKE '%LEMS HOLDINGS LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            12143.72, 
            '2025-12-09', 
            'paid', 
            12143.72, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'ACTION SOLUCOES INDUSTRIAIS LTDA%'
        OR name ILIKE '%ACTION SOLUCOES INDUSTRIAIS LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            759.0, 
            '2025-12-09', 
            'paid', 
            759.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'CASA NOVA TINTAS LTDA%'
        OR name ILIKE '%CASA NOVA TINTAS LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            759.0, 
            '2025-12-09', 
            'paid', 
            759.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'JULIANO SOUZA GARROTE%'
        OR name ILIKE '%JULIANO SOUZA GARROTE%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            375.73, 
            '2025-12-19', 
            'paid', 
            375.73, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'AMETISTA GESTAO EMPRESARIAL LTDA%'
        OR name ILIKE '%AMETISTA GESTAO EMPRESARIAL LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            16728.51, 
            '2025-12-19', 
            'paid', 
            16728.51, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'KOPA REVESTIMENTOS DE MADEIRAS LTDA%'
        OR name ILIKE '%KOPA REVESTIMENTOS DE MADEIRAS LTDA%'
        LIMIT 1;

INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            25550.8, 
            '2025-12-09', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'AMG INDUSTRIA E COMERCIO DE GESSO LTDA%'
        OR name ILIKE '%AMG INDUSTRIA E COMERCIO DE GESSO LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            7605.25, 
            '2025-12-09', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'JJC PRESTADORA DE SERVICOS LTDA%'
        OR name ILIKE '%JJC PRESTADORA DE SERVICOS LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            3795.0, 
            '2025-12-09', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'ACAI DO MADRUGA CAMPINAS LTDA%'
        OR name ILIKE '%ACAI DO MADRUGA CAMPINAS LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            1782.0, 
            '2025-12-09', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'CARLA DAIANE CASTRO OLIVEIRA%'
        OR name ILIKE '%CARLA DAIANE CASTRO OLIVEIRA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            1377.75, 
            '2025-12-09', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'MARIO LUCIO PINHEIRO MILAZZO - FAZ%'
        OR name ILIKE '%MARIO LUCIO PINHEIRO MILAZZO - FAZ%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            29229.44, 
            '2025-12-09', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'SUITE MOTEL LTDA ME%'
        OR name ILIKE '%SUITE MOTEL LTDA ME%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            45102.0, 
            '2025-12-09', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'AVIZ ALIMENTOS LTDA%'
        OR name ILIKE '%AVIZ ALIMENTOS LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            7109.4, 
            '2025-12-09', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'STAR EMPORIO DE BEBIDAS LTDA%'
        OR name ILIKE '%STAR EMPORIO DE BEBIDAS LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            8349.0, 
            '2025-12-09', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'TANNUS E MOTA LTDA%'
        OR name ILIKE '%TANNUS E MOTA LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            7015.8, 
            '2025-12-09', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'COMERCIAL DINIZ EIRELI - ME%'
        OR name ILIKE '%COMERCIAL DINIZ EIRELI - ME%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            1725.0, 
            '2025-12-04', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'TEREZA CRISTINA DA SILVA PAES FERREIRA%'
        OR name ILIKE '%TEREZA CRISTINA DA SILVA PAES FERREIRA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            7605.93, 
            '2025-12-09', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'CONTRONWEB TECNOLOGIA LTDA%'
        OR name ILIKE '%CONTRONWEB TECNOLOGIA LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            6379.84, 
            '2025-12-09', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'DEL PAPA ARQUITETURA LTDA%'
        OR name ILIKE '%DEL PAPA ARQUITETURA LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            4569.25, 
            '2025-12-09', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'M.M LANCHES LTDA%'
        OR name ILIKE '%M.M LANCHES LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            32010.48, 
            '2025-12-09', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'MATA PRAGAS CONTROLE DE PRAGAS LTDA%'
        OR name ILIKE '%MATA PRAGAS CONTROLE DE PRAGAS LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            1500.0, 
            '2025-12-04', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'ROSELIS TORMIN MUNDIM - FAZENDA%'
        OR name ILIKE '%ROSELIS TORMIN MUNDIM - FAZENDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            1548.73, 
            '2025-11-09', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'MEDITERRANE SERVICOS DE COWORKING LTDA%'
        OR name ILIKE '%MEDITERRANE SERVICOS DE COWORKING LTDA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            9314.73, 
            '2025-12-09', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'C D C OLIVEIRA - ESTACAO DA ALEGRIA%'
        OR name ILIKE '%C D C OLIVEIRA - ESTACAO DA ALEGRIA%'
        LIMIT 1;
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '11/2025', 
            256.73, 
            '2025-12-09', 
            'pending', 
            0.0, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE 'C.R.J MANUTENCAO EM AR CONDICIONADO%'
        OR name ILIKE '%C.R.J MANUTENCAO EM AR CONDICIONADO%'
        LIMIT 1;
COMMIT;