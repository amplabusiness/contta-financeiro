-- Adicionar campos para clientes pro-bono
ALTER TABLE clients 
ADD COLUMN is_pro_bono BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN pro_bono_start_date DATE,
ADD COLUMN pro_bono_end_date DATE,
ADD COLUMN pro_bono_reason TEXT;

-- Comentários para documentação
COMMENT ON COLUMN clients.is_pro_bono IS 'Indica se o cliente é atendido gratuitamente';
COMMENT ON COLUMN clients.pro_bono_start_date IS 'Data de início do período gratuito';
COMMENT ON COLUMN clients.pro_bono_end_date IS 'Data de fim do período gratuito';
COMMENT ON COLUMN clients.pro_bono_reason IS 'Motivo/justificativa para o atendimento pro-bono';