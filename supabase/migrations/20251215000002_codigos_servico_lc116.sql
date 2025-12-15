-- =====================================================
-- TABELA DE CÓDIGOS DE SERVIÇO - LEI COMPLEMENTAR 116/2003
-- Lista de Serviços Anexa à LC 116
-- =====================================================

CREATE TABLE IF NOT EXISTS codigos_servico_lc116 (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(10) NOT NULL UNIQUE,
    descricao TEXT NOT NULL,
    cnae_principal VARCHAR(10),
    aliquota_minima DECIMAL(5,4) DEFAULT 0.02,
    aliquota_maxima DECIMAL(5,4) DEFAULT 0.05,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_codigos_servico_codigo ON codigos_servico_lc116(codigo);
CREATE INDEX IF NOT EXISTS idx_codigos_servico_ativo ON codigos_servico_lc116(ativo);

-- =====================================================
-- INSERÇÃO DOS CÓDIGOS DA LC 116/2003
-- Lista completa de serviços sujeitos ao ISS
-- =====================================================

INSERT INTO codigos_servico_lc116 (codigo, descricao, cnae_principal) VALUES
-- 1 – SERVIÇOS DE INFORMÁTICA E CONGÊNERES
('1.01', 'Análise e desenvolvimento de sistemas', '6201500'),
('1.02', 'Programação', '6201500'),
('1.03', 'Processamento, armazenamento ou hospedagem de dados, textos, imagens, vídeos, páginas eletrônicas, aplicativos e sistemas de informação, entre outros formatos, e congêneres', '6311900'),
('1.04', 'Elaboração de programas de computadores, inclusive de jogos eletrônicos, independentemente da arquitetura construtiva da máquina em que o programa será executado, incluindo tablets, smartphones e congêneres', '6201500'),
('1.05', 'Licenciamento ou cessão de direito de uso de programas de computação', '6203100'),
('1.06', 'Assessoria e consultoria em informática', '6204000'),
('1.07', 'Suporte técnico em informática, inclusive instalação, configuração e manutenção de programas de computação e bancos de dados', '6209100'),
('1.08', 'Planejamento, confecção, manutenção e atualização de páginas eletrônicas', '6319400'),
('1.09', 'Disponibilização, sem cessão definitiva, de conteúdos de áudio, vídeo, imagem e texto por meio da internet, respeitada a imunidade de livros, jornais e periódicos', '6319400'),

-- 2 – SERVIÇOS DE PESQUISAS E DESENVOLVIMENTO DE QUALQUER NATUREZA
('2.01', 'Serviços de pesquisas e desenvolvimento de qualquer natureza', '7210000'),

-- 3 – SERVIÇOS PRESTADOS MEDIANTE LOCAÇÃO, CESSÃO DE DIREITO DE USO E CONGÊNERES
('3.02', 'Cessão de direito de uso de marcas e de sinais de propaganda', '7740300'),
('3.03', 'Exploração de salões de festas, centro de convenções, escritórios virtuais, stands, quadras esportivas, estádios, ginásios, auditórios, casas de espetáculos, parques de diversões, canchas e congêneres, para realização de eventos ou negócios de qualquer natureza', '8230001'),
('3.04', 'Locação, sublocação, arrendamento, direito de passagem ou permissão de uso, compartilhado ou não, de ferrovia, rodovia, postes, cabos, dutos e condutos de qualquer natureza', '5212500'),
('3.05', 'Cessão de andaimes, palcos, coberturas e outras estruturas de uso temporário', '7739099'),

-- 4 – SERVIÇOS DE SAÚDE, ASSISTÊNCIA MÉDICA E CONGÊNERES
('4.01', 'Medicina e biomedicina', '8610101'),
('4.02', 'Análises clínicas, patologia, eletricidade médica, radioterapia, quimioterapia, ultra-sonografia, ressonância magnética, radiologia, tomografia e congêneres', '8640201'),
('4.03', 'Hospitais, clínicas, laboratórios, sanatórios, manicômios, casas de saúde, prontos-socorros, ambulatórios e congêneres', '8610102'),
('4.04', 'Instrumentação cirúrgica', '8650001'),
('4.05', 'Acupuntura', '8650003'),
('4.06', 'Enfermagem, inclusive serviços auxiliares', '8650002'),
('4.07', 'Serviços farmacêuticos', '4771701'),
('4.08', 'Terapia ocupacional, fisioterapia e fonoaudiologia', '8650004'),
('4.09', 'Terapias de qualquer espécie destinadas ao tratamento físico, orgânico e mental', '8650099'),
('4.10', 'Nutrição', '8650005'),
('4.11', 'Obstetrícia', '8610101'),
('4.12', 'Odontologia', '8630501'),
('4.13', 'Ortóptica', '8650099'),
('4.14', 'Próteses sob encomenda', '3250706'),
('4.15', 'Psicanálise', '8650006'),
('4.16', 'Psicologia', '8650006'),
('4.17', 'Casas de repouso e de recuperação, creches, asilos e congêneres', '8711501'),
('4.18', 'Inseminação artificial, fertilização in vitro e congêneres', '8610102'),
('4.19', 'Bancos de sangue, leite, pele, olhos, óvulos, sêmen e congêneres', '8640209'),
('4.20', 'Coleta de sangue, leite, tecidos, sêmen, órgãos e materiais biológicos de qualquer espécie', '8640209'),
('4.21', 'Unidade de atendimento, assistência ou tratamento móvel e congêneres', '8621601'),
('4.22', 'Planos de medicina de grupo ou individual e convênios para prestação de assistência médica, hospitalar, odontológica e congêneres', '6550200'),
('4.23', 'Outros planos de saúde que se cumpram através de serviços de terceiros contratados, credenciados, cooperados ou apenas pagos pelo operador do plano mediante indicação do beneficiário', '6550200'),

-- 5 – SERVIÇOS DE MEDICINA E ASSISTÊNCIA VETERINÁRIA E CONGÊNERES
('5.01', 'Medicina veterinária e zootecnia', '7500100'),
('5.02', 'Hospitais, clínicas, ambulatórios, prontos-socorros e congêneres, na área veterinária', '7500100'),
('5.03', 'Laboratórios de análise na área veterinária', '7500100'),
('5.04', 'Inseminação artificial, fertilização in vitro e congêneres', '7500100'),
('5.05', 'Bancos de sangue e de órgãos e congêneres', '7500100'),
('5.06', 'Coleta de sangue, leite, tecidos, sêmen, órgãos e materiais biológicos de qualquer espécie', '7500100'),
('5.07', 'Unidade de atendimento, assistência ou tratamento móvel e congêneres', '7500100'),
('5.08', 'Guarda, tratamento, amestramento, embelezamento, alojamento e congêneres', '9609202'),
('5.09', 'Planos de atendimento e assistência médico-veterinária', '7500100'),

-- 6 – SERVIÇOS DE CUIDADOS PESSOAIS, ESTÉTICA, ATIVIDADES FÍSICAS E CONGÊNERES
('6.01', 'Barbearia, cabeleireiros, manicuros, pedicuros e congêneres', '9602501'),
('6.02', 'Esteticistas, tratamento de pele, depilação e congêneres', '9602502'),
('6.03', 'Banhos, duchas, sauna, massagens e congêneres', '9609204'),
('6.04', 'Ginástica, dança, esportes, natação, artes marciais e demais atividades físicas', '9313100'),
('6.05', 'Centros de emagrecimento, spa e congêneres', '9609299'),
('6.06', 'Aplicação de tatuagens, piercings e congêneres', '9609206'),

-- 7 – SERVIÇOS RELATIVOS A ENGENHARIA, ARQUITETURA, GEOLOGIA, URBANISMO, CONSTRUÇÃO CIVIL, MANUTENÇÃO, LIMPEZA, MEIO AMBIENTE, SANEAMENTO E CONGÊNERES
('7.01', 'Engenharia, agronomia, agrimensura, arquitetura, geologia, urbanismo, paisagismo e congêneres', '7112000'),
('7.02', 'Execução, por administração, empreitada ou subempreitada, de obras de construção civil, hidráulica ou elétrica e de outras obras semelhantes, inclusive sondagem, perfuração de poços, escavação, drenagem e irrigação, terraplanagem, pavimentação, concretagem e a instalação e montagem de produtos, peças e equipamentos', '4120400'),
('7.03', 'Elaboração de planos diretores, estudos de viabilidade, estudos organizacionais e outros, relacionados com obras e serviços de engenharia; elaboração de anteprojetos, projetos básicos e projetos executivos para trabalhos de engenharia', '7112000'),
('7.04', 'Demolição', '4311801'),
('7.05', 'Reparação, conservação e reforma de edifícios, estradas, pontes, portos e congêneres', '4399199'),
('7.06', 'Colocação e instalação de tapetes, carpetes, assoalhos, cortinas, revestimentos de parede, vidros, divisórias, placas de gesso e congêneres, com material fornecido pelo tomador do serviço', '4330404'),
('7.07', 'Recuperação, raspagem, polimento e lustração de pisos e congêneres', '4330499'),
('7.08', 'Calafetação', '4330499'),
('7.09', 'Varrição, coleta, remoção, incineração, tratamento, reciclagem, separação e destinação final de lixo, rejeitos e outros resíduos quaisquer', '3811400'),
('7.10', 'Limpeza, manutenção e conservação de vias e logradouros públicos, imóveis, chaminés, piscinas, parques, jardins e congêneres', '8121400'),
('7.11', 'Decoração e jardinagem, inclusive corte e poda de árvores', '8130300'),
('7.12', 'Controle e tratamento de efluentes de qualquer natureza e de agentes físicos, químicos e biológicos', '3702900'),
('7.13', 'Dedetização, desinfecção, desinsetização, imunização, higienização, desratização, pulverização e congêneres', '8122200'),
('7.16', 'Florestamento, reflorestamento, semeadura, adubação, reparação de solo, plantio, silagem, colheita, corte e descascamento de árvores, silvicultura, exploração florestal e dos serviços congêneres indissociáveis da formação, manutenção e colheita de florestas', '0210108'),
('7.17', 'Escoramento, contenção de encostas e serviços congêneres', '4399103'),
('7.18', 'Limpeza e dragagem de rios, portos, canais, baías, lagos, lagoas, represas, açudes e congêneres', '4313400'),
('7.19', 'Acompanhamento e fiscalização da execução de obras de engenharia, arquitetura e urbanismo', '7112000'),
('7.20', 'Aerofotogrametria (inclusive interpretação), cartografia, mapeamento, levantamentos topográficos, batimétricos, geográficos, geodésicos, geológicos, geofísicos e congêneres', '7119701'),
('7.21', 'Pesquisa, perfuração, cimentação, mergulho, perfilagem, concretação, testemunhagem, pescaria, estimulação e outros serviços relacionados com a exploração e explotação de petróleo, gás natural e de outros recursos minerais', '0910600'),
('7.22', 'Nucleação e bombardeamento de nuvens e congêneres', '7490199'),

-- 8 – SERVIÇOS DE EDUCAÇÃO, ENSINO, ORIENTAÇÃO PEDAGÓGICA E EDUCACIONAL, INSTRUÇÃO, TREINAMENTO E AVALIAÇÃO PESSOAL DE QUALQUER GRAU OU NATUREZA
('8.01', 'Ensino regular pré-escolar, fundamental, médio e superior', '8512100'),
('8.02', 'Instrução, treinamento, orientação pedagógica e educacional, avaliação de conhecimentos de qualquer natureza', '8599603'),

-- 9 – SERVIÇOS RELATIVOS A HOSPEDAGEM, TURISMO, VIAGENS E CONGÊNERES
('9.01', 'Hospedagem de qualquer natureza em hotéis, apart-service condominiais, flat, apart-hotéis, hotéis residência, residence-service, suite service, hotelaria marítima, motéis, pensões e congêneres; ocupação por temporada com fornecimento de serviço', '5510801'),
('9.02', 'Agenciamento, organização, promoção, intermediação e execução de programas de turismo, passeios, viagens, excursões, hospedagens e congêneres', '7911200'),
('9.03', 'Guias de turismo', '7912100'),

-- 10 – SERVIÇOS DE INTERMEDIAÇÃO E CONGÊNERES
('10.01', 'Agenciamento, corretagem ou intermediação de câmbio, de seguros, de cartões de crédito, de planos de saúde e de planos de previdência privada', '6622300'),
('10.02', 'Agenciamento, corretagem ou intermediação de títulos em geral, valores mobiliários e contratos quaisquer', '6612601'),
('10.03', 'Agenciamento, corretagem ou intermediação de direitos de propriedade industrial, artística ou literária', '7490103'),
('10.04', 'Agenciamento, corretagem ou intermediação de contratos de arrendamento mercantil (leasing), de franquia (franchising) e de faturização (factoring)', '6612605'),
('10.05', 'Agenciamento, corretagem ou intermediação de bens móveis ou imóveis, não abrangidos em outros itens ou subitens, inclusive aqueles realizados no âmbito de Bolsas de Mercadorias e Futuros, por quaisquer meios', '6821801'),
('10.06', 'Agenciamento marítimo', '5231101'),
('10.07', 'Agenciamento de notícias', '6391700'),
('10.08', 'Agenciamento de publicidade e propaganda, inclusive o agenciamento de veiculação por quaisquer meios', '7311400'),
('10.09', 'Representação de qualquer natureza, inclusive comercial', '7490104'),
('10.10', 'Distribuição de bens de terceiros', '4619200'),

-- 11 – SERVIÇOS DE GUARDA, ESTACIONAMENTO, ARMAZENAMENTO, VIGILÂNCIA E CONGÊNERES
('11.01', 'Guarda e estacionamento de veículos terrestres automotores, de aeronaves e de embarcações', '5223100'),
('11.02', 'Vigilância, segurança ou monitoramento de bens, pessoas e semoventes', '8011101'),
('11.03', 'Escolta, inclusive de veículos e cargas', '8011102'),
('11.04', 'Armazenamento, depósito, carga, descarga, arrumação e guarda de bens de qualquer espécie', '5211701'),

-- 12 – SERVIÇOS DE DIVERSÕES, LAZER, ENTRETENIMENTO E CONGÊNERES
('12.01', 'Espetáculos teatrais', '9001901'),
('12.02', 'Exibições cinematográficas', '5914600'),
('12.03', 'Espetáculos circenses', '9001903'),
('12.04', 'Programas de auditório', '6021700'),
('12.05', 'Parques de diversões, centros de lazer e congêneres', '9321200'),
('12.06', 'Boates, taxi-dancing e congêneres', '9329801'),
('12.07', 'Shows, ballet, danças, desfiles, bailes, óperas, concertos, recitais, festivais e congêneres', '9001999'),
('12.08', 'Feiras, exposições, congressos e congêneres', '8230002'),
('12.09', 'Bilhares, boliches e diversões eletrônicas ou não', '9329804'),
('12.10', 'Corridas e competições de animais', '9319199'),
('12.11', 'Competições esportivas ou de destreza física ou intelectual, com ou sem a participação do espectador', '9311500'),
('12.12', 'Execução de música', '9001902'),
('12.13', 'Produção, mediante ou sem encomenda prévia, de eventos, espetáculos, entrevistas, shows, ballet, danças, desfiles, bailes, teatros, óperas, concertos, recitais, festivais e congêneres', '9001999'),
('12.14', 'Fornecimento de música para ambientes fechados ou não, mediante transmissão por qualquer processo', '9001902'),
('12.15', 'Desfiles de blocos carnavalescos ou folclóricos, trios elétricos e congêneres', '9329899'),
('12.16', 'Exibição de filmes, entrevistas, musicais, espetáculos, shows, concertos, desfiles, óperas, competições esportivas, de destreza intelectual ou congêneres', '6021700'),
('12.17', 'Recreação e animação, inclusive em festas e eventos de qualquer natureza', '9329899'),

-- 13 – SERVIÇOS RELATIVOS A FONOGRAFIA, FOTOGRAFIA, CINEMATOGRAFIA E REPROGRAFIA
('13.02', 'Fonografia ou gravação de sons, inclusive trucagem, dublagem, mixagem e congêneres', '5920100'),
('13.03', 'Fotografia e cinematografia, inclusive revelação, ampliação, cópia, reprodução, trucagem e congêneres', '7420001'),
('13.04', 'Reprografia, microfilmagem e digitalização', '8219999'),
('13.05', 'Composição gráfica, inclusive confecção de impressos gráficos, fotocomposição, clicheria, zincografia, litografia e fotolitografia, exceto se destinados a posterior operação de comercialização ou industrialização, ainda que incorporados, de qualquer forma, a outra mercadoria que deva ser objeto de posterior circulação', '1811301'),

-- 14 – SERVIÇOS RELATIVOS A BENS DE TERCEIROS
('14.01', 'Lubrificação, limpeza, lustração, revisão, carga e recarga, conserto, restauração, blindagem, manutenção e conservação de máquinas, veículos, aparelhos, equipamentos, motores, elevadores ou de qualquer objeto', '4520001'),
('14.02', 'Assistência técnica', '9512600'),
('14.03', 'Recondicionamento de motores', '2950600'),
('14.04', 'Recauchutagem ou regeneração de pneus', '2212900'),
('14.05', 'Restauração, recondicionamento, acondicionamento, pintura, beneficiamento, lavagem, secagem, tingimento, galvanoplastia, anodização, corte, recorte, plastificação, costura, acabamento, polimento e congêneres de objetos quaisquer', '9601701'),
('14.06', 'Instalação e montagem de aparelhos, máquinas e equipamentos, inclusive montagem industrial, prestados ao usuário final, exclusivamente com material por ele fornecido', '3321000'),
('14.07', 'Colocação de molduras e congêneres', '3299099'),
('14.08', 'Encadernação, gravação e douração de livros, revistas e congêneres', '1821100'),
('14.09', 'Alfaiataria e costura, quando o material for fornecido pelo usuário final, exceto aviamento', '1412602'),
('14.10', 'Tinturaria e lavanderia', '9601702'),
('14.11', 'Tapeçaria e reforma de estofamentos em geral', '9529105'),
('14.12', 'Funilaria e lanternagem', '4520005'),
('14.13', 'Carpintaria e serralheria', '4330403'),
('14.14', 'Guincho intramunicipal, currentíssima e reboque de veículos', '5229099'),

-- 15 – SERVIÇOS RELACIONADOS AO SETOR BANCÁRIO OU FINANCEIRO
('15.01', 'Administração de fundos quaisquer, de consórcio, de cartão de crédito ou débito e congêneres, de carteira de clientes, de cheques pré-datados e congêneres', '6499999'),
('15.02', 'Abertura de contas em geral, inclusive conta-corrente, conta de investimentos e aplicação e caderneta de poupança, no País e no exterior, bem como a manutenção das referidas contas ativas e inativas', '6422100'),
('15.03', 'Locação e manutenção de cofres particulares, de terminais eletrônicos, de terminais de atendimento e de bens e equipamentos em geral', '6422100'),
('15.04', 'Fornecimento ou emissão de atestados em geral, inclusive atestado de idoneidade, atestado de capacidade financeira e congêneres', '6422100'),
('15.05', 'Cadastro, elaboração de ficha cadastral, renovação cadastral e congêneres, inclusão ou exclusão no Cadastro de Emitentes de Cheques sem Fundos – CCF ou em quaisquer outros bancos cadastrais', '6422100'),
('15.06', 'Emissão, reemissão e fornecimento de avisos, comprovantes e documentos em geral; abono de firmas; coleta e entrega de documentos, bens e valores; comunicação com outra agência ou com a administração central; licenciamento eletrônico de veículos; transferência de veículos; agenciamento fiduciário ou depositário; devolução de bens em custódia', '6422100'),
('15.07', 'Acesso, movimentação, atendimento e consulta a contas em geral, por qualquer meio ou processo, inclusive por telefone, fac-símile, internet e telex, acesso a terminais de atendimento, inclusive vinte e quatro horas; acesso a outro banco e a rede compartilhada; fornecimento de saldo, extrato e demais informações relativas a contas em geral, por qualquer meio ou processo', '6422100'),
('15.08', 'Emissão, reemissão, alteração, cessão, substituição, cancelamento e registro de contrato de crédito; estudo, análise e avaliação de operações de crédito; emissão, concessão, alteração ou contratação de aval, fiança, anuência e congêneres; serviços relativos a abertura de crédito, para quaisquer fins', '6422100'),
('15.09', 'Arrendamento mercantil (leasing) de quaisquer bens, inclusive cessão de direitos e obrigações, substituição de garantia, alteração, cancelamento e registro de contrato, e demais serviços relacionados ao arrendamento mercantil (leasing)', '6440900'),
('15.10', 'Serviços relacionados a cobranças, recebimentos ou pagamentos em geral, de títulos quaisquer, de contas ou carnês, de câmbio, de tributos e por conta de terceiros, inclusive os efetuados por meio eletrônico, automático ou por máquinas de atendimento; fornecimento de posição de cobrança, recebimento ou pagamento; emissão de carnês, fichas de compensação, impressos e documentos em geral', '6422100'),
('15.11', 'Devolução de títulos, protesto de títulos, sustação de protesto, manutenção de títulos, reapresentação de títulos, e demais serviços a eles relacionados', '6422100'),
('15.12', 'Custódia em geral, inclusive de títulos e valores mobiliários', '6612603'),
('15.13', 'Serviços relacionados a operações de câmbio em geral, edição, alteração, prorrogação, cancelamento e baixa de contrato de câmbio; emissão de registro de exportação ou de crédito; cobrança ou depósito no exterior; emissão, fornecimento e cancelamento de cheques de viagem; fornecimento, transferência, cancelamento e demais serviços relativos a carta de crédito de importação, exportação e garantias recebidas; envio e recebimento de mensagens em geral relacionadas a operações de câmbio', '6422100'),
('15.14', 'Fornecimento, emissão, reemissão, renovação e manutenção de cartão magnético, cartão de crédito, cartão de débito, cartão salário e congêneres', '6422100'),
('15.15', 'Compensação de cheques e títulos quaisquer; serviços relacionados a depósito, inclusive depósito identificado, a saque de contas quaisquer, por qualquer meio ou processo, inclusive em terminais eletrônicos e de atendimento', '6422100'),
('15.16', 'Emissão, reemissão, liquidação, alteração, cancelamento e baixa de ordens de pagamento, ordens de crédito e similares, por qualquer meio ou processo; serviços relacionados à transferência de valores, dados, fundos, pagamentos e similares, inclusive entre contas em geral', '6422100'),
('15.17', 'Emissão, fornecimento, devolução, sustação, cancelamento e oposição de cheques quaisquer, avulso ou por talão', '6422100'),
('15.18', 'Serviços relacionados a crédito imobiliário, avaliação e vistoria de imóvel ou obra, análise técnica e jurídica, emissão, reemissão, alteração, transferência e renegociação de contrato, emissão e reemissão do termo de quitação e demais serviços relacionados a crédito imobiliário', '6422100'),

-- 16 – SERVIÇOS DE TRANSPORTE DE NATUREZA MUNICIPAL
('16.01', 'Serviços de transporte coletivo municipal rodoviário, metroviário, ferroviário e aquaviário de passageiros', '4921301'),
('16.02', 'Outros serviços de transporte de natureza municipal', '4930202'),

-- 17 – SERVIÇOS DE APOIO TÉCNICO, ADMINISTRATIVO, JURÍDICO, CONTÁBIL, COMERCIAL E CONGÊNERES
('17.01', 'Assessoria ou consultoria de qualquer natureza, não contida em outros itens desta lista; análise, exame, pesquisa, coleta, compilação e fornecimento de dados e informações de qualquer natureza, inclusive cadastro e similares', '7020400'),
('17.02', 'Datilografia, digitação, estenografia, expediente, secretaria em geral, resposta audível, redação, edição, interpretação, revisão, tradução, apoio e infra-estrutura administrativa e congêneres', '8211300'),
('17.03', 'Planejamento, coordenação, programação ou organização técnica, financeira ou administrativa', '7020400'),
('17.04', 'Recrutamento, agenciamento, seleção e colocação de mão-de-obra', '7810800'),
('17.05', 'Fornecimento de mão-de-obra, mesmo em caráter temporário, inclusive de empregados ou trabalhadores, avulsos ou temporários, contratados pelo prestador de serviço', '7820500'),
('17.06', 'Propaganda e publicidade, inclusive promoção de vendas, planejamento de campanhas ou sistemas de publicidade, elaboração de desenhos, textos e demais materiais publicitários', '7311400'),
('17.07', 'Franquia (franchising)', '7740300'),
('17.08', 'Perícias, laudos, exames técnicos e análises técnicas', '7490101'),
('17.09', 'Planejamento, organização e administração de feiras, exposições, congressos e congêneres', '8230002'),
('17.10', 'Organização de festas e recepções; bufê (exceto o fornecimento de alimentação e bebidas, que fica sujeito ao ICMS)', '5620102'),
('17.11', 'Administração em geral, inclusive de bens e negócios de terceiros', '8299799'),
('17.12', 'Leilão e congêneres', '8299704'),
('17.13', 'Advocacia', '6911701'),
('17.14', 'Arbitragem de qualquer espécie, inclusive jurídica', '6911703'),
('17.15', 'Auditoria', '6920601'),
('17.16', 'Análise de Organização e Métodos', '7020400'),
('17.17', 'Atuária e cálculos técnicos de qualquer natureza', '6621502'),
('17.18', 'Contabilidade, inclusive serviços técnicos e auxiliares', '6920602'),
('17.19', 'Consultoria e assessoria econômica ou financeira', '7020400'),
('17.20', 'Estatística', '6399200'),
('17.21', 'Cobrança em geral', '8291100'),
('17.22', 'Assessoria, análise, avaliação, atendimento, consulta, cadastro, seleção, gerenciamento de informações, administração de contas a receber ou a pagar e em geral, relacionados a operações de faturização (factoring)', '6499999'),
('17.23', 'Apresentação de palestras, conferências, seminários e congêneres', '8230002'),
('17.24', 'Inserção de textos, desenhos e outros materiais de propaganda e publicidade, em qualquer meio', '7319002'),
('17.25', 'Serviços de apoio e infraestrutura administrativa e congêneres', '8211300'),

-- 18 – SERVIÇOS DE REGULAÇÃO DE SINISTROS VINCULADOS A CONTRATOS DE SEGUROS; INSPEÇÃO E AVALIAÇÃO DE RISCOS PARA COBERTURA DE CONTRATOS DE SEGUROS; PREVENÇÃO E GERÊNCIA DE RISCOS SEGURÁVEIS E CONGÊNERES
('18.01', 'Serviços de regulação de sinistros vinculados a contratos de seguros; inspeção e avaliação de riscos para cobertura de contratos de seguros; prevenção e gerência de riscos seguráveis e congêneres', '6621501'),

-- 19 – SERVIÇOS DE DISTRIBUIÇÃO E VENDA DE BILHETES E DEMAIS PRODUTOS DE LOTERIA, BINGOS, CARTÕES, PULES OU CUPONS DE APOSTAS, SORTEIOS, PRÊMIOS, INCLUSIVE OS DECORRENTES DE TÍTULOS DE CAPITALIZAÇÃO E CONGÊNERES
('19.01', 'Serviços de distribuição e venda de bilhetes e demais produtos de loteria, bingos, cartões, pules ou cupons de apostas, sorteios, prêmios, inclusive os decorrentes de títulos de capitalização e congêneres', '9200301'),

-- 20 – SERVIÇOS PORTUÁRIOS, AEROPORTUÁRIOS, FERROPORTUÁRIOS, DE TERMINAIS RODOVIÁRIOS, FERROVIÁRIOS E METROVIÁRIOS
('20.01', 'Serviços portuários, ferroportuários, utilização de porto, movimentação de passageiros, reboque de embarcações, rebocador escoteiro, atracação, desatracação, serviços de praticagem, capatazia, armazenagem de qualquer natureza, serviços acessórios, movimentação de mercadorias, serviços de apoio marítimo, de movimentação ao largo, serviços de armadores, estiva, conferência, logística e congêneres', '5231102'),
('20.02', 'Serviços aeroportuários, utilização de aeroporto, movimentação de passageiros, armazenagem de qualquer natureza, capatazia, movimentação de aeronaves, serviços de apoio aeroportuários, serviços acessórios, movimentação de mercadorias, logística e congêneres', '5240101'),
('20.03', 'Serviços de terminais rodoviários, ferroviários, metroviários, movimentação de passageiros, mercadorias, inclusive suas operações, logística e congêneres', '5222200'),

-- 21 – SERVIÇOS DE REGISTROS PÚBLICOS, CARTORÁRIOS E NOTARIAIS
('21.01', 'Serviços de registros públicos, cartorários e notariais', '6912500'),

-- 22 – SERVIÇOS DE EXPLORAÇÃO DE RODOVIA
('22.01', 'Serviços de exploração de rodovia mediante cobrança de preço ou pedágio dos usuários, envolvendo execução de serviços de conservação, manutenção, melhoramentos para adequação de capacidade e segurança de trânsito, operação, monitoração, assistência aos usuários e outros serviços definidos em contratos, atos de concessão ou de permissão ou em normas oficiais', '5221400'),

-- 23 – SERVIÇOS DE PROGRAMAÇÃO E COMUNICAÇÃO VISUAL, DESENHO INDUSTRIAL E CONGÊNERES
('23.01', 'Serviços de programação e comunicação visual, desenho industrial e congêneres', '7410201'),

-- 24 – SERVIÇOS DE CHAVEIROS, CONFECÇÃO DE CARIMBOS, PLACAS, SINALIZAÇÃO VISUAL, BANNERS, ADESIVOS E CONGÊNERES
('24.01', 'Serviços de chaveiros, confecção de carimbos, placas, sinalização visual, banners, adesivos e congêneres', '8299706'),

-- 25 – SERVIÇOS FUNERÁRIOS
('25.01', 'Funerais, inclusive fornecimento de caixão, urna ou esquife; aluguel de capela; transporte do corpo cadavérico; fornecimento de flores, coroas e outros paramentos; desembaraço de certidão de óbito; fornecimento de véu, essa e outros adornos; embalsamento, embelezamento, conservação ou restauração de cadáveres', '9603301'),
('25.02', 'Translado intramunicipal e cremação de corpos e partes de corpos cadavéricos', '9603399'),
('25.03', 'Planos ou convênio funerários', '9603303'),
('25.04', 'Manutenção e conservação de jazigos e cemitérios', '9603304'),
('25.05', 'Cessão de uso de espaços em cemitérios para sepultamento', '9603304'),

-- 26 – SERVIÇOS DE COLETA, REMESSA OU ENTREGA DE CORRESPONDÊNCIAS, DOCUMENTOS, OBJETOS, BENS OU VALORES, INCLUSIVE PELOS CORREIOS E SUAS AGÊNCIAS FRANQUEADAS; COURRIER E CONGÊNERES
('26.01', 'Serviços de coleta, remessa ou entrega de correspondências, documentos, objetos, bens ou valores, inclusive pelos correios e suas agências franqueadas; courrier e congêneres', '5320202'),

-- 27 – SERVIÇOS DE ASSISTÊNCIA SOCIAL
('27.01', 'Serviços de assistência social', '8800600'),

-- 28 – SERVIÇOS DE AVALIAÇÃO DE BENS E SERVIÇOS DE QUALQUER NATUREZA
('28.01', 'Serviços de avaliação de bens e serviços de qualquer natureza', '6821802'),

-- 29 – SERVIÇOS DE BIBLIOTECONOMIA
('29.01', 'Serviços de biblioteconomia', '9101500'),

-- 30 – SERVIÇOS DE BIOLOGIA, BIOTECNOLOGIA E QUÍMICA
('30.01', 'Serviços de biologia, biotecnologia e química', '7210000'),

-- 31 – SERVIÇOS TÉCNICOS EM EDIFICAÇÕES, ELETRÔNICA, ELETROTÉCNICA, MECÂNICA, TELECOMUNICAÇÕES E CONGÊNERES
('31.01', 'Serviços técnicos em edificações, eletrônica, eletrotécnica, mecânica, telecomunicações e congêneres', '7119702'),

-- 32 – SERVIÇOS DE DESENHOS TÉCNICOS
('32.01', 'Serviços de desenhos técnicos', '7119704'),

-- 33 – SERVIÇOS DE DESEMBARAÇO ADUANEIRO, COMISSÁRIOS, DESPACHANTES E CONGÊNERES
('33.01', 'Serviços de desembaraço aduaneiro, comissários, despachantes e congêneres', '5250802'),

-- 34 – SERVIÇOS DE INVESTIGAÇÕES PARTICULARES, DETETIVES E CONGÊNERES
('34.01', 'Serviços de investigações particulares, detetives e congêneres', '8030700'),

-- 35 – SERVIÇOS DE REPORTAGEM, ASSESSORIA DE IMPRENSA, JORNALISMO E RELAÇÕES PÚBLICAS
('35.01', 'Serviços de reportagem, assessoria de imprensa, jornalismo e relações públicas', '7021000'),

-- 36 – SERVIÇOS DE METEOROLOGIA
('36.01', 'Serviços de meteorologia', '7490199'),

-- 37 – SERVIÇOS DE ARTISTAS, ATLETAS, MODELOS E MANEQUINS
('37.01', 'Serviços de artistas, atletas, modelos e manequins', '9002702'),

-- 38 – SERVIÇOS DE MUSEOLOGIA
('38.01', 'Serviços de museologia', '9102301'),

-- 39 – SERVIÇOS DE OURIVESARIA E LAPIDAÇÃO
('39.01', 'Serviços de ourivesaria e lapidação (quando o material for fornecido pelo tomador do serviço)', '3211601'),

-- 40 – SERVIÇOS RELATIVOS A OBRAS DE ARTE SOB ENCOMENDA
('40.01', 'Obras de arte sob encomenda', '9003500')

ON CONFLICT (codigo) DO NOTHING;

-- Comentários
COMMENT ON TABLE codigos_servico_lc116 IS 'Códigos de serviço da Lei Complementar 116/2003 - Lista de serviços sujeitos ao ISS';
COMMENT ON COLUMN codigos_servico_lc116.codigo IS 'Código do item de serviço (ex: 17.18)';
COMMENT ON COLUMN codigos_servico_lc116.descricao IS 'Descrição completa do serviço';
COMMENT ON COLUMN codigos_servico_lc116.cnae_principal IS 'CNAE principal relacionado ao serviço';
