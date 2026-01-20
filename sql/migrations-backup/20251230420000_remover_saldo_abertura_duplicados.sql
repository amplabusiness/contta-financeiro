-- Remover duplicados de SALDO_ABERTURA (contas a receber)
-- Total: 33 lancamentos duplicados

DELETE FROM accounting_entries
WHERE id IN (
    '982ea656-192e-43dc-b09c-2380e928cde5',
    '27e5c3dd-5ddf-4673-82f0-517731e7238b',
    'ec35ea4e-c00e-4597-be36-f1f781df75d6',
    '7d606d38-4a54-46e1-931a-b583a97247a9',
    '167286e5-9b75-4ab5-b14f-31b2ba85343a',
    '292a9d99-f10d-44e8-a0c6-0d99fc2f4ccf',
    '60a4d6cc-c0e3-45f5-bc6a-c7cd0f81db85',
    'f9649891-5469-42b6-bfb8-7c5fb1e33cc5',
    'd5e6864f-261d-4106-af3d-f93e277a9aee',
    '9d8c3a65-0252-4aa3-b76b-b8e621326442',
    '14c8b391-7b2f-4b2b-94c7-f926a5cd3d10',
    '54b380e6-6486-4471-a019-38c8fc384763',
    '2c0bfed7-1b11-4eb4-a04e-f7713a2fa700',
    '97248925-e51b-46cd-89ce-831c0b63630a',
    '57ceae81-d985-4973-86e5-2f8d1132d637',
    '62958005-68c6-4f0d-85f0-63849c66ffd2',
    '10c7997a-267a-4088-ae9a-06ccc4f4953a',
    'c5b6e3ad-aaaa-4820-81e0-d78d9eb40f82',
    '0606a283-95d1-48cc-819b-599117b6c0ae',
    '129a61f6-412c-40e8-a898-e7a8a1dcc4b2',
    '34986bba-0090-4b6e-bf83-f62628ee5693',
    'e77d31f1-c2c1-4419-bfc2-3c55ad153988',
    'c2f44dfe-6f8e-43ee-b824-02b2652e3c69',
    'b045481c-0a5e-4a5c-8002-cc77a87ea9ec',
    '400563ff-cc25-4896-82cc-518fb8847dd4',
    'b36d1ad9-9bc2-4f6e-919f-99f1b58e91c2',
    '7840dbc8-125f-423f-bc58-e05ee07f1c01',
    '2a7104a7-3995-4e0a-9b37-392d7cab47d0',
    '0a6fbd1d-ce46-408c-978b-1f58fbaf74cf',
    '5599f324-25f3-48fc-8fc7-311b8175e5fe',
    '693d4b4c-7893-4cff-8732-3ed1d54f7f43',
    '36d4169f-0cf3-4fd3-8c08-71cc7be15b1c',
    '1a1fb3cb-aa44-4680-a420-4b5ec31ebe7c'
);

COMMENT ON TABLE accounting_entries IS 'Lancamentos Jan/2025 - Duplicados SALDO_ABERTURA removidos.';
