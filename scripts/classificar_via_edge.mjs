import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function classificar() {
  const url = process.env.VITE_SUPABASE_URL + '/functions/v1/dr-cicero-brain';
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  console.log('🔗 Chamando Dr. Cícero Brain...');
  console.log('URL:', url);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key
    },
    body: JSON.stringify({
      action: 'classify_transaction',
      transaction: {
        id: '3113deff-7b93-41d7-b00a-f4f288fba413',
        description: 'CESTA DE RELACIONAMENTO-',
        amount: -59.28,
        date: '2025-02-05',
        type: 'saida'
      }
    })
  });

  const result = await response.json();
  console.log('');
  console.log('📋 Resultado do Dr. Cícero:');
  console.log(JSON.stringify(result, null, 2));
}

classificar().catch(console.error);
